import { randomUUID } from 'crypto';
import { fetchLatestVideo } from './apify';
import { fetchTranscript } from './transcript';
import { rewriteUntilAccurate } from './rewrite';
import { generateSeoMetadata } from './seo';
import { normalizeText, createTtsJob, pollTtsJob, ttsDownloadUrl, VOICE_NAME } from './voice-generator';
import { isProcessed, getProcessed, saveProcessed, saveRun } from './turso';
import { jobStore } from './job-store';
import type { PipelineEvent, PipelineJob, PipelineStep } from '@/types/pipeline';

export const DEFAULT_CHANNEL = 'colonbina1';

export function startPipeline(channelHandle = DEFAULT_CHANNEL): string {
  const id = randomUUID();
  const now = new Date().toISOString();
  const job: PipelineJob = {
    id,
    status: 'running',
    channelHandle,
    videoId: null,
    videoTitle: null,
    videoUrl: null,
    accuracyScore: null,
    audioUrl: null,
    transcript: null,
    script: null,
    seo: null,
    alreadyProcessed: false,
    error: null,
    startedAt: now,
    finishedAt: null,
    events: [],
  };
  jobStore.create(job);
  void runPipeline(id, channelHandle);
  return id;
}

function emit(
  jobId: string,
  step: PipelineStep,
  status: PipelineEvent['status'],
  message: string,
  data?: Record<string, unknown>,
): void {
  jobStore.emit(jobId, { ts: new Date().toISOString(), step, status, message, data });
}

async function runPipeline(jobId: string, channelHandle: string): Promise<void> {
  try {
    emit(jobId, 'fetch-latest', 'started', `Fetching latest video from @${channelHandle}`);
    const latest = await fetchLatestVideo(channelHandle);
    jobStore.update(jobId, {
      videoId: latest.videoId,
      videoTitle: latest.title,
      videoUrl: latest.url,
    });
    emit(jobId, 'fetch-latest', 'completed', `Latest: ${latest.title}`, {
      videoId: latest.videoId,
      url: latest.url,
      publishedAt: latest.publishedAt,
    });

    emit(jobId, 'dedupe', 'started', 'Checking Turso for prior runs');
    if (await isProcessed(latest.videoId)) {
      const prior = await getProcessed(latest.videoId);
      jobStore.update(jobId, {
        status: 'skipped',
        alreadyProcessed: true,
        accuracyScore: prior?.accuracy_score ?? null,
        audioUrl: prior?.audio_url ?? null,
        finishedAt: new Date().toISOString(),
      });
      emit(jobId, 'dedupe', 'skipped', 'Latest video already processed; nothing to do', {
        processedAt: prior?.processed_at,
        audioUrl: prior?.audio_url,
        accuracyScore: prior?.accuracy_score,
      });
      emit(jobId, 'done', 'completed', 'Already processed - skipped');
      return;
    }
    emit(jobId, 'dedupe', 'completed', 'New video; proceeding');

    emit(jobId, 'transcript', 'started', 'Fetching transcript');
    const { title, transcript } = await fetchTranscript(latest.url);
    const resolvedTitle = title || latest.title;
    jobStore.update(jobId, { videoTitle: resolvedTitle, transcript });
    emit(jobId, 'transcript', 'completed', `Transcript fetched (${transcript.length} chars)`, {
      title: resolvedTitle,
    });

    emit(jobId, 'rewrite', 'started', 'Rewriting via Perplexity (target ≥90% accuracy)');
    const outcome = await rewriteUntilAccurate(transcript, resolvedTitle, {
      onAttempt: (attempt, accuracy) => {
        emit(
          jobId,
          'rewrite',
          'progress',
          `Attempt ${attempt}: accuracy ${accuracy.score}% (${accuracy.issues.length} issue(s))`,
          {
            attempt,
            score: accuracy.score,
            issueCount: accuracy.issues.length,
            issues: accuracy.issues.slice(0, 5).map((i) => ({
              category: i.category,
              quote: i.quote.slice(0, 120),
              fix: i.fix.slice(0, 120),
            })),
          },
        );
      },
    });
    jobStore.update(jobId, {
      accuracyScore: outcome.finalAccuracy.score,
      script: outcome.finalScript,
    });
    emit(
      jobId,
      'rewrite',
      'completed',
      `Final accuracy ${outcome.finalAccuracy.score}% after ${outcome.attempts.length} attempt(s)${outcome.reachedThreshold ? '' : ' (below threshold; using best)'}`,
      {
        score: outcome.finalAccuracy.score,
        attempts: outcome.attempts.length,
        reachedThreshold: outcome.reachedThreshold,
      },
    );

    emit(jobId, 'seo', 'started', 'Generating SEO titles, description, tags');
    const seo = await generateSeoMetadata(outcome.finalScript, resolvedTitle);
    jobStore.update(jobId, { seo });
    emit(
      jobId,
      'seo',
      'completed',
      `${seo.titles.length} titles · ${seo.tags.length} tags · ${seo.description.length}-char description`,
      { titles: seo.titles, tagCount: seo.tags.length },
    );

    emit(jobId, 'normalize', 'started', 'Normalizing for TTS');
    const normalized = await normalizeText(outcome.finalScript);
    emit(jobId, 'normalize', 'completed', `Normalized (${normalized.length} chars)`);

    emit(jobId, 'tts-create', 'started', `Creating TTS job (${VOICE_NAME})`);
    const ttsJobId = await createTtsJob(normalized);
    emit(jobId, 'tts-create', 'completed', `TTS job ${ttsJobId} accepted`, { ttsJobId });

    emit(jobId, 'tts-poll', 'started', 'Polling TTS job');
    let lastStatus = '';
    await pollTtsJob(ttsJobId, (s) => {
      if (s.status !== lastStatus) {
        lastStatus = s.status;
        emit(jobId, 'tts-poll', 'progress', `Status: ${s.status}`, {
          status: s.status,
          progress: s.progress,
        });
      }
    });
    const audioUrl = ttsDownloadUrl(ttsJobId);
    jobStore.update(jobId, { audioUrl });
    emit(jobId, 'tts-poll', 'completed', 'Audio ready', { audioUrl });

    emit(jobId, 'persist', 'started', 'Saving to Turso');
    await saveProcessed({
      video_id: latest.videoId,
      channel_handle: channelHandle,
      title: resolvedTitle,
      accuracy_score: outcome.finalAccuracy.score,
      audio_url: audioUrl,
      script: outcome.finalScript,
    });
    emit(jobId, 'persist', 'completed', 'Saved');

    jobStore.update(jobId, { status: 'completed', finishedAt: new Date().toISOString() });
    emit(jobId, 'done', 'completed', 'Pipeline complete');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    jobStore.update(jobId, {
      status: 'failed',
      error: message,
      finishedAt: new Date().toISOString(),
    });
    emit(jobId, 'done', 'failed', message);
  } finally {
    const final = jobStore.get(jobId);
    if (final) {
      try {
        await saveRun({
          job_id: final.id,
          channel_handle: final.channelHandle,
          video_id: final.videoId,
          video_url: final.videoUrl,
          video_title: final.videoTitle,
          status: final.status,
          already_processed: final.alreadyProcessed,
          accuracy_score: final.accuracyScore,
          audio_url: final.audioUrl,
          transcript: final.transcript,
          script: final.script,
          seo_json: final.seo ? JSON.stringify(final.seo) : null,
          error: final.error,
          started_at: final.startedAt,
          finished_at: final.finishedAt,
        });
      } catch (saveErr) {
        console.error('saveRun failed', saveErr);
      }
    }
  }
}

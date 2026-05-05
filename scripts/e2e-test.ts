import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { catalogSources } from '../lib/cataloger';
import { planSequence } from '../lib/director';
import { pollRender, startRender } from '../lib/render';
import { listScenesForJob, listSequencePlans } from '../lib/director-store';
import { putBuffer } from '../lib/storage/s3';
import { s3Key } from '../lib/storage/aws';

const LOCAL_SAMPLE =
  '/Users/avoaja/Documents/mine/youtube/helpers/service/video-generation-service/assets/video/WhatsApp Video 2026-04-16 at 12.24.28.mp4';
const AUDIO_URL =
  'https://voice-generator-service-production.up.railway.app/tts/jobs/bfa05d7d-5dfc-4df4-9814-8eec026aa2c8/download';
const AUDIO_TRIM_SECONDS = 30;

function run(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ['ignore', 'ignore', 'ignore'] });
    p.on('error', reject);
    p.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`${bin} exited ${code}`)),
    );
  });
}

async function pexelsSearch(): Promise<string[]> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return [];
  const res = await fetch(
    'https://api.pexels.com/videos/search?query=rocket+launch&per_page=4&size=small',
    { headers: { Authorization: key } },
  );
  if (!res.ok) return [];
  const j = (await res.json()) as {
    videos: Array<{
      video_files: Array<{ link: string; width: number; quality: string; file_type: string }>;
    }>;
  };
  const urls: string[] = [];
  for (const v of j.videos) {
    const sd = v.video_files
      .filter((f) => f.file_type === 'video/mp4' && f.width && f.width <= 960)
      .sort((a, b) => a.width - b.width)[0];
    if (sd?.link) urls.push(sd.link);
    if (urls.length >= 2) break;
  }
  return urls;
}

async function downloadTo(url: string, file: string): Promise<void> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${url}: ${r.status}`);
  await writeFile(file, Buffer.from(await r.arrayBuffer()));
}

async function uploadFile(
  prefix: 'sources' | 'audio',
  filename: string,
  filePath: string,
  contentType: string,
): Promise<{ key: string; url: string }> {
  const buf = await readFile(filePath);
  const key = s3Key(prefix, `e2e/${filename}`);
  return putBuffer(key, buf, contentType);
}

async function main() {
  const jobId = `e2e-${Date.now()}`;
  console.log(`[e2e] jobId=${jobId}`);
  const work = await mkdtemp(path.join(tmpdir(), 'e2e-'));

  try {
    let sourceFiles: string[] = [];
    const pexelsUrls = await pexelsSearch();
    if (pexelsUrls.length >= 2) {
      console.log(`[e2e] pexels: using ${pexelsUrls.length} video(s)`);
      for (let i = 0; i < 2; i++) {
        const f = path.join(work, `pexels-${i}.mp4`);
        await downloadTo(pexelsUrls[i], f);
        sourceFiles.push(f);
      }
    } else {
      console.log('[e2e] pexels: no PEXELS_API_KEY — using local sample, trimmed into two segments');
      if (!existsSync(LOCAL_SAMPLE)) {
        throw new Error(`local sample missing: ${LOCAL_SAMPLE}`);
      }
      const a = path.join(work, 'src-a.mp4');
      const b = path.join(work, 'src-b.mp4');
      // sample is ~7.5s; split into two halves
      await run('ffmpeg', ['-y', '-ss', '0', '-i', LOCAL_SAMPLE, '-t', '3.5', '-c', 'copy', a]);
      await run('ffmpeg', ['-y', '-ss', '3.5', '-i', LOCAL_SAMPLE, '-t', '4', '-c', 'copy', b]);
      sourceFiles = [a, b];
    }

    console.log('[e2e] uploading sources to S3 …');
    const uploaded = await Promise.all(
      sourceFiles.map((f, i) =>
        uploadFile('sources', `${jobId}-src-${i}.mp4`, f, 'video/mp4'),
      ),
    );
    uploaded.forEach((u, i) => console.log(`  src${i}: ${u.url}`));

    console.log('[e2e] downloading + trimming audio …');
    const audioFull = path.join(work, 'audio-full.mp3');
    const audioTrim = path.join(work, 'audio.mp3');
    await downloadTo(AUDIO_URL, audioFull);
    await run('ffmpeg', [
      '-y', '-i', audioFull, '-t', String(AUDIO_TRIM_SECONDS),
      '-c', 'copy', audioTrim,
    ]);
    const audioUp = await uploadFile('audio', `${jobId}.mp3`, audioTrim, 'audio/mpeg');
    console.log(`  audio: ${audioUp.url}`);

    console.log('[e2e] cataloging sources (parallel) …');
    const t0 = Date.now();
    const cat = await catalogSources(
      jobId,
      uploaded.map((u, i) => ({ url: u.url, key: u.key, name: `src-${i}.mp4` })),
    );
    console.log(`  cataloged in ${(Date.now() - t0) / 1000}s:`, cat);

    const scenes = await listScenesForJob(jobId);
    console.log(`  scenes total: ${scenes.length}`);

    console.log('[e2e] planning via /api/director path (whisper auto-transcribe) …');
    const t1 = Date.now();
    const { transcribeAudio } = await import('../lib/whisper');
    const tr = await transcribeAudio(audioUp.url);
    console.log(`  whisper: ${tr.words.length} words, ${tr.duration.toFixed(2)}s in ${(Date.now() - t1) / 1000}s`);
    const plan = await planSequence({
      jobId,
      audioUrl: audioUp.url,
      audioDuration: tr.duration,
      words: tr.words,
    });
    console.log(`  planId=${plan.planId}, clips=${plan.sequence.clips.length}`);
    plan.sequence.clips.slice(0, 6).forEach((c, i) => {
      console.log(
        `    [${i}] ${c.kind} ${c.start.toFixed(1)}–${c.end.toFixed(1)}s — ${c.reason}`,
      );
    });

    console.log('[e2e] starting Lambda render …');
    const r = await startRender(plan.planId);
    console.log(`  renderId=${r.renderId} bucket=${r.bucketName}`);

    let last = -1;
    for (let i = 0; i < 120; i++) {
      await new Promise((x) => setTimeout(x, 5000));
      const p = await pollRender({
        planId: plan.planId,
        renderId: r.renderId,
        bucketName: r.bucketName,
      });
      const pct = Math.round(p.progress * 100);
      if (pct !== last) {
        console.log(`  render ${pct}%${p.error ? ` err=${p.error}` : ''}`);
        last = pct;
      }
      if (p.error) throw new Error(p.error);
      if (p.done && p.outputUrl) {
        console.log(`\n[e2e] DONE → ${p.outputUrl}`);
        const plans = await listSequencePlans(jobId);
        console.log(`  plan row: status=${plans[0]?.status} render_url=${plans[0]?.render_url}`);
        return;
      }
    }
    throw new Error('render did not complete within 10 minutes');
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error('[e2e] FAILED:', e);
  process.exit(1);
});

'use client';

import { useEffect, useRef, useState } from 'react';
import type { PipelineEvent, PipelineJob, PipelineStep } from '@/types/pipeline';
import { ActionButton } from '@/components/ui/ActionButton';
import { TerminalWindow } from '@/components/ui/TerminalWindow';

const STEP_ORDER: PipelineStep[] = [
  'fetch-latest',
  'dedupe',
  'transcript',
  'rewrite',
  'normalize',
  'tts-create',
  'tts-poll',
  'persist',
  'done',
];

const STEP_LABEL: Record<PipelineStep, string> = {
  'fetch-latest': 'Fetch latest video',
  dedupe: 'Check Turso for prior run',
  transcript: 'Fetch transcript',
  rewrite: 'Perplexity rewrite (≥90%)',
  normalize: 'Normalize for TTS',
  'tts-create': 'Create TTS job',
  'tts-poll': 'Wait for audio',
  persist: 'Save to Turso',
  done: 'Done',
};

interface StepState {
  state: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  message?: string;
  data?: Record<string, unknown>;
}

function emptySteps(): Record<PipelineStep, StepState> {
  const out = {} as Record<PipelineStep, StepState>;
  for (const s of STEP_ORDER) out[s] = { state: 'pending' };
  return out;
}

function applyEvent(steps: Record<PipelineStep, StepState>, ev: PipelineEvent): Record<PipelineStep, StepState> {
  const next = { ...steps };
  const prev = next[ev.step] ?? { state: 'pending' };
  let state: StepState['state'] = prev.state;
  if (ev.status === 'started') state = 'running';
  else if (ev.status === 'progress') state = 'running';
  else if (ev.status === 'completed') state = 'completed';
  else if (ev.status === 'failed') state = 'failed';
  else if (ev.status === 'skipped') state = 'skipped';
  next[ev.step] = { state, message: ev.message, data: ev.data };
  return next;
}

function stateColor(s: StepState['state']): string {
  switch (s) {
    case 'completed':
      return 'text-[var(--success)]';
    case 'running':
      return 'text-[var(--accent)]';
    case 'failed':
      return 'text-[var(--error)]';
    case 'skipped':
      return 'text-[var(--warning)]';
    default:
      return 'text-[var(--foreground-muted)]';
  }
}

function stateIcon(s: StepState['state']): string {
  switch (s) {
    case 'completed':
      return '✓';
    case 'running':
      return '◐';
    case 'failed':
      return '✗';
    case 'skipped':
      return '⤳';
    default:
      return '·';
  }
}

interface HistoryItem {
  video_id: string;
  channel_handle: string;
  title: string;
  accuracy_score: number | null;
  audio_url: string | null;
  processed_at: string;
}

export function PipelineRunner() {
  const [running, setRunning] = useState(false);
  const [job, setJob] = useState<PipelineJob | null>(null);
  const [steps, setSteps] = useState<Record<PipelineStep, StepState>>(emptySteps());
  const [eventLog, setEventLog] = useState<PipelineEvent[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const evtSrcRef = useRef<EventSource | null>(null);

  const refreshHistory = async () => {
    try {
      const r = await fetch('/api/pipeline/history', { cache: 'no-store' });
      const data = (await r.json()) as { items?: HistoryItem[]; error?: string };
      if (!r.ok) {
        setHistoryError(data.error ?? `History request failed (${r.status})`);
        return;
      }
      setHistoryError(null);
      setHistory(data.items ?? []);
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    void refreshHistory();
    return () => {
      evtSrcRef.current?.close();
    };
  }, []);

  const startRun = async () => {
    if (running) return;
    setRunning(true);
    setSteps(emptySteps());
    setEventLog([]);
    setJob(null);

    const r = await fetch('/api/pipeline/run', { method: 'POST' });
    const { jobId } = (await r.json()) as { jobId: string };

    const es = new EventSource(`/api/pipeline/jobs/${jobId}/events`);
    evtSrcRef.current = es;

    es.addEventListener('snapshot', (e) => {
      const { job: j } = JSON.parse((e as MessageEvent).data) as { job: PipelineJob };
      setJob(j);
      let merged = emptySteps();
      for (const ev of j.events) merged = applyEvent(merged, ev);
      setSteps(merged);
      setEventLog(j.events);
    });

    es.addEventListener('event', (e) => {
      const ev = JSON.parse((e as MessageEvent).data) as PipelineEvent;
      setSteps((prev) => applyEvent(prev, ev));
      setEventLog((prev) => [...prev, ev]);
    });

    es.addEventListener('end', (e) => {
      const { job: j } = JSON.parse((e as MessageEvent).data) as { job: PipelineJob };
      setJob(j);
      setRunning(false);
      es.close();
      evtSrcRef.current = null;
      void refreshHistory();
    });

    es.onerror = () => {
      setRunning(false);
      es.close();
      evtSrcRef.current = null;
    };
  };

  const finalAudio = job?.audioUrl ?? null;
  const channel = job?.channelHandle ?? 'colonbina1';

  return (
    <div className="space-y-6">
      <TerminalWindow title="CHANNEL MIRROR // LATEST VIDEO PIPELINE">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-[var(--foreground-muted)]">Source channel</div>
              <div className="text-lg text-[var(--foreground)]">@{channel}</div>
            </div>
            <ActionButton onClick={startRun} disabled={running} size="lg">
              {running ? 'Running…' : 'Run latest'}
            </ActionButton>
          </div>

          {job && (
            <div className="p-3 bg-[var(--background)] border border-[var(--border)] rounded-md text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[var(--foreground-muted)]">Job</span>
                <span className="font-mono">{job.id}</span>
              </div>
              {job.videoTitle && (
                <div className="mt-2">
                  <span className="text-[var(--foreground-muted)]">Video: </span>
                  <a
                    href={job.videoUrl ?? '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--accent)] hover:underline"
                  >
                    {job.videoTitle}
                  </a>
                </div>
              )}
              {job.alreadyProcessed && (
                <div className="mt-2 text-[var(--warning)]">
                  Latest video already processed — nothing to do.
                </div>
              )}
              {job.accuracyScore != null && (
                <div className="mt-2 text-[var(--foreground-muted)]">
                  Accuracy: <span className="text-[var(--foreground)]">{job.accuracyScore}%</span>
                </div>
              )}
              {job.error && <div className="mt-2 text-[var(--error)]">{job.error}</div>}
            </div>
          )}

          <ol className="space-y-2">
            {STEP_ORDER.map((step) => {
              const s = steps[step];
              return (
                <li
                  key={step}
                  className="flex items-start gap-3 p-2 bg-[var(--background)] border border-[var(--border)] rounded-md"
                >
                  <span className={`mt-0.5 font-mono text-base w-4 ${stateColor(s.state)}`}>
                    {stateIcon(s.state)}
                  </span>
                  <div className="flex-1">
                    <div className="flex justify-between gap-3">
                      <span className="text-sm text-[var(--foreground)]">{STEP_LABEL[step]}</span>
                      <span className={`text-xs uppercase tracking-wider ${stateColor(s.state)}`}>
                        {s.state}
                      </span>
                    </div>
                    {s.message && (
                      <div className="text-xs text-[var(--foreground-muted)] mt-1">{s.message}</div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          {finalAudio && (
            <div className="p-3 bg-[var(--background)] border border-[var(--success)] rounded-md">
              <div className="text-xs uppercase tracking-wider text-[var(--success)] mb-2">Audio ready</div>
              <audio controls src={finalAudio} className="w-full" />
              <a
                href={finalAudio}
                className="block mt-2 text-xs text-[var(--accent)] hover:underline"
                download
              >
                Download MP3
              </a>
            </div>
          )}

          {eventLog.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-[var(--foreground-muted)] uppercase tracking-wider">
                Event log ({eventLog.length})
              </summary>
              <div className="mt-2 max-h-64 overflow-y-auto space-y-1 font-mono">
                {eventLog.map((ev, i) => (
                  <div key={i} className="text-[var(--foreground-muted)]">
                    <span className="text-[var(--accent)]">{ev.step}</span>{' '}
                    <span>{ev.status}</span> — {ev.message}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </TerminalWindow>

      <TerminalWindow title="PROCESSED VIDEOS // TURSO">
        <div className="space-y-2">
          {historyError && (
            <div className="p-2 bg-[var(--background)] border border-[var(--error)] rounded-md text-xs text-[var(--error)]">
              {historyError}
            </div>
          )}
          {history.length === 0 && !historyError && (
            <div className="text-xs text-[var(--foreground-muted)]">No videos processed yet.</div>
          )}
          {history.map((h) => (
            <div
              key={h.video_id}
              className="flex items-start justify-between gap-3 p-2 bg-[var(--background)] border border-[var(--border)] rounded-md"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm text-[var(--foreground)] truncate">{h.title}</div>
                <div className="text-xs text-[var(--foreground-muted)] font-mono">
                  @{h.channel_handle} · {h.video_id} · {h.processed_at}
                  {h.accuracy_score != null && ` · ${h.accuracy_score}%`}
                </div>
              </div>
              {h.audio_url && (
                <a
                  href={h.audio_url}
                  className="text-xs text-[var(--accent)] hover:underline whitespace-nowrap"
                  target="_blank"
                  rel="noreferrer"
                >
                  audio
                </a>
              )}
            </div>
          ))}
        </div>
      </TerminalWindow>
    </div>
  );
}

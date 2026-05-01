'use client';

import { useEffect, useRef, useState } from 'react';
import type { PipelineEvent, PipelineJob, PipelineStep, SeoMetadata } from '@/types/pipeline';
import { ActionButton } from '@/components/ui/ActionButton';
import { TerminalWindow } from '@/components/ui/TerminalWindow';

const STEP_ORDER: PipelineStep[] = [
  'fetch-latest',
  'dedupe',
  'transcript',
  'rewrite',
  'seo',
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
  seo: 'Generate SEO metadata',
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

interface RunListItem {
  job_id: string;
  channel_handle: string;
  video_id: string | null;
  video_url: string | null;
  video_title: string | null;
  status: string;
  already_processed: number;
  accuracy_score: number | null;
  audio_url: string | null;
  started_at: string;
  finished_at: string | null;
}

interface RunFull extends RunListItem {
  transcript: string | null;
  script: string | null;
  seo_json: string | null;
  error: string | null;
}

function parseSeo(raw: string | null | undefined): SeoMetadata | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SeoMetadata;
  } catch {
    return null;
  }
}

function CopyButton({ text, label = 'copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs font-mono uppercase tracking-wider text-[var(--accent)] hover:text-[var(--accent-hover)] px-2 py-0.5 border border-[var(--border)] rounded"
    >
      {copied ? 'copied' : label}
    </button>
  );
}

function SeoPanel({ seo }: { seo: SeoMetadata }) {
  const tagsBlob = seo.tags.join(', ');
  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs uppercase tracking-wider text-[var(--foreground-muted)]">
            Title options ({seo.titles.length})
          </span>
          <CopyButton
            text={seo.titles.map((t) => t.title).join('\n')}
            label="copy all"
          />
        </div>
        <ul className="space-y-1">
          {seo.titles.map((t, i) => (
            <li
              key={i}
              className="flex items-start justify-between gap-3 p-2 bg-[var(--background-secondary)] border border-[var(--border)] rounded"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm text-[var(--foreground)]">{t.title}</div>
                <div className="text-xs text-[var(--foreground-muted)] font-mono">
                  {t.title.length}c · {t.principle}
                  {t.estimatedCTR === 'high' ? ' · high CTR' : ''}
                </div>
              </div>
              <CopyButton text={t.title} />
            </li>
          ))}
        </ul>
      </div>

      {seo.description && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wider text-[var(--foreground-muted)]">
              Description ({seo.description.length}c)
            </span>
            <CopyButton text={seo.description} />
          </div>
          <pre className="whitespace-pre-wrap text-xs text-[var(--foreground)] max-h-64 overflow-y-auto bg-[var(--background-secondary)] border border-[var(--border)] rounded p-2">
            {seo.description}
          </pre>
        </div>
      )}

      {seo.tags.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wider text-[var(--foreground-muted)]">
              Tags ({seo.tags.length})
            </span>
            <CopyButton text={tagsBlob} label="copy all" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {seo.tags.map((tag, i) => (
              <button
                key={i}
                type="button"
                onClick={() => navigator.clipboard.writeText(tag).catch(() => {})}
                className="text-xs font-mono px-2 py-0.5 bg-[var(--background-secondary)] border border-[var(--border)] rounded text-[var(--foreground)] hover:border-[var(--accent)]"
                title="click to copy"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function PipelineRunner() {
  const [running, setRunning] = useState(false);
  const [job, setJob] = useState<PipelineJob | null>(null);
  const [steps, setSteps] = useState<Record<PipelineStep, StepState>>(emptySteps());
  const [eventLog, setEventLog] = useState<PipelineEvent[]>([]);
  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [runDetails, setRunDetails] = useState<Record<string, RunFull>>({});
  const [loadingRunIds, setLoadingRunIds] = useState<Record<string, true>>({});
  const evtSrcRef = useRef<EventSource | null>(null);

  const refreshRuns = async () => {
    try {
      const r = await fetch('/api/pipeline/runs', { cache: 'no-store' });
      const data = (await r.json()) as { items?: RunListItem[]; error?: string };
      if (!r.ok) {
        setRunsError(data.error ?? `Runs request failed (${r.status})`);
        return;
      }
      setRunsError(null);
      setRuns(data.items ?? []);
    } catch (e) {
      setRunsError(e instanceof Error ? e.message : String(e));
    }
  };

  const loadRunDetails = async (jobId: string) => {
    if (runDetails[jobId] || loadingRunIds[jobId]) return;
    setLoadingRunIds((p) => ({ ...p, [jobId]: true }));
    try {
      const r = await fetch(`/api/pipeline/runs/${jobId}`, { cache: 'no-store' });
      if (!r.ok) return;
      const full = (await r.json()) as RunFull;
      setRunDetails((p) => ({ ...p, [jobId]: full }));
    } finally {
      setLoadingRunIds((p) => {
        const n = { ...p };
        delete n[jobId];
        return n;
      });
    }
  };

  useEffect(() => {
    void refreshRuns();
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
      void refreshRuns();
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

          {job?.seo && (
            <div className="p-3 bg-[var(--background)] border border-[var(--border)] rounded-md">
              <div className="text-xs uppercase tracking-wider text-[var(--accent)] mb-2">
                YouTube metadata
              </div>
              <SeoPanel seo={job.seo} />
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

      <TerminalWindow title={`ALL RUNS // TURSO (${runs.length})`}>
        <div className="space-y-2">
          {runsError && (
            <div className="p-2 bg-[var(--background)] border border-[var(--error)] rounded-md text-xs text-[var(--error)]">
              {runsError}
            </div>
          )}
          {runs.length === 0 && !runsError && (
            <div className="text-xs text-[var(--foreground-muted)]">No runs yet.</div>
          )}
          {runs.map((r) => {
            const full = runDetails[r.job_id];
            const loading = !!loadingRunIds[r.job_id];
            const statusColor =
              r.status === 'completed'
                ? 'text-[var(--success)]'
                : r.status === 'failed'
                  ? 'text-[var(--error)]'
                  : r.status === 'skipped'
                    ? 'text-[var(--warning)]'
                    : 'text-[var(--foreground-muted)]';
            return (
              <details
                key={r.job_id}
                className="bg-[var(--background)] border border-[var(--border)] rounded-md"
                onToggle={(e) => {
                  if ((e.currentTarget as HTMLDetailsElement).open) void loadRunDetails(r.job_id);
                }}
              >
                <summary className="flex items-start justify-between gap-3 p-2 cursor-pointer">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[var(--foreground)] truncate">
                      {r.video_title ?? '(no video)'}
                    </div>
                    <div className="text-xs text-[var(--foreground-muted)] font-mono truncate">
                      @{r.channel_handle} · {r.video_id ?? '—'} · {r.started_at}
                      {r.accuracy_score != null && ` · ${r.accuracy_score}%`}
                      {r.already_processed ? ' · dedup' : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs uppercase tracking-wider ${statusColor}`}>{r.status}</span>
                    {r.audio_url && (
                      <a
                        href={r.audio_url}
                        className="text-xs text-[var(--accent)] hover:underline whitespace-nowrap"
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        audio
                      </a>
                    )}
                  </div>
                </summary>
                <div className="px-3 pb-3 space-y-3">
                  {loading && !full && (
                    <div className="text-xs text-[var(--foreground-muted)]">Loading…</div>
                  )}
                  {full && (
                    <>
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono text-[var(--foreground-muted)]">
                        <div>job: <span className="text-[var(--foreground)]">{full.job_id}</span></div>
                        <div>finished: <span className="text-[var(--foreground)]">{full.finished_at ?? '—'}</span></div>
                        {full.video_url && (
                          <div className="col-span-2 truncate">
                            video:{' '}
                            <a
                              href={full.video_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[var(--accent)] hover:underline"
                            >
                              {full.video_url}
                            </a>
                          </div>
                        )}
                      </div>
                      {full.audio_url && (
                        <div>
                          <div className="text-xs uppercase tracking-wider text-[var(--foreground-muted)] mb-1">
                            Audio
                          </div>
                          <audio controls src={full.audio_url} className="w-full" />
                        </div>
                      )}
                      {(() => {
                        const seo = parseSeo(full.seo_json);
                        return seo ? (
                          <div>
                            <div className="text-xs uppercase tracking-wider text-[var(--foreground-muted)] mb-2">
                              YouTube metadata
                            </div>
                            <SeoPanel seo={seo} />
                          </div>
                        ) : null;
                      })()}
                      {full.error && (
                        <div className="p-2 bg-[var(--background-secondary)] border border-[var(--error)] rounded text-xs text-[var(--error)] whitespace-pre-wrap">
                          {full.error}
                        </div>
                      )}
                      {full.script && (
                        <details>
                          <summary className="cursor-pointer text-xs uppercase tracking-wider text-[var(--foreground-muted)]">
                            Script ({full.script.length.toLocaleString()} chars)
                          </summary>
                          <pre className="mt-1 whitespace-pre-wrap text-xs text-[var(--foreground)] max-h-72 overflow-y-auto bg-[var(--background-secondary)] border border-[var(--border)] rounded p-2">
                            {full.script}
                          </pre>
                        </details>
                      )}
                      {full.transcript && (
                        <details>
                          <summary className="cursor-pointer text-xs uppercase tracking-wider text-[var(--foreground-muted)]">
                            Original transcript ({full.transcript.length.toLocaleString()} chars)
                          </summary>
                          <pre className="mt-1 whitespace-pre-wrap text-xs text-[var(--foreground-muted)] max-h-72 overflow-y-auto bg-[var(--background-secondary)] border border-[var(--border)] rounded p-2">
                            {full.transcript}
                          </pre>
                        </details>
                      )}
                    </>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      </TerminalWindow>
    </div>
  );
}

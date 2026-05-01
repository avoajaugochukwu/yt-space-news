const BASE_URL = 'https://voice-generator-service-production.up.railway.app';
const POLL_INTERVAL_MS = 4_000;
const POLL_TIMEOUT_MS = 15 * 60_000;
export const VOICE_NAME = 'M-Expressive Narrator';

export async function normalizeText(text: string): Promise<string> {
  const resp = await fetch(`${BASE_URL}/normalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Normalize failed: ${resp.status} ${body.slice(0, 200)}`);
  }
  const data = (await resp.json()) as { text?: string };
  if (typeof data.text !== 'string' || !data.text.trim()) {
    throw new Error('Normalize returned empty text');
  }
  return data.text;
}

export async function createTtsJob(text: string, voice = VOICE_NAME): Promise<string> {
  const resp = await fetch(`${BASE_URL}/tts/synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`TTS create failed: ${resp.status} ${body.slice(0, 300)}`);
  }
  const data = (await resp.json()) as { jobId?: string };
  if (!data.jobId) throw new Error('TTS create returned no jobId');
  return data.jobId;
}

export interface TtsJobStatus {
  status: string;
  progress?: number;
  error?: string;
  raw: Record<string, unknown>;
}

export async function getTtsJob(jobId: string): Promise<TtsJobStatus> {
  const resp = await fetch(`${BASE_URL}/tts/jobs/${encodeURIComponent(jobId)}`);
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`TTS status failed: ${resp.status} ${body.slice(0, 200)}`);
  }
  const data = (await resp.json()) as Record<string, unknown>;
  const status = String(data.status ?? 'unknown').toLowerCase();
  return {
    status,
    progress: typeof data.progress === 'number' ? data.progress : undefined,
    error: typeof data.error === 'string' ? data.error : undefined,
    raw: data,
  };
}

export async function pollTtsJob(
  jobId: string,
  onTick?: (s: TtsJobStatus) => void,
): Promise<TtsJobStatus> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const status = await getTtsJob(jobId);
    onTick?.(status);
    if (['completed', 'done', 'success', 'succeeded'].includes(status.status)) return status;
    if (['failed', 'error', 'errored'].includes(status.status)) {
      throw new Error(`TTS job ${jobId} failed: ${status.error ?? status.status}`);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`TTS job ${jobId} timed out after ${Math.round(POLL_TIMEOUT_MS / 1000)}s`);
}

export function ttsDownloadUrl(jobId: string): string {
  return `${BASE_URL}/tts/jobs/${encodeURIComponent(jobId)}/download`;
}

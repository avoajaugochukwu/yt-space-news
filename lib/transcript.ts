const TRANSCRIPT_ENDPOINT =
  'https://youtube-transcript-production-18aa.up.railway.app/api/transcript';
const TIMEOUT_MS = 90_000;

export interface TranscriptResult {
  title: string;
  transcript: string;
}

export async function fetchTranscript(videoUrl: string): Promise<TranscriptResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let resp: Response;
  try {
    resp = await fetch(TRANSCRIPT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: videoUrl }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (resp.status === 404) {
    throw new Error('No subtitles available for this video');
  }
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Transcript service failed: ${resp.status} ${body.slice(0, 200)}`);
  }

  const data = (await resp.json()) as { title?: string; transcript?: string };
  const transcript = (data.transcript ?? '').replace(/\s+/g, ' ').trim();
  const title = (data.title ?? '').trim();
  if (!transcript) throw new Error('Transcript service returned empty transcript');
  return { title, transcript };
}

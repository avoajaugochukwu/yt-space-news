export type WhisperWord = { word: string; start: number; end: number };

export interface TranscribeResult {
  words: WhisperWord[];
  duration: number;
}

function filenameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const segs = u.pathname.split('/').filter(Boolean);
    return decodeURIComponent(segs[segs.length - 1] ?? 'audio.mp3');
  } catch {
    return 'audio.mp3';
  }
}

export async function transcribeAudio(audioUrl: string): Promise<TranscribeResult> {
  const base = process.env.REMOTION_WHISPER_SERVICE_URL;
  if (!base) throw new Error('REMOTION_WHISPER_SERVICE_URL not set');
  const endpoint = `${base.replace(/\/$/, '')}/v1/transcribe`;

  const audioRes = await fetch(audioUrl);
  if (!audioRes.ok) throw new Error(`audio download failed (${audioRes.status})`);
  const contentType = audioRes.headers.get('content-type') ?? 'audio/mpeg';
  const audioBuf = await audioRes.arrayBuffer();

  const form = new FormData();
  form.append(
    'file',
    new Blob([audioBuf], { type: contentType }),
    filenameFromUrl(audioUrl),
  );

  const res = await fetch(endpoint, { method: 'POST', body: form });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`whisper ${res.status}: ${body.slice(0, 300)}`);
  }
  const raw = (await res.json()) as {
    words?: { word?: string; text?: string; start: number; end: number }[];
    duration?: number;
  };
  const words: WhisperWord[] = (raw.words ?? [])
    .map((w) => ({
      word: (w.word ?? w.text ?? '').trim(),
      start: Number(w.start),
      end: Number(w.end),
    }))
    .filter((w) => w.word && Number.isFinite(w.start) && Number.isFinite(w.end));
  const duration =
    raw.duration ?? (words.length > 0 ? words[words.length - 1].end : 0);
  return { words, duration };
}

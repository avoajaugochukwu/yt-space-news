import { NextRequest, NextResponse } from 'next/server';
import { transcribeAudio } from '@/lib/whisper';
import { inferChapters } from '@/lib/director/chapters';
import { getRun } from '@/lib/turso';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    audioUrl?: string;
    jobId?: string;
  } | null;
  if (!body?.audioUrl) {
    return NextResponse.json({ error: 'audioUrl required' }, { status: 400 });
  }

  let script: string | null = null;
  if (body.jobId) {
    try {
      const run = await getRun(body.jobId);
      script = run?.script ?? null;
    } catch {
      script = null;
    }
  }

  const t = await transcribeAudio(body.audioUrl);
  const chapters = await inferChapters({
    words: t.words,
    audioDuration: t.duration,
    script,
  });

  const expectedEntities = Array.from(
    new Set(chapters.flatMap((c) => c.namedEntities)),
  );
  const visualThemes = Array.from(
    new Set(chapters.flatMap((c) => [c.theme, ...c.tags])),
  );

  return NextResponse.json({
    audioDuration: t.duration,
    words: t.words,
    chapters,
    entityHints: { expectedEntities, visualThemes },
  });
}

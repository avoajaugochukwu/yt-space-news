import { NextRequest, NextResponse } from 'next/server';
import { planSequence, type WordTimestamp } from '@/lib/director';
import { getSequencePlan, listSequencePlans } from '@/lib/director-store';
import { transcribeAudio } from '@/lib/whisper';
import type { Chapter } from '@/lib/director/chapters';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    jobId?: string;
    audioUrl?: string;
    audioDuration?: number;
    words?: WordTimestamp[];
    chapters?: Chapter[];
    fps?: number;
    width?: number;
    height?: number;
  } | null;
  if (!body?.jobId || !body.audioUrl) {
    return NextResponse.json(
      { error: 'jobId and audioUrl required' },
      { status: 400 },
    );
  }
  let words = body.words;
  let audioDuration = body.audioDuration;
  if (!Array.isArray(words) || words.length === 0 || !audioDuration) {
    const t = await transcribeAudio(body.audioUrl);
    words = t.words;
    audioDuration = audioDuration ?? t.duration;
  }
  if (!audioDuration) {
    return NextResponse.json(
      { error: 'could not derive audio duration from whisper response' },
      { status: 502 },
    );
  }
  const r = await planSequence({
    jobId: body.jobId,
    audioUrl: body.audioUrl,
    audioDuration,
    words,
    chapters: body.chapters,
    fps: body.fps,
    width: body.width,
    height: body.height,
  });
  return NextResponse.json({ ...r, transcribedWords: words.length });
}

export async function GET(req: NextRequest) {
  const planId = req.nextUrl.searchParams.get('planId');
  if (planId) {
    const plan = await getSequencePlan(planId);
    if (!plan) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json({
      ...plan,
      sequence: JSON.parse(plan.sequence_json),
    });
  }
  const jobId = req.nextUrl.searchParams.get('jobId') ?? undefined;
  const plans = await listSequencePlans(jobId);
  return NextResponse.json({ plans });
}

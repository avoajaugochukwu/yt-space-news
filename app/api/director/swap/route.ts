import { NextRequest, NextResponse } from 'next/server';
import { getSequencePlan, listScenesForJob, saveSequencePlan } from '@/lib/director-store';
import type { SequenceJSON } from '@/lib/director';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    planId?: string;
    clipIndex?: number;
    sceneId?: string;
    bureauImageUrl?: string;
  } | null;
  if (!body?.planId || typeof body.clipIndex !== 'number') {
    return NextResponse.json({ error: 'planId, clipIndex required' }, { status: 400 });
  }
  const plan = await getSequencePlan(body.planId);
  if (!plan) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const seq = JSON.parse(plan.sequence_json) as SequenceJSON;
  const clip = seq.clips[body.clipIndex];
  if (!clip) return NextResponse.json({ error: 'clipIndex out of range' }, { status: 400 });

  const need = clip.end - clip.start;
  if (body.sceneId) {
    const scenes = await listScenesForJob(plan.job_id);
    const target = scenes.find((s) => s.scene_id === body.sceneId);
    if (!target) return NextResponse.json({ error: 'scene not found' }, { status: 404 });
    const sceneDur = target.end_time - target.start_time;
    seq.clips[body.clipIndex] = sceneDur >= need
      ? {
          kind: 'footage',
          start: clip.start, end: clip.end,
          sceneId: target.scene_id,
          sourceId: target.source_id,
          clipStart: target.start_time,
          clipEnd: target.start_time + need,
          reason: 'manual override',
        }
      : {
          kind: 'loop',
          start: clip.start, end: clip.end,
          sceneId: target.scene_id,
          sourceId: target.source_id,
          clipStart: target.start_time,
          clipEnd: target.end_time,
          reason: 'manual override (looped)',
        };
  } else if (body.bureauImageUrl) {
    seq.clips[body.clipIndex] = {
      kind: 'bureau',
      start: clip.start, end: clip.end,
      imageId: 'manual',
      imageUrl: body.bureauImageUrl,
      reason: 'manual bureau override',
    };
  } else {
    return NextResponse.json({ error: 'sceneId or bureauImageUrl required' }, { status: 400 });
  }

  await saveSequencePlan({
    plan_id: plan.plan_id,
    job_id: plan.job_id,
    audio_url: plan.audio_url,
    audio_duration_seconds: plan.audio_duration_seconds,
    sequence_json: JSON.stringify(seq),
    status: plan.status,
    render_url: plan.render_url,
    rendered_at: plan.rendered_at,
  });
  return NextResponse.json({ planId: plan.plan_id, sequence: seq });
}

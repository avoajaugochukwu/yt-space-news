import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  getSequencePlan,
  listScenesForJob,
  listVideoSources,
} from './director-store';
import type { SequenceJSON } from './director';
import { putBuffer } from './storage/s3';
import { publicUrl } from './storage/aws';

const LOCAL_MANIFEST_DIR = path.join(process.cwd(), 'manifests');

export async function saveRenderManifest(
  planId: string,
  finalRenderUrl: string,
): Promise<{ url: string } | null> {
  const plan = await getSequencePlan(planId);
  if (!plan) return null;
  const seq = JSON.parse(plan.sequence_json) as SequenceJSON;

  const [sources, scenes] = await Promise.all([
    listVideoSources(plan.job_id),
    listScenesForJob(plan.job_id),
  ]);

  const sceneById = new Map(scenes.map((s) => [s.scene_id, s]));
  const sourceById = new Map(sources.map((s) => [s.source_id, s]));
  const sceneUsage = new Map<string, number>();

  const clips = seq.clips.map((c, i) => {
    const base = {
      index: i,
      kind: c.kind,
      startSec: Number(c.start.toFixed(3)),
      endSec: Number(c.end.toFixed(3)),
      durationSec: Number((c.end - c.start).toFixed(3)),
      reason: c.reason,
    };
    if (c.kind === 'footage' || c.kind === 'loop') {
      sceneUsage.set(c.sceneId, (sceneUsage.get(c.sceneId) ?? 0) + 1);
      const scene = sceneById.get(c.sceneId);
      const source = sourceById.get(c.sourceId);
      let tags: unknown = null;
      if (scene?.tags_json) {
        try { tags = JSON.parse(scene.tags_json); } catch { /* ignore */ }
      }
      return {
        ...base,
        sceneId: c.sceneId,
        sourceId: c.sourceId,
        sourceName: source?.original_name ?? null,
        sceneStartInSource: c.clipStart,
        sceneEndInSource: c.clipEnd,
        sceneDescription: scene?.description ?? null,
        sceneTags: tags,
      };
    }
    return {
      ...base,
      bureauImageId: c.imageId,
      bureauImageUrl: c.imageUrl,
    };
  });

  const sceneReuseSummary = Array.from(sceneUsage.entries())
    .filter(([, n]) => n > 1)
    .map(([sceneId, n]) => {
      const sc = sceneById.get(sceneId);
      return {
        sceneId,
        usedTimes: n,
        description: sc?.description ?? null,
        sourceId: sc?.source_id ?? null,
      };
    });

  const manifest = {
    planId: plan.plan_id,
    jobId: plan.job_id,
    createdAt: plan.created_at,
    renderedAt: new Date().toISOString(),
    finalRenderUrl,
    audioUrl: plan.audio_url,
    audioDurationSec: plan.audio_duration_seconds,
    composition: { fps: seq.fps, width: seq.width, height: seq.height },
    summary: {
      chapters: seq.chapters?.length ?? 0,
      clips: seq.clips.length,
      kindCounts: seq.clips.reduce<Record<string, number>>((a, c) => {
        a[c.kind] = (a[c.kind] ?? 0) + 1;
        return a;
      }, {}),
      uniqueScenesUsed: sceneUsage.size,
      sceneReuse: sceneReuseSummary,
    },
    chapters: seq.chapters ?? [],
    clips,
    sources: sources.map((s) => ({
      sourceId: s.source_id,
      name: s.original_name,
      duration: s.duration_seconds,
      width: s.width,
      height: s.height,
      fps: s.fps,
    })),
    scenes: scenes.map((s) => ({
      sceneId: s.scene_id,
      sourceId: s.source_id,
      startSec: s.start_time,
      endSec: s.end_time,
      durationSec: Number((s.end_time - s.start_time).toFixed(3)),
      description: s.description,
      tags: s.tags_json ? JSON.parse(s.tags_json) : null,
    })),
  };

  const json = JSON.stringify(manifest, null, 2);
  const key = `renders/${planId}.json`;
  await putBuffer(key, Buffer.from(json, 'utf8'), 'application/json');

  try {
    await mkdir(LOCAL_MANIFEST_DIR, { recursive: true });
    await writeFile(path.join(LOCAL_MANIFEST_DIR, `${planId}.json`), json, 'utf8');
  } catch (err) {
    console.warn('[manifest] local save failed:', (err as Error).message);
  }

  return { url: publicUrl(key) };
}

import { randomUUID } from 'node:crypto';
import { saveScene, saveVideoSource, type SceneRow } from '../director-store';
import { putBuffer } from '../storage/s3';
import { s3Key } from '../storage/aws';
import {
  cleanupTempParent,
  detectScenes,
  downloadToTemp,
  extractBestKeyframe,
  probe,
  type SceneCut,
} from './ffmpeg';
import { tagKeyframe, type SceneTags, type VisionHints } from './vision';

export interface CatalogResult {
  source_id: string;
  scenes: number;
  duration: number;
  rejected: number;
  merged: number;
}

const SCENE_CONCURRENCY = 6;
const MIN_SCENE_DURATION_SECONDS = 3;
const TAG_MERGE_JACCARD = 0.65;

function mergeMicroScenes(scenes: SceneCut[]): SceneCut[] {
  if (scenes.length <= 1) return scenes;
  const out: SceneCut[] = [];
  for (const scene of scenes) {
    const last = out[out.length - 1];
    const dur = scene.end - scene.start;
    if (last && dur < MIN_SCENE_DURATION_SECONDS) {
      last.end = scene.end;
      continue;
    }
    if (last && last.end - last.start < MIN_SCENE_DURATION_SECONDS) {
      last.end = scene.end;
      continue;
    }
    out.push({ ...scene });
  }
  return out;
}

function tagTokens(t: SceneTags): Set<string> {
  const out = new Set<string>();
  for (const x of t.description.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    if (x.length > 2) out.add(x);
  }
  for (const tag of t.tags) for (const x of tag.toLowerCase().split(/\s+/)) out.add(x);
  for (const h of t.hardware) out.add(h.toLowerCase());
  for (const e of t.matched_entities ?? []) out.add(e.toLowerCase());
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  return inter / (a.size + b.size - inter);
}

interface ProcessedScene {
  row: Omit<SceneRow, 'created_at'>;
  tags: SceneTags | null;
  rejected: boolean;
}

interface ProcessSceneArgs {
  sourceId: string;
  jobId: string;
  localPath: string;
  scene: SceneCut;
  hints?: VisionHints;
}

async function processScene(args: ProcessSceneArgs): Promise<ProcessedScene> {
  const sceneId = randomUUID();
  let keyframeUrl: string | null = null;
  let keyframeKey: string | null = null;
  let tagsJson: string | null = null;
  let description: string | null = null;
  let tags: SceneTags | null = null;
  let rejected = false;

  try {
    const jpeg = await extractBestKeyframe(args.localPath, args.scene);
    if (!jpeg) {
      rejected = true;
      tagsJson = JSON.stringify({ rejected: 'transition or low-detail frame' });
    } else {
      const key = s3Key('keyframes', args.sourceId, `${sceneId}.jpg`);
      const put = await putBuffer(key, jpeg, 'image/jpeg');
      keyframeKey = put.key;
      keyframeUrl = put.url;
      tags = await tagKeyframe(jpeg, args.hints);
      description = tags.description;
      tagsJson = JSON.stringify(tags);
    }
  } catch (err) {
    tagsJson = JSON.stringify({ error: (err as Error).message });
  }

  return {
    row: {
      scene_id: sceneId,
      source_id: args.sourceId,
      job_id: args.jobId,
      start_time: args.scene.start,
      end_time: args.scene.end,
      keyframe_s3_key: keyframeKey,
      keyframe_url: keyframeUrl,
      description,
      tags_json: tagsJson,
      embedding_json: null,
    },
    tags,
    rejected,
  };
}

// Walk adjacent scenes (within the same source) and merge consecutive pairs
// whose tag-Jaccard exceeds TAG_MERGE_JACCARD. The earlier scene's keyframe is
// kept; the later one's tags are folded in; the time range is extended.
function contentMerge(processed: ProcessedScene[]): { kept: ProcessedScene[]; merged: number } {
  const kept: ProcessedScene[] = [];
  let merged = 0;
  for (const cur of processed) {
    if (cur.rejected) continue;
    const prev = kept[kept.length - 1];
    if (!prev || !prev.tags || !cur.tags) {
      kept.push(cur);
      continue;
    }
    const sim = jaccard(tagTokens(prev.tags), tagTokens(cur.tags));
    if (sim >= TAG_MERGE_JACCARD) {
      // Extend prev, fold cur's tags in.
      prev.row.end_time = cur.row.end_time;
      const unionTags = Array.from(new Set([...prev.tags.tags, ...cur.tags.tags])).slice(0, 12);
      const unionHardware = Array.from(
        new Set([...prev.tags.hardware, ...cur.tags.hardware]),
      ).slice(0, 8);
      prev.tags = { ...prev.tags, tags: unionTags, hardware: unionHardware };
      prev.row.tags_json = JSON.stringify(prev.tags);
      prev.row.description = prev.tags.description;
      merged += 1;
    } else {
      kept.push(cur);
    }
  }
  return { kept, merged };
}

export async function catalogSource(input: {
  jobId: string;
  sourceUrl: string;
  s3Key: string;
  originalName?: string;
  hints?: VisionHints;
}): Promise<CatalogResult> {
  const sourceId = randomUUID();
  const localPath = await downloadToTemp(input.sourceUrl, '.mp4');
  try {
    const info = await probe(localPath);
    await saveVideoSource({
      source_id: sourceId,
      job_id: input.jobId,
      s3_key: input.s3Key,
      s3_url: input.sourceUrl,
      original_name: input.originalName ?? null,
      duration_seconds: info.duration,
      width: info.width,
      height: info.height,
      fps: info.fps,
      status: 'cataloging',
    });

    const rawScenes = await detectScenes(localPath, info.duration);
    const scenes = mergeMicroScenes(rawScenes);

    const processed = await pmap(scenes, SCENE_CONCURRENCY, (scene) =>
      processScene({ sourceId, jobId: input.jobId, localPath, scene, hints: input.hints }),
    );
    const rejected = processed.filter((p) => p.rejected).length;
    const { kept, merged } = contentMerge(processed);
    for (const p of kept) await saveScene(p.row);

    await saveVideoSource({
      source_id: sourceId,
      job_id: input.jobId,
      s3_key: input.s3Key,
      s3_url: input.sourceUrl,
      original_name: input.originalName ?? null,
      duration_seconds: info.duration,
      width: info.width,
      height: info.height,
      fps: info.fps,
      status: 'cataloged',
    });

    return {
      source_id: sourceId,
      scenes: kept.length,
      duration: info.duration,
      rejected,
      merged,
    };
  } finally {
    await cleanupTempParent(localPath);
  }
}

export async function catalogSources(
  jobId: string,
  sources: Array<{ url: string; key: string; name?: string }>,
  hints?: VisionHints,
): Promise<CatalogResult[]> {
  return Promise.all(
    sources.map((s) =>
      catalogSource({
        jobId,
        sourceUrl: s.url,
        s3Key: s.key,
        originalName: s.name,
        hints,
      }),
    ),
  );
}

async function pmap<T, U>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<U>,
): Promise<U[]> {
  const out: U[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

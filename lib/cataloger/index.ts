import { randomUUID } from 'node:crypto';
import { saveScene, saveVideoSource, type SceneRow } from '../director-store';
import { putBuffer } from '../storage/s3';
import { s3Key } from '../storage/aws';
import {
  cleanupTempParent,
  detectScenes,
  downloadToTemp,
  extractKeyframe,
  probe,
  type SceneCut,
} from './ffmpeg';
import { tagKeyframe } from './vision';

export interface CatalogResult {
  source_id: string;
  scenes: number;
  duration: number;
}

const SCENE_CONCURRENCY = 8;

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

async function processScene(args: {
  sourceId: string;
  jobId: string;
  localPath: string;
  scene: SceneCut;
}): Promise<Omit<SceneRow, 'created_at'>> {
  const sceneId = randomUUID();
  const mid = args.scene.start + (args.scene.end - args.scene.start) / 2;
  let keyframeUrl: string | null = null;
  let keyframeKey: string | null = null;
  let tagsJson: string | null = null;
  let description: string | null = null;
  try {
    const jpeg = await extractKeyframe(args.localPath, mid);
    const key = s3Key('keyframes', args.sourceId, `${sceneId}.jpg`);
    const put = await putBuffer(key, jpeg, 'image/jpeg');
    keyframeKey = put.key;
    keyframeUrl = put.url;
    const tags = await tagKeyframe(jpeg);
    description = tags.description;
    tagsJson = JSON.stringify(tags);
  } catch (err) {
    tagsJson = JSON.stringify({ error: (err as Error).message });
  }

  return {
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
  };
}

export async function catalogSource(input: {
  jobId: string;
  sourceUrl: string;
  s3Key: string;
  originalName?: string;
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

    const scenes = await detectScenes(localPath, info.duration);
    const rows = await pmap(scenes, SCENE_CONCURRENCY, (scene) =>
      processScene({ sourceId, jobId: input.jobId, localPath, scene }),
    );
    for (const row of rows) await saveScene(row);

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

    return { source_id: sourceId, scenes: rows.length, duration: info.duration };
  } finally {
    await cleanupTempParent(localPath);
  }
}

export async function catalogSources(
  jobId: string,
  sources: Array<{ url: string; key: string; name?: string }>,
): Promise<CatalogResult[]> {
  return Promise.all(
    sources.map((s) =>
      catalogSource({
        jobId,
        sourceUrl: s.url,
        s3Key: s.key,
        originalName: s.name,
      }),
    ),
  );
}

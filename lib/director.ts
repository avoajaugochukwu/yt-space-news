import { randomUUID } from 'node:crypto';
import {
  listBureauImages,
  listScenesForJob,
  saveSequencePlan,
  type BureauImageRow,
  type SceneRow,
} from './director-store';

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

export interface ScriptEntity {
  text: string;
  start: number;
  end: number;
}

export type ClipSegment =
  | {
      kind: 'footage';
      start: number;
      end: number;
      sceneId: string;
      sourceId: string;
      sourceUrl?: string;
      clipStart: number;
      clipEnd: number;
      reason: string;
    }
  | {
      kind: 'bureau';
      start: number;
      end: number;
      imageId: string;
      imageUrl: string;
      reason: string;
    }
  | {
      kind: 'loop';
      start: number;
      end: number;
      sceneId: string;
      sourceId: string;
      sourceUrl?: string;
      clipStart: number;
      clipEnd: number;
      reason: string;
    };

export interface SequenceJSON {
  audioUrl: string;
  audioDuration: number;
  fps: number;
  width: number;
  height: number;
  clips: ClipSegment[];
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'been', 'be',
  'to', 'of', 'in', 'on', 'at', 'by', 'for', 'from', 'with', 'as', 'it', 'its',
  'this', 'that', 'these', 'those', 'they', 'we', 'you', 'i', 'he', 'she',
  'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could',
  'so', 'than', 'then', 'into', 'about', 'after', 'before', 'over', 'under',
  'just', 'also', 'now', 'how', 'what', 'when', 'where', 'why', 'who',
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

export function entitiesFromWords(
  words: WordTimestamp[],
  windowSec = 3,
): ScriptEntity[] {
  if (words.length === 0) return [];
  const out: ScriptEntity[] = [];
  let cursor = 0;
  while (cursor < words.length) {
    const startTime = words[cursor].start;
    const endTime = startTime + windowSec;
    const bucket: WordTimestamp[] = [];
    let j = cursor;
    while (j < words.length && words[j].start < endTime) {
      bucket.push(words[j]);
      j++;
    }
    if (bucket.length === 0) break;
    const text = tokenize(bucket.map((w) => w.word).join(' ')).join(' ');
    if (text) {
      out.push({
        text,
        start: bucket[0].start,
        end: bucket[bucket.length - 1].end,
      });
    }
    cursor = j;
  }
  return out;
}

interface SceneVec {
  scene: SceneRow;
  tokens: Set<string>;
  motion: 'static' | 'low' | 'medium' | 'high';
  hardware: string[];
}

function sceneVectors(scenes: SceneRow[]): SceneVec[] {
  return scenes.map((scene) => {
    let tokens = new Set<string>();
    let motion: SceneVec['motion'] = 'medium';
    let hardware: string[] = [];
    if (scene.tags_json) {
      try {
        const t = JSON.parse(scene.tags_json) as {
          description?: string;
          tags?: string[];
          hardware?: string[];
          motion?: SceneVec['motion'];
        };
        const all: string[] = [];
        if (t.description) all.push(...tokenize(t.description));
        if (t.tags) for (const tag of t.tags) all.push(...tokenize(tag));
        if (t.hardware) {
          hardware = t.hardware;
          for (const h of t.hardware) all.push(...tokenize(h));
        }
        tokens = new Set(all);
        if (t.motion) motion = t.motion;
      } catch {
        /* ignore */
      }
    }
    if (scene.description) {
      for (const tok of tokenize(scene.description)) tokens.add(tok);
    }
    return { scene, tokens, motion, hardware };
  });
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const uni = a.size + b.size - inter;
  return uni === 0 ? 0 : inter / uni;
}

function entityCost(entityTokens: Set<string>, vec: SceneVec): number {
  return 1 - jaccard(entityTokens, vec.tokens);
}

export function alignDTW(
  entities: ScriptEntity[],
  vectors: SceneVec[],
): Array<{ entity: ScriptEntity; sceneIndex: number; cost: number }> {
  if (entities.length === 0 || vectors.length === 0) return [];
  const N = entities.length;
  const M = vectors.length;
  const dp: number[][] = Array.from({ length: N }, () => Array(M).fill(Infinity));
  const back: Array<Array<[number, number]>> = Array.from({ length: N }, () =>
    Array(M).fill([0, 0] as [number, number]),
  );
  const entityTokenSets = entities.map((e) => new Set(tokenize(e.text)));

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < M; j++) {
      const c = entityCost(entityTokenSets[i], vectors[j]);
      if (i === 0 && j === 0) {
        dp[i][j] = c;
        back[i][j] = [-1, -1];
      } else if (i === 0) {
        dp[i][j] = c + dp[i][j - 1];
        back[i][j] = [i, j - 1];
      } else if (j === 0) {
        dp[i][j] = c + dp[i - 1][j];
        back[i][j] = [i - 1, j];
      } else {
        const a = dp[i - 1][j - 1];
        const b = dp[i - 1][j];
        const cc = dp[i][j - 1];
        const min = Math.min(a, b, cc);
        dp[i][j] = c + min;
        back[i][j] = min === a ? [i - 1, j - 1] : min === b ? [i - 1, j] : [i, j - 1];
      }
    }
  }

  const path: Array<{ entity: ScriptEntity; sceneIndex: number; cost: number }> = [];
  let i = N - 1;
  let j = M - 1;
  while (i >= 0 && j >= 0) {
    path.push({
      entity: entities[i],
      sceneIndex: j,
      cost: entityCost(entityTokenSets[i], vectors[j]),
    });
    const [pi, pj] = back[i][j];
    if (pi < 0 || pj < 0) break;
    i = pi;
    j = pj;
  }
  path.reverse();

  const dedup = new Map<number, { entity: ScriptEntity; sceneIndex: number; cost: number }>();
  for (const p of path) {
    const prev = dedup.get(p.entity.start);
    if (!prev || p.cost < prev.cost) dedup.set(p.entity.start, p);
  }
  return Array.from(dedup.values()).sort((a, b) => a.entity.start - b.entity.start);
}

function scenePool(scenes: SceneRow[]) {
  return sceneVectors(scenes);
}

export interface PlanInput {
  jobId: string;
  audioUrl: string;
  audioDuration: number;
  words: WordTimestamp[];
  fps?: number;
  width?: number;
  height?: number;
}

export async function planSequence(input: PlanInput): Promise<{
  planId: string;
  sequence: SequenceJSON;
}> {
  const fps = input.fps ?? 30;
  const width = input.width ?? 1920;
  const height = input.height ?? 1080;

  const scenes = await listScenesForJob(input.jobId);
  const bureau = await listBureauImages();
  const vectors = scenePool(scenes);
  const entities = entitiesFromWords(input.words);
  const align = alignDTW(entities, vectors);

  const clips: ClipSegment[] = [];
  let cursor = 0;
  const used = new Set<string>();

  const COST_THRESHOLD = 0.85;

  for (const a of align) {
    const segStart = Math.max(cursor, a.entity.start);
    const segEnd = a.entity.end;
    if (segStart >= segEnd) continue;
    if (segStart > cursor) {
      addGap(clips, cursor, segStart, vectors, bureau, used);
    }
    if (a.cost > COST_THRESHOLD) {
      addGap(clips, segStart, segEnd, vectors, bureau, used);
    } else {
      const vec = vectors[a.sceneIndex];
      const sceneDuration = vec.scene.end_time - vec.scene.start_time;
      const needed = segEnd - segStart;
      let clipStart = vec.scene.start_time;
      let clipEnd = vec.scene.end_time;
      if (sceneDuration > needed) {
        const slack = sceneDuration - needed;
        const motionBias = vec.motion === 'high' ? 0.15 : vec.motion === 'medium' ? 0.3 : 0.5;
        clipStart = vec.scene.start_time + slack * motionBias;
        clipEnd = clipStart + needed;
      }
      if (sceneDuration >= needed) {
        clips.push({
          kind: 'footage',
          start: segStart,
          end: segEnd,
          sceneId: vec.scene.scene_id,
          sourceId: vec.scene.source_id,
          clipStart,
          clipEnd,
          reason: `dtw match cost=${a.cost.toFixed(2)}`,
        });
        used.add(vec.scene.scene_id);
      } else {
        clips.push({
          kind: 'loop',
          start: segStart,
          end: segEnd,
          sceneId: vec.scene.scene_id,
          sourceId: vec.scene.source_id,
          clipStart: vec.scene.start_time,
          clipEnd: vec.scene.end_time,
          reason: `looped (footage ${sceneDuration.toFixed(1)}s < need ${needed.toFixed(1)}s)`,
        });
        used.add(vec.scene.scene_id);
      }
    }
    cursor = segEnd;
  }
  if (cursor < input.audioDuration) {
    addGap(clips, cursor, input.audioDuration, vectors, bureau, used);
  }

  const sequence: SequenceJSON = {
    audioUrl: input.audioUrl,
    audioDuration: input.audioDuration,
    fps,
    width,
    height,
    clips,
  };
  const planId = randomUUID();
  await saveSequencePlan({
    plan_id: planId,
    job_id: input.jobId,
    audio_url: input.audioUrl,
    audio_duration_seconds: input.audioDuration,
    sequence_json: JSON.stringify(sequence),
    status: 'planned',
    render_url: null,
    rendered_at: null,
  });
  return { planId, sequence };
}

function addGap(
  clips: ClipSegment[],
  start: number,
  end: number,
  vectors: SceneVec[],
  bureau: BureauImageRow[],
  used: Set<string>,
): void {
  if (end <= start) return;
  const unused = vectors.filter((v) => !used.has(v.scene.scene_id));
  if (unused.length > 0) {
    const pick = unused[0];
    used.add(pick.scene.scene_id);
    const need = end - start;
    const dur = pick.scene.end_time - pick.scene.start_time;
    if (dur >= need) {
      clips.push({
        kind: 'footage',
        start, end,
        sceneId: pick.scene.scene_id,
        sourceId: pick.scene.source_id,
        clipStart: pick.scene.start_time,
        clipEnd: pick.scene.start_time + need,
        reason: 'gap-fill alt-source',
      });
    } else {
      clips.push({
        kind: 'loop',
        start, end,
        sceneId: pick.scene.scene_id,
        sourceId: pick.scene.source_id,
        clipStart: pick.scene.start_time,
        clipEnd: pick.scene.end_time,
        reason: 'gap-fill seamless loop',
      });
    }
    return;
  }
  if (bureau.length > 0) {
    const pick = bureau[clips.length % bureau.length];
    clips.push({
      kind: 'bureau',
      start, end,
      imageId: pick.image_id,
      imageUrl: pick.s3_url,
      reason: 'bureau injection (no footage match)',
    });
    return;
  }
  clips.push({
    kind: 'bureau',
    start, end,
    imageId: 'placeholder',
    imageUrl: '',
    reason: 'placeholder (no footage and no bureau images available)',
  });
}

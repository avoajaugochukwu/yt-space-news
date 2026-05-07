import { randomUUID } from 'node:crypto';
import {
  listBureauImages,
  listScenesForJob,
  saveSequencePlan,
  type BureauImageRow,
  type SceneRow,
} from './director-store';
import { inferChapters, type Chapter } from './director/chapters';
import type { WhisperWord } from './whisper';
import { getRun } from './turso';

export type WordTimestamp = WhisperWord;

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
  chapters?: Chapter[];
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

interface SceneVec {
  scene: SceneRow;
  tokens: Set<string>;
  hardware: Set<string>;
  motion: 'static' | 'low' | 'medium' | 'high';
}

function sceneVectors(scenes: SceneRow[]): SceneVec[] {
  return scenes.map((scene) => {
    const tokens = new Set<string>();
    const hardware = new Set<string>();
    let motion: SceneVec['motion'] = 'medium';
    if (scene.tags_json) {
      try {
        const t = JSON.parse(scene.tags_json) as {
          description?: string;
          tags?: string[];
          hardware?: string[];
          motion?: SceneVec['motion'];
        };
        if (t.description) for (const x of tokenize(t.description)) tokens.add(x);
        if (t.tags) for (const tag of t.tags) for (const x of tokenize(tag)) tokens.add(x);
        if (t.hardware) {
          for (const h of t.hardware) {
            hardware.add(h.toLowerCase());
            for (const x of tokenize(h)) tokens.add(x);
          }
        }
        if (t.motion) motion = t.motion;
      } catch {
        /* ignore */
      }
    }
    if (scene.description) for (const x of tokenize(scene.description)) tokens.add(x);
    return { scene, tokens, hardware, motion };
  });
}

function chapterTokens(c: Chapter): { tokens: Set<string>; hardware: Set<string> } {
  const tokens = new Set<string>();
  const hardware = new Set<string>();
  for (const x of tokenize(c.theme)) tokens.add(x);
  for (const x of tokenize(c.narrative)) tokens.add(x);
  for (const tag of c.tags) for (const x of tokenize(tag)) tokens.add(x);
  for (const h of c.namedEntities) {
    hardware.add(h.toLowerCase());
    for (const x of tokenize(h)) tokens.add(x);
  }
  return { tokens, hardware };
}

function scoreScene(vec: SceneVec, chap: { tokens: Set<string>; hardware: Set<string> }): number {
  let score = 0;
  for (const h of chap.hardware) if (vec.hardware.has(h)) score += 2.0;
  for (const t of vec.tokens) if (chap.tokens.has(t)) score += 1.0;
  return score;
}

const MIN_CLIP_SEC = 5;
const MAX_CLIP_SEC = 12;

interface AllocationResult {
  clips: ClipSegment[];
}

function allocateChapter(
  chapter: Chapter,
  vectors: SceneVec[],
  useCount: Map<string, number>,
  bureau: BureauImageRow[],
  bureauCursor: { i: number },
): AllocationResult {
  if (vectors.length === 0) {
    return {
      clips: [
        bureauClip(
          chapter.startSec,
          chapter.endSec,
          bureau,
          bureauCursor,
          `bureau (no scenes for "${chapter.theme}")`,
        ),
      ],
    };
  }
  const ct = chapterTokens(chapter);

  // Walk the chapter timeline. For each step pick the next scene by:
  //   1. Must NOT be the same scene as the previous clip (kills back-to-back
  //      repeats; "user memory is too fresh to loop").
  //   2. Strongly prefer never-used scenes (use count ascending).
  //   3. Among ties, prefer higher match score against the chapter.
  // Each clip is the scene's natural duration capped at MAX_CLIP_SEC; we never
  // emit a loop. Short scenes (<MIN_CLIP_SEC) are accepted because cutting to
  // a different scene is always better than looping the same one.
  const clips: ClipSegment[] = [];
  let cursor = chapter.startSec;
  let lastSceneId: string | null = null;

  while (cursor < chapter.endSec - 0.001) {
    const remaining = chapter.endSec - cursor;
    const candidates = vectors
      .filter((v) => v.scene.scene_id !== lastSceneId)
      .map((v) => ({
        vec: v,
        used: useCount.get(v.scene.scene_id) ?? 0,
        matchScore: scoreScene(v, ct),
      }))
      .sort((a, b) => {
        if (a.used !== b.used) return a.used - b.used;
        return b.matchScore - a.matchScore;
      });

    if (candidates.length === 0) {
      clips.push(
        bureauClip(
          cursor,
          chapter.endSec,
          bureau,
          bureauCursor,
          `bureau (only one scene available; cannot loop)`,
        ),
      );
      break;
    }

    const pick = candidates[0];
    const sceneDur = pick.vec.scene.end_time - pick.vec.scene.start_time;
    const sliceDur = Math.min(remaining, sceneDur, MAX_CLIP_SEC);
    const tag = pick.used === 0 ? 'fresh' : `reuse#${pick.used + 1}`;
    clips.push(
      makeFootageClip(
        pick.vec,
        cursor,
        cursor + sliceDur,
        `chapter "${chapter.theme}" · ${tag} · score ${pick.matchScore.toFixed(1)}`,
      ),
    );
    cursor += sliceDur;
    useCount.set(
      pick.vec.scene.scene_id,
      (useCount.get(pick.vec.scene.scene_id) ?? 0) + 1,
    );
    lastSceneId = pick.vec.scene.scene_id;
  }

  return { clips };
}

function makeFootageClip(
  vec: SceneVec,
  start: number,
  end: number,
  reason: string,
): ClipSegment {
  const need = end - start;
  const sceneDur = vec.scene.end_time - vec.scene.start_time;
  // Caller guarantees need <= sceneDur. If not, clip to scene's end (clip
  // shorter than slot is preferable to a loop — the loop creates the visible
  // glitch users notice).
  const used = Math.min(need, sceneDur);
  const slack = sceneDur - used;
  const motionBias = vec.motion === 'high' ? 0.15 : vec.motion === 'medium' ? 0.3 : 0.5;
  const clipStart = vec.scene.start_time + slack * motionBias;
  return {
    kind: 'footage',
    start,
    end: start + used,
    sceneId: vec.scene.scene_id,
    sourceId: vec.scene.source_id,
    clipStart,
    clipEnd: clipStart + used,
    reason,
  };
}

function bureauClip(
  start: number,
  end: number,
  bureau: BureauImageRow[],
  cursor: { i: number },
  reason: string,
): ClipSegment {
  if (bureau.length === 0) {
    return { kind: 'bureau', start, end, imageId: 'placeholder', imageUrl: '', reason: `${reason} (no bureau images)` };
  }
  const pick = bureau[cursor.i % bureau.length];
  cursor.i += 1;
  return { kind: 'bureau', start, end, imageId: pick.image_id, imageUrl: pick.s3_url, reason };
}

export interface PlanInput {
  jobId: string;
  audioUrl: string;
  audioDuration: number;
  words: WordTimestamp[];
  fps?: number;
  width?: number;
  height?: number;
  script?: string | null;
  chapters?: Chapter[];
}

export async function planSequence(input: PlanInput): Promise<{
  planId: string;
  sequence: SequenceJSON;
}> {
  const fps = input.fps ?? 30;
  const width = input.width ?? 1920;
  const height = input.height ?? 1080;

  let script: string | null | undefined = input.script;
  if (script === undefined) {
    try {
      const run = await getRun(input.jobId);
      script = run?.script ?? null;
    } catch {
      script = null;
    }
  }

  const [scenes, bureau] = await Promise.all([
    listScenesForJob(input.jobId),
    listBureauImages(),
  ]);
  const chapters =
    input.chapters && input.chapters.length > 0
      ? input.chapters
      : await inferChapters({
          words: input.words,
          audioDuration: input.audioDuration,
          script,
        });
  const vectors = sceneVectors(scenes);

  const useCount = new Map<string, number>();
  const bureauCursor = { i: 0 };
  const clips: ClipSegment[] = [];
  for (const chap of chapters) {
    const r = allocateChapter(chap, vectors, useCount, bureau, bureauCursor);
    clips.push(...r.clips);
  }

  const sequence: SequenceJSON = {
    audioUrl: input.audioUrl,
    audioDuration: input.audioDuration,
    fps,
    width,
    height,
    clips,
    chapters,
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

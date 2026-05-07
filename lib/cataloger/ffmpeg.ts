import { spawn } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export interface ProbeInfo {
  duration: number;
  width: number;
  height: number;
  fps: number;
}

function run(bin: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args);
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    p.stdout.on('data', (c) => stdoutChunks.push(c));
    p.stderr.on('data', (c) => stderrChunks.push(c));
    p.on('error', reject);
    p.on('close', (code) => {
      const stdout = Buffer.concat(stdoutChunks).toString('utf8');
      const stderr = Buffer.concat(stderrChunks).toString('utf8');
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${bin} exited ${code}: ${stderr}`));
    });
  });
}

export async function probe(filePath: string): Promise<ProbeInfo> {
  const { stdout } = await run('ffprobe', [
    '-v', 'error',
    '-print_format', 'json',
    '-show_streams',
    '-show_format',
    filePath,
  ]);
  const j = JSON.parse(stdout) as {
    streams: Array<{ codec_type: string; width?: number; height?: number; r_frame_rate?: string; avg_frame_rate?: string; duration?: string }>;
    format: { duration?: string };
  };
  const v = j.streams.find((s) => s.codec_type === 'video');
  const fr = v?.avg_frame_rate || v?.r_frame_rate || '30/1';
  const [n, d] = fr.split('/').map(Number);
  return {
    duration: Number(j.format.duration ?? v?.duration ?? 0),
    width: v?.width ?? 0,
    height: v?.height ?? 0,
    fps: d ? n / d : 30,
  };
}

export interface SceneCut {
  start: number;
  end: number;
}

export async function detectScenes(
  filePath: string,
  duration: number,
  threshold = 0.35,
): Promise<SceneCut[]> {
  const { stderr } = await run('ffmpeg', [
    '-i', filePath,
    '-filter:v', `select='gt(scene,${threshold})',showinfo`,
    '-f', 'null',
    '-',
  ]).catch((e: Error) => ({ stdout: '', stderr: e.message }));

  const cutTimes: number[] = [0];
  const re = /pts_time:([0-9.]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stderr))) {
    const t = Number(m[1]);
    if (t > (cutTimes[cutTimes.length - 1] ?? 0) + 0.5) cutTimes.push(t);
  }
  if (duration > (cutTimes[cutTimes.length - 1] ?? 0)) cutTimes.push(duration);

  const scenes: SceneCut[] = [];
  for (let i = 0; i < cutTimes.length - 1; i++) {
    scenes.push({ start: cutTimes[i], end: cutTimes[i + 1] });
  }
  if (scenes.length === 0) scenes.push({ start: 0, end: duration });
  return scenes;
}

export async function extractKeyframe(
  filePath: string,
  timeSeconds: number,
  width = 640,
): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), 'kf-'));
  const out = path.join(dir, 'kf.jpg');
  try {
    await run('ffmpeg', [
      '-y',
      '-ss', timeSeconds.toFixed(3),
      '-i', filePath,
      '-frames:v', '1',
      '-vf', `scale=${width}:-2`,
      '-q:v', '4',
      out,
    ]);
    return await readFile(out);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// Sample N candidate frames evenly across the scene, return the sharpest +
// reject the scene entirely if the best candidate looks like a transition
// (uniform frame, fade-to-black, etc.). The heuristic uses JPG compressed-byte
// size at constant quality: low-detail/uniform frames compress to small files,
// high-detail in-focus frames compress to larger files. Cheap, no extra deps.
const TRANSITION_BYTE_THRESHOLD = 6_000; // ~6KB at 1280px q=4 is junk

export async function extractBestKeyframe(
  filePath: string,
  scene: { start: number; end: number },
  width = 1280,
  candidates = 5,
): Promise<Buffer | null> {
  const duration = scene.end - scene.start;
  if (duration <= 0) return null;
  const offsets: number[] = [];
  // Sample inside (avoid boundaries, which often catch the cut transition).
  for (let i = 0; i < candidates; i++) {
    const t = scene.start + ((i + 1) / (candidates + 1)) * duration;
    offsets.push(t);
  }

  const buffers = await Promise.all(
    offsets.map(async (t) => {
      try {
        return await extractKeyframe(filePath, t, width);
      } catch {
        return null;
      }
    }),
  );

  let best: Buffer | null = null;
  for (const b of buffers) {
    if (b && (!best || b.byteLength > best.byteLength)) best = b;
  }
  if (!best || best.byteLength < TRANSITION_BYTE_THRESHOLD) return null;
  return best;
}

export async function downloadToTemp(url: string, ext = '.mp4'): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'src-'));
  const file = path.join(dir, `src${ext}`);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${url} failed: ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  await writeFile(file, buf);
  return file;
}

export async function cleanupTempParent(filePath: string): Promise<void> {
  await rm(path.dirname(filePath), { recursive: true, force: true });
}

export async function listFiles(dir: string): Promise<string[]> {
  return readdir(dir);
}

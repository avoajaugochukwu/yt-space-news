import { createClient, type Client } from '@libsql/client';

let client: Client | null = null;
let initPromise: Promise<void> | null = null;

function tursoUrl(): string {
  const raw = process.env.TURSO_ENDPOINT;
  if (!raw) throw new Error('TURSO_ENDPOINT env var is not set');
  return raw.replace(/^libsql:\/\//, 'https://');
}

function getClient(): Client {
  if (client) return client;
  const authToken = process.env.TURSO_API_KEY;
  if (!authToken) throw new Error('TURSO_API_KEY env var is not set');
  client = createClient({ url: tursoUrl(), authToken });
  return client;
}

async function ensureSchema(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const c = getClient();
    await c.execute(`
      CREATE TABLE IF NOT EXISTS video_sources (
        source_id TEXT PRIMARY KEY,
        job_id TEXT,
        s3_key TEXT NOT NULL,
        s3_url TEXT NOT NULL,
        original_name TEXT,
        duration_seconds REAL,
        width INTEGER,
        height INTEGER,
        fps REAL,
        status TEXT NOT NULL DEFAULT 'uploaded',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    await c.execute(
      'CREATE INDEX IF NOT EXISTS idx_video_sources_job ON video_sources(job_id)',
    );
    await c.execute(`
      CREATE TABLE IF NOT EXISTS scenes (
        scene_id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        job_id TEXT,
        start_time REAL NOT NULL,
        end_time REAL NOT NULL,
        keyframe_s3_key TEXT,
        keyframe_url TEXT,
        description TEXT,
        tags_json TEXT,
        embedding_json TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    await c.execute(
      'CREATE INDEX IF NOT EXISTS idx_scenes_source ON scenes(source_id)',
    );
    await c.execute(
      'CREATE INDEX IF NOT EXISTS idx_scenes_job ON scenes(job_id)',
    );
    await c.execute(`
      CREATE TABLE IF NOT EXISTS bureau_images (
        image_id TEXT PRIMARY KEY,
        s3_key TEXT NOT NULL,
        s3_url TEXT NOT NULL,
        description TEXT,
        tags_json TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    await c.execute(`
      CREATE TABLE IF NOT EXISTS sequence_plans (
        plan_id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        audio_url TEXT NOT NULL,
        audio_duration_seconds REAL NOT NULL,
        sequence_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'planned',
        render_url TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        rendered_at TEXT
      )
    `);
    await c.execute(
      'CREATE INDEX IF NOT EXISTS idx_sequence_plans_job ON sequence_plans(job_id)',
    );
  })().catch((err) => {
    initPromise = null;
    throw err;
  });
  return initPromise;
}

export interface VideoSource {
  source_id: string;
  job_id: string | null;
  s3_key: string;
  s3_url: string;
  original_name: string | null;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  status: string;
  created_at: string;
}

export interface SceneRow {
  scene_id: string;
  source_id: string;
  job_id: string | null;
  start_time: number;
  end_time: number;
  keyframe_s3_key: string | null;
  keyframe_url: string | null;
  description: string | null;
  tags_json: string | null;
  embedding_json: string | null;
  created_at: string;
}

export interface BureauImageRow {
  image_id: string;
  s3_key: string;
  s3_url: string;
  description: string | null;
  tags_json: string | null;
  created_at: string;
}

export interface SequencePlanRow {
  plan_id: string;
  job_id: string;
  audio_url: string;
  audio_duration_seconds: number;
  sequence_json: string;
  status: string;
  render_url: string | null;
  created_at: string;
  rendered_at: string | null;
}

export async function saveVideoSource(s: Omit<VideoSource, 'created_at'>): Promise<void> {
  await ensureSchema();
  await getClient().execute({
    sql: `INSERT OR REPLACE INTO video_sources
            (source_id, job_id, s3_key, s3_url, original_name, duration_seconds,
             width, height, fps, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      s.source_id, s.job_id, s.s3_key, s.s3_url, s.original_name,
      s.duration_seconds, s.width, s.height, s.fps, s.status,
    ],
  });
}

export async function listVideoSources(jobId?: string): Promise<VideoSource[]> {
  await ensureSchema();
  const c = getClient();
  const r = jobId
    ? await c.execute({
        sql: 'SELECT * FROM video_sources WHERE job_id = ? ORDER BY created_at',
        args: [jobId],
      })
    : await c.execute('SELECT * FROM video_sources ORDER BY created_at DESC LIMIT 200');
  return r.rows as unknown as VideoSource[];
}

export async function saveScene(s: Omit<SceneRow, 'created_at'>): Promise<void> {
  await ensureSchema();
  await getClient().execute({
    sql: `INSERT OR REPLACE INTO scenes
            (scene_id, source_id, job_id, start_time, end_time,
             keyframe_s3_key, keyframe_url, description, tags_json, embedding_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      s.scene_id, s.source_id, s.job_id, s.start_time, s.end_time,
      s.keyframe_s3_key, s.keyframe_url, s.description, s.tags_json, s.embedding_json,
    ],
  });
}

export async function listScenesForJob(jobId: string): Promise<SceneRow[]> {
  await ensureSchema();
  const r = await getClient().execute({
    sql: 'SELECT * FROM scenes WHERE job_id = ? ORDER BY source_id, start_time',
    args: [jobId],
  });
  return r.rows as unknown as SceneRow[];
}

export async function getScene(sceneId: string): Promise<SceneRow | null> {
  await ensureSchema();
  const r = await getClient().execute({
    sql: 'SELECT * FROM scenes WHERE scene_id = ? LIMIT 1',
    args: [sceneId],
  });
  if (r.rows.length === 0) return null;
  return r.rows[0] as unknown as SceneRow;
}

export async function deleteScene(sceneId: string): Promise<void> {
  await ensureSchema();
  await getClient().execute({
    sql: 'DELETE FROM scenes WHERE scene_id = ?',
    args: [sceneId],
  });
}

export async function listScenesForSource(sourceId: string): Promise<SceneRow[]> {
  await ensureSchema();
  const r = await getClient().execute({
    sql: 'SELECT * FROM scenes WHERE source_id = ? ORDER BY start_time',
    args: [sourceId],
  });
  return r.rows as unknown as SceneRow[];
}

export async function listBureauImages(): Promise<BureauImageRow[]> {
  await ensureSchema();
  const r = await getClient().execute(
    'SELECT * FROM bureau_images ORDER BY created_at DESC LIMIT 200',
  );
  return r.rows as unknown as BureauImageRow[];
}

export async function saveBureauImage(b: Omit<BureauImageRow, 'created_at'>): Promise<void> {
  await ensureSchema();
  await getClient().execute({
    sql: `INSERT OR REPLACE INTO bureau_images
            (image_id, s3_key, s3_url, description, tags_json)
          VALUES (?, ?, ?, ?, ?)`,
    args: [b.image_id, b.s3_key, b.s3_url, b.description, b.tags_json],
  });
}

export async function saveSequencePlan(p: Omit<SequencePlanRow, 'created_at'>): Promise<void> {
  await ensureSchema();
  await getClient().execute({
    sql: `INSERT OR REPLACE INTO sequence_plans
            (plan_id, job_id, audio_url, audio_duration_seconds, sequence_json,
             status, render_url, rendered_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      p.plan_id, p.job_id, p.audio_url, p.audio_duration_seconds, p.sequence_json,
      p.status, p.render_url, p.rendered_at,
    ],
  });
}

export async function getSequencePlan(planId: string): Promise<SequencePlanRow | null> {
  await ensureSchema();
  const r = await getClient().execute({
    sql: 'SELECT * FROM sequence_plans WHERE plan_id = ? LIMIT 1',
    args: [planId],
  });
  if (r.rows.length === 0) return null;
  return r.rows[0] as unknown as SequencePlanRow;
}

export async function listSequencePlans(jobId?: string): Promise<SequencePlanRow[]> {
  await ensureSchema();
  const c = getClient();
  const r = jobId
    ? await c.execute({
        sql: 'SELECT * FROM sequence_plans WHERE job_id = ? ORDER BY created_at DESC',
        args: [jobId],
      })
    : await c.execute('SELECT * FROM sequence_plans ORDER BY created_at DESC LIMIT 100');
  return r.rows as unknown as SequencePlanRow[];
}

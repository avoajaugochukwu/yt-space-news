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
      CREATE TABLE IF NOT EXISTS processed_videos (
        video_id TEXT PRIMARY KEY,
        channel_handle TEXT NOT NULL,
        title TEXT NOT NULL,
        accuracy_score INTEGER,
        audio_url TEXT,
        script TEXT,
        processed_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    const pvCols = await c.execute('PRAGMA table_info(processed_videos)');
    const hasScript = pvCols.rows.some(
      (r) => (r as unknown as { name: string }).name === 'script',
    );
    if (!hasScript) {
      await c.execute('ALTER TABLE processed_videos ADD COLUMN script TEXT');
    }
    await c.execute(`
      CREATE TABLE IF NOT EXISTS pipeline_runs (
        job_id TEXT PRIMARY KEY,
        channel_handle TEXT NOT NULL,
        video_id TEXT,
        video_url TEXT,
        video_title TEXT,
        status TEXT NOT NULL,
        already_processed INTEGER NOT NULL DEFAULT 0,
        accuracy_score INTEGER,
        audio_url TEXT,
        transcript TEXT,
        script TEXT,
        seo_json TEXT,
        error TEXT,
        started_at TEXT NOT NULL,
        finished_at TEXT
      )
    `);
    const prCols = await c.execute('PRAGMA table_info(pipeline_runs)');
    const hasSeo = prCols.rows.some(
      (r) => (r as unknown as { name: string }).name === 'seo_json',
    );
    if (!hasSeo) {
      await c.execute('ALTER TABLE pipeline_runs ADD COLUMN seo_json TEXT');
    }
    await c.execute(
      'CREATE INDEX IF NOT EXISTS idx_pipeline_runs_started_at ON pipeline_runs(started_at DESC)',
    );
    await c.execute(
      "DELETE FROM processed_videos WHERE processed_at < datetime('now', '-7 days')",
    );
    await c.execute(
      "DELETE FROM pipeline_runs WHERE started_at < datetime('now', '-7 days')",
    );
  })().catch((err) => {
    initPromise = null;
    throw err;
  });
  return initPromise;
}

export interface ProcessedVideo {
  video_id: string;
  channel_handle: string;
  title: string;
  accuracy_score: number | null;
  audio_url: string | null;
  script: string | null;
  processed_at: string;
}

export async function purgeOldRows(): Promise<{ processed: number; runs: number }> {
  await ensureSchema();
  const c = getClient();
  const a = await c.execute(
    "DELETE FROM processed_videos WHERE processed_at < datetime('now', '-7 days')",
  );
  const b = await c.execute(
    "DELETE FROM pipeline_runs WHERE started_at < datetime('now', '-7 days')",
  );
  return {
    processed: Number(a.rowsAffected ?? 0),
    runs: Number(b.rowsAffected ?? 0),
  };
}

export interface PipelineRunRow {
  job_id: string;
  channel_handle: string;
  video_id: string | null;
  video_url: string | null;
  video_title: string | null;
  status: string;
  already_processed: number;
  accuracy_score: number | null;
  audio_url: string | null;
  transcript: string | null;
  script: string | null;
  seo_json: string | null;
  error: string | null;
  started_at: string;
  finished_at: string | null;
}

export async function saveRun(v: {
  job_id: string;
  channel_handle: string;
  video_id: string | null;
  video_url: string | null;
  video_title: string | null;
  status: string;
  already_processed: boolean;
  accuracy_score: number | null;
  audio_url: string | null;
  transcript: string | null;
  script: string | null;
  seo_json: string | null;
  error: string | null;
  started_at: string;
  finished_at: string | null;
}): Promise<void> {
  await ensureSchema();
  await getClient().execute({
    sql: `INSERT OR REPLACE INTO pipeline_runs
            (job_id, channel_handle, video_id, video_url, video_title, status,
             already_processed, accuracy_score, audio_url, transcript, script,
             seo_json, error, started_at, finished_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      v.job_id,
      v.channel_handle,
      v.video_id,
      v.video_url,
      v.video_title,
      v.status,
      v.already_processed ? 1 : 0,
      v.accuracy_score,
      v.audio_url,
      v.transcript,
      v.script,
      v.seo_json,
      v.error,
      v.started_at,
      v.finished_at,
    ],
  });
}

const RUN_LIST_COLS =
  'job_id, channel_handle, video_id, video_url, video_title, status, already_processed, accuracy_score, audio_url, started_at, finished_at';
const RUN_FULL_COLS =
  'job_id, channel_handle, video_id, video_url, video_title, status, already_processed, accuracy_score, audio_url, transcript, script, seo_json, error, started_at, finished_at';

export async function listRuns(limit = 100): Promise<PipelineRunRow[]> {
  await ensureSchema();
  const r = await getClient().execute({
    sql: `SELECT ${RUN_LIST_COLS} FROM pipeline_runs ORDER BY started_at DESC LIMIT ?`,
    args: [limit],
  });
  return r.rows as unknown as PipelineRunRow[];
}

export async function getRun(jobId: string): Promise<PipelineRunRow | null> {
  await ensureSchema();
  const r = await getClient().execute({
    sql: `SELECT ${RUN_FULL_COLS} FROM pipeline_runs WHERE job_id = ? LIMIT 1`,
    args: [jobId],
  });
  if (r.rows.length === 0) return null;
  return r.rows[0] as unknown as PipelineRunRow;
}

export async function isProcessed(videoId: string): Promise<boolean> {
  await ensureSchema();
  const r = await getClient().execute({
    sql: 'SELECT 1 FROM processed_videos WHERE video_id = ? LIMIT 1',
    args: [videoId],
  });
  return r.rows.length > 0;
}

export async function getProcessed(videoId: string): Promise<ProcessedVideo | null> {
  await ensureSchema();
  const r = await getClient().execute({
    sql: 'SELECT video_id, channel_handle, title, accuracy_score, audio_url, script, processed_at FROM processed_videos WHERE video_id = ? LIMIT 1',
    args: [videoId],
  });
  if (r.rows.length === 0) return null;
  return r.rows[0] as unknown as ProcessedVideo;
}

export async function saveProcessed(v: {
  video_id: string;
  channel_handle: string;
  title: string;
  accuracy_score: number | null;
  audio_url: string | null;
  script: string | null;
}): Promise<void> {
  await ensureSchema();
  await getClient().execute({
    sql: `INSERT OR REPLACE INTO processed_videos
            (video_id, channel_handle, title, accuracy_score, audio_url, script, processed_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
    args: [v.video_id, v.channel_handle, v.title, v.accuracy_score, v.audio_url, v.script],
  });
}

export async function listProcessed(limit = 50): Promise<ProcessedVideo[]> {
  await ensureSchema();
  const r = await getClient().execute({
    sql: 'SELECT video_id, channel_handle, title, accuracy_score, audio_url, script, processed_at FROM processed_videos ORDER BY processed_at DESC LIMIT ?',
    args: [limit],
  });
  return r.rows as unknown as ProcessedVideo[];
}

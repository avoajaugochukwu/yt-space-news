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
    await getClient().execute(`
      CREATE TABLE IF NOT EXISTS processed_videos (
        video_id TEXT PRIMARY KEY,
        channel_handle TEXT NOT NULL,
        title TEXT NOT NULL,
        accuracy_score INTEGER,
        audio_url TEXT,
        processed_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
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
  processed_at: string;
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
    sql: 'SELECT video_id, channel_handle, title, accuracy_score, audio_url, processed_at FROM processed_videos WHERE video_id = ? LIMIT 1',
    args: [videoId],
  });
  if (r.rows.length === 0) return null;
  const row = r.rows[0] as unknown as ProcessedVideo;
  return row;
}

export async function saveProcessed(v: {
  video_id: string;
  channel_handle: string;
  title: string;
  accuracy_score: number | null;
  audio_url: string | null;
}): Promise<void> {
  await ensureSchema();
  await getClient().execute({
    sql: `INSERT OR REPLACE INTO processed_videos
            (video_id, channel_handle, title, accuracy_score, audio_url, processed_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    args: [v.video_id, v.channel_handle, v.title, v.accuracy_score, v.audio_url],
  });
}

export async function listProcessed(limit = 50): Promise<ProcessedVideo[]> {
  await ensureSchema();
  const r = await getClient().execute({
    sql: 'SELECT video_id, channel_handle, title, accuracy_score, audio_url, processed_at FROM processed_videos ORDER BY processed_at DESC LIMIT ?',
    args: [limit],
  });
  return r.rows as unknown as ProcessedVideo[];
}

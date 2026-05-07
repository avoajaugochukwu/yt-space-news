// Walk pipeline_runs + processed_videos, find broken audio_url links,
// re-upload from upstream voice-generator, and rewrite Turso rows so all
// audio links are permanent public S3 URLs.
//
// Usage:  npx tsx --env-file=.env.local scripts/repair-audio.ts
//
// Idempotent. Only touches rows whose audio_url currently HEADs to non-200.

import { createClient } from '@libsql/client';
import { uploadTtsAudioToS3 } from '../lib/voice-generator';

interface Row {
  pk: string;
  audio_url: string;
}

const TURSO_URL = (process.env.TURSO_ENDPOINT ?? '').replace('libsql://', 'https://');
const TURSO_TOKEN = process.env.TURSO_API_KEY;
if (!TURSO_URL || !TURSO_TOKEN) {
  console.error('TURSO_ENDPOINT and TURSO_API_KEY must be set');
  process.exit(1);
}

const client = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

function jobIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    // Voice-generator pattern:  /tts/jobs/<jobId>/download
    const ttsMatch = u.pathname.match(/\/tts\/jobs\/([^/]+)\/download/);
    if (ttsMatch) return decodeURIComponent(ttsMatch[1]);
    // Our S3 pattern:  /audio/<jobId>.mp3
    const s3Match = u.pathname.match(/\/audio\/([^/]+)\.mp3$/);
    if (s3Match) return decodeURIComponent(s3Match[1]);
    return null;
  } catch {
    return null;
  }
}

async function isReachable(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: 'HEAD' });
    return r.ok;
  } catch {
    return false;
  }
}

async function repairTable(table: string, pkCol: string): Promise<void> {
  const r = await client.execute({
    sql: `SELECT ${pkCol} AS pk, audio_url FROM ${table} WHERE audio_url IS NOT NULL`,
  });
  const rows = r.rows as unknown as Row[];
  console.log(`[${table}] ${rows.length} rows with audio_url`);

  let ok = 0;
  let repaired = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const reachable = await isReachable(row.audio_url);
    if (reachable) {
      ok += 1;
      continue;
    }
    const jobId = jobIdFromUrl(row.audio_url);
    if (!jobId) {
      skipped += 1;
      console.warn(`  [skip] ${row.pk}: cannot parse jobId from ${row.audio_url}`);
      continue;
    }
    try {
      const newUrl = await uploadTtsAudioToS3(jobId);
      await client.execute({
        sql: `UPDATE ${table} SET audio_url = ? WHERE ${pkCol} = ?`,
        args: [newUrl, row.pk],
      });
      repaired += 1;
      console.log(`  [ok] ${row.pk}: ${jobId} → ${newUrl}`);
    } catch (err) {
      failed += 1;
      console.warn(`  [fail] ${row.pk}: ${(err as Error).message}`);
    }
  }

  console.log(
    `[${table}] ok=${ok} repaired=${repaired} skipped=${skipped} failed=${failed}`,
  );
}

async function main(): Promise<void> {
  await repairTable('pipeline_runs', 'job_id');
  await repairTable('processed_videos', 'video_id');
  console.log('done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

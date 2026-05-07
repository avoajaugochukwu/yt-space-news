import {
  deleteScenesForJob,
  deleteSequencePlansForJob,
  deleteVideoSourcesForJob,
  listScenesForJob,
  listSequencePlans,
  listVideoSources,
} from './director-store';
import { deleteObjects } from './storage/s3';

export interface CleanupReport {
  jobId: string;
  s3Deleted: number;
  sourcesDeleted: number;
  scenesDeleted: number;
  plansDeleted: number;
}

// Wipe every transient artifact for a job: source videos, keyframes, our own
// audio uploads, cataloger rows, and sequence plans. We never touch the
// `renders/` prefix or `bureau_images` — those are the only persistent things.
export async function cleanupJob(jobId: string): Promise<CleanupReport> {
  const [sources, scenes, plans] = await Promise.all([
    listVideoSources(jobId),
    listScenesForJob(jobId),
    listSequencePlans(jobId),
  ]);

  const keys = new Set<string>();
  for (const s of sources) if (s.s3_key) keys.add(s.s3_key);
  for (const sc of scenes) if (sc.keyframe_s3_key) keys.add(sc.keyframe_s3_key);
  // NB: never delete `audio/` objects — they're referenced from
  // pipeline_runs.audio_url and must persist (no expiring links).

  try {
    await deleteObjects(Array.from(keys));
  } catch (err) {
    console.warn('[cleanup] s3 delete failed:', (err as Error).message);
  }

  await Promise.all([
    deleteScenesForJob(jobId),
    deleteVideoSourcesForJob(jobId),
    deleteSequencePlansForJob(jobId),
  ]);

  return {
    jobId,
    s3Deleted: keys.size,
    sourcesDeleted: sources.length,
    scenesDeleted: scenes.length,
    plansDeleted: plans.length,
  };
}

import { renderMediaOnLambda, getRenderProgress } from '@remotion/lambda/client';
import { CopyObjectCommand } from '@aws-sdk/client-s3';
import {
  getSequencePlan,
  listVideoSources,
  saveSequencePlan,
} from './director-store';
import type { SequenceJSON } from './director';
import { AWS_REGION, MEDIA_BUCKET, publicUrl } from './storage/aws';
import { getS3 } from './storage/s3';

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} not set`);
  return v;
}

async function hydrateSequence(planId: string): Promise<{
  sequence: SequenceJSON;
  jobId: string;
}> {
  const plan = await getSequencePlan(planId);
  if (!plan) throw new Error(`plan ${planId} not found`);
  const seq = JSON.parse(plan.sequence_json) as SequenceJSON;
  const sources = await listVideoSources(plan.job_id);
  const byId = new Map(sources.map((s) => [s.source_id, s]));
  seq.clips = seq.clips.map((c) => {
    if (c.kind === 'footage' || c.kind === 'loop') {
      const src = byId.get(c.sourceId);
      return { ...c, sourceUrl: src?.s3_url };
    }
    return c;
  });
  return { sequence: seq, jobId: plan.job_id };
}

// Remotion caps concurrent functions at 200. Pick framesPerLambda so we never
// exceed that cap, with a floor of 80 to keep short renders parallel.
const MAX_LAMBDA_FUNCTIONS = 200;
const MIN_FRAMES_PER_LAMBDA = 80;

function pickFramesPerLambda(frameCount: number): number {
  const minFromCap = Math.ceil(frameCount / MAX_LAMBDA_FUNCTIONS);
  return Math.max(MIN_FRAMES_PER_LAMBDA, minFromCap);
}

export async function startRender(planId: string): Promise<{
  renderId: string;
  bucketName: string;
}> {
  const { sequence } = await hydrateSequence(planId);
  const functionName = envOrThrow('REMOTION_LAMBDA_FUNCTION_NAME');
  const serveUrl = envOrThrow('REMOTION_SERVE_URL');

  const frameCount = Math.max(
    1,
    Math.round(sequence.audioDuration * sequence.fps),
  );
  const framesPerLambda = pickFramesPerLambda(frameCount);

  const r = await renderMediaOnLambda({
    region: AWS_REGION as 'us-west-2',
    functionName,
    serveUrl,
    composition: 'BureauNews',
    inputProps: { sequence },
    codec: 'h264',
    imageFormat: 'jpeg',
    privacy: 'public',
    maxRetries: 1,
    framesPerLambda,
  });

  return { renderId: r.renderId, bucketName: r.bucketName };
}

async function copyToMediaBucket(
  srcBucket: string,
  srcUrl: string,
  planId: string,
): Promise<string> {
  // Remotion may return either virtual-hosted style
  //   https://<bucket>.s3.<region>.amazonaws.com/<key>
  // or path style
  //   https://s3.<region>.amazonaws.com/<bucket>/<key>
  const u = new URL(srcUrl);
  const path = u.pathname.replace(/^\//, '');
  const srcKey = u.hostname.startsWith(`${srcBucket}.`)
    ? decodeURIComponent(path)
    : decodeURIComponent(path.replace(new RegExp(`^${srcBucket}/`), ''));
  const dstKey = `renders/${planId}.mp4`;
  await getS3().send(
    new CopyObjectCommand({
      Bucket: MEDIA_BUCKET,
      Key: dstKey,
      CopySource: `/${srcBucket}/${srcKey}`,
      ContentType: 'video/mp4',
      MetadataDirective: 'REPLACE',
    }),
  );
  return publicUrl(dstKey);
}

export async function pollRender(input: {
  planId: string;
  renderId: string;
  bucketName: string;
}): Promise<{
  done: boolean;
  progress: number;
  outputUrl?: string;
  error?: string;
}> {
  const functionName = envOrThrow('REMOTION_LAMBDA_FUNCTION_NAME');
  const p = await getRenderProgress({
    renderId: input.renderId,
    bucketName: input.bucketName,
    functionName,
    region: AWS_REGION as 'us-west-2',
  });
  if (p.fatalErrorEncountered) {
    return { done: true, progress: 1, error: p.errors?.[0]?.message ?? 'render failed' };
  }
  if (p.done && p.outputFile) {
    let finalUrl = p.outputFile;
    try {
      finalUrl = await copyToMediaBucket(input.bucketName, p.outputFile, input.planId);
    } catch (err) {
      console.warn('[render] copy to media bucket failed:', (err as Error).message);
    }
    const plan = await getSequencePlan(input.planId);
    if (plan) {
      await saveSequencePlan({
        plan_id: plan.plan_id,
        job_id: plan.job_id,
        audio_url: plan.audio_url,
        audio_duration_seconds: plan.audio_duration_seconds,
        sequence_json: plan.sequence_json,
        status: 'rendered',
        render_url: finalUrl,
        rendered_at: new Date().toISOString(),
      });
    }
    return { done: true, progress: 1, outputUrl: finalUrl };
  }
  return { done: false, progress: p.overallProgress ?? 0 };
}

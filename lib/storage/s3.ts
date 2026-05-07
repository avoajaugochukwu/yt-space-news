import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AWS_REGION, MEDIA_BUCKET, publicUrl, s3Key, type S3PrefixKey } from './aws';

let client: S3Client | null = null;

export function getS3(): S3Client {
  if (client) return client;
  client = new S3Client({
    region: AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
  return client;
}

export async function putBuffer(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<{ key: string; url: string }> {
  await getS3().send(
    new PutObjectCommand({
      Bucket: MEDIA_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  return { key, url: publicUrl(key) };
}

export async function headObject(key: string): Promise<{ size: number; contentType?: string } | null> {
  try {
    const r = await getS3().send(
      new HeadObjectCommand({ Bucket: MEDIA_BUCKET, Key: key }),
    );
    return { size: Number(r.ContentLength ?? 0), contentType: r.ContentType };
  } catch {
    return null;
  }
}

export async function deleteObject(key: string): Promise<void> {
  await getS3().send(new DeleteObjectCommand({ Bucket: MEDIA_BUCKET, Key: key }));
}

export async function deleteObjects(keys: string[]): Promise<void> {
  const filtered = keys.filter(Boolean);
  if (filtered.length === 0) return;
  for (let i = 0; i < filtered.length; i += 1000) {
    const chunk = filtered.slice(i, i + 1000);
    await getS3().send(
      new DeleteObjectsCommand({
        Bucket: MEDIA_BUCKET,
        Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true },
      }),
    );
  }
}

export function ourBucketKey(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const region = AWS_REGION;
    if (u.hostname === `${MEDIA_BUCKET}.s3.${region}.amazonaws.com`) {
      return decodeURIComponent(u.pathname.replace(/^\//, ''));
    }
    if (u.hostname === `s3.${region}.amazonaws.com`) {
      const m = u.pathname.match(new RegExp(`^/${MEDIA_BUCKET}/(.+)$`));
      if (m) return decodeURIComponent(m[1]);
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function presignedPutUrl(
  prefix: S3PrefixKey,
  filename: string,
  contentType: string,
  expiresInSeconds = 900,
): Promise<{ key: string; url: string; publicUrl: string }> {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const stamped = `${Date.now()}-${safe}`;
  const key = s3Key(prefix, stamped);
  const url = await getSignedUrl(
    getS3(),
    new PutObjectCommand({
      Bucket: MEDIA_BUCKET,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: expiresInSeconds },
  );
  return { key, url, publicUrl: publicUrl(key) };
}

export async function presignedGetUrl(key: string, expiresInSeconds = 900): Promise<string> {
  return getSignedUrl(
    getS3(),
    new GetObjectCommand({ Bucket: MEDIA_BUCKET, Key: key }),
    { expiresIn: expiresInSeconds },
  );
}

export const AWS_REGION = process.env.AWS_REGION ?? "us-west-2";

export const MEDIA_BUCKET = "yt-space-news-media-prod";

export const S3_PREFIX = {
  sources: "sources/",
  keyframes: "keyframes/",
  bureau: "bureau/",
  audio: "audio/",
  renders: "renders/",
  manifests: "manifests/",
} as const;

export type S3PrefixKey = keyof typeof S3_PREFIX;

export function s3Key(prefix: S3PrefixKey, ...parts: string[]): string {
  const tail = parts
    .filter(Boolean)
    .map((p) => p.replace(/^\/+|\/+$/g, ""))
    .join("/");
  return `${S3_PREFIX[prefix]}${tail}`;
}

export function publicUrl(key: string): string {
  return `https://${MEDIA_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`;
}

export function s3Uri(key: string): string {
  return `s3://${MEDIA_BUCKET}/${key}`;
}

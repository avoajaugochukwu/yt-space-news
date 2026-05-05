import { NextRequest, NextResponse } from 'next/server';
import { presignedPutUrl } from '@/lib/storage/s3';
import type { S3PrefixKey } from '@/lib/storage/aws';

export const runtime = 'nodejs';

const ALLOWED: Record<string, S3PrefixKey> = {
  source: 'sources',
  bureau: 'bureau',
  audio: 'audio',
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    kind?: keyof typeof ALLOWED;
    filename?: string;
    contentType?: string;
  } | null;
  if (!body?.kind || !body.filename || !body.contentType) {
    return NextResponse.json(
      { error: 'kind, filename, contentType required' },
      { status: 400 },
    );
  }
  const prefix = ALLOWED[body.kind];
  if (!prefix) return NextResponse.json({ error: 'invalid kind' }, { status: 400 });
  const signed = await presignedPutUrl(prefix, body.filename, body.contentType);
  return NextResponse.json(signed);
}

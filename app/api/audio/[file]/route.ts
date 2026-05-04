import { NextRequest, NextResponse } from 'next/server';
import { ttsUpstreamDownloadUrl } from '@/lib/voice-generator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;
  const jobId = file.replace(/\.mp3$/i, '');
  if (!jobId) return NextResponse.json({ error: 'missing jobId' }, { status: 400 });

  const upstream = ttsUpstreamDownloadUrl(jobId);
  const range = req.headers.get('range');
  const upstreamResp = await fetch(upstream, {
    headers: range ? { range } : undefined,
    cache: 'no-store',
  });

  if (!upstreamResp.ok && upstreamResp.status !== 206) {
    return NextResponse.json(
      { error: `upstream ${upstreamResp.status}` },
      { status: upstreamResp.status },
    );
  }

  const headers = new Headers();
  headers.set('Content-Type', 'audio/mpeg');
  headers.set('Content-Disposition', `inline; filename="${jobId}.mp3"`);
  for (const h of ['content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']) {
    const v = upstreamResp.headers.get(h);
    if (v) headers.set(h, v);
  }

  return new NextResponse(upstreamResp.body, { status: upstreamResp.status, headers });
}

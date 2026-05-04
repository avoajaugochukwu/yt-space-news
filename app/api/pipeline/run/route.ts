import { NextRequest, NextResponse } from 'next/server';
import { startPipeline, DEFAULT_CHANNEL, type PipelineSelection } from '@/lib/pipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let channel = DEFAULT_CHANNEL;
  let selection: PipelineSelection | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    if (body && typeof body.channel === 'string' && body.channel.trim()) {
      channel = body.channel.trim().replace(/^@/, '');
    }
    if (
      body &&
      typeof body.videoId === 'string' &&
      typeof body.title === 'string' &&
      typeof body.url === 'string'
    ) {
      selection = {
        videoId: body.videoId,
        title: body.title,
        url: body.url,
        publishedAt: typeof body.publishedAt === 'string' ? body.publishedAt : null,
      };
    }
  } catch {
    // ignore body parse errors; default channel applies
  }
  const id = startPipeline(channel, selection);
  return NextResponse.json({ jobId: id, channel }, { status: 202 });
}

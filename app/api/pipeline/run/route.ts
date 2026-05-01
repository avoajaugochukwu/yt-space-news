import { NextRequest, NextResponse } from 'next/server';
import { startPipeline, DEFAULT_CHANNEL } from '@/lib/pipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let channel = DEFAULT_CHANNEL;
  try {
    const body = await req.json().catch(() => ({}));
    if (body && typeof body.channel === 'string' && body.channel.trim()) {
      channel = body.channel.trim().replace(/^@/, '');
    }
  } catch {
    // ignore body parse errors; default channel applies
  }
  const id = startPipeline(channel);
  return NextResponse.json({ jobId: id, channel }, { status: 202 });
}

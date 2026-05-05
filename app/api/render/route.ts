import { NextRequest, NextResponse } from 'next/server';
import { pollRender, startRender } from '@/lib/render';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    planId?: string;
  } | null;
  if (!body?.planId) {
    return NextResponse.json({ error: 'planId required' }, { status: 400 });
  }
  const r = await startRender(body.planId);
  return NextResponse.json({ planId: body.planId, ...r });
}

export async function GET(req: NextRequest) {
  const planId = req.nextUrl.searchParams.get('planId');
  const renderId = req.nextUrl.searchParams.get('renderId');
  const bucketName = req.nextUrl.searchParams.get('bucketName');
  if (!planId || !renderId || !bucketName) {
    return NextResponse.json(
      { error: 'planId, renderId, bucketName required' },
      { status: 400 },
    );
  }
  const r = await pollRender({ planId, renderId, bucketName });
  return NextResponse.json(r);
}

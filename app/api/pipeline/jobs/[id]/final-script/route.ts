import { NextRequest, NextResponse } from 'next/server';
import { jobStore } from '@/lib/job-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const job = jobStore.get(id);
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  if (!jobStore.isAwaitingFinalScript(id)) {
    return NextResponse.json(
      { error: `Job is not awaiting a final script (status: ${job.status})` },
      { status: 409 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const script =
    body && typeof body === 'object' && 'script' in body
      ? (body as { script: unknown }).script
      : null;
  if (typeof script !== 'string' || script.trim().length === 0) {
    return NextResponse.json(
      { error: 'Body must include a non-empty "script" string' },
      { status: 400 },
    );
  }

  const accepted = jobStore.resolveFinalScript(id, script);
  if (!accepted) {
    return NextResponse.json(
      { error: 'Job is no longer awaiting a final script' },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, length: script.length }, { status: 202 });
}

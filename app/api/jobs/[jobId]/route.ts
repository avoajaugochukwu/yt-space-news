import { NextRequest, NextResponse } from 'next/server';
import { cleanupJob } from '@/lib/cleanup';

export const runtime = 'nodejs';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 });
  const report = await cleanupJob(jobId);
  return NextResponse.json(report);
}

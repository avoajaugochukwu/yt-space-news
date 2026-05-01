import { NextResponse } from 'next/server';
import { getRun } from '@/lib/turso';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const run = await getRun(id);
    if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    return NextResponse.json(run);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

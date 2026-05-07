import { NextRequest, NextResponse } from 'next/server';
import { catalogSources } from '@/lib/cataloger';
import { listScenesForJob, listVideoSources } from '@/lib/director-store';

export const runtime = 'nodejs';
export const maxDuration = 900;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    jobId?: string;
    sources?: Array<{ url: string; key: string; name?: string }>;
    entityHints?: {
      expectedEntities?: string[];
      visualThemes?: string[];
      contextSentence?: string;
    };
  } | null;
  if (!body?.jobId || !Array.isArray(body.sources) || body.sources.length === 0) {
    return NextResponse.json({ error: 'jobId and sources[] required' }, { status: 400 });
  }
  if (body.sources.length > 5) {
    return NextResponse.json({ error: 'max 5 sources per job' }, { status: 400 });
  }
  const results = await catalogSources(body.jobId, body.sources, body.entityHints);
  return NextResponse.json({ jobId: body.jobId, results });
}

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get('jobId');
  if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 });
  const [sources, scenes] = await Promise.all([
    listVideoSources(jobId),
    listScenesForJob(jobId),
  ]);
  return NextResponse.json({ jobId, sources, scenes });
}

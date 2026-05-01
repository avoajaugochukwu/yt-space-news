import { jobStore } from '@/lib/job-store';
import type { PipelineEvent } from '@/types/pipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = jobStore.get(id);
  if (!job) {
    return new Response('Job not found', { status: 404 });
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, payload: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`),
        );
      };

      send('snapshot', { job });

      const isTerminal = (s: string) => s === 'completed' || s === 'failed' || s === 'skipped';

      const close = () => {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      const unsub = jobStore.subscribe(id, (event: PipelineEvent) => {
        send('event', event);
        const current = jobStore.get(id);
        if (current && isTerminal(current.status)) {
          send('end', { job: current });
          unsub();
          close();
        }
      });

      const current = jobStore.get(id);
      if (current && isTerminal(current.status)) {
        send('end', { job: current });
        unsub();
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

import type { PipelineEvent, PipelineJob } from '@/types/pipeline';

type Listener = (event: PipelineEvent) => void;

class JobStore {
  private jobs = new Map<string, PipelineJob>();
  private listeners = new Map<string, Set<Listener>>();

  create(job: PipelineJob): void {
    this.jobs.set(job.id, job);
    this.listeners.set(job.id, new Set());
  }

  get(id: string): PipelineJob | undefined {
    return this.jobs.get(id);
  }

  update(id: string, patch: Partial<PipelineJob>): void {
    const j = this.jobs.get(id);
    if (!j) return;
    this.jobs.set(id, { ...j, ...patch });
  }

  emit(id: string, event: PipelineEvent): void {
    const j = this.jobs.get(id);
    if (j) {
      const events = [...j.events, event].slice(-200);
      this.jobs.set(id, { ...j, events });
    }
    const subs = this.listeners.get(id);
    if (subs) for (const cb of subs) cb(event);
  }

  subscribe(id: string, cb: Listener): () => void {
    let subs = this.listeners.get(id);
    if (!subs) {
      subs = new Set();
      this.listeners.set(id, subs);
    }
    subs.add(cb);
    return () => {
      subs?.delete(cb);
    };
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __pipelineJobStore: JobStore | undefined;
}

export const jobStore: JobStore = globalThis.__pipelineJobStore ?? new JobStore();
if (!globalThis.__pipelineJobStore) globalThis.__pipelineJobStore = jobStore;

export type PipelineStep =
  | 'fetch-latest'
  | 'dedupe'
  | 'transcript'
  | 'rewrite'
  | 'normalize'
  | 'tts-create'
  | 'tts-poll'
  | 'persist'
  | 'done';

export type PipelineStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface PipelineEvent {
  ts: string;
  step: PipelineStep;
  status: 'started' | 'completed' | 'failed' | 'progress' | 'skipped';
  message: string;
  data?: Record<string, unknown>;
}

export interface PipelineJob {
  id: string;
  status: PipelineStatus;
  channelHandle: string;
  videoId: string | null;
  videoTitle: string | null;
  videoUrl: string | null;
  accuracyScore: number | null;
  audioUrl: string | null;
  alreadyProcessed: boolean;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
  events: PipelineEvent[];
}

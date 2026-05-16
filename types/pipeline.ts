export type PipelineStep =
  | 'fetch-latest'
  | 'dedupe'
  | 'transcript'
  | 'rewrite'
  | 'await-final-script'
  | 'seo'
  | 'normalize'
  | 'tts-create'
  | 'tts-poll'
  | 'persist'
  | 'done';

export type PipelineStatus =
  | 'pending'
  | 'running'
  | 'awaiting-input'
  | 'completed'
  | 'failed'
  | 'skipped';

export interface SeoTitle {
  title: string;
  principle: string;
  principleNumber: number;
  estimatedCTR: 'high' | 'medium';
  imageKeywords: string[];
  thumbnailText: string;
}

export interface SeoMetadata {
  titles: SeoTitle[];
  description: string;
  tags: string[];
}

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
  transcript: string | null;
  draftScript: string | null;
  script: string | null;
  seo: SeoMetadata | null;
  alreadyProcessed: boolean;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
  events: PipelineEvent[];
}

// Story Card Types
export interface StoryCard {
  id: string;
  title: string;
  timestamp: string;
  suitabilityScore: number; // 1-15
  hardwareData: HardwareData;
  sourceUrls: SourceUrl[];
  summary: string;
}

export interface HardwareData {
  primaryHardware: string;
  agency: string;
  technicalSpecs: string[];
  keyMetrics: Record<string, string>;
}

export interface SourceUrl {
  url: string;
  title: string;
  category: 'primary' | 'technical' | 'context';
}

// Intelligence Briefing Types
export interface IntelligenceBriefing {
  storyId: string;
  technicalPillars: {
    hardwareData: string;
    politicalContext: string;
    retroParallel: string;
    realityCheck: string;
  };
  sources: SourceUrl[];
}

// Packaging Types
export interface PackagingResult {
  titles: TitleOption[];
  thumbnailLayout: ThumbnailLayout;
  midjourneyPrompt: string;
}

export interface TitleOption {
  id: string;
  title: string;
  engineeringAnchor: string;
  technicalConflict: string;
}

export interface ThumbnailLayout {
  primaryText: string;
  secondaryText: string;
  visualFocus: string;
}

// Hook Types
export interface HookResult {
  hooks: HookVariation[];
  winner?: HookVariation;
}

export interface HookVariation {
  id: string;
  type: 'hardware' | 'geopolitical' | 'heritage';
  content: string;
  wordCount: number;
}

// Script Types
export interface ScriptOutline {
  hook: string;
  phases: ScriptPhase[];
  totalEstimatedWords: number;
}

export interface ScriptPhase {
  id: string;
  name: string;
  type: 'hardware' | 'deep-dive' | 'geopolitical';
  keyPoints: string[];
  estimatedWords: number;
}

export interface ScriptSegment {
  phaseId: string;
  content: string;
  wordCount: number;
  hasBannedPhrases: boolean;
  flaggedPhrases?: string[];
}

export interface GeneratedScript {
  segments: ScriptSegment[];
  totalWordCount: number;
  sources: SourceUrl[];
}

// Workflow State Types
export type WorkflowPhase =
  | 'radar'
  | 'briefing'
  | 'packaging'
  | 'hook'
  | 'outline'
  | 'script';

export interface WorkflowState {
  currentPhase: WorkflowPhase;
  selectedStory: StoryCard | null;
  briefing: IntelligenceBriefing | null;
  packaging: PackagingResult | null;
  selectedTitle: TitleOption | null;
  hookResult: HookResult | null;
  selectedHook: HookVariation | null;
  outline: ScriptOutline | null;
  script: GeneratedScript | null;
}

// API Response Types
export interface RadarScanResponse {
  stories: StoryCard[];
  scanTimestamp: string;
  fallbackUsed: boolean;
}

export interface ApiError {
  message: string;
  code: string;
  retryable: boolean;
}

// Banned Phrases for Content Validation
export const BANNED_PHRASES = [
  'insane',
  'shocking',
  'game over',
  'nasa is terrified',
  'elon\'s secret plan',
  'this changes everything',
  'the end of',
  'mind-blowing',
  'unbelievable',
  'you won\'t believe',
];

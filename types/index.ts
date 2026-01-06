// Content Mode Type
export type ContentMode = 'hype' | 'lowkey';

// Content Analysis Types
export interface ContentAnalysis {
  mode: ContentMode;
  score: number;
  phrasesFound: string[];
  needsAttention: boolean;
  recommendation: string;
}

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

// Hype Metrics Types
export interface HypeMeter {
  hypeScore: number; // 0-10, higher = more hype
  powerPhrasesUsed: string[];
  needsMoreHype: boolean;
  recommendation: string;
}

// Hook Types
export interface HookResult {
  hooks: HookVariation[];
  winner?: HookVariation;
}

export interface HookVariation {
  id: string;
  type: 'shock' | 'mystery' | 'stakes' | 'hardware' | 'geopolitical' | 'heritage';
  content: string;
  wordCount: number;
  // Mode-aware analysis fields
  analysisScore?: number;
  phrasesFound?: string[];
  needsAttention?: boolean;
  recommendation?: string;
  // Legacy fields for backwards compatibility
  hypeScore?: number;
  powerPhrasesUsed?: string[];
  needsMoreHype?: boolean;
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
  // Mode-aware analysis fields
  analysisScore: number;
  phrasesFound: string[];
  needsAttention: boolean;
  recommendation: string;
  // Legacy fields for backwards compatibility
  hypeScore?: number;
  powerPhrasesUsed?: string[];
  needsMoreHype?: boolean;
  hypeRecommendation?: string;
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
  | 'outline';

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

// YouTube Rewriter Types
export interface RewriteResult {
  originalTranscript: string;
  rewrittenScript: string;
  wordCount: number;
  improvedTitles: string[];
}

// Power Phrases for Maximum Hype (USE THESE!)
export const POWER_PHRASES = [
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
  'breaking',
  'exposed',
  'revealed',
  'impossible',
  'revolutionary',
  'historic',
  'catastrophic',
  'terrifying',
  'game-changing',
  'they don\'t want you to know',
  'finally revealed',
  'the truth about',
  'secret',
  'massive',
  'horrifying',
  'genius',
];

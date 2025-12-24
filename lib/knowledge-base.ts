import { promises as fs } from 'fs';
import path from 'path';
import type { ContentMode } from './settings-context';

const SYSTEM_FILES_DIR = path.join(process.cwd(), 'public', 'system_files');

// Cache for loaded files
const cache: Record<string, string> = {};

async function loadFile(filename: string, mode: ContentMode = 'hype'): Promise<string> {
  // Add mode suffix to filename
  const baseFilename = filename.replace('.txt', '');
  const modeFilename = `${baseFilename}_${mode}.txt`;
  const cacheKey = modeFilename;

  if (cache[cacheKey]) {
    return cache[cacheKey];
  }

  const filePath = path.join(SYSTEM_FILES_DIR, modeFilename);
  const content = await fs.readFile(filePath, 'utf-8');
  cache[cacheKey] = content;
  return content;
}

// Individual file loaders
export async function loadPackagingGuide(mode: ContentMode = 'hype'): Promise<string> {
  return loadFile('Packaging_and_Signal_Guide.txt', mode);
}

export async function loadAestheticGuide(mode: ContentMode = 'hype'): Promise<string> {
  return loadFile('Aesthetic_Brand_Guidelines.txt', mode);
}

export async function loadAudiencePersona(mode: ContentMode = 'hype'): Promise<string> {
  return loadFile('Audience_Persona_Bob.txt', mode);
}

export async function loadRetroArchive(mode: ContentMode = 'hype'): Promise<string> {
  return loadFile('Retro_Archive_Index.txt', mode);
}

export async function loadTechnicalFramework(mode: ContentMode = 'hype'): Promise<string> {
  return loadFile('Technical_Realism_Framework.txt', mode);
}

export async function loadToneGuide(mode: ContentMode = 'hype'): Promise<string> {
  return loadFile('Tone_and_Vocabulary_Guide.txt', mode);
}

// Combined loaders for specific use cases
export async function getScriptingContext(mode: ContentMode = 'hype'): Promise<string> {
  const [tone, audience, technical] = await Promise.all([
    loadToneGuide(mode),
    loadAudiencePersona(mode),
    loadTechnicalFramework(mode),
  ]);

  return `
=== TONE AND VOCABULARY GUIDE ===
${tone}

=== TARGET AUDIENCE ===
${audience}

=== TECHNICAL REALISM FRAMEWORK ===
${technical}
`.trim();
}

export async function getPackagingContext(mode: ContentMode = 'hype'): Promise<string> {
  const [packaging, aesthetic] = await Promise.all([
    loadPackagingGuide(mode),
    loadAestheticGuide(mode),
  ]);

  return `
=== PACKAGING AND SIGNAL GUIDE ===
${packaging}

=== AESTHETIC BRAND GUIDELINES ===
${aesthetic}
`.trim();
}

export async function getFullContext(mode: ContentMode = 'hype'): Promise<string> {
  const [tone, audience, technical, packaging, aesthetic, retro] = await Promise.all([
    loadToneGuide(mode),
    loadAudiencePersona(mode),
    loadTechnicalFramework(mode),
    loadPackagingGuide(mode),
    loadAestheticGuide(mode),
    loadRetroArchive(mode),
  ]);

  return `
=== TONE AND VOCABULARY GUIDE ===
${tone}

=== TARGET AUDIENCE ===
${audience}

=== TECHNICAL REALISM FRAMEWORK ===
${technical}

=== PACKAGING AND SIGNAL GUIDE ===
${packaging}

=== AESTHETIC BRAND GUIDELINES ===
${aesthetic}

=== RETRO ARCHIVE INDEX ===
${retro}
`.trim();
}

export async function getResearchContext(mode: ContentMode = 'hype'): Promise<string> {
  const [technical, retro] = await Promise.all([
    loadTechnicalFramework(mode),
    loadRetroArchive(mode),
  ]);

  return `
=== TECHNICAL REALISM FRAMEWORK ===
${technical}

=== RETRO ARCHIVE INDEX ===
${retro}
`.trim();
}

// ========== HYPE MODE FUNCTIONS ==========

// High-Signal power phrases that build authority (USE THESE!)
export function getPowerPhrases(): string[] {
  return [
    // URGENCY (not panic)
    'critical',
    'decisive',
    'urgent',
    'significant',
    'immediate',
    // AUTHORITY (not sensationalism)
    'unprecedented',
    'strategic',
    'systemic',
    'operational',
    'fundamental',
    // DATA-DRIVEN
    'the data shows',
    'reports confirm',
    'internal analysis reveals',
    'industry sources indicate',
    'program data confirms',
    'documents show',
    'metrics indicate',
    // BREAKTHROUGH (earned, not claimed)
    'breakthrough',
    'milestone',
    'critical threshold',
    'key achievement',
    'pivotal development',
    // CONFLICT (strategic, not personal)
    'strategic friction',
    'competitive pressure',
    'timeline pressure',
    'budget constraint',
    'systemic challenge',
    // INSIDER LANGUAGE
    'industry analysts note',
    'internal reports suggest',
    'program reviews indicate',
    'according to sources',
    'data reveals',
  ];
}

// Banned fluff phrases (NEVER USE!)
export function getBannedFluffPhrases(): string[] {
  return [
    'insane',
    'shocking',
    'terrified',
    'mind-blowing',
    'jaw-dropping',
    'speechless',
    'unbelievable',
    'crazy',
    'horrifying',
    'begging',
    'destroyed',
    'annihilated',
    'obliterated',
    'freaking out',
    'secret plan',
    'they don\'t want you to know',
    'exposed',
    'nasa is terrified',
    'game over',
  ];
}

// Measure content for HIGH-SIGNAL indicators (data density + authority phrases)
export function measureHypeLevel(content: string): {
  powerPhrasesFound: string[];
  hypeScore: number;
  needsMoreHype: boolean;
  recommendation: string;
  bannedPhrasesFound: string[];
  metricDensity: number;
} {
  const powerPhrases = getPowerPhrases();
  const bannedPhrases = getBannedFluffPhrases();
  const lowerContent = content.toLowerCase();

  // HIGH-SIGNAL power phrases
  const found = powerPhrases.filter(phrase => lowerContent.includes(phrase));

  // BANNED fluff phrases (should be 0)
  const bannedFound = bannedPhrases.filter(phrase => lowerContent.includes(phrase));

  // Count specific metrics (numbers with units)
  const metricPattern = /\d+(?:\.\d+)?\s*(?:metric tons?|tons?|kg|km|miles?|billion|million|%|percent|\$|dollars?|meters?|feet|seconds?|days?|months?|years?)/gi;
  const metrics = content.match(metricPattern) || [];
  const wordCount = content.split(/\s+/).length;
  const metricDensity = wordCount > 0 ? (metrics.length / wordCount) * 1000 : 0; // metrics per 1000 words

  // Calculate score: Data Density + Urgent Framing - Banned Phrases
  let score = 0;
  score += Math.min(4, found.length); // Up to 4 points for power phrases
  score += Math.min(4, metricDensity); // Up to 4 points for metric density
  score -= bannedFound.length * 2; // Deduct 2 points per banned phrase
  score = Math.max(0, Math.min(10, Math.round(score))); // Clamp to 0-10

  let recommendation = '';
  let needsMoreHype = false;

  if (bannedFound.length > 0) {
    recommendation = `Remove banned fluff phrases: ${bannedFound.join(', ')}. Replace with data-driven language.`;
    needsMoreHype = true;
  } else if (metricDensity < 3) {
    recommendation = 'Add more specific metrics. Target: 5+ hardware metrics or budget figures per 1000 words.';
    needsMoreHype = true;
  } else if (found.length < 3) {
    recommendation = 'Add more authority phrases: "The data shows," "Reports confirm," "Industry analysts note."';
    needsMoreHype = true;
  } else if (score < 7) {
    recommendation = 'Good signal. Consider adding more strategic context or comparative analysis.';
    needsMoreHype = false;
  } else {
    recommendation = 'HIGH-SIGNAL content achieved. Data-rich, authoritative, credible.';
    needsMoreHype = false;
  }

  return {
    powerPhrasesFound: found,
    hypeScore: score,
    needsMoreHype,
    recommendation,
    bannedPhrasesFound: bannedFound,
    metricDensity: Math.round(metricDensity * 10) / 10,
  };
}

// ========== LOW-KEY MODE FUNCTIONS ==========

// Banned phrases for professional/technical content
export function getBannedPhrases(): string[] {
  return [
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
    'terrifying',
    'horrifying',
    'secret',
    'exposed',
    'they don\'t want you to know',
  ];
}

// Check content for banned phrases
export function checkForBannedPhrases(content: string): {
  bannedPhrasesFound: string[];
  qualityScore: number;
  hasBannedPhrases: boolean;
  recommendation: string;
} {
  const bannedPhrases = getBannedPhrases();
  const lowerContent = content.toLowerCase();

  const found = bannedPhrases.filter(phrase => lowerContent.includes(phrase));
  const qualityScore = Math.max(0, 10 - found.length * 2); // Each banned phrase deducts 2 points

  let recommendation = '';
  let hasBannedPhrases = false;

  if (found.length === 0) {
    recommendation = 'Content meets High-Signal standards. Professional and data-driven.';
    hasBannedPhrases = false;
  } else if (found.length <= 2) {
    recommendation = `Remove banned phrases: ${found.join(', ')}. Use technical language instead.`;
    hasBannedPhrases = true;
  } else {
    recommendation = `Too much clickbait language detected! Remove: ${found.join(', ')}. Focus on hardware and data.`;
    hasBannedPhrases = true;
  }

  return { bannedPhrasesFound: found, qualityScore, hasBannedPhrases, recommendation };
}

// ========== MODE-AWARE ANALYSIS ==========

export interface ContentAnalysis {
  mode: ContentMode;
  score: number;
  phrasesFound: string[];
  needsAttention: boolean;
  recommendation: string;
}

export function analyzeContent(content: string, mode: ContentMode): ContentAnalysis {
  if (mode === 'hype') {
    const result = measureHypeLevel(content);
    return {
      mode: 'hype',
      score: result.hypeScore,
      phrasesFound: result.powerPhrasesFound,
      needsAttention: result.needsMoreHype,
      recommendation: result.recommendation,
    };
  } else {
    const result = checkForBannedPhrases(content);
    return {
      mode: 'lowkey',
      score: result.qualityScore,
      phrasesFound: result.bannedPhrasesFound,
      needsAttention: result.hasBannedPhrases,
      recommendation: result.recommendation,
    };
  }
}

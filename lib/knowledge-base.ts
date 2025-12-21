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

// Power phrases that boost engagement (USE THESE!)
export function getPowerPhrases(): string[] {
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
}

// Measure content for power phrases and score hype level
export function measureHypeLevel(content: string): {
  powerPhrasesFound: string[];
  hypeScore: number;
  needsMoreHype: boolean;
  recommendation: string;
} {
  const powerPhrases = getPowerPhrases();
  const lowerContent = content.toLowerCase();

  const found = powerPhrases.filter(phrase => lowerContent.includes(phrase));
  const hypeScore = Math.min(10, Math.round(found.length * 1.5)); // Each phrase adds ~1.5 points

  let recommendation = '';
  let needsMoreHype = false;

  if (hypeScore < 3) {
    recommendation = 'WAY too dry! Add MORE power phrases for MAXIMUM impact!';
    needsMoreHype = true;
  } else if (hypeScore < 5) {
    recommendation = 'Needs more ENERGY! Sprinkle in some INSANE, SHOCKING, or GAME-CHANGING!';
    needsMoreHype = true;
  } else if (hypeScore < 7) {
    recommendation = 'Good energy! Could still add more excitement for viral potential!';
    needsMoreHype = false;
  } else {
    recommendation = 'MAXIMUM HYPE ACHIEVED! This is FIRE!';
    needsMoreHype = false;
  }

  return { powerPhrasesFound: found, hypeScore, needsMoreHype, recommendation };
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

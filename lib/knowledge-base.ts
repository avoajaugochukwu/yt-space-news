import { promises as fs } from 'fs';
import path from 'path';

const SYSTEM_FILES_DIR = path.join(process.cwd(), 'public', 'system_files');

// Cache for loaded files
const cache: Record<string, string> = {};

async function loadFile(filename: string): Promise<string> {
  if (cache[filename]) {
    return cache[filename];
  }

  const filePath = path.join(SYSTEM_FILES_DIR, filename);
  const content = await fs.readFile(filePath, 'utf-8');
  cache[filename] = content;
  return content;
}

// Individual file loaders
export async function loadPackagingGuide(): Promise<string> {
  return loadFile('Packaging_and_Signal_Guide.txt');
}

export async function loadAestheticGuide(): Promise<string> {
  return loadFile('Aesthetic_Brand_Guidelines.txt');
}

export async function loadAudiencePersona(): Promise<string> {
  return loadFile('Audience_Persona_Bob.txt');
}

export async function loadRetroArchive(): Promise<string> {
  return loadFile('Retro_Archive_Index.txt');
}

export async function loadTechnicalFramework(): Promise<string> {
  return loadFile('Technical_Realism_Framework.txt');
}

export async function loadToneGuide(): Promise<string> {
  return loadFile('Tone_and_Vocabulary_Guide.txt');
}

// Combined loaders for specific use cases
export async function getScriptingContext(): Promise<string> {
  const [tone, audience, technical] = await Promise.all([
    loadToneGuide(),
    loadAudiencePersona(),
    loadTechnicalFramework(),
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

export async function getPackagingContext(): Promise<string> {
  const [packaging, aesthetic] = await Promise.all([
    loadPackagingGuide(),
    loadAestheticGuide(),
  ]);

  return `
=== PACKAGING AND SIGNAL GUIDE ===
${packaging}

=== AESTHETIC BRAND GUIDELINES ===
${aesthetic}
`.trim();
}

export async function getFullContext(): Promise<string> {
  const [tone, audience, technical, packaging, aesthetic, retro] = await Promise.all([
    loadToneGuide(),
    loadAudiencePersona(),
    loadTechnicalFramework(),
    loadPackagingGuide(),
    loadAestheticGuide(),
    loadRetroArchive(),
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

export async function getResearchContext(): Promise<string> {
  const [technical, retro] = await Promise.all([
    loadTechnicalFramework(),
    loadRetroArchive(),
  ]);

  return `
=== TECHNICAL REALISM FRAMEWORK ===
${technical}

=== RETRO ARCHIVE INDEX ===
${retro}
`.trim();
}

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

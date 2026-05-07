import { callClaude } from '../anthropic';
import type { WhisperWord } from '../whisper';

export interface Chapter {
  startSec: number;
  endSec: number;
  theme: string;
  narrative: string;
  namedEntities: string[];
  tags: string[];
}

const SYSTEM = `You are a senior broadcast video editor planning the visual edit for an aerospace news package.
Given the spoken transcript with word-level timestamps, group the audio into 6–15 narrative chapters.
Each chapter is a continuous span of time devoted to one thread of the story.
Chapters MUST cover the full audio with no gaps and no overlaps; chapter[i].endSec === chapter[i+1].startSec.
Aim for chapters of 30–90 seconds each; never shorter than 20s; never longer than 120s.
Cut chapter boundaries at natural pauses or topic shifts — never mid-sentence.
For each chapter return:
  startSec, endSec       — boundaries in seconds (numbers, two decimals)
  theme                  — 2-5 word label of the visual theme (e.g. "static fire test", "gulf coast launch site")
  narrative              — 1 sentence describing what is being said in this chapter
  namedEntities          — array of specific hardware/places/people mentioned in this chapter ("Starship S31", "Raptor 3", "Pad B")
  tags                   — array of 3-8 short visual descriptors that B-roll should match ("engine ignition","vehicle stacking","cryo venting")
Return STRICT JSON: {"chapters":[...]}. No prose, no fences.`;

function transcriptFromWords(words: WhisperWord[]): string {
  if (words.length === 0) return '';
  const lines: string[] = [];
  for (let i = 0; i < words.length; i += 12) {
    const chunk = words.slice(i, i + 12);
    const t = chunk[0].start.toFixed(2);
    lines.push(`[${t}] ${chunk.map((w) => w.word).join(' ')}`);
  }
  return lines.join('\n');
}

export async function inferChapters(input: {
  words: WhisperWord[];
  audioDuration: number;
  script?: string | null;
}): Promise<Chapter[]> {
  const transcriptWithStamps = transcriptFromWords(input.words);
  const scriptBlock = input.script
    ? `Original written script (for context):\n"""\n${input.script.slice(0, 12000)}\n"""\n\n`
    : '';
  const userPrompt = `${scriptBlock}Spoken transcript with word timestamps (truncated as needed):
"""
${transcriptWithStamps.slice(0, 18000)}
"""

Total audio duration: ${input.audioDuration.toFixed(2)} seconds.

Plan the chapters now. Return only the JSON object.`;

  const raw = await callClaude({
    systemPrompt: SYSTEM,
    userPrompt,
    maxTokens: 4096,
  });
  const cleaned = raw.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '').trim();
  let parsed: { chapters?: Chapter[] };
  try {
    parsed = JSON.parse(cleaned) as { chapters?: Chapter[] };
  } catch {
    throw new Error(`chapter inference returned invalid JSON: ${cleaned.slice(0, 200)}`);
  }
  const chapters = Array.isArray(parsed.chapters) ? parsed.chapters : [];
  if (chapters.length === 0) throw new Error('chapter inference returned 0 chapters');

  const fixed = chapters
    .map((c) => ({
      startSec: Math.max(0, Number(c.startSec)),
      endSec: Math.min(input.audioDuration, Number(c.endSec)),
      theme: String(c.theme ?? ''),
      narrative: String(c.narrative ?? ''),
      namedEntities: Array.isArray(c.namedEntities) ? c.namedEntities.map(String) : [],
      tags: Array.isArray(c.tags) ? c.tags.map(String) : [],
    }))
    .filter((c) => c.endSec > c.startSec)
    .sort((a, b) => a.startSec - b.startSec);

  for (let i = 0; i < fixed.length; i++) {
    if (i === 0) fixed[i].startSec = 0;
    if (i === fixed.length - 1) fixed[i].endSec = input.audioDuration;
    if (i > 0 && fixed[i].startSec !== fixed[i - 1].endSec) {
      fixed[i].startSec = fixed[i - 1].endSec;
    }
  }
  return fixed;
}

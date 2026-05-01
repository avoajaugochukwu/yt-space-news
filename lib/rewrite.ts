import {
  callClaude,
  EDITOR_SYSTEM_PROMPT,
  WRITER_SYSTEM_PROMPT,
} from './anthropic';

const PPLX_ENDPOINT = 'https://api.perplexity.ai/chat/completions';
const PPLX_MODEL = 'sonar-pro';

export const ACCURACY_THRESHOLD = 90;
export const MAX_REWRITE_ATTEMPTS = 3;

interface PplxResponse {
  choices: { message: { content: string } }[];
}

async function callPerplexity(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error('PERPLEXITY_API_KEY env var is not set');

  const resp = await fetch(PPLX_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: PPLX_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Perplexity error: ${resp.status} ${body.slice(0, 300)}`);
  }
  const data = (await resp.json()) as PplxResponse;
  const text = data.choices?.[0]?.message?.content ?? '';
  if (!text.trim()) throw new Error('Perplexity returned empty content');
  return text.trim();
}

const NUMBER_RULES = `
NUMBER SPELLING RULES (NON-NEGOTIABLE):
- Every number must be written exactly as a narrator would read it aloud.
- Cardinals: 905 -> "nine hundred and five"; 12 -> "twelve"; 1,250 -> "one thousand two hundred and fifty".
- Years: 1969 -> "nineteen sixty-nine"; 2024 -> "twenty twenty-four"; 2000 -> "two thousand"; 2005 -> "two thousand and five".
- Dates: "March 5, 1969" -> "March fifth, nineteen sixty-nine".
- Currency: "$2.5M" -> "two point five million dollars"; "$905" -> "nine hundred and five dollars".
- Units: "12kg" -> "twelve kilograms"; "5km/h" -> "five kilometers per hour".
- Percentages: "47%" -> "forty-seven percent".
- Decimals: "3.14" -> "three point one four".
- Phone / serial / model numbers: spell digit by digit if that's how a human would say them.
- Roman numerals: "Apollo 11" -> "Apollo eleven"; "World War II" -> "World War Two".
- Abbreviations the listener would expand: "Dr." -> "Doctor"; "vs." -> "versus"; "etc." -> "etcetera".
- Never leave a digit, %, $, or unit symbol in the output. If unsure, expand it.
`.trim();

export interface AccuracyIssue {
  category:
    | 'fact'
    | 'number'
    | 'verbatim'
    | 'artifact'
    | 'typo'
    | 'ear'
    | 'branding'
    | 'engagement'
    | 'persona'
    | 'lead'
    | 'augmentation'
    | 'other';
  quote: string;
  fix: string;
}

export interface AccuracyResult {
  score: number;
  issues: AccuracyIssue[];
  feedback: string;
  raw: string;
}

export interface RewriteOutcome {
  finalScript: string;
  finalAccuracy: AccuracyResult;
  attempts: { script: string; accuracy: AccuracyResult }[];
  reachedThreshold: boolean;
}

function buildRewritePrompt(originalTranscript: string, title: string): string {
  return `IDENTIFICATION:
You are an Editor at an Aerospace News Bureau. Convert this personal vlog transcript into a professional, third-person news report for "we go for powered descent".

ORIGINAL VIDEO TITLE (for context only — do not echo): ${title}

MANDATE:
- DO NOT SUMMARIZE. Maintain the depth and technical density of the source. The finished script should be approximately the same length as the source transcript; a noticeably shorter rewrite is a failure.
- RUTHLESS PERSONA PURGE: Remove all "I", "me", "my", "we" used as the host, "our team", and personal anecdotes (e.g. "I spoke to Elon", "I met Elon", "when I was at the Cape"). Convert subjective opinions into objective analytical statements ("Analysis suggests", "The data indicates"). Drop named source-channel hosts (e.g. "Kevin", "Felix") entirely.
- NO STACCATO: Use professional broadcast prosody — a natural mix of complex technical explanations and punchy summary statements. No one-thought-per-line. No uniform sentence lengths.
- NO CHANNEL LEAKAGE: Strip the source channel's name, host, sponsor, Patreon, and any "this channel / our channel / our show" phrasing. The only reporting entity referenced is "we go for powered descent".
- NO PRESENTATION ARTIFACTS: No music cues, "[Music]", "[Applause]", "♪", emoji, markdown, bullet lists, headings, or stage directions. Broadcast prose only.
- NO SOURCE PLAGIARISM: No run of more than four consecutive words may be reused verbatim from the source. Unique proper nouns (e.g. "Falcon Heavy", "International Space Station") do not count.
- PROPER NOUN FIDELITY: Spell every proper noun exactly as it appears in the original.

INTELLIGENCE AUGMENTATION (VALUE-ADD):
You must provide context the source vlog missed. Whatever the topic — SpaceX, NASA, Boeing, Blue Origin, ESA, CASC, ISRO, or anything else — research and weave in the following three classes of high-signal context. Two to three concrete additions total, distributed across the report.
1. IDENTIFY THE PHYSICS: Research and weave in the underlying engineering or scientific principles (e.g. specific chemical reactions, orbital mechanics, material-science limits, propellant cycle properties, atmospheric thresholds) that explain HOW the hardware works or WHY a constraint exists.
2. HISTORICAL MIRROR: Identify a relevant historical parallel — an Apollo-era program, a Cold War rivalry, a previous failure/success, an X-plane, or an analogous mission cadence — to give the current event perspective. Anchor with a real program name or year.
3. DATA ANCHORING: Replace vague "hype" adjectives ("massive", "fast", "expensive") with documented metrics — thrust values, thrust-to-weight ratios, specific impulse, payload class, delta-v budgets, atmospheric pressures, GAO/NASA-IG budget figures, transfer-window cadence — whichever fits the topic.

VERIFIABILITY (CRITICAL): Every augmentation must be a verifiable, accurate fact grounded in current aerospace engineering or documented history. If you are not confident, drop it — omission beats fabrication. Do not speculate on classified or "secret" projects unless naming a publicly available GAO, NASA IG, or DoD report inline.

STRUCTURE (continuous broadcast copy, no labels in the output):
1. THE NEWS LEAD: A professional five-Ws Lead — who, what, where, when, why — explaining the strategic significance immediately. No greeting, no hook, no teaser.
2. THE TECHNICAL REPORT: Detailed breakdown of the hardware, mission, or policy. This is where you integrate the augmented physics and data anchoring. Preserve every metric, date, payload mass, thrust value, orbit, mission ID, timeline, and engineering tradeoff from the source.
3. STRATEGIC IMPLICATIONS: Analyze how this event shifts the landscape of the industry or global competition. The Historical Mirror is most useful here.
4. ANALYTICAL CLOSER: Exactly one professional question inviting viewer analysis. Template: "For more deep-dives into [Topic], subscribe to we go for powered descent. How do you evaluate [Specific Strategic Shift]? Let us know your analysis in the comments." Replace [Topic] and [Specific Strategic Shift] with concrete references to the actual story. This is the ONLY engagement / subscribe / comment instruction in the script — no opener aside, no mid-script asides.

${NUMBER_RULES}

Output ONLY the rewritten broadcast script. No preamble, no headings, no markdown, no section labels.

SOURCE TRANSCRIPT:
"""
${originalTranscript}
"""`;
}

function buildCorrectionPrompt(
  previousScript: string,
  accuracy: AccuracyResult,
  originalTranscript: string,
): string {
  const issueLines =
    accuracy.issues.length > 0
      ? accuracy.issues
          .map(
            (it, i) =>
              `${i + 1}. [${it.category}] In: "${it.quote}"\n   Replace with: ${it.fix}`,
          )
          .join('\n')
      : '(no specific issues listed; apply general guidelines below)';

  return `Your previous rewrite scored ${accuracy.score} out of one hundred. Apply the targeted fixes below. Do not rewrite anything that is not flagged.

ISSUES TO FIX (each one is a specific quote with a specific replacement):
${issueLines}

REVIEWER FEEDBACK:
${accuracy.feedback}

${NUMBER_RULES}

GENERAL GUIDELINES (re-check after applying fixes):
- Faceless aerospace news desk — broadcast news flow: a natural mix of complex technical explanations and punchy summary statements. Never staccato, never one-thought-per-line, never uniform sentence lengths.
- DO NOT SUMMARIZE. Output length should be approximately the same as the source. Preserve every metric, date, payload mass, thrust value, orbit, mission window, and engineering tradeoff. If a paragraph of source detail collapsed into a single sentence in the previous draft, expand it back out.
- ZERO first-person references and ZERO host-name carryover. No "I", "me", "my", "we" as the host, "our team", "I spoke to Elon", "I met Elon", "when I was at the Cape", "Kevin says", or any other named source-channel host. Convert "I think" to "Analysis suggests"; convert personal anecdotes into third-person attribution.
- Opening paragraph is a five-Ws Lead — no greetings, hooks, or teaser questions. After the Lead, move into a substantive Technical Report.
- INTELLIGENCE AUGMENTATION must be present and topic-appropriate: 2 to 3 high-signal additions distributed across IDENTIFY THE PHYSICS (underlying engineering / science for THIS topic), HISTORICAL MIRROR (named prior program / year), and DATA ANCHORING (documented metrics replacing hype adjectives). Research what fits the topic — do not import facts from other topics. When uncertain, OMIT rather than fabricate.
- VERIFIABILITY: every augmentation must be a real, accurate aerospace fact. No speculation about classified or "secret" projects unless naming a public GAO, NASA IG, or DoD report inline.
- Replace hype phrases ("massive", "huge", "a lot") with documented metrics when the source provides them.
- Every fact, name, date, number, and quote from the original must be preserved.
- No remaining digit, %, $, year, decimal, currency, or unit symbol.
- No proper-noun typos. Spell every name exactly as in the original.
- No run of more than four consecutive words copied from the source.
- No markdown, music cues, emoji, or bracketed stage directions.
- The source channel's name, host, sponsor, and any "this channel / our channel / our show" reference must be replaced with "we go for powered descent".
- Exactly ONE professional closing call to action at the very end inviting subscription to "we go for powered descent" and posing a topic-specific analytical question for the comments. No opener subscribe aside. No mid-script asides.

ORIGINAL TRANSCRIPT (ground truth for facts):
"""
${originalTranscript}
"""

PREVIOUS REWRITE (apply fixes to this):
"""
${previousScript}
"""

Output ONLY the corrected script. No preamble, no headings, no markdown.`;
}

function buildAccuracyPrompt(rewrittenScript: string, originalTranscript: string): string {
  return `Audit a rewritten broadcast script against the original transcript. The rewrite is meant to be a faceless aerospace news report for "we go for powered descent" — not a vlog, not a personal narration. Produce a holistic accuracy score plus a list of concrete defects the editor can fix.

CRITERIA — weigh these when assigning the score (use your judgment on severity, do not just count items):
- Persona bleed (CRITICAL): the script must contain ZERO first-person references and ZERO host-name carryover — no "I", "me", "my", "we" used as the host, "our team"; no personal anecdotes ("I spoke to Elon", "I met Elon", "when I was at the Cape"); no source-channel host names ("Kevin", "Marcus", "Felix", or any other named presenter). If ANY of these remain, the OVERALL score MUST be below 50 — no exceptions. ~20 points.
- Information density and length preservation: the rewrite must retain the source's specific metrics — payload masses, thrust values, orbital parameters, mission IDs, transfer windows, dates, durations, engineering tradeoffs. The output should be approximately the same length as the source; a noticeably shorter rewrite is itself evidence of summarization and the score MUST drop sharply. Vague substitutions ("a lot", "huge", "a long time") for specific numbers are defects. ~15 points.
- News-lead quality: the opening must read as a Lead — within the first two sentences it resolves the five Ws (who, what, where, when, why) and states strategic significance. Hooks, greetings, teasers, or rhetorical questions in the lead are defects. ~5 points.
- Source factual fidelity: every fact, name, date, number, and quote from the original is preserved. A wrong fact or missing key claim hurts sharply. ~10 points.
- Bureau augmentation (universal): the report must weave in 2–3 short high-signal additions across the three classes: IDENTIFY THE PHYSICS (underlying engineering / scientific principles for the topic), HISTORICAL MIRROR (named prior program or year that mirrors the current event), DATA ANCHORING (documented metrics replacing hype adjectives). Whatever the topic — SpaceX, NASA, Blue Origin, ESA, CASC, ISRO, Boeing — the auditor evaluates whether augmentation is present and topic-appropriate, not whether it matches a fixed list. Absence or topic-irrelevance is an "augmentation" defect. ~10 points.
- Fabrication risk (CRITICAL): every augmentation must be a verifiable, accurate fact grounded in current aerospace engineering or documented history. If the rewrite contains a metric, program name, date, or claim you cannot confirm — flag as a "fact" defect; the score must drop sharply. Speculation about classified projects without an inline GAO / NASA IG / DoD source citation is a fabrication defect. Better to omit than to invent. ~10 points.
- Rhythm check (NOT staccato, NOT uniform): broadcast news flow — a mix of complex technical explanations and punchy summary statements. Multi-clause sentences when laying out engineering detail, short declarative beats when the news lands. Robotic one-thought-per-line, uniformly short, or telegraphic chopping is an "ear" defect. No markdown, no bullets, no headings, no music cues, no emoji, no brackets. ~10 points.
- Number spelling: every digit, %, $, year, decimal, currency, or unit symbol must be spelled out as a narrator would say it. ~5 points.
- Original phrasing: no run of more than four consecutive words copied verbatim from the source (unique proper nouns excluded). ~5 points.
- Channel rebrand and closing CTA: source channel/host/sponsor swapped to "we go for powered descent"; exactly ONE professional closing call to action at the end (no opener aside, no mid-script asides). ~5 points.

Score guidance: 100 = no defects; ~90 = essentially clean, only trivial issues; 70-89 = several real defects; 50-69 = significant fact or formatting problems; <50 = major fidelity loss.

LIST EVERY CONCRETE DEFECT in the "issues" array. Each issue MUST be a single object of this shape — no plain strings, no commentary, only fixable defects:
  {"category": "fact" | "number" | "verbatim" | "artifact" | "typo" | "ear" | "branding" | "engagement" | "persona" | "lead" | "augmentation", "quote": "<verbatim short snippet from the REWRITTEN script, or empty string if it's a missing-element defect>", "fix": "<specific replacement or addition that resolves it>"}

Categories:
- "persona": first-person references, personal anecdotes, or source-host name carryover leaked through ("I", "me", "my", "I spoke to Elon", "I met Elon", "when I was at the Cape", "Kevin says", "Felix here"). Convert to objective broadcast voice ("Analysis suggests", "The data indicates", "SpaceX confirmed").
- "lead": the opening fails to resolve the five Ws or buries the news event behind a hook, greeting, teaser, or rhetorical question.
- "fact": a source metric was dropped, summarized into a vague term ("a lot", "huge", "many"), a paragraph of source detail collapsed into a single sentence (technical-density failure), OR a fabricated/unverifiable augmentation was inserted.
- "augmentation": the bureau augmentation requirement is unmet — fewer than 2 high-signal additions woven in, or none of the three universal classes (IDENTIFY THE PHYSICS, HISTORICAL MIRROR, DATA ANCHORING) is present, or augmentations overshadow rather than serve the source. The "fix" field should suggest a topic-appropriate addition (e.g. for a Mars script: a specific atmospheric pressure / chemistry of perchlorates; for a launch-cadence script: an Apollo-era flight rate parallel; for a competitor story: named hardware like "Long March 9" instead of "China is competing").
- "ear": broadcast prose reads as robotic / staccato / one-thought-per-line, or sentences are uniformly short, or it carries article artifacts (lists, headings, parentheticals, "as you can see").
- "branding": the source channel's name, host, sponsor, or "this channel / our channel / our show" leaked through, or "we go for powered descent" is missing in the closing.
- "engagement": more than one CTA aside is present, an opener subscribe aside is present, the closing CTA is missing, or the closing CTA is templated rather than topic-specific.

Do NOT log positive observations ("digits are fully spelled", "no markdown found") as issues. If the script is clean, return an empty array.

Return ONLY one JSON object on a single line:
{"score": <integer 0-100>, "issues": [<issue object>, ...], "feedback": "<one short sentence summarizing severity>"}

ORIGINAL TRANSCRIPT:
"""
${originalTranscript}
"""

REWRITTEN SCRIPT:
"""
${rewrittenScript}
"""`;
}

function coerceIssue(x: unknown): AccuracyIssue | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const cat = String(o.category ?? 'other').toLowerCase();
  const allowed = [
    'fact',
    'number',
    'verbatim',
    'artifact',
    'typo',
    'ear',
    'branding',
    'engagement',
    'persona',
    'lead',
    'augmentation',
  ] as const;
  const category = (allowed as readonly string[]).includes(cat)
    ? (cat as AccuracyIssue['category'])
    : 'other';
  const quote = typeof o.quote === 'string' ? o.quote : '';
  const fix = typeof o.fix === 'string' ? o.fix : '';
  if (!quote && !fix) return null;
  return { category, quote, fix };
}

function parseAccuracy(raw: string): AccuracyResult {
  const cleaned = raw.replace(/```json\s*|```/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  const json = match ? match[0] : cleaned;
  try {
    const parsed = JSON.parse(json) as {
      score?: number;
      issues?: unknown[];
      feedback?: string;
    };
    const issues = Array.isArray(parsed.issues)
      ? parsed.issues.map(coerceIssue).filter((i): i is AccuracyIssue => i !== null)
      : [];
    const scoreNum = typeof parsed.score === 'number' ? parsed.score : Number(parsed.score);
    const score = Number.isFinite(scoreNum)
      ? Math.max(0, Math.min(100, Math.round(scoreNum)))
      : 0;
    return {
      score,
      issues,
      feedback: typeof parsed.feedback === 'string' ? parsed.feedback : '',
      raw,
    };
  } catch {
    return {
      score: 0,
      issues: [{ category: 'other', quote: '', fix: 'Could not parse accuracy response' }],
      feedback: raw.slice(0, 500),
      raw,
    };
  }
}

export async function rewriteScript(originalTranscript: string, title: string): Promise<string> {
  return callClaude({
    systemPrompt: WRITER_SYSTEM_PROMPT,
    userPrompt: buildRewritePrompt(originalTranscript, title),
  });
}

export async function checkAccuracy(
  rewrittenScript: string,
  originalTranscript: string,
): Promise<AccuracyResult> {
  const raw = await callPerplexity(
    'You are a strict fact-and-readability auditor. You output only a single JSON object on one line, no commentary.',
    buildAccuracyPrompt(rewrittenScript, originalTranscript),
  );
  return parseAccuracy(raw);
}

export async function correctScript(
  previousScript: string,
  accuracy: AccuracyResult,
  originalTranscript: string,
): Promise<string> {
  return callClaude({
    systemPrompt: EDITOR_SYSTEM_PROMPT,
    userPrompt: buildCorrectionPrompt(previousScript, accuracy, originalTranscript),
  });
}

export async function rewriteUntilAccurate(
  originalTranscript: string,
  title: string,
  callbacks?: {
    onAttempt?: (attempt: number, accuracy: AccuracyResult) => void;
  },
): Promise<RewriteOutcome> {
  const attempts: { script: string; accuracy: AccuracyResult }[] = [];
  let currentScript = await rewriteScript(originalTranscript, title);
  let currentAccuracy = await checkAccuracy(currentScript, originalTranscript);
  attempts.push({ script: currentScript, accuracy: currentAccuracy });
  callbacks?.onAttempt?.(1, currentAccuracy);

  if (currentAccuracy.score >= ACCURACY_THRESHOLD) {
    return { finalScript: currentScript, finalAccuracy: currentAccuracy, attempts, reachedThreshold: true };
  }

  for (let i = 1; i < MAX_REWRITE_ATTEMPTS; i++) {
    currentScript = await correctScript(currentScript, currentAccuracy, originalTranscript);
    currentAccuracy = await checkAccuracy(currentScript, originalTranscript);
    attempts.push({ script: currentScript, accuracy: currentAccuracy });
    callbacks?.onAttempt?.(i + 1, currentAccuracy);
    if (currentAccuracy.score >= ACCURACY_THRESHOLD) {
      return { finalScript: currentScript, finalAccuracy: currentAccuracy, attempts, reachedThreshold: true };
    }
  }

  const best = attempts.reduce((a, b) => (a.accuracy.score >= b.accuracy.score ? a : b));
  return {
    finalScript: best.script,
    finalAccuracy: best.accuracy,
    attempts,
    reachedThreshold: false,
  };
}

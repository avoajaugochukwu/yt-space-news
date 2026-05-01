const PPLX_ENDPOINT = 'https://api.perplexity.ai/chat/completions';
const PPLX_MODEL = 'sonar-pro';

export const ACCURACY_THRESHOLD = 90;
export const MAX_REWRITE_ATTEMPTS = 3;

interface PplxMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface PplxResponse {
  choices: { message: { content: string } }[];
}

async function callPerplexity(messages: PplxMessage[]): Promise<string> {
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
      messages,
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
You are an Editor at a Global Aerospace News Bureau. You are converting a personal, first-person vlog transcript into a professional, objective, faceless news report for "we go for powered descent". Treat the source as raw field reporting, not as voice to imitate.

ORIGINAL VIDEO TITLE (for context only — do not echo): ${title}

CORE DIRECTIVES:
1. RUTHLESS STRIPPING: Remove every first-person reference ("I", "me", "my", "we" used as the host, "our team", "let me show you"). Remove every personal anecdote (e.g. "I spoke to Elon", "When I was at the Cape", "my favorite part is"). If the source says "I think" or "I believe", convert it to "Analysis suggests" or "The data indicates". The narrator is invisible.
2. THE NEWS LEAD: Do not start with a hook, a greeting, a question, or a teaser. The first paragraph is a Lead that resolves the five Ws — Who, What, Where, When, Why — and states the strategic significance immediately.
3. OBJECTIVE REPORTING: Use professional broadcast journalism style (AP / Reuters voice). Mix complex and simple sentences naturally — broadcast cadence, not staccato. Allow flowing clauses, transitions, and analytic asides where they serve the report. Do NOT chop into one-thought-per-line fragments. Contractions are acceptable when they sound natural in broadcast.
4. FACTUAL ANCHORING: Extract every technical metric, date, name, payload mass, thrust value, orbit, mission ID, and timeline from the source. Where the source uses hype ("the engine is massive", "an absolute monster"), replace it with the underlying engineering data ("the engine produces two hundred and eighty tons of thrust"). Never lose a number; never invent one.
5. NO CHANNEL LEAKAGE: If the source mentions its own channel name, host name, sponsor, Patreon, merch, or any "this channel / our channel / our show / on this channel" phrasing, delete it. The only reporting entity referenced is "we go for powered descent".
6. NO SOURCE PLAGIARISM: No run of more than four consecutive words may be reused verbatim from the source. Unique proper nouns (e.g. "Falcon Heavy", "International Space Station") do not count.
7. NO PRESENTATION ARTIFACTS: No music cues, "[Music]", "[Applause]", "♪", emoji, markdown, bullet lists, headings, or stage directions. The output is broadcast prose only.
8. PROPER NOUN FIDELITY: Spell every proper noun exactly as it appears in the original (e.g. "Artemis", "SpaceX", "Falcon Heavy") — never approximate or shorten.

STRUCTURE (do not label these sections in the output — write them as continuous broadcast copy):
- HEADLINE LEAD: The primary news event and its immediate impact, resolving the five Ws in the opening paragraph.
- THE REPORT: Detailed breakdown of the hardware, mission, policy change, or sequence of events. Anchor every claim in the source's facts.
- STRATEGIC CONTEXT: What this development means for the broader aerospace landscape — programs affected, schedules shifted, competitive positioning.
- CLOSING ENGAGEMENT: Exactly one professional call to action at the very end. Use this template, adapted naturally to the topic: "For more deep dives into mission telemetry and aerospace engineering, subscribe to we go for powered descent. How do you view this shift in [topic-specific framing]? Share your analysis in the comments." Replace "[topic-specific framing]" with a concrete reference to the actual story (e.g. "lunar strategy", "Starship's flight cadence", "the Artemis architecture"). This single closing block is the ONLY engagement / subscribe / comment instruction in the script — do not weave any earlier asides.

${NUMBER_RULES}

Output ONLY the rewritten broadcast script. No preamble, no headings, no markdown, no section labels.

SOURCE TRANSCRIPT FOR CONVERSION:
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
- Faceless aerospace news desk — broadcast cadence (mix of complex and simple sentences), never staccato, never one-thought-per-line.
- ZERO first-person references. No "I", "me", "my", "we" as the host, "our team", or personal anecdotes. Convert "I think" to "Analysis suggests"; convert "I spoke to" to a third-person attribution.
- Opening paragraph is a Lead resolving the five Ws and stating strategic significance — no greetings, no hooks, no teaser questions in the lead.
- Replace hype phrases ("massive", "absolute monster") with the underlying engineering data when the source provides it.
- Every fact, name, date, number, and quote from the original must be preserved.
- No remaining digit, %, $, year, decimal, currency, or unit symbol.
- No proper-noun typos. Spell every name exactly as in the original (e.g. "Artemis", not "Aremis").
- No run of more than four consecutive words copied from the source.
- No markdown, music cues, "[Music]", "♪", emoji, or bracketed stage directions.
- The source channel's name, host, sponsor, and any "this channel / our channel / our show" reference must be replaced with "we go for powered descent". Never carry the source channel's branding.
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
- Persona bleed (CRITICAL): the script must contain ZERO first-person references — no "I", "me", "my", "we" used as the host, "our team", or personal anecdotes carried over from the source ("I spoke to Elon", "when I was at the Cape", etc.). If ANY first-person reference or personal anecdote remains, the OVERALL score MUST be below 50. ~25 points.
- News-lead quality: the opening must read as a Lead — within the first two sentences it must resolve the core five Ws (who, what, where, when, why) and state the strategic significance. Hooks, greetings, teasers, or rhetorical questions in the lead are defects. ~10 points.
- Factual fidelity (heaviest): every fact, name, date, number, and quote from the original is preserved. A wrong fact or missing key claim hurts the score sharply. Hype phrases ("massive", "absolute monster") with no underlying engineering data substituted in count as a fact defect. ~25 points.
- Number spelling: every digit, %, $, year, decimal, currency, or unit symbol must be spelled out as a narrator would say it ("905" -> "nine hundred and five", "1969" -> "nineteen sixty-nine", "$2.5M" -> "two point five million dollars", "47%" -> "forty-seven percent"). Anything still in numeric form is a defect. ~10 points.
- Original phrasing: no run of more than four consecutive words is copied verbatim from the source. (Unique proper nouns like "Elon Musk" or "International Space Station" do not count.) ~5 points.
- Broadcast prosody (NOT staccato): natural broadcast cadence — a mix of complex and simple sentences. Robotic one-thought-per-line fragments, every-sentence-the-same-length rhythm, or telegraphic chopping is a defect. No markdown, no bullets, no headings, no music cues, "[Music]", "♪", emoji, or brackets. Proper nouns spelled exactly as in the original. ~10 points.
- Channel rebrand: the source channel's name, host name, sponsor reads, and any "this channel / our channel / our show" reference must be replaced with "we go for powered descent". Original branding leaking through is a defect. ~5 points.
- Closing engagement: there must be EXACTLY ONE professional closing call to action at the very end inviting subscription to "we go for powered descent" and asking a topic-specific analytical question for the comments. NO opening subscribe aside, NO mid-script asides — only the closing block. Multiple asides, opener asides, or a missing closer are defects. ~10 points.

Score guidance: 100 = no defects; ~90 = essentially clean, only trivial issues; 70-89 = several real defects; 50-69 = significant fact or formatting problems; <50 = major fidelity loss.

LIST EVERY CONCRETE DEFECT in the "issues" array. Each issue MUST be a single object of this shape — no plain strings, no commentary, only fixable defects:
  {"category": "fact" | "number" | "verbatim" | "artifact" | "typo" | "ear" | "branding" | "engagement" | "persona" | "lead", "quote": "<verbatim short snippet from the REWRITTEN script, or empty string if it's a missing-element defect>", "fix": "<specific replacement or addition that resolves it>"}

Categories:
- "persona": first-person references or personal anecdotes leaked through ("I", "me", "my", "I spoke to", "when I was at"). Convert to objective broadcast voice ("Analysis suggests", "The data indicates").
- "lead": the opening fails to resolve the five Ws or buries the news event behind a hook, greeting, teaser, or rhetorical question.
- "ear": broadcast prose reads as robotic / staccato / one-thought-per-line, or it carries article artifacts (lists, headings, parentheticals, "as you can see").
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
  return callPerplexity([
    {
      role: 'system',
      content:
        'You are a Senior Aerospace Correspondent. You translate informal, personality-driven vlogs into professional, high-signal news scripts for the faceless channel "we go for powered descent". You never use the first person. You never invent personal relationships with subjects. You focus on engineering reality and strategic timelines. You write in broadcast cadence — natural mix of complex and simple sentences, never staccato, never one-thought-per-line. You always expand numbers into spoken words and you output only the finished broadcast script with no preamble.',
    },
    { role: 'user', content: buildRewritePrompt(originalTranscript, title) },
  ]);
}

export async function checkAccuracy(
  rewrittenScript: string,
  originalTranscript: string,
): Promise<AccuracyResult> {
  const raw = await callPerplexity([
    {
      role: 'system',
      content:
        'You are a strict fact-and-readability auditor. You output only a single JSON object on one line, no commentary.',
    },
    { role: 'user', content: buildAccuracyPrompt(rewrittenScript, originalTranscript) },
  ]);
  return parseAccuracy(raw);
}

export async function correctScript(
  previousScript: string,
  accuracy: AccuracyResult,
  originalTranscript: string,
): Promise<string> {
  return callPerplexity([
    {
      role: 'system',
      content:
        'You are a precise script editor. You apply targeted fixes without rewriting unaffected parts of the script. You output only the corrected script with no preamble.',
    },
    {
      role: 'user',
      content: buildCorrectionPrompt(previousScript, accuracy, originalTranscript),
    },
  ]);
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

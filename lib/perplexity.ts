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
  category: 'fact' | 'number' | 'verbatim' | 'artifact' | 'typo' | 'other';
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
  return `You are rewriting a YouTube narration script. The goal is a clean, original, narration-ready script that preserves all factual content from the source but is reworded so it does not plagiarize the original.

ORIGINAL VIDEO TITLE: ${title}

REQUIREMENTS:
1. Preserve every factual claim, name, quote attribution, statistic, and chronology from the source. Do not invent new facts.
2. Rewrite every sentence in your own words. No phrase longer than 4 consecutive words may be reused verbatim from the source.
3. Use a calm, engaging, narration-friendly voice suitable for text-to-speech.
4. Remove music cues, "[Music]", "[Applause]", "♪", subscribe pleas, sponsor reads, and any non-narrative chatter from the source.
5. Keep the same overall length and structure as the source.
6. Spell every proper noun exactly as it appears in the original (e.g. "Artemis", "SpaceX", "Falcon Heavy") — never approximate or shorten a name.

${NUMBER_RULES}

Output ONLY the rewritten script. No preamble, no headings, no markdown.

ORIGINAL TRANSCRIPT:
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
- Every fact, name, date, number, and quote from the original must be preserved.
- No remaining digit, %, $, year, decimal, currency, or unit symbol.
- No proper-noun typos. Spell every name exactly as in the original (e.g. "Artemis", not "Aremis").
- No run of more than four consecutive words copied from the source.
- No markdown, music cues, "[Music]", "♪", emoji, or bracketed stage directions.

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
  return `Audit a rewritten YouTube narration against the original transcript and produce a holistic accuracy score plus a list of concrete defects the editor can fix.

CRITERIA — weigh these when assigning the score (use your judgment on severity, do not just count items):
- Factual fidelity (heaviest): every fact, name, date, number, and quote from the original is preserved. A wrong fact or missing key claim hurts the score sharply. ~50 points.
- Number spelling: every digit, %, $, year, decimal, currency, or unit symbol must be spelled out as a narrator would say it ("905" -> "nine hundred and five", "1969" -> "nineteen sixty-nine", "$2.5M" -> "two point five million dollars", "47%" -> "forty-seven percent"). Anything still in numeric form is a defect. ~25 points.
- Original phrasing: no run of more than four consecutive words is copied verbatim from the source. (Unique proper nouns like "Elon Musk" or "International Space Station" do not count.) ~15 points.
- TTS readability: no markdown, music cues, "[Music]", "♪", emoji, brackets, or non-narrative artifacts. Proper nouns spelled exactly as in the original. ~10 points.

Score guidance: 100 = no defects; ~90 = essentially clean, only trivial issues; 70-89 = several real defects; 50-69 = significant fact or formatting problems; <50 = major fidelity loss.

LIST EVERY CONCRETE DEFECT in the "issues" array. Each issue MUST be a single object of this shape — no plain strings, no commentary, only fixable defects:
  {"category": "fact" | "number" | "verbatim" | "artifact" | "typo", "quote": "<verbatim short snippet from the REWRITTEN script>", "fix": "<specific replacement that resolves it>"}

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
  const allowed = ['fact', 'number', 'verbatim', 'artifact', 'typo'] as const;
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
        'You are a precise script rewriter. You always preserve facts, always rephrase, and always expand numbers into spoken words. You output only the rewritten script with no preamble.',
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

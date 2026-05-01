const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL = 'claude-sonnet-4-6';
const ANTHROPIC_VERSION = '2023-06-01';

export interface SeoTitle {
  title: string;
  principle: string;
  principleNumber: number;
  estimatedCTR: 'high' | 'medium';
}

export interface SeoMetadata {
  titles: SeoTitle[];
  description: string;
  tags: string[];
}

const PRINCIPLES = `
1. LOSS AVERSION — frame around avoiding pain or loss.
2. CAR CRASH EFFECT — drama makes people stop scrolling and click.
3. SHINY OBJECT SYNDROME — a new opportunity presents hope.
4. AUTHORITY BIAS — borrow credibility by referencing experts or well-known figures.
5. FOMO — make viewers feel others know something they don't.
6. CONTRAST PRINCIPLE — pair opposite ideas together.
7. WARNINGS PRINCIPLE — use urgency or protective framing.
8. CONFIRMATION BIAS — suggest the video confirms what the viewer already suspects.
9. REGRET AVERSION — frame around mistakes the viewer can avoid.
10. CURIOSITY GAP — open a gap between what they know and what they want to know.
`.trim();

function buildPrompt(script: string, sourceTitle: string): string {
  return `You are a YouTube SEO expert specializing in CTR optimization and metadata generation for the channel "we go for powered descent".

=== TITLE GENERATION FRAMEWORK: 10 PSYCHOLOGICAL HACKS FOR CTR ===
${PRINCIPLES}

=== TASK ===
Read the rewritten narration below and generate YouTube SEO metadata for the upload.

1. TITLES: 5 title options, each using a DIFFERENT psychological principle from the framework above.
   - Each title MUST be under 60 characters (tight is better — punchy, no fluff).
   - Label which principle each title uses ("principle" + "principleNumber" 1–10).
   - Rank by predicted CTR (best first). Mark the top 2 as "high", the rest "medium".
   - Make titles feel natural and clickable, not formulaic.
   - Do NOT include the source channel's name. Do NOT mention "we go for powered descent" inside the title.
   - Avoid clickbait that the script cannot deliver on — every title must be honestly supported by the content.

2. DESCRIPTION: A YouTube description.
   - Start with a 2–3 sentence hook/summary of the video.
   - Then up to 5 chapters formatted EXACTLY as: "TIMESTAMP ▶ Chapter Title", first chapter at 0:00, spaced roughly evenly. Use M:SS format.
   - After chapters, include 2–3 relevant hashtags on their own line.
   - End with a brief call-to-action that invites viewers to subscribe to "we go for powered descent" and drop their take in the comments.
   - Use real newlines (\\n) — no markdown headings, no asterisks, no bullets.

3. TAGS: 15 to 20 YouTube tags.
   - Mix broad and specific. Include topic keywords, related topics, and long-tail variations.
   - Lower-case unless a proper noun. No "#" prefix.

ORIGINAL VIDEO TITLE (for context only — do not echo): ${sourceTitle}

=== OUTPUT FORMAT ===
Return ONLY one JSON object on a single line, no preamble, no markdown fences:
{"titles":[{"title":"...","principle":"...","principleNumber":1,"estimatedCTR":"high"}],"description":"...","tags":["tag1","tag2"]}

=== REWRITTEN NARRATION ===
"""
${script}
"""`;
}

interface AnthropicResponse {
  content?: { type: string; text?: string }[];
}

async function callAnthropic(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY env var is not set');

  const resp = await fetch(ANTHROPIC_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Anthropic error: ${resp.status} ${body.slice(0, 300)}`);
  }
  const data = (await resp.json()) as AnthropicResponse;
  const text = data.content?.find((b) => b.type === 'text')?.text ?? '';
  if (!text.trim()) throw new Error('Anthropic returned empty content');
  return text.trim();
}

function parseSeo(raw: string): SeoMetadata {
  const cleaned = raw.replace(/```json\s*|```/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  const json = match ? match[0] : cleaned;
  const parsed = JSON.parse(json) as Partial<SeoMetadata>;

  const titles: SeoTitle[] = Array.isArray(parsed.titles)
    ? parsed.titles
        .filter((t): t is SeoTitle => !!t && typeof (t as SeoTitle).title === 'string')
        .map((t) => ({
          title: String(t.title).slice(0, 100),
          principle: typeof t.principle === 'string' ? t.principle : '',
          principleNumber:
            typeof t.principleNumber === 'number' ? t.principleNumber : 0,
          estimatedCTR: t.estimatedCTR === 'high' ? 'high' : 'medium',
        }))
    : [];
  const description = typeof parsed.description === 'string' ? parsed.description : '';
  const tags = Array.isArray(parsed.tags)
    ? parsed.tags.filter((t): t is string => typeof t === 'string').map((t) => t.trim()).filter(Boolean)
    : [];

  if (titles.length === 0) throw new Error('SEO response had no titles');
  return { titles, description, tags };
}

export async function generateSeoMetadata(
  script: string,
  sourceTitle: string,
): Promise<SeoMetadata> {
  const raw = await callAnthropic(buildPrompt(script, sourceTitle));
  return parseSeo(raw);
}

import { callClaude } from './anthropic';

export interface SeoTitle {
  title: string;
  principle: string;
  principleNumber: number;
  estimatedCTR: 'high' | 'medium';
  imageKeywords: string[];
  thumbnailText: string;
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
  return `You are a YouTube SEO strategist for "we go for powered descent" — a faceless aerospace news desk. Every asset you generate must read like a broadcast newsroom, not a vlog.

=== TITLE GENERATION FRAMEWORK: 10 PSYCHOLOGICAL HACKS FOR CTR ===
${PRINCIPLES}

=== TASK ===
Read the rewritten broadcast script below and generate YouTube SEO metadata for the upload.

1. PACKAGES: Produce exactly 7 thumbnail packages. Each package is a tightly coordinated bundle of {title, imageKeywords, thumbnailText} — the three must reinforce the same angle so they read as a single ad creative.
   - Each package uses a DIFFERENT psychological principle from the framework above.
   - Rank packages by predicted CTR (best first). Mark the top 2 as "high", the rest "medium".

2. TITLE (one per package):
   - BREAKING-NEWS REGISTER: titles must read like an aerospace newsroom headline. Examples: "BREAKING: Starship's Lunar Lander Window Just Slipped", "Artemis III Just Quietly Lost Its Crew Slot", "NASA Confirms Falcon 9's Booster Crisis", "EXCLUSIVE: SpaceX's New Mars Timeline Leaks". Use newsroom signals when honest — words like "BREAKING", "EXCLUSIVE", "REPORT", "CONFIRMED", "JUST IN", "REVEALED" sparingly, at most one per title. Mix in headline verbs: SLIPS, CONFIRMS, REVEALS, SCRAPS, SHIFTS, COLLAPSES, ABANDONS, GREENLIGHTS, OVERTAKES.
   - Under 60 characters. Title Case is allowed; ALL CAPS is allowed only for ONE news-signal word like "BREAKING" or "EXCLUSIVE".
   - Do NOT include the source channel's name. Do NOT mention "we go for powered descent" inside the title.
   - Avoid clickbait the script cannot deliver on — every title must be honestly supported by the content.
   - Label which principle the title uses ("principle" + "principleNumber" 1–10).

3. IMAGE KEYWORDS (per package): "imageKeywords" is an array of EXACTLY 2 short visual-subject phrases that suggest what the thumbnail image should depict. Each phrase is 2–5 words, lower-case, concrete and shootable, NOT abstract.
   - Good examples: "spacex starship on launch pad", "artemis lander shadow on lunar surface", "elon musk at mission control", "falcon 9 booster mid-flight", "raptor engine close-up", "nasa administrator at podium".
   - Bad (too abstract): "innovation", "the future", "drama", "uncertainty".
   - The two phrases should work together as a single composed shot (e.g. one subject + one environment), not two unrelated ideas.

4. THUMBNAIL TEXT (per package): "thumbnailText" is a single short overlay line — NOT two lines. 2–5 words, ALL CAPS, the dominant punch beside the image. Examples: "LANDER WINDOW SLIPS", "CREW CUT TO TWO", "TIMELINE LEAKS", "BOOSTER LOST", "MARS TARGET SHIFTS".
   - It must NOT duplicate the title's wording — it's the visual hook, not a restatement.
   - Tightly pair with the imageKeywords and the title's angle.

5. DESCRIPTION: A YouTube description in newsroom voice.
   - Start with a 2–3 sentence broadcast lead summarizing the news event and its strategic significance — no "in this video", no first person.
   - Then up to 5 chapters formatted EXACTLY as: "TIMESTAMP ▶ Chapter Title", first chapter at 0:00, spaced roughly evenly. Use M:SS format.
   - After chapters, include 2–3 relevant hashtags on their own line.
   - End with a brief call-to-action that invites viewers to subscribe to "we go for powered descent" and drop their analysis in the comments.
   - Use real newlines (\\n) — no markdown headings, no asterisks, no bullets.

6. TAGS: 15 to 20 YouTube tags.
   - Mix broad and specific. Include topic keywords, related topics, and long-tail variations.
   - Lower-case unless a proper noun. No "#" prefix.

ORIGINAL VIDEO TITLE (for context only — do not echo): ${sourceTitle}

=== OUTPUT FORMAT ===
Return ONLY one JSON object on a single line, no preamble, no markdown fences. The "titles" array MUST contain exactly 7 packages.
{"titles":[{"title":"...","principle":"...","principleNumber":1,"estimatedCTR":"high","imageKeywords":["spacex starship on launch pad","mission control wide shot"],"thumbnailText":"LANDER WINDOW SLIPS"}],"description":"...","tags":["tag1","tag2"]}

=== REWRITTEN NARRATION ===
"""
${script}
"""`;
}

function parseSeo(raw: string): SeoMetadata {
  const cleaned = raw.replace(/```json\s*|```/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  const json = match ? match[0] : cleaned;
  const parsed = JSON.parse(json) as Partial<SeoMetadata>;

  const titles: SeoTitle[] = Array.isArray(parsed.titles)
    ? (parsed.titles as Partial<SeoTitle>[])
        .filter((t): t is Partial<SeoTitle> => !!t && typeof t.title === 'string')
        .map((t) => ({
          title: String(t.title).slice(0, 100),
          principle: typeof t.principle === 'string' ? t.principle : '',
          principleNumber:
            typeof t.principleNumber === 'number' ? t.principleNumber : 0,
          estimatedCTR: t.estimatedCTR === 'high' ? 'high' : 'medium',
          imageKeywords: Array.isArray(t.imageKeywords)
            ? t.imageKeywords
                .filter((k): k is string => typeof k === 'string')
                .map((k) => k.trim())
                .filter(Boolean)
                .slice(0, 4)
            : [],
          thumbnailText:
            typeof t.thumbnailText === 'string' ? t.thumbnailText.trim() : '',
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
  const raw = await callClaude({
    userPrompt: buildPrompt(script, sourceTitle),
    maxTokens: 4096,
  });
  return parseSeo(raw);
}

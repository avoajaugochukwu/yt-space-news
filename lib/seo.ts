import { callClaude } from './anthropic';

export interface SeoTitle {
  title: string;
  principle: string;
  principleNumber: number;
  estimatedCTR: 'high' | 'medium';
  imageKeywords: string[];
  thumbnailKicker: string;
  thumbnailText: string;
  imagePrompt: string;
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
  return `You are a YouTube SEO strategist for "this is your favorite space channel" — a playful, high-energy space-news creator that competes for clicks on the YouTube home page against creators like "What about it!?", "Marcus House", and "Felix Schlang". Every asset you generate must STOP THE SCROLL. Think reactive, slightly tabloid, dramatized — not a stiff press release. Be playful and clickbaity while staying honestly supported by the script.

=== TITLE GENERATION FRAMEWORK: 10 PSYCHOLOGICAL HACKS FOR CTR ===
${PRINCIPLES}

=== TASK ===
Read the rewritten broadcast script below and generate YouTube SEO metadata for the upload.

1. PACKAGES: Produce exactly 7 thumbnail packages. Each package is a tightly coordinated bundle of {title, imageKeywords, thumbnailKicker, thumbnailText, imagePrompt} — the fields must reinforce the same angle so they read as a single ad creative.
   - Each package uses a DIFFERENT psychological principle from the framework above.
   - Rank packages by predicted CTR (best first). Mark the top 2 as "high", the rest "medium".

2. TITLE (one per package):
   - CLICKBAIT-NEWS REGISTER: titles should hit like a reactive YouTube hook — punchy, emotional, slightly tabloid — while still being truthful. They can be playful rhetorical questions ("Are They Kidding?!"), exclamations ("This Isn't Good for Starship..."), or sharp news beats ("Starship's Mars Window Just Slipped"). Mix conversational hooks ("FINALLY", "ARE THEY SERIOUS", "WAIT, WHAT?", "NO MORE...?", "THIS CHANGES EVERYTHING") with newsroom signals ("BREAKING", "EXCLUSIVE", "JUST IN", "CONFIRMED") used sparingly — at most one signal word per title. Headline verbs welcome: SLIPS, SCRAPS, SHIFTS, REVEALS, COLLAPSES, ABANDONS, OVERTAKES, COMES BACK, RETURNS, EXPLODES.
   - Under 70 characters. Title Case is the default. ALL CAPS is allowed only for ONE punch word (e.g. "BREAKING", "FINALLY", "WAIT"). One trailing "!" or "?" per title is fine for impact; do not stack punctuation.
   - Do NOT include the source channel's name. Do NOT mention "this is your favorite space channel" inside the title.
   - Clickbait is welcome but every title must be honestly supported by the script's content — no fabricated outcomes, no fake quotes.
   - Label which principle the title uses ("principle" + "principleNumber" 1–10).

3. IMAGE KEYWORDS (per package): "imageKeywords" is an array of EXACTLY 2 short visual-subject phrases that suggest what the thumbnail image should depict. Each phrase is 2–5 words, lower-case, concrete and shootable, NOT abstract.
   - Good examples: "spacex starship on launch pad", "artemis lander shadow on lunar surface", "elon musk at mission control", "falcon 9 booster mid-flight", "raptor engine close-up", "nasa administrator at podium".
   - Bad (too abstract): "innovation", "the future", "drama", "uncertainty".
   - The two phrases should work together as a single composed shot (e.g. one subject + one environment), not two unrelated ideas.

4. THUMBNAIL TEXT (per package): the on-thumbnail copy is rendered in post as TWO stacked elements in the bottom-left of the image — a small kicker badge sitting directly above a larger headline bar. Read like a tabloid lower-third, not a press wire.
   - "thumbnailKicker": the small top eyebrow/badge label. 1–3 words, ALL CAPS, no punctuation. Can be a reactive vibe tag, a category, or an urgency stamp. Examples: "WAIT WHAT", "ARE YOU KIDDING", "FINALLY", "NO WAY", "OH NO", "COME ON", "BREAKING", "JUST IN", "MAJOR SETBACK", "MARS UPDATE", "ARTEMIS WATCH", "STARSHIP DRAMA".
   - "thumbnailText": the larger main headline line below the kicker. 2–5 words, ALL CAPS, the dominant punch — playful and clickbaity, like the competitor channels. One trailing "!" or "?" is allowed for impact. Examples: "ARE THEY KIDDING?", "THIS ISN'T GOOD!", "FINALLY HAPPENING!", "NO MORE NRHO?", "FIRING AGAIN TODAY!", "COUNTDOWN BEGINS!", "FLIGHT 12 IN DAYS!", "LATER THAN EXPECTED!", "ROOT CAUSE FOUND!", "FIRST CATCH ON SHIP!", "TIMELINE LEAKS!".
   - Neither field may duplicate the title's exact wording — they're the visual hook, not a restatement.
   - The kicker frames the angle; the main line delivers the punch. Together with imageKeywords they must read as one coordinated creative.

5. IMAGE PROMPT (per package): "imagePrompt" is a single plain-English paragraph (40–80 words) that a model-agnostic text-to-image generator (Flux, SDXL, Ideogram, DALL-E, Midjourney) can turn directly into a 16:9 YouTube thumbnail BACKGROUND.
   - MUST incorporate the imageKeywords as the primary subjects — they are the shot list. Expand them with concrete framing, lighting, lens, atmosphere, and a clear focal point.
   - Do NOT instruct the model to render text, captions, titles, watermarks, logos, or UI overlays anywhere in the image. The thumbnailKicker + thumbnailText are composited later in post as a stacked lower-third in the BOTTOM-LEFT of the frame; the image must leave clean, low-detail negative space there so the text reads on top.
   - Push the primary subject toward the right two-thirds / upper-right of the frame. The bottom-left ~40% should be uncluttered background (sky, smooth surface, soft gradient, out-of-focus terrain) — never the focal point.
   - Voice: hyper-dramatic semi-fictional space CG — think high-end concept-art / cinematic 3D render aesthetic in the style of competitor channels like "What about it!?" and "Felix Schlang". The shot may be dramatized, exaggerated, or speculative (e.g. a Starship doing something it hasn't done yet, an explosion mid-air, a vehicle on a fictional pad at sunset) as long as it visualizes the story angle. Cinematic, ultra-detailed, high contrast, deep teal-and-orange grade, lens flares and atmospheric haze welcome. Polished and believable — not cartoon, not anime, not flat illustration — but it does NOT need to be a press photo. Slight artistic license is encouraged.
   - Be specific and shootable. Example: "Two prototype Starships side by side on a coastal launch pad at fiery golden-hour dusk, low wide-angle hero shot framed from the right, exhaust glow and dust billowing under the nearest vehicle, dramatic god-rays cutting through atmospheric haze, drone silhouettes hovering mid-air, soft out-of-focus coastline and burning orange sky filling the bottom-left third as clean negative space for overlay text. Hyper-detailed cinematic CG render, deep teal-and-orange grade, lens flare, slightly dramatized."
   - Single paragraph, no lists, no Midjourney flags (no "--ar", no "::"), no negative prompts. End with the composition note "leave clean low-detail negative space in the bottom-left for stacked overlay text".

6. DESCRIPTION: A YouTube description in newsroom voice.
   - Start with a 2–3 sentence broadcast lead summarizing the news event and its strategic significance — no "in this video", no first person.
   - Then up to 5 chapters formatted EXACTLY as: "TIMESTAMP ▶ Chapter Title", first chapter at 0:00, spaced roughly evenly. Use M:SS format.
   - After chapters, include 2–3 relevant hashtags on their own line.
   - End with a brief call-to-action that invites viewers to subscribe to "this is your favorite space channel" and drop their analysis in the comments.
   - Use real newlines (\\n) — no markdown headings, no asterisks, no bullets.

7. TAGS: 15 to 20 YouTube tags.
   - Mix broad and specific. Include topic keywords, related topics, and long-tail variations.
   - Lower-case unless a proper noun. No "#" prefix.

ORIGINAL VIDEO TITLE (for context only — do not echo): ${sourceTitle}

=== OUTPUT FORMAT ===
Return ONLY one JSON object on a single line, no preamble, no markdown fences. The "titles" array MUST contain exactly 7 packages.
{"titles":[{"title":"Wait... Starship's Mars Window Just Slipped?!","principle":"...","principleNumber":1,"estimatedCTR":"high","imageKeywords":["spacex starship on launch pad","mission control wide shot"],"thumbnailKicker":"ARE YOU KIDDING","thumbnailText":"MARS IS SLIPPING!","imagePrompt":"Two towering prototype Starships side by side on a dramatized coastal launch pad at fiery golden-hour dusk, low wide-angle hero shot framed from the right, glowing exhaust plumes and dust billowing under the nearest vehicle, god-rays cutting through atmospheric haze, drone silhouettes hovering mid-air, soft out-of-focus coastline and burning orange sky filling the bottom-left third as clean negative space for overlay text. Hyper-detailed cinematic CG render, deep teal-and-orange grade, heavy lens flare, slightly dramatized concept-art realism. Leave clean low-detail negative space in the bottom-left for stacked overlay text."}],"description":"...","tags":["tag1","tag2"]}

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
          thumbnailKicker:
            typeof t.thumbnailKicker === 'string' ? t.thumbnailKicker.trim() : '',
          thumbnailText:
            typeof t.thumbnailText === 'string' ? t.thumbnailText.trim() : '',
          imagePrompt:
            typeof t.imagePrompt === 'string' ? t.imagePrompt.trim() : '',
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

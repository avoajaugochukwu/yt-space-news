import OpenAI from 'openai';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (client) return client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');
  client = new OpenAI({ apiKey });
  return client;
}

export interface SceneTags {
  description: string;
  tags: string[];
  hardware: string[];
  motion: 'static' | 'low' | 'medium' | 'high';
  matched_entities?: string[];
}

export interface VisionHints {
  expectedEntities?: string[];
  visualThemes?: string[];
  contextSentence?: string;
}

const BASE_SYSTEM = `You are a visual cataloger for an aerospace news production system.
Given one keyframe image from B-roll footage, return STRICT JSON:
{
  "description": "<one sentence describing what is visible in technical aerospace terms>",
  "tags": ["<3-8 short technical tags, e.g. 'engine ignition','cryogenic venting','pad approach'>"],
  "hardware": ["<named vehicles/components if visible: 'Starship S31','Raptor 3','Pad B'>"],
  "motion": "static" | "low" | "medium" | "high",
  "matched_entities": ["<exact-string matches against the candidate list, if provided>"]
}
No prose, no fences. If the frame is unclear, still produce best-guess tags.
You may NOT identify private individuals by name. For people, describe their role/context
("executive on stage", "engineer in clean room", "narrator at desk") and any visible logos
or environment cues (banners, hardware in the background).`;

function buildSystemPrompt(hints?: VisionHints): string {
  if (!hints) return BASE_SYSTEM;
  const parts: string[] = [BASE_SYSTEM];
  if (hints.contextSentence) {
    parts.push(`\nThis footage is being cataloged for a story about: ${hints.contextSentence}`);
  }
  if (hints.expectedEntities && hints.expectedEntities.length > 0) {
    parts.push(
      `\nCANDIDATE LIST — bias strongly toward identifying any of these if visible. Use the EXACT spelling from this list when populating "hardware" and "matched_entities":\n` +
        hints.expectedEntities.map((e) => `- ${e}`).join('\n'),
    );
  }
  if (hints.visualThemes && hints.visualThemes.length > 0) {
    parts.push(
      `\nVISUAL THEMES we are looking for in B-roll. Mention any that match in "tags":\n` +
        hints.visualThemes.map((e) => `- ${e}`).join('\n'),
    );
  }
  return parts.join('\n');
}

export async function tagKeyframe(
  jpegBuffer: Buffer,
  hints?: VisionHints,
): Promise<SceneTags> {
  const c = getClient();
  const dataUrl = `data:image/jpeg;base64,${jpegBuffer.toString('base64')}`;
  const r = await c.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: buildSystemPrompt(hints) },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Catalog this keyframe.' },
          { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
        ],
      },
    ],
  });
  const text = r.choices[0]?.message?.content?.trim() ?? '{}';
  const parsed = JSON.parse(text) as Partial<SceneTags>;
  return {
    description: parsed.description ?? '',
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 8) : [],
    hardware: Array.isArray(parsed.hardware) ? parsed.hardware.slice(0, 8) : [],
    matched_entities: Array.isArray(parsed.matched_entities)
      ? parsed.matched_entities.slice(0, 8)
      : [],
    motion: ['static', 'low', 'medium', 'high'].includes(parsed.motion as string)
      ? (parsed.motion as SceneTags['motion'])
      : 'medium',
  };
}

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
}

const SYSTEM = `You are a visual cataloger for an aerospace news production system.
Given one keyframe image from B-roll footage, return STRICT JSON:
{
  "description": "<one sentence describing what is visible in technical aerospace terms>",
  "tags": ["<3-8 short technical tags, e.g. 'engine ignition','cryogenic venting','pad approach'>"],
  "hardware": ["<named vehicles/components if visible: 'Starship S31','Raptor 3','Pad B'>"],
  "motion": "static" | "low" | "medium" | "high"
}
No prose, no fences. If the frame is unclear, still produce best-guess tags.`;

export async function tagKeyframe(jpegBuffer: Buffer): Promise<SceneTags> {
  const c = getClient();
  const dataUrl = `data:image/jpeg;base64,${jpegBuffer.toString('base64')}`;
  const r = await c.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Catalog this keyframe.' },
          { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } },
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
    motion: ['static', 'low', 'medium', 'high'].includes(parsed.motion as string)
      ? (parsed.motion as SceneTags['motion'])
      : 'medium',
  };
}

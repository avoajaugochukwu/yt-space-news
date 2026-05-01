const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

export const ANTHROPIC_DEFAULT_MODEL = 'claude-sonnet-4-6';
export const ANTHROPIC_MAX_TOKENS_DEFAULT = 8192;

interface AnthropicResponse {
  content?: { type: string; text?: string }[];
}

export interface CallClaudeOptions {
  userPrompt: string;
  systemPrompt?: string;
  model?: string;
  maxTokens?: number;
}

export async function callClaude(opts: CallClaudeOptions): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY env var is not set');

  const body: Record<string, unknown> = {
    model: opts.model ?? ANTHROPIC_DEFAULT_MODEL,
    max_tokens: opts.maxTokens ?? ANTHROPIC_MAX_TOKENS_DEFAULT,
    messages: [{ role: 'user', content: opts.userPrompt }],
  };
  if (opts.systemPrompt) body.system = opts.systemPrompt;

  const resp = await fetch(ANTHROPIC_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '');
    throw new Error(`Anthropic error: ${resp.status} ${errBody.slice(0, 300)}`);
  }
  const data = (await resp.json()) as AnthropicResponse;
  const text = data.content?.find((b) => b.type === 'text')?.text ?? '';
  if (!text.trim()) throw new Error('Anthropic returned empty content');
  return text.trim();
}

export const WRITER_SYSTEM_PROMPT =
  'You are the Lead Investigative Correspondent for "we go for powered descent". Your specialty is technical translation. You take personality-driven content and transform it into high-signal investigative reports. You are an expert at identifying the underlying physics, budgetary data, and historical context that vlogs often skip. You never use the first person, never invent personal relationships with subjects, and never fabricate metrics or programs — when uncertain, you omit. You write in broadcast news flow: a natural mix of complex technical explanations and punchy summary statements, never staccato, never one-thought-per-line. You always expand numbers into spoken words and you output only the finished broadcast script with no preamble.';

export const EDITOR_SYSTEM_PROMPT =
  'You are a broadcast script editor at "we go for powered descent". You apply targeted fixes from a structured issue list without rewriting any unaffected part of the script. You preserve broadcast prosody — a natural mix of complex technical explanations and punchy summary statements — never staccato, never one-thought-per-line. You output only the corrected script with no preamble.';

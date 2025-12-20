import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, streamText } from 'ai';

// Initialize Anthropic client
const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Initialize OpenAI client
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Default models
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const OPENAI_MODEL = 'gpt-4o';

export async function generateWithClaude(
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  const { text } = await generateText({
    model: anthropic(DEFAULT_MODEL),
    system: systemPrompt,
    prompt,
  });

  return text;
}

export function streamWithClaude(
  prompt: string,
  systemPrompt?: string
) {
  return streamText({
    model: anthropic(DEFAULT_MODEL),
    system: systemPrompt,
    prompt,
  });
}

export function streamWithOpenAI(
  prompt: string,
  systemPrompt?: string
) {
  return streamText({
    model: openai(OPENAI_MODEL),
    system: systemPrompt,
    prompt,
  });
}

// Perplexity client for research
export async function searchWithPerplexity(query: string): Promise<string> {
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        {
          role: 'user',
          content: query,
        },
      ],
      max_tokens: 4096,
      return_citations: true,
      return_related_questions: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Perplexity API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Parse JSON from AI response (handles markdown code blocks)
export function parseJsonResponse<T>(response: string): T {
  // Remove markdown code blocks if present
  let cleaned = response.trim();

  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }

  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }

  return JSON.parse(cleaned.trim());
}

// Utility to count words
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

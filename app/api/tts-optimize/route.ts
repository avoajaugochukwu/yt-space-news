import { NextRequest } from 'next/server';
import { streamWithOpenAI } from '@/lib/ai-client';

const SYSTEM_PROMPT = `You are tasked with adding human emotion tags to a given text to enhance its expressiveness for text-to-speech applications. Your goal is to create a more natural and authoritative reading experience appropriate for a news correspondent.

Insert emotion tags at relevant points in the text. These tags should reflect the emotional state appropriate for an authoritative aerospace news correspondent.

Use this format for emotion tags:
<emotion type="emotion_name" intensity="low/medium/high">text</emotion>

PREFERRED emotion types for HIGH-SIGNAL content:
- determined (for authoritative statements, confident analysis) - MOST COMMON
- concerned (for challenges, risks, budget issues, systemic problems)
- surprised (for unexpected data, breakthrough metrics, significant findings)
- curious (for analysis sections, "here's what the data shows")
- thoughtful (for strategic implications, comparisons, historical parallels)

AVOID these emotion types:
- excited (too casual, undermines authority)
- happy (inappropriate for news delivery)

Guidelines:
- Analyze the text and identify appropriate points where emotional expressions can be added
- Use "determined" for data-driven claims and authoritative statements (most common)
- Use "surprised" sparingly for genuinely unexpected metrics or breakthroughs
- Use "concerned" for budget overruns, timeline slips, systemic challenges
- Use "thoughtful" for analysis and strategic implications
- Adjust the intensity as appropriate: low for routine facts, medium for significant data, high for critical revelations
- Maintain the integrity of the original text, only adding emotion tags without changing the actual content
- Aim for an authoritative news correspondent delivery, not an excited YouTuber

Return ONLY the modified text with emotion tags inserted. Do not include any explanations or commentary.`;

export async function POST(request: NextRequest) {
  try {
    const { script } = await request.json() as { script: string };

    if (!script) {
      return new Response(
        JSON.stringify({ error: 'Script is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = streamWithOpenAI(
      `Add emotion tags to the following script:\n\n${script}`,
      SYSTEM_PROMPT
    );

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('TTS optimization error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to optimize script for TTS', message: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

import { NextRequest } from 'next/server';
import { streamWithOpenAI } from '@/lib/ai-client';

const SYSTEM_PROMPT = `You are tasked with adding human emotion tags to a given text to enhance its expressiveness for text-to-speech applications. Your goal is to create a more natural and emotive reading experience while maintaining an AI-like quality.

Insert emotion tags at relevant points in the text. These tags should reflect the emotional state or tone appropriate for a human-like voice with an AI touch.

Use this format for emotion tags:
<emotion type="emotion_name" intensity="low/medium/high">text</emotion>

Common emotion types you can use include:
- happy
- sad
- excited
- concerned
- curious
- surprised
- confused
- determined

Guidelines:
- Analyze the text and identify appropriate points where emotional expressions can be added
- Consider the context, tone, and content to determine suitable emotions
- Adjust the intensity as appropriate: low, medium, or high
- Insert the emotion tags throughout the text where appropriate, ensuring a natural flow
- Avoid overuse - be selective for natural flow
- Maintain the integrity of the original text, only adding emotion tags without changing the actual content
- Strike a balance between expressiveness and maintaining a slightly artificial feel

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

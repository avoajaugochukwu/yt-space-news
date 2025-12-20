import { NextRequest, NextResponse } from 'next/server';
import { generateWithClaude, parseJsonResponse } from '@/lib/ai-client';
import { buildOutlinePrompt } from '@/lib/prompts';
import { getScriptingContext } from '@/lib/knowledge-base';
import type { ScriptOutline, StoryCard, HookVariation } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { story, selectedHook } = await request.json() as {
      story: StoryCard;
      selectedHook: HookVariation;
    };

    if (!story || !selectedHook) {
      return NextResponse.json(
        { error: 'Story and selected hook are required' },
        { status: 400 }
      );
    }

    const scriptingContext = await getScriptingContext();

    // Format story for the prompt
    const storyText = `
Title: ${story.title}
Summary: ${story.summary}
Primary Hardware: ${story.hardwareData.primaryHardware}
Agency: ${story.hardwareData.agency}
Technical Specs: ${story.hardwareData.technicalSpecs.join(', ')}
Key Metrics: ${Object.entries(story.hardwareData.keyMetrics).map(([k, v]) => `${k}: ${v}`).join(', ')}
Sources: ${story.sourceUrls.map(s => s.title).join(', ')}
    `.trim();

    const prompt = buildOutlinePrompt(storyText, selectedHook.content, scriptingContext);

    const response = await generateWithClaude(
      prompt,
      `You are the VIRAL SCRIPT ARCHITECT for "Go For Powered Descent" YouTube channel!
You design BINGE-WORTHY scripts with emotional peaks every 90 seconds!
Structure for MAXIMUM retention with cliffhangers and "wait, WHAT?!" moments!
Every section should make viewers feel like they CAN'T click away!`
    );

    const result = parseJsonResponse<ScriptOutline>(response);

    // Ensure the hook is set
    result.hook = selectedHook.content;

    return NextResponse.json(result);
  } catch (error) {
    console.error('Outline generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate outline', message: String(error) },
      { status: 500 }
    );
  }
}

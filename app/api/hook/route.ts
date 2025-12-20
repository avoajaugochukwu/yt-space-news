import { NextRequest, NextResponse } from 'next/server';
import { generateWithClaude, parseJsonResponse } from '@/lib/ai-client';
import { buildHookPrompt } from '@/lib/prompts';
import { getScriptingContext } from '@/lib/knowledge-base';
import { measureHypeLevel } from '@/lib/knowledge-base';
import type { HookResult, StoryCard, TitleOption } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { story, selectedTitle } = await request.json() as {
      story: StoryCard;
      selectedTitle: TitleOption;
    };

    if (!story || !selectedTitle) {
      return NextResponse.json(
        { error: 'Story and selected title are required' },
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
    `.trim();

    const prompt = buildHookPrompt(storyText, selectedTitle.title, scriptingContext);

    const response = await generateWithClaude(
      prompt,
      `You are the VIRAL hook writer for "Go For Powered Descent" YouTube channel!
You write EXPLOSIVE openings that make it IMPOSSIBLE to click away!
Use power phrases LIBERALLY: insane, shocking, mind-blowing, game-changing!
Every hook should feel like BREAKING NEWS that viewers CAN'T miss!`
    );

    const result = parseJsonResponse<HookResult>(response);

    // Measure hype level for each hook and add metrics
    result.hooks = result.hooks.map(hook => {
      const hypeMetrics = measureHypeLevel(hook.content);
      return {
        ...hook,
        hypeScore: hypeMetrics.hypeScore,
        powerPhrasesUsed: hypeMetrics.powerPhrasesFound,
        needsMoreHype: hypeMetrics.needsMoreHype,
        recommendation: hypeMetrics.recommendation,
      };
    });

    // Set winner to the hook with HIGHEST hype score
    if (result.hooks.length > 0) {
      result.winner = result.hooks.reduce((best, current) =>
        (current.hypeScore || 0) > (best.hypeScore || 0) ? current : best
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Hook generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate hooks', message: String(error) },
      { status: 500 }
    );
  }
}

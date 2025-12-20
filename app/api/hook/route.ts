import { NextRequest, NextResponse } from 'next/server';
import { generateWithClaude, parseJsonResponse } from '@/lib/ai-client';
import { buildHookPrompt } from '@/lib/prompts';
import { getScriptingContext } from '@/lib/knowledge-base';
import { checkForBannedPhrases } from '@/lib/knowledge-base';
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
      `You are the hook writer for "Go For Powered Descent" YouTube channel.
You write compelling, data-rich openings that establish credibility immediately.
You NEVER use sensationalist language or banned phrases.`
    );

    const result = parseJsonResponse<HookResult>(response);

    // Check each hook for banned phrases and flag if found
    result.hooks = result.hooks.map(hook => {
      const bannedFound = checkForBannedPhrases(hook.content);
      if (bannedFound.length > 0) {
        return {
          ...hook,
          flagged: true,
          flaggedPhrases: bannedFound,
        };
      }
      return hook;
    });

    // Set winner if recommended
    if (result.hooks.length > 0) {
      const recommendedType = (result as { recommendation?: string }).recommendation || 'hardware';
      result.winner = result.hooks.find(h => h.type === recommendedType) || result.hooks[0];
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

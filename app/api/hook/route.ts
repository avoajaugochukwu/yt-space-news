import { NextRequest, NextResponse } from 'next/server';
import { generateWithClaude, parseJsonResponse } from '@/lib/ai-client';
import { buildHookPrompt } from '@/lib/prompts';
import { getScriptingContext, analyzeContent } from '@/lib/knowledge-base';
import type { HookResult, StoryCard, TitleOption, ContentMode } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { story, selectedTitle, mode = 'hype' } = await request.json() as {
      story: StoryCard;
      selectedTitle: TitleOption;
      mode?: ContentMode;
    };

    if (!story || !selectedTitle) {
      return NextResponse.json(
        { error: 'Story and selected title are required' },
        { status: 400 }
      );
    }

    const scriptingContext = await getScriptingContext(mode);

    // Format story for the prompt
    const storyText = `
Title: ${story.title}
Summary: ${story.summary}
Primary Hardware: ${story.hardwareData.primaryHardware}
Agency: ${story.hardwareData.agency}
Technical Specs: ${story.hardwareData.technicalSpecs.join(', ')}
Key Metrics: ${Object.entries(story.hardwareData.keyMetrics).map(([k, v]) => `${k}: ${v}`).join(', ')}
    `.trim();

    const prompt = buildHookPrompt(storyText, selectedTitle.title, scriptingContext, mode);

    // Mode-specific system prompt
    const systemPrompt = mode === 'hype'
      ? `You are the VIRAL hook writer for "Go For Powered Descent" YouTube channel!
You write EXPLOSIVE openings that make it IMPOSSIBLE to click away!
Use power phrases LIBERALLY: insane, shocking, mind-blowing, game-changing!
Every hook should feel like BREAKING NEWS that viewers CAN'T miss!`
      : `You are the hook writer for "Go For Powered Descent" YouTube channel.
You write compelling, data-rich openings that establish credibility immediately.
Use the "Lead Flight Director" persona: calm, authoritative, hardware-focused.
Never use sensationalist language or banned phrases.`;

    const response = await generateWithClaude(prompt, systemPrompt);

    const result = parseJsonResponse<HookResult>(response);

    // Analyze each hook using mode-aware analysis
    result.hooks = result.hooks.map(hook => {
      const analysis = analyzeContent(hook.content, mode);
      return {
        ...hook,
        analysisScore: analysis.score,
        phrasesFound: analysis.phrasesFound,
        needsAttention: analysis.needsAttention,
        recommendation: analysis.recommendation,
        // Legacy fields for backwards compatibility
        hypeScore: analysis.score,
        powerPhrasesUsed: analysis.phrasesFound,
        needsMoreHype: analysis.needsAttention,
      };
    });

    // Set winner based on mode
    if (result.hooks.length > 0) {
      if (mode === 'hype') {
        // Highest score wins in hype mode
        result.winner = result.hooks.reduce((best, current) =>
          (current.analysisScore || 0) > (best.analysisScore || 0) ? current : best
        );
      } else {
        // Highest score (fewer banned phrases) wins in lowkey mode
        result.winner = result.hooks.reduce((best, current) =>
          (current.analysisScore || 0) > (best.analysisScore || 0) ? current : best
        );
      }
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

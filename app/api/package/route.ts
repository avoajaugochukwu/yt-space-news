import { NextRequest, NextResponse } from 'next/server';
import { generateWithClaude, parseJsonResponse } from '@/lib/ai-client';
import { buildPackagingPrompt } from '@/lib/prompts';
import { getPackagingContext } from '@/lib/knowledge-base';
import type { PackagingResult, StoryCard } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { story } = await request.json() as { story: StoryCard };

    if (!story) {
      return NextResponse.json(
        { error: 'Story data is required' },
        { status: 400 }
      );
    }

    const packagingContext = await getPackagingContext();

    // Format story for the prompt
    const storyText = `
Title: ${story.title}
Summary: ${story.summary}
Primary Hardware: ${story.hardwareData.primaryHardware}
Agency: ${story.hardwareData.agency}
Technical Specs: ${story.hardwareData.technicalSpecs.join(', ')}
Key Metrics: ${Object.entries(story.hardwareData.keyMetrics).map(([k, v]) => `${k}: ${v}`).join(', ')}
    `.trim();

    const prompt = buildPackagingPrompt(storyText, packagingContext);

    const response = await generateWithClaude(
      prompt,
      `You are the packaging specialist for "Go For Powered Descent" YouTube channel.
You create high-signal, engineering-focused titles and thumbnails.
You NEVER use sensationalist language or clickbait tactics.`
    );

    const result = parseJsonResponse<PackagingResult>(response);

    // Ensure IDs are present
    result.titles = result.titles.map((title, index) => ({
      ...title,
      id: title.id || `title-${index + 1}`,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Packaging error:', error);
    return NextResponse.json(
      { error: 'Failed to generate packaging', message: String(error) },
      { status: 500 }
    );
  }
}

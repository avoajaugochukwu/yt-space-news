import { NextResponse } from 'next/server';
import { searchWithPerplexity, parseJsonResponse, generateWithClaude } from '@/lib/ai-client';
import { buildRadarSearchPrompt } from '@/lib/prompts';
import { getResearchContext } from '@/lib/knowledge-base';
import type { StoryCard, RadarScanResponse } from '@/types';

export async function POST() {
  try {
    const searchPrompt = buildRadarSearchPrompt();
    const researchContext = await getResearchContext();

    // Try Perplexity first for real-time search
    let searchResults: string;
    let fallbackUsed = false;

    try {
      searchResults = await searchWithPerplexity(
        `Search for the latest aerospace and space news from the last 24 hours. Focus on:
        - SpaceX launches, tests, Starship developments
        - NASA missions and program updates
        - Blue Origin, ULA launches
        - International space agencies (CNSA, ESA, JAXA)
        - Commercial space industry news

        Provide detailed technical information for each story including hardware specs, dates, and sources.`
      );
    } catch (error) {
      console.error('Perplexity search failed, using 48-hour fallback:', error);
      fallbackUsed = true;
      // Fallback: Ask Claude to generate based on recent knowledge
      searchResults = await generateWithClaude(
        `Generate 4 significant aerospace news stories that would likely be trending in the space industry this week.
        Include realistic technical details and source references.

        ${researchContext}`,
        'You are a space industry analyst with deep technical knowledge.'
      );
    }

    // Process search results through Claude to structure them
    const structuredResponse = await generateWithClaude(
      `${searchPrompt}

Here are the raw search results to process:

${searchResults}

Process these results and return exactly 4 story cards in the specified JSON format.
Assign suitability scores based on hardware focus and technical data availability.
Generate unique IDs for each story.`,
      `You are a research assistant for a technical aerospace YouTube channel.
Your job is to filter and structure news for maximum technical signal.

${researchContext}`
    );

    const parsed = parseJsonResponse<{ stories: StoryCard[] }>(structuredResponse);

    // Add IDs if not present
    const stories = parsed.stories.map((story, index) => ({
      ...story,
      id: story.id || `story-${Date.now()}-${index}`,
    }));

    const response: RadarScanResponse = {
      stories,
      scanTimestamp: new Date().toISOString(),
      fallbackUsed,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Radar scan error:', error);
    return NextResponse.json(
      { error: 'Failed to complete radar scan', message: String(error) },
      { status: 500 }
    );
  }
}

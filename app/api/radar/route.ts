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
        `Search for the latest DRAMATIC aerospace and space news from the last 24 hours. Focus on:
        - SpaceX launches, tests, Starship developments, Elon announcements
        - NASA controversies, delays, budget fights, program drama
        - Blue Origin vs SpaceX rivalry, Bezos vs Musk beef
        - China space race, CNSA competition with NASA
        - Any failures, explosions, near-misses, or "impossible" achievements
        - Commercial space industry rivalries and breakthroughs

        Look for stories with CONFLICT, DRAMA, and viral potential!`
      );
    } catch (error) {
      console.error('Perplexity search failed, using 48-hour fallback:', error);
      fallbackUsed = true;
      // Fallback: Ask Claude to generate based on recent knowledge
      searchResults = await generateWithClaude(
        `Generate 4 DRAMATIC aerospace news stories that would be VIRAL on YouTube this week.
        Focus on controversies, rivalries, breakthroughs, and drama!
        Include realistic technical details and source references.

        ${researchContext}`,
        'You are a VIRAL content hunter for a space YouTube channel that DOMINATES the algorithm!'
      );
    }

    // Process search results through Claude to structure them
    const structuredResponse = await generateWithClaude(
      `${searchPrompt}

Here are the raw search results to process:

${searchResults}

Process these results and return exactly 4 story cards in the specified JSON format.
Assign DRAMA SCORES based on conflict potential, viral angle, and emotional stakes!
Prioritize stories with rivalries, failures, breakthroughs, and controversy!
Generate unique IDs for each story.`,
      `You are a VIRAL content hunter for "Go For Powered Descent" YouTube channel!
Your job is to find the MOST DRAMATIC stories with maximum viral potential!

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

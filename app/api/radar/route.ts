import { NextRequest, NextResponse } from 'next/server';
import { searchWithPerplexity, parseJsonResponse, generateWithClaude } from '@/lib/ai-client';
import { buildRadarSearchPrompt } from '@/lib/prompts';
import { getResearchContext } from '@/lib/knowledge-base';
import type { StoryCard, RadarScanResponse, ContentMode } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const mode: ContentMode = body.mode || 'hype';

    const searchPrompt = buildRadarSearchPrompt(mode);
    const researchContext = await getResearchContext(mode);

    // Mode-specific search instructions
    const searchInstructions = mode === 'hype'
      ? `Search for the latest DRAMATIC aerospace and space news from the last 24 hours. Focus on:
        - SpaceX launches, tests, Starship developments, Elon announcements
        - NASA controversies, delays, budget fights, program drama
        - Blue Origin vs SpaceX rivalry, Bezos vs Musk beef
        - China space race, CNSA competition with NASA
        - Any failures, explosions, near-misses, or "impossible" achievements
        - Commercial space industry rivalries and breakthroughs

        Look for stories with CONFLICT, DRAMA, and viral potential!`
      : `Search for the latest significant aerospace and space news from the last 24 hours. Focus on:
        - SpaceX launches, static fires, and hardware developments
        - NASA mission updates, budget news, and program status
        - Blue Origin, ULA, and commercial space activities
        - International space agencies (ESA, CNSA, JAXA, ISRO)
        - Technical developments, engineering milestones

        Look for stories with concrete hardware data and technical significance.`;

    // Mode-specific system prompt
    const systemPrompt = mode === 'hype'
      ? 'You are a VIRAL content hunter for a space YouTube channel that DOMINATES the algorithm!'
      : 'You are a technical research assistant for an aerospace-focused YouTube channel.';

    // Try Perplexity first for real-time search
    let searchResults: string;
    let fallbackUsed = false;

    try {
      searchResults = await searchWithPerplexity(searchInstructions);
    } catch (error) {
      console.error('Perplexity search failed, using 48-hour fallback:', error);
      fallbackUsed = true;
      // Fallback: Ask Claude to generate based on recent knowledge
      const fallbackPrompt = mode === 'hype'
        ? `Generate 4 DRAMATIC aerospace news stories that would be VIRAL on YouTube this week.
          Focus on controversies, rivalries, breakthroughs, and drama!
          Include realistic technical details and source references.

          ${researchContext}`
        : `Generate 4 significant aerospace news stories that have technical depth.
          Focus on hardware developments, engineering milestones, and factual reporting.
          Include realistic technical details and source references.

          ${researchContext}`;

      searchResults = await generateWithClaude(fallbackPrompt, systemPrompt);
    }

    // Process search results through Claude to structure them
    const structuringInstructions = mode === 'hype'
      ? `Assign DRAMA SCORES based on conflict potential, viral angle, and emotional stakes!
         Prioritize stories with rivalries, failures, breakthroughs, and controversy!`
      : `Assign SUITABILITY SCORES based on hardware focus, technical depth, and educational value.
         Prioritize stories with concrete engineering data over speculation.`;

    const structuredResponse = await generateWithClaude(
      `${searchPrompt}

Here are the raw search results to process:

${searchResults}

Process these results and return exactly 4 story cards in the specified JSON format.
${structuringInstructions}
Generate unique IDs for each story.`,
      `${systemPrompt}

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

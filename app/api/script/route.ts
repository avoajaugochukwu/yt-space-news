import { NextRequest, NextResponse } from 'next/server';
import { generateWithClaude, parseJsonResponse, countWords } from '@/lib/ai-client';
import { buildScriptPhasePrompt, buildExpandPrompt } from '@/lib/prompts';
import { getScriptingContext, checkForBannedPhrases } from '@/lib/knowledge-base';
import type { ScriptOutline, ScriptSegment, GeneratedScript, StoryCard } from '@/types';

const MINIMUM_WORDS_RATIO = 0.8; // Must hit 80% of target

export async function POST(request: NextRequest) {
  try {
    const { story, outline, phaseId } = await request.json() as {
      story: StoryCard;
      outline: ScriptOutline;
      phaseId?: string; // If provided, generate only this phase
    };

    if (!story || !outline) {
      return NextResponse.json(
        { error: 'Story and outline are required' },
        { status: 400 }
      );
    }

    const scriptingContext = await getScriptingContext();

    // Format outline for context
    const outlineText = `
Hook: ${outline.hook}

Phases:
${outline.phases.map(p => `- ${p.name} (${p.estimatedWords} words): ${p.keyPoints.join('; ')}`).join('\n')}

Total target: ${outline.totalEstimatedWords} words
    `.trim();

    const segments: ScriptSegment[] = [];
    let previousContent = '';

    // Determine which phases to generate
    const phasesToGenerate = phaseId
      ? outline.phases.filter(p => p.id === phaseId)
      : outline.phases;

    for (const phase of phasesToGenerate) {
      const prompt = buildScriptPhasePrompt(
        outlineText,
        phase.id,
        phase.name,
        phase.keyPoints,
        phase.estimatedWords,
        previousContent.slice(-500), // Last 500 chars for continuity
        scriptingContext
      );

      let response = await generateWithClaude(
        prompt,
        `You are The Scribe for "Go For Powered Descent" YouTube channel.
You write scripts that are data-rich, technically accurate, and avoid hyperbole.
You maintain the "Lead Flight Director" persona throughout.`
      );

      let parsed = parseJsonResponse<{
        phaseId: string;
        content: string;
        wordCount: number;
      }>(response);

      // Check word count and expand if needed
      const actualWordCount = countWords(parsed.content);
      const targetWords = phase.estimatedWords;

      if (actualWordCount < targetWords * MINIMUM_WORDS_RATIO) {
        const expandPrompt = buildExpandPrompt(
          parsed.content,
          actualWordCount,
          targetWords,
          scriptingContext
        );

        const expandedResponse = await generateWithClaude(
          expandPrompt,
          'You are The Scribe. Expand the technical content with more data points.'
        );

        const expandedParsed = parseJsonResponse<{
          expandedContent: string;
          wordCount: number;
        }>(expandedResponse);

        parsed.content = expandedParsed.expandedContent;
        parsed.wordCount = countWords(expandedParsed.expandedContent);
      }

      // Check for banned phrases
      const bannedFound = checkForBannedPhrases(parsed.content);

      const segment: ScriptSegment = {
        phaseId: phase.id,
        content: parsed.content,
        wordCount: countWords(parsed.content),
        hasBannedPhrases: bannedFound.length > 0,
        flaggedPhrases: bannedFound.length > 0 ? bannedFound : undefined,
      };

      segments.push(segment);
      previousContent += '\n\n' + parsed.content;
    }

    const result: GeneratedScript = {
      segments,
      totalWordCount: segments.reduce((sum, s) => sum + s.wordCount, 0),
      sources: story.sourceUrls,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Script generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate script', message: String(error) },
      { status: 500 }
    );
  }
}

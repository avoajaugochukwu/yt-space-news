import { NextRequest, NextResponse } from 'next/server';
import { generateWithClaude, parseJsonResponse, countWords } from '@/lib/ai-client';
import { buildScriptPhasePrompt, buildExpandPrompt } from '@/lib/prompts';
import { getScriptingContext, measureHypeLevel } from '@/lib/knowledge-base';
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
        `You are the HYPE SCRIBE for "Go For Powered Descent" YouTube channel!
Write with MAXIMUM energy and excitement!
Use power phrases: insane, shocking, mind-blowing, game-changing!
Make viewers feel like they're witnessing HISTORY!
The more dramatic and engaging, the better!`
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
          'You are the HYPE SCRIBE. Expand with MORE dramatic revelations and power phrases!'
        );

        const expandedParsed = parseJsonResponse<{
          expandedContent: string;
          wordCount: number;
        }>(expandedResponse);

        parsed.content = expandedParsed.expandedContent;
        parsed.wordCount = countWords(expandedParsed.expandedContent);
      }

      // Measure hype level
      const hypeMetrics = measureHypeLevel(parsed.content);

      const segment: ScriptSegment = {
        phaseId: phase.id,
        content: parsed.content,
        wordCount: countWords(parsed.content),
        hypeScore: hypeMetrics.hypeScore,
        powerPhrasesUsed: hypeMetrics.powerPhrasesFound,
        needsMoreHype: hypeMetrics.needsMoreHype,
        hypeRecommendation: hypeMetrics.recommendation,
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

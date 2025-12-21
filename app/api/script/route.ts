import { NextRequest, NextResponse } from 'next/server';
import { generateWithClaude, parseJsonResponse, countWords } from '@/lib/ai-client';
import { buildScriptPhasePrompt, buildExpandPrompt } from '@/lib/prompts';
import { getScriptingContext, analyzeContent } from '@/lib/knowledge-base';
import type { ScriptOutline, ScriptSegment, GeneratedScript, StoryCard, ContentMode } from '@/types';

const MINIMUM_WORDS_RATIO = 0.8; // Must hit 80% of target

export async function POST(request: NextRequest) {
  try {
    const { story, outline, phaseId, mode = 'hype' } = await request.json() as {
      story: StoryCard;
      outline: ScriptOutline;
      phaseId?: string; // If provided, generate only this phase
      mode?: ContentMode;
    };

    if (!story || !outline) {
      return NextResponse.json(
        { error: 'Story and outline are required' },
        { status: 400 }
      );
    }

    const scriptingContext = await getScriptingContext(mode);

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

    // Mode-specific system prompts
    const systemPrompt = mode === 'hype'
      ? `You are the HYPE SCRIBE for "Go For Powered Descent" YouTube channel!
Write with MAXIMUM energy and excitement!
Use power phrases: insane, shocking, mind-blowing, game-changing!
Make viewers feel like they're witnessing HISTORY!
The more dramatic and engaging, the better!`
      : `You are the script writer for "Go For Powered Descent" YouTube channel.
Write with data-driven precision and technical authority.
Use the "Lead Flight Director" persona: calm, authoritative, skeptical of hype.
Focus on hardware specifics, engineering details, and factual accuracy.`;

    const expandSystemPrompt = mode === 'hype'
      ? 'You are the HYPE SCRIBE. Expand with MORE dramatic revelations and power phrases!'
      : 'You are the technical script writer. Expand with MORE data points and engineering details.';

    for (const phase of phasesToGenerate) {
      const prompt = buildScriptPhasePrompt(
        outlineText,
        phase.id,
        phase.name,
        phase.keyPoints,
        phase.estimatedWords,
        previousContent.slice(-500), // Last 500 chars for continuity
        scriptingContext,
        mode
      );

      let response = await generateWithClaude(prompt, systemPrompt);

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
          scriptingContext,
          mode
        );

        const expandedResponse = await generateWithClaude(expandPrompt, expandSystemPrompt);

        const expandedParsed = parseJsonResponse<{
          expandedContent: string;
          wordCount: number;
        }>(expandedResponse);

        parsed.content = expandedParsed.expandedContent;
        parsed.wordCount = countWords(expandedParsed.expandedContent);
      }

      // Analyze content using mode-aware analysis
      const analysis = analyzeContent(parsed.content, mode);

      const segment: ScriptSegment = {
        phaseId: phase.id,
        content: parsed.content,
        wordCount: countWords(parsed.content),
        // Mode-aware analysis fields
        analysisScore: analysis.score,
        phrasesFound: analysis.phrasesFound,
        needsAttention: analysis.needsAttention,
        recommendation: analysis.recommendation,
        // Legacy fields for backwards compatibility
        hypeScore: analysis.score,
        powerPhrasesUsed: analysis.phrasesFound,
        needsMoreHype: analysis.needsAttention,
        hypeRecommendation: analysis.recommendation,
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

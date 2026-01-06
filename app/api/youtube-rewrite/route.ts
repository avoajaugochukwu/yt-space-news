import { NextRequest, NextResponse } from 'next/server';
import { generateWithClaude, parseJsonResponse } from '@/lib/ai-client';
import { buildYouTubeRewritePrompt, buildYouTubeTitlePrompt } from '@/lib/prompts';

const TRANSCRIPT_LAMBDA_URL =
  'https://bepu4kbnoghbb2kx5tjfi7duom0mofcd.lambda-url.us-west-2.on.aws/';

// Extract video ID from various YouTube URL formats
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/ // Direct video ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { url } = (await request.json()) as { url: string };

    if (!url) {
      return NextResponse.json({ error: 'YouTube URL is required' }, { status: 400 });
    }

    const videoId = extractVideoId(url.trim());
    if (!videoId) {
      return NextResponse.json({ error: 'Invalid YouTube URL format' }, { status: 400 });
    }

    // Fetch transcript from Lambda
    const videoUrl = url.trim().startsWith('http')
      ? url.trim()
      : `https://www.youtube.com/watch?v=${videoId}`;

    const lambdaResponse = await fetch(TRANSCRIPT_LAMBDA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoUrl }),
    });

    if (!lambdaResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch transcript from video' },
        { status: lambdaResponse.status }
      );
    }

    const lambdaData = await lambdaResponse.json();
    const parsedBody =
      typeof lambdaData.body === 'string' ? JSON.parse(lambdaData.body) : lambdaData.body;

    if (!parsedBody?.transcript) {
      return NextResponse.json(
        { error: 'No transcript available for this video. The video may not have captions enabled.' },
        { status: 404 }
      );
    }

    const fullTranscript = parsedBody.transcript.replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();

    // Build rewrite prompt and generate rewritten script first
    const scriptPrompt = buildYouTubeRewritePrompt(fullTranscript);
    const scriptSystemPrompt = `You are an expert script rewriter who creates completely original content while preserving meaning. You never plagiarize - every sentence you write is uniquely phrased. Your rewrites are natural, engaging, and suitable for YouTube video delivery.`;

    const rewrittenScript = await generateWithClaude(scriptPrompt, scriptSystemPrompt);

    // Generate titles based on the rewritten script
    const titlePrompt = buildYouTubeTitlePrompt(rewrittenScript);
    const titleSystemPrompt = `You are a YouTube title specialist. Return only valid JSON arrays.`;
    const titleResponse = await generateWithClaude(titlePrompt, titleSystemPrompt);

    // Parse improved titles from JSON response
    let improvedTitles: string[] = [];
    try {
      improvedTitles = parseJsonResponse<string[]>(titleResponse);
    } catch {
      // If parsing fails, try to extract titles manually
      const matches = titleResponse.match(/"([^"]+)"/g);
      if (matches) {
        improvedTitles = matches.map((m) => m.replace(/"/g, '')).slice(0, 3);
      }
    }

    return NextResponse.json({
      originalTranscript: fullTranscript,
      rewrittenScript,
      wordCount: rewrittenScript.split(/\s+/).filter((w) => w.length > 0).length,
      improvedTitles,
    });
  } catch (error) {
    console.error('YouTube rewrite error:', error);
    return NextResponse.json(
      { error: 'Failed to process video', message: String(error) },
      { status: 500 }
    );
  }
}

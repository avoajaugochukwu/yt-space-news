import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'youtubei';
import { generateWithClaude, parseJsonResponse } from '@/lib/ai-client';
import { buildYouTubeRewritePrompt, buildYouTubeTitlePrompt } from '@/lib/prompts';

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

    // Initialize youtubei client
    const youtube = new Client();

    // Fetch video info
    const video = await youtube.getVideo(videoId);
    if (!video) {
      return NextResponse.json({ error: 'Could not fetch video information' }, { status: 404 });
    }

    // Get transcript using captions API
    let captions;
    if (video.captions) {
      // Try English first, then fall back to first available language
      captions = await video.captions.get('en');
      if (!captions && video.captions.languages.length > 0) {
        const firstLang = video.captions.languages[0];
        captions = await video.captions.get(firstLang.code);
      }
    }

    if (!captions || captions.length === 0) {
      return NextResponse.json(
        { error: 'No transcript available for this video. The video may not have captions enabled.' },
        { status: 404 }
      );
    }

    // Combine caption segments into full transcript text
    const fullTranscript = captions
      .map((segment) => segment.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Build prompts
    const scriptPrompt = buildYouTubeRewritePrompt(fullTranscript, video.title || 'Untitled Video');
    const transcriptSummary = fullTranscript.split(/\s+/).slice(0, 500).join(' ');
    const titlePrompt = buildYouTubeTitlePrompt(video.title || 'Untitled Video', transcriptSummary);

    const scriptSystemPrompt = `You are an expert script rewriter who creates completely original content while preserving meaning. You never plagiarize - every sentence you write is uniquely phrased. Your rewrites are natural, engaging, and suitable for YouTube video delivery.`;
    const titleSystemPrompt = `You are a YouTube title specialist. Return only valid JSON arrays.`;

    // Call Claude for both script rewrite and title improvement in parallel
    const [rewrittenScript, titleResponse] = await Promise.all([
      generateWithClaude(scriptPrompt, scriptSystemPrompt),
      generateWithClaude(titlePrompt, titleSystemPrompt),
    ]);

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
      videoInfo: {
        title: video.title || 'Untitled',
        channel: video.channel?.name || 'Unknown Channel',
        videoId,
      },
    });
  } catch (error) {
    console.error('YouTube rewrite error:', error);
    return NextResponse.json(
      { error: 'Failed to process video', message: String(error) },
      { status: 500 }
    );
  }
}

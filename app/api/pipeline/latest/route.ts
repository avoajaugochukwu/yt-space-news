import { NextRequest, NextResponse } from 'next/server';
import { fetchLatestVideos } from '@/lib/apify';
import { getProcessedByIds } from '@/lib/turso';
import { DEFAULT_CHANNEL } from '@/lib/pipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const channel = (url.searchParams.get('channel') ?? DEFAULT_CHANNEL).replace(/^@/, '');
    const videos = await fetchLatestVideos(channel, 5);
    const processedMap = await getProcessedByIds(videos.map((v) => v.videoId));
    const items = videos.map((v) => {
      const prior = processedMap.get(v.videoId);
      return {
        videoId: v.videoId,
        title: v.title,
        url: v.url,
        publishedAt: v.publishedAt,
        channelHandle: v.channelHandle,
        viewCount: v.viewCount,
        processed: !!prior,
        accuracyScore: prior?.accuracy_score ?? null,
        audioUrl: prior?.audio_url ?? null,
        processedAt: prior?.processed_at ?? null,
      };
    });
    return NextResponse.json({ channel, items });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

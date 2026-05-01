const APIFY_ACTOR = 'streamers~youtube-scraper';
const APIFY_ENDPOINT = `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items`;
const APIFY_TIMEOUT_MS = 120_000;

export interface LatestVideo {
  videoId: string;
  title: string;
  url: string;
  publishedAt: string | null;
  channelHandle: string;
  channelName: string;
  viewCount: number | null;
}

interface ApifyVideoItem {
  id?: string;
  title?: string;
  url?: string;
  date?: string;
  channelUsername?: string;
  channelName?: string;
  viewCount?: number;
  type?: string;
}

export async function fetchLatestVideo(channelHandle: string): Promise<LatestVideo> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error('APIFY_TOKEN env var is not set');

  const handle = channelHandle.replace(/^@/, '');
  const startUrl = `https://www.youtube.com/@${handle}/videos`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), APIFY_TIMEOUT_MS);

  let resp: Response;
  try {
    resp = await fetch(`${APIFY_ENDPOINT}?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startUrls: [{ url: startUrl }],
        maxResults: 5,
        maxResultsShorts: 0,
        sortVideosBy: 'NEWEST',
        downloadSubtitles: false,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Apify request failed: ${resp.status} ${resp.statusText} ${body.slice(0, 200)}`);
  }

  const items = (await resp.json()) as ApifyVideoItem[];
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error(`Apify returned no videos for @${handle}`);
  }

  const videos = items.filter((it) => it && it.id && (it.type ?? 'video') === 'video');
  if (videos.length === 0) throw new Error(`No video-type items returned for @${handle}`);

  videos.sort((a, b) => {
    const ta = a.date ? Date.parse(a.date) : 0;
    const tb = b.date ? Date.parse(b.date) : 0;
    return tb - ta;
  });

  const latest = videos[0];
  return {
    videoId: latest.id!,
    title: latest.title ?? '(untitled)',
    url: latest.url ?? `https://www.youtube.com/watch?v=${latest.id}`,
    publishedAt: latest.date ?? null,
    channelHandle: handle,
    channelName: latest.channelName ?? handle,
    viewCount: typeof latest.viewCount === 'number' ? latest.viewCount : null,
  };
}

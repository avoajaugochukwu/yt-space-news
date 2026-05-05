import { renderMediaOnLambda } from '@remotion/lambda/client';

async function main() {
  console.log('starting renderMediaOnLambda…');
  const t0 = Date.now();
  const r = await renderMediaOnLambda({
    region: 'us-west-2',
    functionName: process.env.REMOTION_LAMBDA_FUNCTION_NAME!,
    serveUrl: process.env.REMOTION_SERVE_URL!,
    composition: 'BureauNews',
    inputProps: {
      sequence: {
        audioUrl: 'https://yt-space-news-media-prod.s3.us-west-2.amazonaws.com/audio/e2e/e2e-1777953797869.mp3',
        audioDuration: 5,
        fps: 30,
        width: 1280,
        height: 720,
        clips: [
          { kind: 'bureau', start: 0, end: 5, imageId: 'p', imageUrl: '', reason: 'debug' },
        ],
      },
    },
    codec: 'h264',
    imageFormat: 'jpeg',
    privacy: 'public',
    maxRetries: 1,
    framesPerLambda: 80,
  });
  console.log(`returned after ${(Date.now() - t0) / 1000}s:`, r);
}
main().catch((e) => {
  console.error('ERR:', e);
  process.exit(1);
});

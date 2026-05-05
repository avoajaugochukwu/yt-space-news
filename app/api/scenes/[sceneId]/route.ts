import { NextRequest, NextResponse } from 'next/server';
import { deleteScene, getScene } from '@/lib/director-store';
import { deleteObject } from '@/lib/storage/s3';

export const runtime = 'nodejs';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ sceneId: string }> },
) {
  const { sceneId } = await params;
  const scene = await getScene(sceneId);
  if (!scene) {
    return NextResponse.json({ error: 'scene not found' }, { status: 404 });
  }
  if (scene.keyframe_s3_key) {
    try {
      await deleteObject(scene.keyframe_s3_key);
    } catch (err) {
      console.warn('[scenes] keyframe delete failed:', (err as Error).message);
    }
  }
  await deleteScene(sceneId);
  return NextResponse.json({ deleted: sceneId });
}

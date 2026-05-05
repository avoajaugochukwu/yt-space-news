'use client';

import { useCallback, useRef, useState } from 'react';

type Source = { url: string; key: string; name: string };
type Scene = {
  scene_id: string;
  source_id: string;
  start_time: number;
  end_time: number;
  description: string | null;
  keyframe_url: string | null;
  tags_json: string | null;
};
type Clip =
  | {
      kind: 'footage' | 'loop';
      start: number;
      end: number;
      sceneId: string;
      sourceId: string;
      reason: string;
    }
  | {
      kind: 'bureau';
      start: number;
      end: number;
      imageId: string;
      imageUrl: string;
      reason: string;
    };
type Sequence = {
  audioUrl: string;
  audioDuration: number;
  fps: number;
  width: number;
  height: number;
  clips: Clip[];
};

const fmt = (s: number) =>
  `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`;

export function DirectorAdmin() {
  const [jobId, setJobId] = useState('');
  const [sources, setSources] = useState<Source[]>([]);
  const [uploading, setUploading] = useState(false);
  const [cataloging, setCataloging] = useState(false);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [planning, setPlanning] = useState(false);
  const [planId, setPlanId] = useState<string | null>(null);
  const [sequence, setSequence] = useState<Sequence | null>(null);
  const [rendering, setRendering] = useState<{ renderId: string; bucketName: string } | null>(
    null,
  );
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderUrl, setRenderUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deletingScenes, setDeletingScenes] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ingestFiles = useCallback(
    async (rawFiles: File[]) => {
      if (!jobId) {
        setError('set a job id first');
        return;
      }
      const remaining = Math.max(0, 5 - sources.length);
      const files = rawFiles.slice(0, remaining);
      if (files.length === 0) {
        setError('source limit (5) reached');
        return;
      }
      setUploading(true);
      setError(null);
      try {
        const out: Source[] = [];
        for (const file of files) {
          const signRes = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              kind: 'source',
              filename: file.name,
              contentType: file.type || 'video/mp4',
            }),
          });
          if (!signRes.ok) throw new Error(`sign: ${await signRes.text()}`);
          const { url, key, publicUrl } = (await signRes.json()) as {
            url: string;
            key: string;
            publicUrl: string;
          };
          const put = await fetch(url, {
            method: 'PUT',
            headers: { 'content-type': file.type || 'video/mp4' },
            body: file,
          });
          if (!put.ok) throw new Error(`put: ${put.status}`);
          out.push({ url: publicUrl, key, name: file.name });
        }
        setSources((prev) => [...prev, ...out].slice(0, 5));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setUploading(false);
      }
    },
    [jobId, sources.length],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      void ingestFiles(Array.from(e.dataTransfer.files));
    },
    [ingestFiles],
  );

  const onPick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      void ingestFiles(files);
      e.target.value = '';
    },
    [ingestFiles],
  );

  const deleteSceneClick = async (sceneId: string) => {
    if (deletingScenes.has(sceneId)) return;
    setDeletingScenes((s) => new Set(s).add(sceneId));
    try {
      const r = await fetch(`/api/scenes/${sceneId}`, { method: 'DELETE' });
      if (!r.ok) throw new Error(await r.text());
      setScenes((arr) => arr.filter((x) => x.scene_id !== sceneId));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeletingScenes((s) => {
        const n = new Set(s);
        n.delete(sceneId);
        return n;
      });
    }
  };

  const runCatalog = async () => {
    if (!jobId || sources.length === 0) return;
    setCataloging(true);
    setError(null);
    try {
      const r = await fetch('/api/catalog', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jobId, sources }),
      });
      if (!r.ok) throw new Error(await r.text());
      const list = await fetch(`/api/catalog?jobId=${jobId}`).then((x) => x.json());
      setScenes(list.scenes ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCataloging(false);
    }
  };

  const runPlan = async () => {
    if (!jobId || !audioUrl) {
      setError('jobId and audioUrl required');
      return;
    }
    setPlanning(true);
    setError(null);
    setRenderUrl(null);
    setRenderProgress(0);
    try {
      const r = await fetch('/api/director', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jobId, audioUrl }),
      });
      if (!r.ok) throw new Error(await r.text());
      const j = (await r.json()) as { planId: string; sequence: Sequence };
      setPlanId(j.planId);
      setSequence(j.sequence);
      await autoRender(j.planId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPlanning(false);
    }
  };

  const autoRender = async (pid: string) => {
    const r = await fetch('/api/render', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ planId: pid }),
    });
    if (!r.ok) {
      setError(await r.text());
      return;
    }
    const j = (await r.json()) as { renderId: string; bucketName: string };
    setRendering(j);
    void poll(pid, j);
  };

  const swapClip = async (clipIndex: number, sceneId: string) => {
    if (!planId) return;
    const r = await fetch('/api/director/swap', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ planId, clipIndex, sceneId }),
    });
    if (!r.ok) {
      setError(await r.text());
      return;
    }
    const j = (await r.json()) as { sequence: Sequence };
    setSequence(j.sequence);
  };

  const poll = async (pid: string, state: { renderId: string; bucketName: string }) => {
    for (let i = 0; i < 240; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const u = new URLSearchParams({
        planId: pid,
        renderId: state.renderId,
        bucketName: state.bucketName,
      });
      const res = await fetch(`/api/render?${u.toString()}`);
      const j = (await res.json()) as {
        done: boolean;
        progress: number;
        outputUrl?: string;
        error?: string;
      };
      setRenderProgress(j.progress);
      if (j.error) {
        setError(j.error);
        return;
      }
      if (j.done && j.outputUrl) {
        setRenderUrl(j.outputUrl);
        return;
      }
    }
  };

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">1. Job</h2>
        <input
          value={jobId}
          onChange={(e) => setJobId(e.target.value)}
          placeholder="job id (any string)"
          className="border px-3 py-2 rounded font-mono text-sm w-full max-w-md"
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">2. Upload sources (up to 5)</h2>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
          }}
          className="border-2 border-dashed rounded p-10 text-center text-sm font-mono cursor-pointer hover:border-blue-500 hover:bg-blue-50/5 transition-colors"
        >
          {uploading
            ? 'uploading…'
            : `click to choose or drop video files here (${sources.length}/5)`}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          multiple
          onChange={onPick}
          className="hidden"
        />
        <ul className="text-xs font-mono space-y-1">
          {sources.map((s, i) => (
            <li key={i}>
              {i + 1}. {s.name} → {s.key}
            </li>
          ))}
        </ul>
        <button
          onClick={runCatalog}
          disabled={cataloging || sources.length === 0}
          className="px-3 py-2 bg-blue-600 text-white rounded font-mono text-sm disabled:opacity-50"
        >
          {cataloging ? 'cataloging…' : 'Run cataloger'}
        </button>
      </section>

      {scenes.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">3. Scenes ({scenes.length})</h2>
          {(() => {
            const groups = new Map<string, Scene[]>();
            for (const s of scenes) {
              const arr = groups.get(s.source_id) ?? [];
              arr.push(s);
              groups.set(s.source_id, arr);
            }
            const SOURCE_TINT = ['border-blue-500', 'border-orange-500', 'border-emerald-500', 'border-pink-500', 'border-violet-500'];
            return Array.from(groups.entries()).map(([sourceId, group], gi) => {
              const tint = SOURCE_TINT[gi % SOURCE_TINT.length];
              return (
                <div key={sourceId} className={`border-l-4 ${tint} pl-3 space-y-2`}>
                  <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider">
                    <span className={`px-2 py-0.5 rounded text-white ${tint.replace('border-', 'bg-')}`}>
                      Source {gi + 1}
                    </span>
                    <span className="opacity-70">{group.length} scene{group.length === 1 ? '' : 's'}</span>
                    <span className="opacity-50">· {sourceId.slice(0, 8)}</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs font-mono">
                    {group.map((s) => {
                      const pending = deletingScenes.has(s.scene_id);
                      return (
                        <div
                          key={s.scene_id}
                          className={`relative border rounded p-2 group transition-colors ${pending ? 'bg-red-500/20 border-red-500 opacity-60 pointer-events-none' : ''}`}
                        >
                          <button
                            onClick={() => deleteSceneClick(s.scene_id)}
                            disabled={pending}
                            title={pending ? 'Deleting…' : 'Delete scene'}
                            className={`absolute top-1 right-1 z-10 w-6 h-6 rounded text-white text-xs leading-6 text-center transition-opacity ${pending ? 'bg-red-700 opacity-100' : 'bg-red-600 opacity-0 group-hover:opacity-100 hover:bg-red-700'}`}
                          >
                            {pending ? '…' : '×'}
                          </button>
                          {s.keyframe_url ? (
                            <img src={s.keyframe_url} alt="" className="w-full h-24 object-cover" />
                          ) : null}
                          <div>
                            {fmt(s.start_time)}–{fmt(s.end_time)}
                          </div>
                          <div className="opacity-70 line-clamp-2">{s.description}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()}
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">4. Plan (DTW)</h2>
        <input
          value={audioUrl}
          onChange={(e) => setAudioUrl(e.target.value)}
          placeholder="TTS audio URL (duration + word timestamps auto-derived via Whisper)"
          className="border px-3 py-2 rounded font-mono text-sm w-full"
        />
        <button
          onClick={runPlan}
          disabled={planning}
          className="px-3 py-2 bg-blue-600 text-white rounded font-mono text-sm disabled:opacity-50"
        >
          {planning ? 'transcribing + planning…' : 'Generate sequence'}
        </button>
      </section>

      {sequence ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">5. Render</h2>
          {(() => {
            const counts = sequence.clips.reduce<Record<string, number>>((acc, c) => {
              acc[c.kind] = (acc[c.kind] ?? 0) + 1;
              return acc;
            }, {});
            return (
              <div className="text-xs font-mono opacity-80">
                {sequence.clips.length} clips · {Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(' · ')}
              </div>
            );
          })()}
          <div className="text-sm font-mono">
            {rendering && !renderUrl
              ? `rendering… ${(renderProgress * 100).toFixed(0)}%`
              : renderUrl
                ? 'done'
                : 'queued'}
          </div>
          {renderUrl ? (
            <a
              href={renderUrl}
              target="_blank"
              rel="noreferrer"
              className="block underline font-mono text-sm break-all"
            >
              {renderUrl}
            </a>
          ) : null}
        </section>
      ) : null}

      {error ? (
        <div className="p-3 bg-red-100 text-red-900 font-mono text-xs whitespace-pre-wrap">
          {error}
        </div>
      ) : null}
    </div>
  );
}

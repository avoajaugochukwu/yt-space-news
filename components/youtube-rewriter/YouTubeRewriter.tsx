'use client';

import { useState } from 'react';
import { TerminalWindow } from '@/components/ui/TerminalWindow';
import { ActionButton } from '@/components/ui/ActionButton';
import { LoadingState } from '@/components/ui/LoadingState';
import type { RewriteResult } from '@/types';

export function YouTubeRewriter() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RewriteResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedTitle, setCopiedTitle] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'rewritten' | 'original'>('rewritten');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/youtube-rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process video');
      }

      const data: RewriteResult = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!result) return;
    const textToCopy = activeTab === 'rewritten' ? result.rewrittenScript : result.originalTranscript;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyTitle = (title: string, index: number) => {
    navigator.clipboard.writeText(title);
    setCopiedTitle(index);
    setTimeout(() => setCopiedTitle(null), 2000);
  };

  const handleReset = () => {
    setUrl('');
    setResult(null);
    setError(null);
  };

  const originalWordCount = result?.originalTranscript.split(/\s+/).filter((w) => w.length > 0).length || 0;

  return (
    <TerminalWindow title="YOUTUBE SCRIPT REWRITER // PARAPHRASER">
      <div className="space-y-6">
        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="youtube-url"
              className="block text-xs font-mono text-[var(--foreground-muted)] uppercase tracking-wider mb-2"
            >
              YouTube Video URL
            </label>
            <input
              id="youtube-url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              disabled={isLoading}
              className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-md text-[var(--foreground)] font-mono text-sm placeholder:text-[var(--foreground-muted)] focus:outline-none focus:border-[var(--accent)] disabled:opacity-50"
            />
          </div>
          <div className="flex gap-3">
            <ActionButton type="submit" disabled={isLoading || !url.trim()}>
              {isLoading ? 'Processing...' : 'Fetch & Rewrite'}
            </ActionButton>
            {result && (
              <ActionButton variant="ghost" onClick={handleReset}>
                Reset
              </ActionButton>
            )}
          </div>
        </form>

        {/* Loading State */}
        {isLoading && <LoadingState message="Fetching transcript and rewriting..." />}

        {/* Error State */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-md text-red-400 text-sm font-mono">
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4">
            {/* Video Info */}
            <div className="p-4 bg-[var(--background)] rounded-md border border-[var(--border)]">
              <h4 className="text-xs font-mono text-[var(--accent)] uppercase tracking-wider mb-2">
                Original Title
              </h4>
              <p className="text-sm font-semibold text-[var(--foreground)]">{result.videoInfo.title}</p>
              <p className="text-xs text-[var(--foreground-muted)]">{result.videoInfo.channel}</p>
            </div>

            {/* Improved Titles */}
            {result.improvedTitles && result.improvedTitles.length > 0 && (
              <div className="p-4 bg-[var(--background)] rounded-md border border-[var(--border)]">
                <h4 className="text-xs font-mono text-[var(--accent)] uppercase tracking-wider mb-3">
                  Improved Title Options
                </h4>
                <div className="space-y-2">
                  {result.improvedTitles.map((title, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between gap-3 p-3 bg-[var(--background-secondary)] rounded-md border border-[var(--border)] hover:border-[var(--accent)] transition-colors cursor-pointer group"
                      onClick={() => copyTitle(title, index)}
                    >
                      <span className="text-sm text-[var(--foreground)]">{title}</span>
                      <span className="text-xs font-mono text-[var(--foreground-muted)] opacity-0 group-hover:opacity-100 transition-opacity">
                        {copiedTitle === index ? 'Copied!' : 'Click to copy'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 bg-[var(--background)] rounded-md border border-[var(--border)]">
                <div className="text-xs font-mono text-[var(--foreground-muted)] uppercase tracking-wider">
                  Rewritten
                </div>
                <div className="text-lg font-mono text-[var(--foreground)]">{result.wordCount} words</div>
              </div>
              <div className="p-3 bg-[var(--background)] rounded-md border border-[var(--border)]">
                <div className="text-xs font-mono text-[var(--foreground-muted)] uppercase tracking-wider">
                  Original
                </div>
                <div className="text-lg font-mono text-[var(--foreground)]">{originalWordCount} words</div>
              </div>
              <div className="p-3 bg-[var(--background)] rounded-md border border-[var(--border)]">
                <div className="text-xs font-mono text-[var(--foreground-muted)] uppercase tracking-wider">
                  Video ID
                </div>
                <div className="text-sm font-mono text-[var(--foreground)] truncate">{result.videoInfo.videoId}</div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-[var(--border)] pb-2">
              <button
                onClick={() => setActiveTab('rewritten')}
                className={`px-4 py-2 text-sm font-mono rounded-t-md transition-all ${
                  activeTab === 'rewritten'
                    ? 'bg-[var(--accent)] text-white'
                    : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
                }`}
              >
                Rewritten Script
              </button>
              <button
                onClick={() => setActiveTab('original')}
                className={`px-4 py-2 text-sm font-mono rounded-t-md transition-all ${
                  activeTab === 'original'
                    ? 'bg-[var(--accent)] text-white'
                    : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
                }`}
              >
                Original Transcript
              </button>
            </div>

            {/* Script Display */}
            <div className="p-4 bg-[var(--background)] rounded-md border border-[var(--border)]">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-mono text-[var(--accent)] uppercase tracking-wider">
                  {activeTab === 'rewritten' ? 'Rewritten Script' : 'Original Transcript'}
                </h4>
                <ActionButton size="sm" onClick={copyToClipboard}>
                  {copied ? 'Copied!' : 'Copy'}
                </ActionButton>
              </div>
              <div className="text-sm text-[var(--foreground)] leading-relaxed whitespace-pre-wrap max-h-[500px] overflow-y-auto">
                {activeTab === 'rewritten' ? result.rewrittenScript : result.originalTranscript}
              </div>
            </div>
          </div>
        )}
      </div>
    </TerminalWindow>
  );
}

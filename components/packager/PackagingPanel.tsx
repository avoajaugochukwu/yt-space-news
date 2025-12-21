'use client';

import { useState, useEffect } from 'react';
import { TerminalWindow } from '@/components/ui/TerminalWindow';
import { ActionButton } from '@/components/ui/ActionButton';
import { LoadingState } from '@/components/ui/LoadingState';
import { useSettings } from '@/lib/settings-context';
import type { StoryCard, PackagingResult, TitleOption } from '@/types';

interface PackagingPanelProps {
  story: StoryCard;
  onTitleSelect: (title: TitleOption) => void;
  selectedTitle: TitleOption | null;
}

export function PackagingPanel({ story, onTitleSelect, selectedTitle }: PackagingPanelProps) {
  const [packaging, setPackaging] = useState<PackagingResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const { mode } = useSettings();

  useEffect(() => {
    generatePackaging();
  }, [story.id, mode]);

  const generatePackaging = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ story, mode }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate packaging');
      }

      const data: PackagingResult = await response.json();
      setPackaging(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const copyMidjourneyPrompt = () => {
    if (packaging?.midjourneyPrompt) {
      navigator.clipboard.writeText(packaging.midjourneyPrompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <TerminalWindow title="STRATEGIC PACKAGING // TITLE & THUMBNAIL">
        <LoadingState message="Generating packaging options..." />
      </TerminalWindow>
    );
  }

  if (error) {
    return (
      <TerminalWindow title="STRATEGIC PACKAGING // TITLE & THUMBNAIL">
        <div className="p-4 bg-[var(--error)]/10 border border-[var(--error)] rounded-md text-[var(--error)] text-sm">
          {error}
        </div>
        <ActionButton onClick={generatePackaging} className="mt-4">
          Retry
        </ActionButton>
      </TerminalWindow>
    );
  }

  if (!packaging) return null;

  return (
    <TerminalWindow title="STRATEGIC PACKAGING // TITLE & THUMBNAIL">
      <div className="space-y-6">
        {/* Title Options */}
        <div>
          <h3 className="text-xs font-mono text-[var(--accent)] uppercase tracking-wider mb-3">
            Engineering Anchor Titles
          </h3>
          <div className="space-y-3">
            {packaging.titles.map((title) => (
              <div
                key={title.id}
                onClick={() => onTitleSelect(title)}
                className={`p-4 rounded-md cursor-pointer transition-all border ${
                  selectedTitle?.id === title.id
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                    : 'border-[var(--border)] hover:border-[var(--border-light)] bg-[var(--background)]'
                }`}
              >
                <p className="text-lg font-semibold text-[var(--foreground)] mb-2">
                  {title.title}
                </p>
                <div className="flex flex-wrap gap-2 text-xs font-mono">
                  <span className="px-2 py-1 bg-[var(--accent)]/20 text-[var(--accent)] rounded">
                    {title.engineeringAnchor}
                  </span>
                  <span className="px-2 py-1 bg-[var(--border)] text-[var(--foreground-muted)] rounded">
                    {title.technicalConflict}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Thumbnail Layout */}
        <div className="p-4 bg-[var(--background)] rounded-md">
          <h3 className="text-xs font-mono text-[var(--accent)] uppercase tracking-wider mb-3">
            Thumbnail Text Hierarchy
          </h3>
          <div className="space-y-3">
            <div>
              <span className="text-xs text-[var(--foreground-muted)]">Primary (2 words max):</span>
              <p className="text-2xl font-bold text-[var(--foreground)]">
                {packaging.thumbnailLayout.primaryText}
              </p>
            </div>
            <div>
              <span className="text-xs text-[var(--foreground-muted)]">Secondary (4 words max):</span>
              <p className="text-sm font-mono text-[var(--accent)]">
                {packaging.thumbnailLayout.secondaryText}
              </p>
            </div>
            <div>
              <span className="text-xs text-[var(--foreground-muted)]">Visual Focus:</span>
              <p className="text-sm text-[var(--foreground)]">
                {packaging.thumbnailLayout.visualFocus}
              </p>
            </div>
          </div>
        </div>

        {/* Midjourney Prompt */}
        <div className="p-4 bg-[var(--background)] rounded-md">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-mono text-[var(--accent)] uppercase tracking-wider">
              Midjourney Prompt
            </h3>
            <ActionButton size="sm" variant="secondary" onClick={copyMidjourneyPrompt}>
              {copiedPrompt ? 'Copied!' : 'Copy'}
            </ActionButton>
          </div>
          <p className="text-sm text-[var(--foreground-muted)] font-mono leading-relaxed">
            {packaging.midjourneyPrompt}
          </p>
        </div>
      </div>
    </TerminalWindow>
  );
}

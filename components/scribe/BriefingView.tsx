'use client';

import { TerminalWindow } from '@/components/ui/TerminalWindow';
import type { StoryCard } from '@/types';

interface BriefingViewProps {
  story: StoryCard;
}

export function BriefingView({ story }: BriefingViewProps) {
  return (
    <TerminalWindow title="INTELLIGENCE BRIEFING // STORY ANALYSIS">
      <div className="space-y-6">
        {/* Story Header */}
        <div className="border-b border-[var(--border)] pb-4">
          <h2 className="text-xl font-semibold text-[var(--foreground)] mb-2">
            {story.title}
          </h2>
          <div className="flex items-center gap-4 text-sm font-mono text-[var(--foreground-muted)]">
            <span className="flex items-center gap-2">
              <span className="status-dot online" />
              {story.hardwareData.agency}
            </span>
            <span>{story.timestamp}</span>
          </div>
        </div>

        {/* Technical Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Hardware Data */}
          <div className="p-4 bg-[var(--background)] rounded-md">
            <h3 className="text-xs font-mono text-[var(--accent)] uppercase tracking-wider mb-3">
              Hardware Data
            </h3>
            <div className="space-y-2">
              <div>
                <span className="text-xs text-[var(--foreground-muted)]">Primary Hardware:</span>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {story.hardwareData.primaryHardware}
                </p>
              </div>
              <div>
                <span className="text-xs text-[var(--foreground-muted)]">Technical Specs:</span>
                <ul className="mt-1 space-y-1">
                  {story.hardwareData.technicalSpecs.map((spec, i) => (
                    <li key={i} className="text-sm text-[var(--foreground)] font-mono">
                      • {spec}
                    </li>
                  ))}
                </ul>
              </div>
              {Object.keys(story.hardwareData.keyMetrics).length > 0 && (
                <div>
                  <span className="text-xs text-[var(--foreground-muted)]">Key Metrics:</span>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    {Object.entries(story.hardwareData.keyMetrics).map(([key, value]) => (
                      <div key={key} className="text-sm">
                        <span className="text-[var(--foreground-muted)]">{key}:</span>{' '}
                        <span className="text-[var(--accent)] font-mono">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="p-4 bg-[var(--background)] rounded-md">
            <h3 className="text-xs font-mono text-[var(--accent)] uppercase tracking-wider mb-3">
              Story Summary
            </h3>
            <p className="text-sm text-[var(--foreground)] leading-relaxed">
              {story.summary}
            </p>
          </div>
        </div>

        {/* Sources */}
        <div className="p-4 bg-[var(--background)] rounded-md">
          <h3 className="text-xs font-mono text-[var(--accent)] uppercase tracking-wider mb-3">
            Source Intelligence ({story.sourceUrls.length} sources)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {story.sourceUrls.map((source, i) => (
              <a
                key={i}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2 rounded hover:bg-[var(--background-secondary)] transition-colors group"
              >
                <span className={`text-xs px-1.5 py-0.5 rounded font-mono uppercase ${
                  source.category === 'primary'
                    ? 'bg-[var(--accent)]/20 text-[var(--accent)]'
                    : source.category === 'technical'
                    ? 'bg-[var(--success)]/20 text-[var(--success)]'
                    : 'bg-[var(--border)] text-[var(--foreground-muted)]'
                }`}>
                  {source.category}
                </span>
                <span className="text-sm text-[var(--foreground)] group-hover:text-[var(--accent)] truncate">
                  {source.title}
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </TerminalWindow>
  );
}

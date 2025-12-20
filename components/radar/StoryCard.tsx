'use client';

import { TelemetryGauge } from '@/components/ui/TelemetryGauge';
import { ActionButton } from '@/components/ui/ActionButton';
import type { StoryCard as StoryCardType } from '@/types';

interface StoryCardProps {
  story: StoryCardType;
  onSelect: (story: StoryCardType) => void;
  isSelected?: boolean;
}

export function StoryCard({ story, onSelect, isSelected = false }: StoryCardProps) {
  return (
    <div
      className={`data-card cursor-pointer transition-all duration-200 ${
        isSelected
          ? 'border-[var(--accent)] bg-[var(--accent)]/10'
          : 'hover:border-[var(--border-light)]'
      }`}
      onClick={() => onSelect(story)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-1 line-clamp-2">
            {story.title}
          </h3>
          <div className="flex items-center gap-2 text-xs font-mono text-[var(--foreground-muted)]">
            <span className="status-dot online" />
            <span>{story.hardwareData.agency}</span>
            <span className="text-[var(--border)]">|</span>
            <span>{story.timestamp}</span>
          </div>
        </div>
      </div>

      {/* Suitability Score */}
      <div className="mb-4">
        <TelemetryGauge
          value={story.suitabilityScore}
          max={15}
          label="Signal"
        />
      </div>

      {/* Hardware Data Preview */}
      <div className="mb-4 p-3 bg-[var(--background)] rounded-md">
        <div className="text-xs font-mono text-[var(--foreground-muted)] uppercase tracking-wider mb-2">
          Primary Hardware
        </div>
        <div className="text-sm font-semibold text-[var(--accent)]">
          {story.hardwareData.primaryHardware}
        </div>
        {story.hardwareData.technicalSpecs.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {story.hardwareData.technicalSpecs.slice(0, 3).map((spec, i) => (
              <span
                key={i}
                className="inline-block px-2 py-0.5 text-xs font-mono bg-[var(--background-secondary)] text-[var(--foreground-muted)] rounded"
              >
                {spec}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Summary */}
      <p className="text-sm text-[var(--foreground-muted)] mb-4 line-clamp-2">
        {story.summary}
      </p>

      {/* Sources Count */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-[var(--foreground-muted)]">
          {story.sourceUrls.length} sources
        </span>
        <ActionButton
          size="sm"
          variant={isSelected ? 'primary' : 'secondary'}
          onClick={(e) => {
            e?.stopPropagation();
            onSelect(story);
          }}
        >
          {isSelected ? 'Selected' : 'Greenlight'}
        </ActionButton>
      </div>
    </div>
  );
}

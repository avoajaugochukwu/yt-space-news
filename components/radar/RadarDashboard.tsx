'use client';

import { useState } from 'react';
import { TerminalWindow } from '@/components/ui/TerminalWindow';
import { ActionButton } from '@/components/ui/ActionButton';
import { LoadingState } from '@/components/ui/LoadingState';
import { StoryCard } from './StoryCard';
import { useSettings } from '@/lib/settings-context';
import type { StoryCard as StoryCardType, RadarScanResponse } from '@/types';

interface RadarDashboardProps {
  onStorySelect: (story: StoryCardType) => void;
  selectedStory: StoryCardType | null;
}

export function RadarDashboard({ onStorySelect, selectedStory }: RadarDashboardProps) {
  const [stories, setStories] = useState<StoryCardType[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanInfo, setScanInfo] = useState<{ timestamp: string; fallback: boolean } | null>(null);
  const { mode } = useSettings();

  const initiateRadarScan = async () => {
    setIsScanning(true);
    setError(null);

    try {
      const response = await fetch('/api/radar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });

      if (!response.ok) {
        throw new Error('Radar scan failed');
      }

      const data: RadarScanResponse = await response.json();
      setStories(data.stories);
      setScanInfo({
        timestamp: data.scanTimestamp,
        fallback: data.fallbackUsed,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <TerminalWindow title="RESEARCH RADAR // STORY DETECTION SYSTEM">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-1">
              Radar Scan
            </h2>
            <p className="text-sm text-[var(--foreground-muted)]">
              Scanning aerospace news sources for high-signal content
            </p>
          </div>
          <ActionButton
            onClick={initiateRadarScan}
            disabled={isScanning}
          >
            {isScanning ? 'Scanning...' : 'Initiate Radar Scan'}
          </ActionButton>
        </div>

        {scanInfo && (
          <div className="flex items-center gap-4 text-xs font-mono text-[var(--foreground-muted)] p-3 bg-[var(--background)] rounded-md">
            <span className="flex items-center gap-2">
              <span className={`status-dot ${scanInfo.fallback ? 'warning' : 'online'}`} />
              {scanInfo.fallback ? 'Fallback Mode' : 'Live Data'}
            </span>
            <span>Last scan: {new Date(scanInfo.timestamp).toLocaleTimeString()}</span>
          </div>
        )}
      </div>

      {isScanning && (
        <LoadingState message="Scanning news sources..." />
      )}

      {error && (
        <div className="p-4 bg-[var(--error)]/10 border border-[var(--error)] rounded-md text-[var(--error)] text-sm mb-4">
          {error}
        </div>
      )}

      {!isScanning && stories.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stories.map((story) => (
            <StoryCard
              key={story.id}
              story={story}
              onSelect={onStorySelect}
              isSelected={selectedStory?.id === story.id}
            />
          ))}
        </div>
      )}

      {!isScanning && stories.length === 0 && !error && (
        <div className="text-center py-12 text-[var(--foreground-muted)]">
          <p className="text-lg mb-2">No stories detected</p>
          <p className="text-sm">Click "Initiate Radar Scan" to search for aerospace news</p>
        </div>
      )}
    </TerminalWindow>
  );
}

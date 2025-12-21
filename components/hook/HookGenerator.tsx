'use client';

import { useState, useEffect } from 'react';
import { TerminalWindow } from '@/components/ui/TerminalWindow';
import { ActionButton } from '@/components/ui/ActionButton';
import { LoadingState } from '@/components/ui/LoadingState';
import { useSettings } from '@/lib/settings-context';
import type { StoryCard, TitleOption, HookResult, HookVariation } from '@/types';

interface HookGeneratorProps {
  story: StoryCard;
  selectedTitle: TitleOption;
  onHookSelect: (hook: HookVariation) => void;
  selectedHook: HookVariation | null;
}

const HOOK_TYPE_LABELS_HYPE = {
  shock: 'SHOCK HOOK',
  mystery: 'MYSTERY HOOK',
  stakes: 'STAKES HOOK',
};

const HOOK_TYPE_LABELS_LOWKEY = {
  hardware: 'HARDWARE LEAD',
  geopolitical: 'GEOPOLITICAL LEAD',
  heritage: 'HERITAGE LEAD',
};

const HOOK_TYPE_COLORS: Record<string, string> = {
  shock: 'bg-red-500/20 text-red-400',
  mystery: 'bg-purple-500/20 text-purple-400',
  stakes: 'bg-orange-500/20 text-orange-400',
  hardware: 'bg-blue-500/20 text-blue-400',
  geopolitical: 'bg-green-500/20 text-green-400',
  heritage: 'bg-amber-500/20 text-amber-400',
};

export function HookGenerator({
  story,
  selectedTitle,
  onHookSelect,
  selectedHook,
}: HookGeneratorProps) {
  const [hookResult, setHookResult] = useState<HookResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { mode } = useSettings();

  const HOOK_TYPE_LABELS = mode === 'hype' ? HOOK_TYPE_LABELS_HYPE : HOOK_TYPE_LABELS_LOWKEY;

  useEffect(() => {
    generateHooks();
  }, [story.id, selectedTitle.id, mode]);

  const generateHooks = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/hook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ story, selectedTitle, mode }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate hooks');
      }

      const data: HookResult = await response.json();
      setHookResult(data);

      // Auto-select the recommended winner
      if (data.winner && !selectedHook) {
        onHookSelect(data.winner);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <TerminalWindow title="HOOK GENERATOR // OPENING SEQUENCE">
        <LoadingState message="Generating hook variations..." />
      </TerminalWindow>
    );
  }

  if (error) {
    return (
      <TerminalWindow title="HOOK GENERATOR // OPENING SEQUENCE">
        <div className="p-4 bg-[var(--error)]/10 border border-[var(--error)] rounded-md text-[var(--error)] text-sm">
          {error}
        </div>
        <ActionButton onClick={generateHooks} className="mt-4">
          Retry
        </ActionButton>
      </TerminalWindow>
    );
  }

  if (!hookResult) return null;

  return (
    <TerminalWindow title="HOOK GENERATOR // OPENING SEQUENCE">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[var(--foreground)]">
              Select Opening Hook
            </h3>
            <p className="text-sm text-[var(--foreground-muted)]">
              Choose the angle for your video&apos;s first 15-20 seconds
            </p>
          </div>
          <ActionButton size="sm" variant="secondary" onClick={generateHooks}>
            Regenerate
          </ActionButton>
        </div>

        {/* Hook Variations */}
        <div className="space-y-4">
          {hookResult.hooks.map((hook) => (
            <div
              key={hook.id}
              onClick={() => onHookSelect(hook)}
              className={`p-4 rounded-md cursor-pointer transition-all border ${
                selectedHook?.id === hook.id
                  ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                  : 'border-[var(--border)] hover:border-[var(--border-light)] bg-[var(--background)]'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-mono px-2 py-1 rounded uppercase ${
                  HOOK_TYPE_COLORS[hook.type] || 'bg-gray-500/20 text-gray-400'
                }`}>
                  {HOOK_TYPE_LABELS[hook.type as keyof typeof HOOK_TYPE_LABELS] || hook.type.toUpperCase()}
                </span>
                <div className="flex items-center gap-2">
                  {hookResult.winner?.id === hook.id && (
                    <span className="text-xs font-mono px-2 py-1 bg-[var(--success)]/20 text-[var(--success)] rounded">
                      Recommended
                    </span>
                  )}
                  <span className="text-xs font-mono text-[var(--foreground-muted)]">
                    {hook.wordCount} words
                  </span>
                </div>
              </div>
              <p className="text-sm text-[var(--foreground)] leading-relaxed">
                {hook.content}
              </p>
              {hook.needsAttention && (
                <div className={`mt-2 p-2 ${mode === 'hype' ? 'bg-[var(--warning)]/10 border-[var(--warning)] text-[var(--warning)]' : 'bg-[var(--error)]/10 border-[var(--error)] text-[var(--error)]'} border rounded text-xs`}>
                  {hook.recommendation}
                </div>
              )}
              {hook.analysisScore !== undefined && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs font-mono text-[var(--foreground-muted)]">
                    {mode === 'hype' ? 'Hype Score:' : 'Quality Score:'}
                  </span>
                  <span className={`text-xs font-bold ${hook.analysisScore >= 7 ? 'text-green-400' : hook.analysisScore >= 5 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {hook.analysisScore}/10
                  </span>
                  {hook.phrasesFound && hook.phrasesFound.length > 0 && (
                    <span className="text-xs text-[var(--foreground-muted)]">
                      ({mode === 'hype' ? 'power: ' : 'banned: '}{hook.phrasesFound.join(', ')})
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Selected Hook Display */}
        {selectedHook && (
          <div className="p-4 bg-[var(--accent)]/5 border border-[var(--accent)] rounded-md">
            <h4 className="text-xs font-mono text-[var(--accent)] uppercase tracking-wider mb-2">
              {mode === 'hype' ? 'THE VIRAL HOOK' : 'SELECTED HOOK'}
            </h4>
            <p className="text-sm text-[var(--foreground)] italic">
              &ldquo;{selectedHook.content}&rdquo;
            </p>
          </div>
        )}
      </div>
    </TerminalWindow>
  );
}

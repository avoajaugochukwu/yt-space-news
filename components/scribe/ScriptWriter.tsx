'use client';

import { useState, useEffect } from 'react';
import { TerminalWindow } from '@/components/ui/TerminalWindow';
import { ActionButton } from '@/components/ui/ActionButton';
import { LoadingState } from '@/components/ui/LoadingState';
import { DataCard } from '@/components/ui/DataCard';
import type { StoryCard, HookVariation, ScriptOutline, GeneratedScript, ScriptSegment } from '@/types';

interface ScriptWriterProps {
  story: StoryCard;
  selectedHook: HookVariation;
}

type GenerationPhase = 'outline' | 'phase1' | 'phase2' | 'phase3' | 'complete';

export function ScriptWriter({ story, selectedHook }: ScriptWriterProps) {
  const [outline, setOutline] = useState<ScriptOutline | null>(null);
  const [script, setScript] = useState<GeneratedScript | null>(null);
  const [currentPhase, setCurrentPhase] = useState<GenerationPhase>('outline');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    generateOutline();
  }, [story.id, selectedHook.id]);

  const generateOutline = async () => {
    setIsLoading(true);
    setError(null);
    setCurrentPhase('outline');

    try {
      const response = await fetch('/api/outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ story, selectedHook }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate outline');
      }

      const data: ScriptOutline = await response.json();
      setOutline(data);
      setCurrentPhase('phase1');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const generateScript = async () => {
    if (!outline) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ story, outline }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate script');
      }

      const data: GeneratedScript = await response.json();
      setScript(data);
      setCurrentPhase('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const getCleanScript = (): string => {
    if (!script || !outline) return '';

    let fullScript = `${outline.hook}\n\n`;

    script.segments.forEach((segment, index) => {
      const phase = outline.phases[index];
      if (phase) {
        fullScript += `[${phase.name}]\n\n${segment.content}\n\n`;
      }
    });

    fullScript += `---\n\nSOURCES:\n`;
    story.sourceUrls.forEach((source) => {
      fullScript += `- ${source.title}: ${source.url}\n`;
    });

    return fullScript;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(getCleanScript());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderPhaseStatus = (phaseId: string, index: number) => {
    const phaseMap: Record<number, GenerationPhase> = {
      0: 'phase1',
      1: 'phase2',
      2: 'phase3',
    };

    const phase = phaseMap[index];
    if (!phase) return null;

    const segment = script?.segments.find((s) => s.phaseId === phaseId);

    if (segment) {
      return (
        <span className="flex items-center gap-2">
          <span className="status-dot online" />
          <span className="text-[var(--success)]">Complete</span>
          <span className="text-[var(--foreground-muted)]">({segment.wordCount} words)</span>
        </span>
      );
    }

    if (currentPhase === phase && isLoading) {
      return (
        <span className="flex items-center gap-2">
          <span className="status-dot warning" />
          <span className="text-[var(--warning)]">Generating...</span>
        </span>
      );
    }

    return (
      <span className="flex items-center gap-2">
        <span className="status-dot offline" />
        <span className="text-[var(--foreground-muted)]">Pending</span>
      </span>
    );
  };

  if (error) {
    return (
      <TerminalWindow title="MODULAR SCRIPT WRITER // THE SCRIBE">
        <div className="p-4 bg-[var(--error)]/10 border border-[var(--error)] rounded-md text-[var(--error)] text-sm">
          {error}
        </div>
        <ActionButton onClick={generateOutline} className="mt-4">
          Retry
        </ActionButton>
      </TerminalWindow>
    );
  }

  return (
    <TerminalWindow title="MODULAR SCRIPT WRITER // THE SCRIBE">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[var(--foreground)]">
              Script Generation
            </h3>
            <p className="text-sm text-[var(--foreground-muted)]">
              Phase-based script generation for maximum control
            </p>
          </div>
          {script && (
            <ActionButton onClick={copyToClipboard}>
              {copied ? 'Copied!' : 'Copy Script'}
            </ActionButton>
          )}
        </div>

        {/* Loading State */}
        {isLoading && !outline && (
          <LoadingState message="Generating script outline..." />
        )}

        {/* Outline Display */}
        {outline && (
          <div className="space-y-4">
            {/* Word Count Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <DataCard
                label="Target Words"
                value={outline.totalEstimatedWords}
              />
              <DataCard
                label="Actual Words"
                value={script?.totalWordCount || 0}
              />
              <DataCard
                label="Phases"
                value={outline.phases.length}
              />
              <DataCard
                label="Status"
                value={currentPhase === 'complete' ? 'Done' : 'In Progress'}
              />
            </div>

            {/* Hook */}
            <div className="p-4 bg-[var(--background)] rounded-md">
              <h4 className="text-xs font-mono text-[var(--accent)] uppercase tracking-wider mb-2">
                Hook (Opening)
              </h4>
              <p className="text-sm text-[var(--foreground)] italic">
                &ldquo;{outline.hook}&rdquo;
              </p>
            </div>

            {/* Phases */}
            <div className="space-y-4">
              {outline.phases.map((phase, index) => {
                const segment = script?.segments.find((s) => s.phaseId === phase.id);

                return (
                  <div
                    key={phase.id}
                    className="p-4 bg-[var(--background)] rounded-md"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-[var(--foreground)]">
                        Phase {index + 1}: {phase.name}
                      </h4>
                      {renderPhaseStatus(phase.id, index)}
                    </div>

                    {/* Key Points */}
                    <div className="mb-3">
                      <span className="text-xs text-[var(--foreground-muted)]">Key Points:</span>
                      <ul className="mt-1 space-y-1">
                        {phase.keyPoints.map((point, i) => (
                          <li key={i} className="text-xs text-[var(--foreground-muted)] font-mono">
                            • {point}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Generated Content */}
                    {segment && (
                      <div className="mt-4 pt-4 border-t border-[var(--border)]">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-[var(--foreground-muted)]">
                            Generated Content:
                          </span>
                          <span className="text-xs font-mono text-[var(--foreground-muted)]">
                            {segment.wordCount} words
                          </span>
                        </div>
                        <div className="text-sm text-[var(--foreground)] leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                          {segment.content}
                        </div>
                        {segment.hasBannedPhrases && (
                          <div className="mt-2 p-2 bg-[var(--warning)]/10 border border-[var(--warning)] rounded text-xs text-[var(--warning)]">
                            Contains flagged phrases: {segment.flaggedPhrases?.join(', ')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Generate Button */}
            {!script && (
              <ActionButton
                onClick={generateScript}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? 'Generating Script...' : 'Generate Full Script'}
              </ActionButton>
            )}

            {isLoading && script === null && outline && (
              <LoadingState message="Writing script phases..." />
            )}

            {/* Sources */}
            {script && (
              <div className="p-4 bg-[var(--background)] rounded-md">
                <h4 className="text-xs font-mono text-[var(--accent)] uppercase tracking-wider mb-3">
                  Sources for Script
                </h4>
                <div className="space-y-2">
                  {story.sourceUrls.map((source, i) => (
                    <a
                      key={i}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-xs text-[var(--foreground-muted)] hover:text-[var(--accent)] truncate"
                    >
                      {source.title}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </TerminalWindow>
  );
}

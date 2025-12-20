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

type ScriptTab = 'clean' | 'tts';

export function ScriptWriter({ story, selectedHook }: ScriptWriterProps) {
  const [outline, setOutline] = useState<ScriptOutline | null>(null);
  const [script, setScript] = useState<GeneratedScript | null>(null);
  const [currentPhase, setCurrentPhase] = useState<GenerationPhase>('outline');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // TTS optimization state
  const [activeTab, setActiveTab] = useState<ScriptTab>('clean');
  const [ttsScript, setTtsScript] = useState<string>('');
  const [isTtsLoading, setIsTtsLoading] = useState(false);
  const [ttsCopied, setTtsCopied] = useState(false);

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

  const copyTtsToClipboard = () => {
    navigator.clipboard.writeText(ttsScript);
    setTtsCopied(true);
    setTimeout(() => setTtsCopied(false), 2000);
  };

  const generateTtsScript = async () => {
    if (!script || !outline) return;

    setIsTtsLoading(true);
    setTtsScript('');

    try {
      const response = await fetch('/api/tts-optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: getCleanScript() }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate TTS script');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        setTtsScript(accumulated);
      }
    } catch (err) {
      console.error('TTS generation error:', err);
    } finally {
      setIsTtsLoading(false);
    }
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
          {script && activeTab === 'clean' && (
            <ActionButton onClick={copyToClipboard}>
              {copied ? 'Copied!' : 'Copy Script'}
            </ActionButton>
          )}
          {script && activeTab === 'tts' && ttsScript && (
            <ActionButton onClick={copyTtsToClipboard}>
              {ttsCopied ? 'Copied!' : 'Copy TTS Script'}
            </ActionButton>
          )}
        </div>

        {/* Tabs */}
        {script && (
          <div className="flex gap-2 border-b border-[var(--border)] pb-2">
            <button
              onClick={() => setActiveTab('clean')}
              className={`px-4 py-2 text-sm font-mono rounded-t-md transition-all ${
                activeTab === 'clean'
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
              }`}
            >
              Clean Script
            </button>
            <button
              onClick={() => setActiveTab('tts')}
              className={`px-4 py-2 text-sm font-mono rounded-t-md transition-all ${
                activeTab === 'tts'
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
              }`}
            >
              TTS Optimized
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && !outline && (
          <LoadingState message="Generating script outline..." />
        )}

        {/* TTS Optimized View */}
        {script && activeTab === 'tts' && (
          <div className="space-y-4">
            {!ttsScript && !isTtsLoading && (
              <div className="p-8 bg-[var(--background)] rounded-md text-center">
                <p className="text-sm text-[var(--foreground-muted)] mb-4">
                  Generate a TTS-optimized version of your script with emotion tags for more expressive text-to-speech.
                </p>
                <ActionButton onClick={generateTtsScript}>
                  Generate TTS Version
                </ActionButton>
              </div>
            )}

            {isTtsLoading && (
              <div className="p-4 bg-[var(--background)] rounded-md">
                <div className="flex items-center gap-2 mb-4">
                  <span className="status-dot warning" />
                  <span className="text-sm text-[var(--warning)]">Generating TTS script...</span>
                </div>
                {ttsScript && (
                  <div className="text-sm text-[var(--foreground)] leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto font-mono">
                    {ttsScript}
                  </div>
                )}
              </div>
            )}

            {ttsScript && !isTtsLoading && (
              <div className="p-4 bg-[var(--background)] rounded-md">
                <h4 className="text-xs font-mono text-[var(--accent)] uppercase tracking-wider mb-3">
                  TTS Optimized Script
                </h4>
                <div className="text-sm text-[var(--foreground)] leading-relaxed whitespace-pre-wrap max-h-[600px] overflow-y-auto font-mono">
                  {ttsScript}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Outline Display */}
        {outline && (activeTab === 'clean' || !script) && (
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
                        {segment.needsMoreHype && (
                          <div className="mt-2 p-2 bg-[var(--warning)]/10 border border-[var(--warning)] rounded text-xs text-[var(--warning)]">
                            {segment.hypeRecommendation}
                          </div>
                        )}
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs font-mono text-[var(--foreground-muted)]">Hype Score:</span>
                          <span className={`text-xs font-bold ${segment.hypeScore >= 7 ? 'text-green-400' : segment.hypeScore >= 5 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {segment.hypeScore}/10
                          </span>
                          {segment.powerPhrasesUsed && segment.powerPhrasesUsed.length > 0 && (
                            <span className="text-xs text-[var(--foreground-muted)]">
                              ({segment.powerPhrasesUsed.join(', ')})
                            </span>
                          )}
                        </div>
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

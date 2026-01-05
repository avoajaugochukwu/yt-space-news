'use client';

import Link from 'next/link';
import { useWorkflow } from '@/lib/workflow-context';
import { RadarDashboard } from '@/components/radar/RadarDashboard';
import { BriefingView } from '@/components/scribe/BriefingView';
import { PackagingPanel } from '@/components/packager/PackagingPanel';
import { HookGenerator } from '@/components/hook/HookGenerator';
import { ScriptWriter } from '@/components/scribe/ScriptWriter';
import { ActionButton } from '@/components/ui/ActionButton';
import { ModeToggle } from '@/components/ui/ModeToggle';
import type { WorkflowPhase } from '@/types';

const PHASE_LABELS: Record<WorkflowPhase, string> = {
  radar: 'Research Radar',
  briefing: 'Intelligence Briefing',
  packaging: 'Strategic Packaging',
  hook: 'Hook Generator',
  outline: 'Script Outline',
};

const PHASE_ORDER: WorkflowPhase[] = ['radar', 'briefing', 'packaging', 'hook', 'outline'];

export default function Home() {
  const {
    currentPhase,
    selectedStory,
    selectedTitle,
    selectedHook,
    selectStory,
    selectTitle,
    selectHook,
    setPhase,
    reset,
  } = useWorkflow();

  const currentPhaseIndex = PHASE_ORDER.indexOf(currentPhase);

  const renderPhaseContent = () => {
    switch (currentPhase) {
      case 'radar':
        return (
          <RadarDashboard
            onStorySelect={selectStory}
            selectedStory={selectedStory}
          />
        );

      case 'briefing':
        if (!selectedStory) return null;
        return (
          <div className="space-y-6">
            <BriefingView story={selectedStory} />
            <div className="flex justify-end">
              <ActionButton onClick={() => setPhase('packaging')}>
                Continue to Packaging
              </ActionButton>
            </div>
          </div>
        );

      case 'packaging':
        if (!selectedStory) return null;
        return (
          <PackagingPanel
            story={selectedStory}
            onTitleSelect={selectTitle}
            selectedTitle={selectedTitle}
          />
        );

      case 'hook':
        if (!selectedStory || !selectedTitle) return null;
        return (
          <HookGenerator
            story={selectedStory}
            selectedTitle={selectedTitle}
            onHookSelect={selectHook}
            selectedHook={selectedHook}
          />
        );

      case 'outline':
        if (!selectedStory || !selectedHook) return null;
        return (
          <ScriptWriter
            story={selectedStory}
            selectedHook={selectedHook}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[var(--background-secondary)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="status-dot online" />
                <h1 className="text-xl font-semibold text-[var(--foreground)]">
                  GFPD Content Engine
                </h1>
              </div>
              <span className="text-xs font-mono text-[var(--foreground-muted)] px-2 py-1 bg-[var(--background)] rounded">
                v1.0.0
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/youtube-rewriter"
                className="font-mono text-xs px-3 py-1.5 border border-[var(--border)] rounded-md text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--background-secondary)] transition-all uppercase tracking-wider"
              >
                YT Rewriter
              </Link>
              <ModeToggle />
              <ActionButton variant="ghost" size="sm" onClick={reset}>
                Reset Workflow
              </ActionButton>
            </div>
          </div>
        </div>
      </header>

      {/* Phase Navigation */}
      <nav className="border-b border-[var(--border)] bg-[var(--background)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-1 py-2 overflow-x-auto">
            {PHASE_ORDER.map((phase, index) => {
              const isActive = currentPhase === phase;
              const isPast = index < currentPhaseIndex;
              const isFuture = index > currentPhaseIndex;

              return (
                <button
                  key={phase}
                  onClick={() => {
                    if (isPast || isActive) {
                      setPhase(phase);
                    }
                  }}
                  disabled={isFuture}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-md text-sm font-mono transition-all
                    ${isActive
                      ? 'bg-[var(--accent)] text-white'
                      : isPast
                      ? 'bg-[var(--background-secondary)] text-[var(--foreground)] hover:bg-[var(--border)]'
                      : 'bg-transparent text-[var(--foreground-muted)] cursor-not-allowed opacity-50'
                    }
                  `}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                    isActive
                      ? 'bg-white/20'
                      : isPast
                      ? 'bg-[var(--success)] text-white'
                      : 'bg-[var(--border)]'
                  }`}>
                    {isPast ? '✓' : index + 1}
                  </span>
                  <span className="hidden sm:inline">{PHASE_LABELS[phase]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status Bar */}
        {selectedStory && (
          <div className="mb-6 p-4 bg-[var(--background-secondary)] border border-[var(--border)] rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-mono text-[var(--foreground-muted)] uppercase tracking-wider">
                  Active Story
                </span>
                <h2 className="text-lg font-semibold text-[var(--foreground)]">
                  {selectedStory.title}
                </h2>
              </div>
              <div className="flex items-center gap-4 text-sm">
                {selectedTitle && (
                  <div className="text-right">
                    <span className="text-xs text-[var(--foreground-muted)] block">Title</span>
                    <span className="text-[var(--accent)] font-mono text-xs truncate max-w-[200px] block">
                      {selectedTitle.title}
                    </span>
                  </div>
                )}
                {selectedHook && (
                  <div className="text-right">
                    <span className="text-xs text-[var(--foreground-muted)] block">Hook</span>
                    <span className="text-[var(--success)] font-mono text-xs uppercase">
                      {selectedHook.type}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Phase Content */}
        {renderPhaseContent()}
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] bg-[var(--background-secondary)] mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between text-xs font-mono text-[var(--foreground-muted)]">
            <span>Go For Powered Descent Content Engine</span>
            <span>Powered by Claude AI + Perplexity</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

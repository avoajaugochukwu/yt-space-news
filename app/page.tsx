import { PipelineRunner } from '@/components/PipelineRunner';

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col">
      <header className="border-b border-[var(--border)] bg-[var(--background-secondary)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-3">
          <span className="status-dot online" />
          <h1 className="text-xl font-semibold text-[var(--foreground)]">Channel Mirror</h1>
          <span className="text-xs font-mono text-[var(--foreground-muted)] px-2 py-1 bg-[var(--background)] rounded">
            v0.2
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PipelineRunner />
      </main>

      <footer className="border-t border-[var(--border)] bg-[var(--background-secondary)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3 text-xs font-mono text-[var(--foreground-muted)] flex justify-between">
          <span>Apify · Perplexity · voice-generator-service · Turso</span>
          <span>M-Expressive Narrator</span>
        </div>
      </footer>
    </div>
  );
}

import { DirectorAdmin } from '@/components/DirectorAdmin';

export const dynamic = 'force-dynamic';

export default function DirectorPage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--border)] bg-[var(--background-secondary)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-3">
          <span className="status-dot online" />
          <h1 className="text-xl font-semibold text-[var(--foreground)]">
            Director // Bureau News
          </h1>
          <span className="text-xs font-mono text-[var(--foreground-muted)] px-2 py-1 bg-[var(--background)] rounded">
            v0.1
          </span>
        </div>
      </header>
      <main className="max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DirectorAdmin />
      </main>
    </div>
  );
}

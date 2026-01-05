'use client';

import Link from 'next/link';
import { YouTubeRewriter } from '@/components/youtube-rewriter/YouTubeRewriter';
import { ModeToggle } from '@/components/ui/ModeToggle';

export default function YouTubeRewriterPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[var(--background-secondary)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="status-dot online" />
                <h1 className="text-xl font-semibold text-[var(--foreground)]">YouTube Script Rewriter</h1>
              </div>
              <span className="text-xs font-mono text-[var(--foreground-muted)] px-2 py-1 bg-[var(--background)] rounded">
                GFPD Tool
              </span>
            </div>
            <div className="flex items-center gap-3">
              <ModeToggle />
              <Link
                href="/"
                className="font-mono font-semibold rounded-md cursor-pointer transition-all duration-200 uppercase tracking-wider inline-flex items-center justify-center gap-2 bg-transparent text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--background-secondary)] px-3 py-1.5 text-xs border border-[var(--border)]"
              >
                Back to Main
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <YouTubeRewriter />
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] bg-[var(--background-secondary)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between text-xs font-mono text-[var(--foreground-muted)]">
            <span>Go For Powered Descent Content Engine</span>
            <span>Powered by Claude AI + YouTubei</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

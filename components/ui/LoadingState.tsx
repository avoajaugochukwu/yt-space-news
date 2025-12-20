'use client';

interface LoadingStateProps {
  message?: string;
  showScanLine?: boolean;
}

export function LoadingState({ message = 'Processing...', showScanLine = true }: LoadingStateProps) {
  return (
    <div className="relative flex flex-col items-center justify-center py-12">
      {showScanLine && <div className="scan-line" />}
      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-[var(--accent)] loading-pulse" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 rounded-full bg-[var(--accent)] loading-pulse" style={{ animationDelay: '200ms' }} />
          <div className="w-2 h-2 rounded-full bg-[var(--accent)] loading-pulse" style={{ animationDelay: '400ms' }} />
        </div>
        <span className="font-mono text-sm text-[var(--foreground-muted)] uppercase tracking-wider">
          {message}
        </span>
      </div>
    </div>
  );
}

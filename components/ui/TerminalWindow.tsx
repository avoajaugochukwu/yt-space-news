'use client';

interface TerminalWindowProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function TerminalWindow({ title, children, className = '' }: TerminalWindowProps) {
  return (
    <div className={`terminal-window ${className}`}>
      <div className="terminal-header">
        <div className="terminal-dot red" />
        <div className="terminal-dot yellow" />
        <div className="terminal-dot green" />
        <span className="terminal-title">{title}</span>
      </div>
      <div className="terminal-body">
        {children}
      </div>
    </div>
  );
}

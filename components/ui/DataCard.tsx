'use client';

interface DataCardProps {
  label: string;
  value: string | number;
  unit?: string;
  className?: string;
}

export function DataCard({ label, value, unit, className = '' }: DataCardProps) {
  return (
    <div className={`data-card ${className}`}>
      <div className="data-card-header">{label}</div>
      <div className="data-card-value">
        {value}
        {unit && <span className="text-sm text-[var(--foreground-muted)] ml-1">{unit}</span>}
      </div>
    </div>
  );
}

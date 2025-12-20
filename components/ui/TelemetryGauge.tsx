'use client';

interface TelemetryGaugeProps {
  value: number;
  max: number;
  label?: string;
  showValue?: boolean;
}

export function TelemetryGauge({ value, max, label, showValue = true }: TelemetryGaugeProps) {
  const percentage = Math.min((value / max) * 100, 100);

  const getLevel = () => {
    if (percentage < 40) return 'low';
    if (percentage < 70) return 'medium';
    return 'high';
  };

  return (
    <div className="telemetry-gauge">
      {label && (
        <span className="text-xs font-mono text-[var(--foreground-muted)] uppercase tracking-wider min-w-[60px]">
          {label}
        </span>
      )}
      <div className="gauge-bar flex-1">
        <div
          className={`gauge-fill ${getLevel()}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showValue && (
        <span className="text-sm font-mono text-[var(--foreground)] min-w-[40px] text-right">
          {value}/{max}
        </span>
      )}
    </div>
  );
}

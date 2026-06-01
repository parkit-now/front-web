interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
  height?: number;
}

export function ProgressBar({
  value,
  max = 100,
  color = 'var(--brand)',
  height = 6,
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div
      style={{
        height,
        background: 'var(--border-soft)',
        borderRadius: 999,
        overflow: 'hidden',
        width: '100%',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${pct}%`,
          background: color,
          borderRadius: 999,
          transition: 'width 400ms ease',
        }}
      />
    </div>
  );
}

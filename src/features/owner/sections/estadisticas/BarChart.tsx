interface BarChartProps {
  data: number[];
  labels?: string[];
  height?: number;
  color?: string;
}

export function BarChart({
  data,
  labels,
  height = 180,
  color = 'var(--brand)',
}: BarChartProps) {
  if (data.length === 0) return null;

  const max = Math.max(...data, 1);
  const labelHeight = labels ? 24 : 0;
  const barAreaHeight = height - labelHeight;
  const barWidth = 100 / data.length;
  const gap = 0.6; // percentage gap between bars

  return (
    <div
      aria-label="Gráfico de barras"
      role="img"
      style={{ height, display: 'flex', flexDirection: 'column' }}
    >
      <svg
        width="100%"
        height={barAreaHeight}
        viewBox={`0 0 100 ${barAreaHeight}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        style={{ display: 'block', flex: '0 0 auto' }}
      >
        {data.map((val, i) => {
          const barH = (val / max) * barAreaHeight;
          const x = i * barWidth + gap / 2;
          const w = barWidth - gap;
          const y = barAreaHeight - barH;

          return (
            <g key={i}>
              {/* Background track */}
              <rect
                x={x}
                y={0}
                width={w}
                height={barAreaHeight}
                fill="var(--border-soft)"
                rx={1}
              />
              {/* Value bar */}
              <rect
                x={x}
                y={y}
                width={w}
                height={barH}
                fill={color}
                rx={1}
                style={{ transition: 'height 400ms ease, y 400ms ease' }}
              />
            </g>
          );
        })}
      </svg>
      {labels && (
        <div
          aria-hidden="true"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))`,
            gap: 4,
            height: labelHeight,
            alignItems: 'end',
            paddingTop: 6,
          }}
        >
          {data.map((_, i) => (
            <span
              key={i}
              title={labels[i]}
              style={{
                minWidth: 0,
                overflow: 'hidden',
                textAlign: 'center',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: 'var(--text-3)',
                fontFamily: 'var(--font)',
                fontSize: 11,
                lineHeight: '14px',
              }}
            >
              {labels[i]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

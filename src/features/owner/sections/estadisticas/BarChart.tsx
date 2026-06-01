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
  const barAreaHeight = height - (labels ? 24 : 0);
  const barWidth = 100 / data.length;
  const gap = 0.6; // percentage gap between bars

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      aria-label="Gráfico de barras"
      role="img"
      style={{ display: 'block' }}
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
            {/* Label */}
            {labels && labels[i] && (
              <text
                x={x + w / 2}
                y={height - 4}
                textAnchor="middle"
                fontSize={5}
                fill="var(--text-3)"
                fontFamily="var(--font)"
              >
                {labels[i]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

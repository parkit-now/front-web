import { fmtMoney0 } from '../../../../shared/utils/fmt';
import type { PieSlice } from './transform';

interface DonutChartProps {
  slices: PieSlice[];
  total: number;
  size?: number;
}

/**
 * Opacidades sucesivas del color de marca, de mayor a menor.
 *
 * Se usa una escala monocroma en vez de una paleta categórica nueva para no
 * salirse de los tokens de `SHARED_STYLE_GUIDE.md`. La porción "sin detalle"
 * va en gris neutro, que la separa visualmente de los métodos reales.
 */
const SLICE_OPACITIES = [1, 0.78, 0.6, 0.46, 0.35, 0.27, 0.2];

function sliceColor(slice: PieSlice): string {
  return slice.isUnallocated ? 'var(--text-3)' : 'var(--brand)';
}

function sliceOpacity(slice: PieSlice, index: number): number {
  if (slice.isUnallocated) return 0.45;
  return SLICE_OPACITIES[index] ?? 0.15;
}

export function DonutChart({ slices, total, size = 168 }: DonutChartProps) {
  const visible = slices.filter((slice) => slice.share > 0);

  if (visible.length === 0 || total <= 0) {
    return (
      <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>
        Sin recaudación en el período.
      </p>
    );
  }

  // `pathLength={100}` normaliza la circunferencia a 100, así el largo de cada
  // arco es directamente el porcentaje y no hay que calcular 2πr.
  let cumulative = 0;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        flexWrap: 'wrap',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: size,
          height: size,
          flex: '0 0 auto',
        }}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 42 42"
          role="img"
          aria-label={`Ingresos por método de pago, total ${fmtMoney0(total)}`}
        >
          <circle
            cx="21"
            cy="21"
            r="15.915"
            fill="none"
            stroke="var(--border-soft)"
            strokeWidth="5"
          />
          {visible.map((slice, index) => {
            const length = slice.share * 100;
            const offset = -cumulative;
            cumulative += length;

            return (
              <circle
                key={slice.name}
                cx="21"
                cy="21"
                r="15.915"
                fill="none"
                stroke={sliceColor(slice)}
                strokeOpacity={sliceOpacity(slice, index)}
                strokeWidth="5"
                pathLength={100}
                strokeDasharray={`${length} ${100 - length}`}
                strokeDashoffset={offset}
                transform="rotate(-90 21 21)"
              >
                <title>{`${slice.name}: ${fmtMoney0(slice.amount)}`}</title>
              </circle>
            );
          })}
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Total</span>
          <span
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--text-1)',
              fontFamily: 'var(--mono)',
            }}
          >
            {fmtMoney0(total)}
          </span>
        </div>
      </div>

      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          flex: '1 1 200px',
          minWidth: 0,
        }}
      >
        {visible.map((slice, index) => (
          <li
            key={slice.name}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                flexShrink: 0,
                background: sliceColor(slice),
                opacity: sliceOpacity(slice, index),
              }}
            />
            <span
              style={{
                fontSize: 13,
                color: 'var(--text-2)',
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={slice.name}
            >
              {slice.name}
            </span>
            <span
              style={{
                fontSize: 13,
                color: 'var(--text-1)',
                fontFamily: 'var(--mono)',
              }}
            >
              {fmtMoney0(slice.amount)}
            </span>
            <span
              style={{
                fontSize: 12,
                color: 'var(--text-3)',
                width: 44,
                textAlign: 'right',
              }}
            >
              {(slice.share * 100).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

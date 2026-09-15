import { useState } from 'react';
import { niceTicks } from './transform';

/** Ancho del canal de las etiquetas del eje Y. */
const AXIS_WIDTH = 56;
/** Alto de la fila de etiquetas del eje X. */
const LABEL_HEIGHT = 24;
/** Aire sobre la barra más alta para que su valor impreso no se salga. */
const VALUE_ROOM = 16;
/** Con más barras que esto el valor impreso no entra y queda solo el tooltip. */
const MAX_BARS_WITH_VALUES = 14;
/** A partir de acá las barras van pegadas: el separador ya no entra. */
const MAX_BARS_WITHOUT_GAP = 60;

interface BarChartProps {
  data: number[];
  labels?: string[];
  height?: number;
  color?: string;
  /** Valor exacto, para el tooltip y la etiqueta sobre la barra. */
  formatValue?: (value: number) => string;
  /** Valor abreviado, para los ticks del eje Y. */
  formatTick?: (value: number) => string;
}

/**
 * Barras verticales con eje Y, valor sobre la barra y tooltip al hover.
 *
 * Es HTML/CSS y no SVG a propósito: el gráfico se estira al ancho disponible, y
 * dentro de un `viewBox` con `preserveAspectRatio="none"` cualquier texto se
 * deformaría junto con las barras.
 */
export function BarChart({
  data,
  labels,
  height = 180,
  color = 'var(--brand)',
  formatValue = (value) => value.toLocaleString('es-AR'),
  formatTick = (value) => value.toLocaleString('es-AR'),
}: BarChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (data.length === 0) return null;

  const { top, ticks } = niceTicks(Math.max(...data));
  const showValues = data.length <= MAX_BARS_WITH_VALUES;
  const plotHeight = height - (labels ? LABEL_HEIGHT : 0);
  // Las columnas se reparten el ancho con `flex: 1`, pero los separadores no se
  // encogen: con cientos de buckets sumarían más que la card. El mismo valor va
  // en las barras y en las etiquetas, o se desalinean.
  const gap = data.length > MAX_BARS_WITHOUT_GAP ? 0 : 2;

  return (
    <div
      role="img"
      aria-label={`Gráfico de barras, ${data.length} ${
        data.length === 1 ? 'intervalo' : 'intervalos'
      }, máximo ${formatValue(Math.max(...data))}`}
      style={{ height, display: 'flex', flexDirection: 'column' }}
    >
      <div
        aria-hidden="true"
        style={{
          height: plotHeight,
          display: 'flex',
          paddingTop: showValues ? VALUE_ROOM : 0,
        }}
      >
        {/* Eje Y */}
        <div
          style={{ width: AXIS_WIDTH, flex: '0 0 auto', position: 'relative' }}
        >
          {ticks.map((tick) => (
            <span
              key={tick}
              style={{
                position: 'absolute',
                right: 8,
                top: `${(1 - tick / top) * 100}%`,
                transform: 'translateY(-50%)',
                fontSize: 11,
                lineHeight: '14px',
                color: 'var(--text-3)',
                fontFamily: 'var(--mono)',
                whiteSpace: 'nowrap',
              }}
            >
              {formatTick(tick)}
            </span>
          ))}
        </div>

        {/* Área del gráfico */}
        <div
          style={{ flex: 1, minWidth: 0, position: 'relative' }}
          onMouseLeave={() => setHovered(null)}
        >
          {ticks.map((tick) => (
            <div
              key={tick}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: `${(1 - tick / top) * 100}%`,
                height: 1,
                background: tick === 0 ? 'var(--border)' : 'var(--border-soft)',
              }}
            />
          ))}

          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              gap,
              alignItems: 'flex-end',
            }}
          >
            {data.map((value, i) => {
              const pct = (value / top) * 100;
              const isHovered = hovered === i;

              return (
                <div
                  key={i}
                  // Toda la columna es hoverable, no solo la parte pintada: si
                  // no, un bucket en cero no tendría cómo mostrar su valor.
                  onMouseEnter={() => setHovered(i)}
                  title={
                    labels
                      ? `${labels[i]}: ${formatValue(value)}`
                      : formatValue(value)
                  }
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: '100%',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'flex-end',
                    background: isHovered ? 'var(--brand-soft)' : 'transparent',
                    transition: 'background 120ms',
                  }}
                >
                  {showValues && value > 0 && (
                    <span
                      style={{
                        position: 'absolute',
                        bottom: `calc(${pct}% + 3px)`,
                        left: 0,
                        right: 0,
                        textAlign: 'center',
                        fontSize: 10,
                        lineHeight: '12px',
                        color: 'var(--text-2)',
                        fontFamily: 'var(--mono)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatValue(value)}
                    </span>
                  )}
                  <div
                    style={{
                      width: '100%',
                      height: `${pct}%`,
                      background: isHovered ? 'var(--brand-hover)' : color,
                      borderRadius: '2px 2px 0 0',
                      transition: 'height 400ms ease, background 120ms',
                    }}
                  />
                </div>
              );
            })}
          </div>

          {hovered !== null && (
            <Tooltip
              index={hovered}
              count={data.length}
              label={labels?.[hovered]}
              value={formatValue(data[hovered])}
            />
          )}
        </div>
      </div>

      {labels && (
        <div
          aria-hidden="true"
          style={{
            display: 'flex',
            gap,
            height: LABEL_HEIGHT,
            paddingLeft: AXIS_WIDTH,
            paddingTop: 6,
            alignItems: 'start',
          }}
        >
          {labels.map((label, i) => (
            <span
              key={i}
              style={{
                flex: 1,
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
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Se ancla arriba del área del gráfico y sigue a la columna en el eje X. En los
 * extremos se pega al borde en vez de centrarse, para no salirse de la card.
 */
function Tooltip({
  index,
  count,
  label,
  value,
}: {
  index: number;
  count: number;
  label?: string;
  value: string;
}) {
  const center = ((index + 0.5) / count) * 100;
  const position =
    center < 15
      ? { left: 0 }
      : center > 85
        ? { right: 0 }
        : { left: `${center}%`, transform: 'translateX(-50%)' };

  return (
    <div className="pk-tooltip" style={{ top: 0, ...position }}>
      {label && <div style={{ opacity: 0.7, fontSize: 11 }}>{label}</div>}
      <div style={{ fontWeight: 600, fontFamily: 'var(--mono)' }}>{value}</div>
    </div>
  );
}

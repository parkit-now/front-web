import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SectionHeader } from '../../../../shared/components/SectionHeader';
import { Switch } from '../../../../shared/components/ui/Switch';
import { Skeleton } from '../../../../shared/components/ui/Skeleton';
import { EmptyState } from '../../../../shared/components/ui/EmptyState';
import {
  DateRangeFilter,
  type DateRange,
} from '../../../../shared/components/ui/DateRangeFilter';
import { fmtMoney0 } from '../../../../shared/utils/fmt';
import { translateApiError } from '../../../../lib/api/translate';
import type { Granularity } from '../../../../shared/utils/ar-datetime';
import { useSucursal } from '../../context/SucursalContext';
import { listPaymentMethods } from '../../services/entities';
import { listVehicleTypes } from '../../services/vehicle-types';
import {
  useRevenueByPaymentMethod,
  useRevenueSeries,
  useTopPlates,
} from '../../hooks/useMetrics';
import { BarChart } from './BarChart';
import { DonutChart } from './DonutChart';
import { TopPlatesTable } from './TopPlatesTable';
import {
  GRANULARITY_LABELS,
  PRESET_LABELS,
  granularityIsTooFine,
  resolveRange,
  type PresetOption,
} from './filters';
import {
  buildPieSlices,
  formatBucketLabel,
  hasInconsistentUnallocated,
} from './transform';

const PRESETS: PresetOption[] = ['hoy', '7d', '30d', 'custom'];
const GRANULARITIES: Granularity[] = ['hour', 'day', 'week', 'month'];

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '5px 14px',
        borderRadius: 999,
        border: '1px solid',
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 150ms',
        borderColor: active ? 'var(--brand)' : 'var(--border)',
        background: active ? 'var(--brand-soft)' : 'transparent',
        color: active ? 'var(--brand)' : 'var(--text-2)',
      }}
    >
      {children}
    </button>
  );
}

function KpiCard({
  title,
  value,
  sub,
  loading,
}: {
  title: string;
  value: string;
  sub?: string;
  loading?: boolean;
}) {
  return (
    <div
      className="pk-card pk-card-pad"
      style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--text-3)',
        }}
      >
        {title}
      </span>
      {loading ? (
        <Skeleton height={32} width="70%" />
      ) : (
        <span
          style={{
            fontSize: 26,
            fontWeight: 700,
            color: 'var(--text-1)',
            letterSpacing: '-0.02em',
            fontFamily: 'var(--mono)',
          }}
        >
          {value}
        </span>
      )}
      {sub && (
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{sub}</span>
      )}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        margin: '12px 0 0',
        fontSize: 12,
        color: 'var(--text-3)',
        lineHeight: 1.5,
      }}
    >
      {children}
    </p>
  );
}

export function EstadisticasPage() {
  const { sucursalId } = useSucursal();

  const [preset, setPreset] = useState<PresetOption>('7d');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [fromTime, setFromTime] = useState('00:00');
  const [toTime, setToTime] = useState('23:59');
  const [manualGranularity, setManualGranularity] =
    useState<Granularity | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  // Nombre del tipo, o '' para no filtrar. Es texto libre desde que el contrato
  // dejó de exponer `vehicleType` como enum.
  const [vehicleType, setVehicleType] = useState('');
  const [showVehicles, setShowVehicles] = useState(false);

  // Instante contra el que se resuelven los presets. Solo se refresca cuando el
  // usuario elige un rango, así la ventana no cambia en cada render.
  const [anchor, setAnchor] = useState(() => Date.now());

  const resolved = useMemo(
    () =>
      resolveRange({ preset, range: customRange, fromTime, toTime }, anchor),
    [preset, customRange, fromTime, toTime, anchor],
  );

  const granularity =
    manualGranularity ?? (resolved.ok ? resolved.granularity : 'day');
  const tooFine = granularityIsTooFine(resolved, granularity);

  // El tope de buckets lo rechaza el backend con un 400; si ya sabemos que no
  // entra, dejamos `from`/`to` vacíos y los hooks no disparan la request.
  const canQuery = resolved.ok && !tooFine;

  const filters = useMemo(
    () => ({
      from: canQuery && resolved.ok ? resolved.from : '',
      to: canQuery && resolved.ok ? resolved.to : '',
      granularity,
      paymentMethod: paymentMethod || undefined,
      vehicleType: vehicleType || undefined,
    }),
    [canQuery, resolved, granularity, paymentMethod, vehicleType],
  );

  const seriesQuery = useRevenueSeries(filters);
  const breakdownQuery = useRevenueByPaymentMethod(filters);
  const topPlatesQuery = useTopPlates(filters);

  const paymentMethodsQuery = useQuery({
    queryKey: ['payment-methods', sucursalId],
    queryFn: () => listPaymentMethods(sucursalId),
    enabled: Boolean(sucursalId),
    staleTime: 300_000,
  });

  // Misma queryKey que las secciones de Vehículos y Tipos de vehículo, así
  // TanStack comparte caché en vez de pedir el catálogo de nuevo.
  const vehicleTypesQuery = useQuery({
    queryKey: ['vehicle-types', sucursalId],
    queryFn: () => listVehicleTypes(sucursalId),
    enabled: Boolean(sucursalId),
    staleTime: 300_000,
  });

  function choosePreset(next: PresetOption) {
    setPreset(next);
    setManualGranularity(null);
    if (next !== 'custom') setAnchor(Date.now());
  }

  const series = seriesQuery.data;
  const values = useMemo(() => {
    const buckets = series?.buckets ?? [];
    return buckets.map((bucket) =>
      showVehicles ? bucket.vehiclesIn : bucket.revenue,
    );
  }, [series, showVehicles]);

  const labels = useMemo(
    () =>
      (series?.buckets ?? []).map((bucket) =>
        formatBucketLabel(bucket.key, series?.granularity ?? granularity),
      ),
    [series, granularity],
  );

  const breakdown = breakdownQuery.data;
  const slices = useMemo(
    () => (breakdown ? buildPieSlices(breakdown) : []),
    [breakdown],
  );

  return (
    <div>
      <SectionHeader
        title="Ingresos"
        subtitle="Recaudación y autos ingresados, por período"
      />

      {/* Filtros */}
      <div
        className="pk-card pk-card-pad"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {PRESETS.map((option) => (
            <Chip
              key={option}
              active={preset === option}
              onClick={() => choosePreset(option)}
            >
              {PRESET_LABELS[option]}
            </Chip>
          ))}
        </div>

        {preset === 'custom' && (
          <div
            style={{
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <DateRangeFilter
              value={customRange}
              onChange={setCustomRange}
              placeholder="Elegí el rango de fechas"
            />
            <label style={{ fontSize: 13, color: 'var(--text-2)' }}>
              Desde{' '}
              <input
                type="time"
                className="pk-input"
                value={fromTime}
                onChange={(event) => setFromTime(event.target.value)}
                style={{ width: 110, display: 'inline-block' }}
              />
            </label>
            <label style={{ fontSize: 13, color: 'var(--text-2)' }}>
              Hasta{' '}
              <input
                type="time"
                className="pk-input"
                value={toTime}
                onChange={(event) => setToTime(event.target.value)}
                style={{ width: 110, display: 'inline-block' }}
              />
            </label>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
              Hora de Argentina
            </span>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <label style={{ fontSize: 13, color: 'var(--text-2)' }}>
            Método de pago{' '}
            <select
              className="pk-input"
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
              style={{ width: 180, display: 'inline-block' }}
            >
              <option value="">Todos</option>
              {(paymentMethodsQuery.data ?? []).map((method) => (
                <option key={method.id} value={method.name}>
                  {method.name}
                </option>
              ))}
            </select>
          </label>

          <label style={{ fontSize: 13, color: 'var(--text-2)' }}>
            Tipo de vehículo{' '}
            <select
              className="pk-input"
              value={vehicleType}
              onChange={(event) => setVehicleType(event.target.value)}
              disabled={vehicleTypesQuery.isLoading}
              style={{ width: 160, display: 'inline-block' }}
            >
              <option value="">Todos</option>
              {/* Se compara por nombre contra el snapshot guardado en la
                  estadía, así que el value es el nombre, no el id. */}
              {(vehicleTypesQuery.data ?? []).map((type) => (
                <option key={type.id} value={type.name}>
                  {type.name}
                </option>
              ))}
            </select>
          </label>

          <label style={{ fontSize: 13, color: 'var(--text-2)' }}>
            Agrupar{' '}
            <select
              className="pk-input"
              value={granularity}
              onChange={(event) =>
                setManualGranularity(event.target.value as Granularity)
              }
              style={{ width: 150, display: 'inline-block' }}
            >
              {GRANULARITIES.map((option) => (
                <option key={option} value={option}>
                  {GRANULARITY_LABELS[option]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {vehicleType && (
          <Note>
            El tipo de vehículo solo se registra en los ingresos automáticos por
            lectura de patente. Las altas manuales quedan sin tipo y este filtro
            las excluye, así que el total puede quedar muy por debajo del real.
            Además, cada estadía guarda el nombre que el tipo tenía ese día: si
            se renombró desde entonces, las estadías anteriores no aparecen bajo
            el nombre nuevo.
          </Note>
        )}
      </div>

      {/* Estados de rango inválido */}
      {!resolved.ok && (
        <div className="pk-card">
          <EmptyState
            title={
              resolved.reason === 'incomplete'
                ? 'Elegí un rango de fechas'
                : 'El rango está invertido'
            }
            description={
              resolved.reason === 'incomplete'
                ? 'Seleccioná al menos una fecha para ver los ingresos del período.'
                : 'La fecha y hora de inicio tienen que ser anteriores a las de fin.'
            }
          />
        </div>
      )}

      {resolved.ok && tooFine && (
        <div className="pk-card">
          <EmptyState
            title="Demasiados intervalos"
            description="El período elegido no entra en esa agrupación. Probá agrupando por un intervalo más grande."
          />
        </div>
      )}

      {canQuery && seriesQuery.isError && (
        <div className="pk-card">
          <EmptyState
            title="No se pudieron cargar los ingresos"
            description={translateApiError(seriesQuery.error, {
              endpoint: 'metrics.revenue',
            })}
          />
        </div>
      )}

      {canQuery && !seriesQuery.isError && (
        <>
          {/* KPIs */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 16,
              marginBottom: 24,
            }}
          >
            <KpiCard
              title="Total ingresos"
              value={fmtMoney0(series?.totals.revenue ?? 0)}
              sub="recaudado en el período"
              loading={seriesQuery.isLoading}
            />
            <KpiCard
              title="Autos ingresados"
              value={(series?.totals.vehiclesIn ?? 0).toLocaleString('es-AR')}
              sub="entradas en el período"
              loading={seriesQuery.isLoading}
            />
            <KpiCard
              title="Autos salidos"
              value={(series?.totals.vehiclesOut ?? 0).toLocaleString('es-AR')}
              sub="salidas en el período"
              loading={seriesQuery.isLoading}
            />
          </div>

          {/* Gráfico */}
          <div className="pk-card pk-card-pad" style={{ marginBottom: 24 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 12,
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text-2)',
                }}
              >
                {showVehicles ? 'Autos ingresados' : 'Ingresos'} por período
              </span>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13,
                  color: 'var(--text-2)',
                }}
              >
                Ver cantidad de autos
                <Switch
                  checked={showVehicles}
                  onChange={setShowVehicles}
                  aria-label="Alternar entre ingresos y cantidad de autos"
                />
              </label>
            </div>

            {seriesQuery.isLoading ? (
              <Skeleton height={200} />
            ) : values.length === 0 ? (
              <EmptyState
                title="Sin datos en el período"
                description="No hay movimientos registrados en el rango elegido."
              />
            ) : (
              <BarChart data={values} labels={labels} height={220} />
            )}

            <Note>
              Los ingresos se imputan al momento de <strong>salida</strong> del
              vehículo y las entradas al de <strong>ingreso</strong>. Un auto
              que entra un día y sale otro suma su visita al primero y su
              recaudación al segundo, así que las dos series no coinciden.
            </Note>

            {series?.revenueSource === 'paymentTransactions' && (
              <Note>
                Al filtrar por método de pago solo se cuenta la recaudación con
                detalle de pagos registrado. El total es menor que el del
                período sin filtrar.
              </Note>
            )}
          </div>

          {/* Torta por método de pago */}
          <div className="pk-card pk-card-pad" style={{ marginBottom: 24 }}>
            <div style={{ marginBottom: 16 }}>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text-2)',
                }}
              >
                Ingresos por método de pago
              </span>
            </div>

            {breakdownQuery.isLoading ? (
              <Skeleton height={168} />
            ) : breakdownQuery.isError ? (
              <EmptyState
                title="No se pudo cargar el desglose"
                description={translateApiError(breakdownQuery.error, {
                  endpoint: 'metrics.byPaymentMethod',
                })}
              />
            ) : (
              <>
                <DonutChart slices={slices} total={breakdown?.total ?? 0} />
                {breakdown && breakdown.unallocated > 0 && (
                  <Note>
                    "Sin detalle" es la recaudación cerrada sin desglosar el
                    medio de pago. Se muestra aparte para que las porciones
                    sumen el total.
                  </Note>
                )}
                {breakdown && hasInconsistentUnallocated(breakdown) && (
                  <Note>
                    Los pagos registrados superan el total cobrado en las
                    estadías del período. Puede indicar datos inconsistentes.
                  </Note>
                )}
              </>
            )}
          </div>

          {/* Top de patentes */}
          <div className="pk-card pk-card-pad">
            <TopPlatesTable
              items={topPlatesQuery.data?.items ?? []}
              loading={topPlatesQuery.isLoading}
              error={
                topPlatesQuery.isError
                  ? translateApiError(topPlatesQuery.error, {
                      endpoint: 'metrics.topPlates',
                    })
                  : null
              }
            />
          </div>
        </>
      )}
    </div>
  );
}

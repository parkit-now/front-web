import { useMemo, useState } from 'react';
import { SectionHeader } from '../../../../shared/components/SectionHeader';
import { Skeleton } from '../../../../shared/components/ui/Skeleton';
import { EmptyState } from '../../../../shared/components/ui/EmptyState';
import { Pagination } from '../../../../shared/components/ui/Pagination';
import {
  DateRangeFilter,
  type DateRange,
} from '../../../../shared/components/ui/DateRangeFilter';
import { fmtDateTimeAr } from '../../../../shared/utils/fmt';
import {
  localDayKey,
  toArOffsetIso,
} from '../../../../shared/utils/ar-datetime';
import { translateApiError } from '../../../../lib/api/translate';
import { useAuditEvents } from '../../hooks/useAuditEvents';
import type { AuditAction, AuditSeverity } from '../../services/audit';
import {
  SEVERITY_DOT_COLOR,
  SEVERITY_LABELS,
  auditActionLabel,
  auditActionOptions,
} from './labels';

const PAGE_SIZE = 12;

const SEVERITIES: AuditSeverity[] = ['info', 'warn', 'crit'];

export function AuditoriaPage() {
  const [severity, setSeverity] = useState<'' | AuditSeverity>('');
  const [action, setAction] = useState<'' | AuditAction>('');
  const [range, setRange] = useState<DateRange | undefined>();
  const [page, setPage] = useState(1);

  const actionOptions = useMemo(() => auditActionOptions(), []);

  // `from`/`to` son opcionales e independientes, y usan el mismo formato con
  // offset explícito que las métricas.
  const from = range?.from
    ? toArOffsetIso(localDayKey(range.from), '00:00')
    : undefined;
  const to = range?.to
    ? toArOffsetIso(localDayKey(range.to), '23:59:59')
    : range?.from
      ? toArOffsetIso(localDayKey(range.from), '23:59:59')
      : undefined;

  const query = useAuditEvents({
    severity: severity || undefined,
    action: action || undefined,
    from,
    to,
    page,
    pageSize: PAGE_SIZE,
  });

  const events = query.data?.items ?? [];
  const total = query.data?.total ?? 0;

  function resetTo(fn: () => void) {
    fn();
    setPage(1);
  }

  return (
    <div>
      <SectionHeader
        title="Auditoría"
        subtitle="Traza de cambios de configuración y de ciclo de vida del estacionamiento"
      />

      {/* Filtros */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 20,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => resetTo(() => setSeverity(''))}
            style={chipStyle(severity === '')}
          >
            Todas
          </button>
          {SEVERITIES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => resetTo(() => setSeverity(option))}
              style={chipStyle(severity === option)}
            >
              {SEVERITY_LABELS[option]}
            </button>
          ))}
        </div>

        <select
          className="pk-input"
          aria-label="Filtrar por acción"
          value={action}
          onChange={(event) =>
            resetTo(() => setAction(event.target.value as '' | AuditAction))
          }
          style={{ width: 260 }}
        >
          <option value="">Todas las acciones</option>
          {actionOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <DateRangeFilter
          value={range}
          onChange={(value) => resetTo(() => setRange(value))}
          placeholder="Filtrar por fecha"
        />
      </div>

      {query.isError ? (
        <div className="pk-card">
          <EmptyState
            title="No se pudo cargar la auditoría"
            description={translateApiError(query.error, {
              endpoint: 'audit.list',
            })}
          />
        </div>
      ) : (
        <>
          <div className="pk-card" style={{ padding: '8px 0' }}>
            {query.isLoading ? (
              <div style={{ padding: '16px 20px' }}>
                <Skeleton height={120} />
              </div>
            ) : events.length === 0 ? (
              <EmptyState
                title="No hay eventos"
                description="Ningún evento coincide con los filtros elegidos."
              />
            ) : (
              <div
                style={{
                  position: 'relative',
                  opacity: query.isFetching ? 0.6 : 1,
                  transition: 'opacity 150ms',
                }}
              >
                {/* Línea vertical del timeline */}
                <div
                  style={{
                    position: 'absolute',
                    left: 28,
                    top: 0,
                    bottom: 0,
                    width: 1,
                    background: 'var(--border-soft)',
                  }}
                />
                {events.map((event, index) => (
                  <div
                    key={event.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 16,
                      padding: '12px 20px',
                      borderBottom:
                        index < events.length - 1
                          ? '1px solid var(--border-soft)'
                          : 'none',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: SEVERITY_DOT_COLOR[event.severity],
                        flexShrink: 0,
                        marginTop: 4,
                        zIndex: 1,
                        boxShadow: '0 0 0 3px var(--card)',
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          color: 'var(--text-1)',
                          lineHeight: 1.4,
                        }}
                      >
                        <strong style={{ fontWeight: 600 }}>
                          {event.actorName ?? 'Sistema'}
                        </strong>{' '}
                        <span style={{ color: 'var(--text-2)' }}>
                          {auditActionLabel(event.action)}
                        </span>
                      </div>
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 12,
                          color: 'var(--text-3)',
                          fontFamily: 'var(--mono)',
                        }}
                      >
                        {fmtDateTimeAr(event.createdAt)}
                        {event.entityType ? ` · ${event.entityType}` : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {total > PAGE_SIZE && (
            <div className="pk-card" style={{ marginTop: 16 }}>
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                total={total}
                onPageChange={setPage}
              />
            </div>
          )}

          <p
            style={{
              marginTop: 16,
              fontSize: 12,
              color: 'var(--text-3)',
              lineHeight: 1.5,
            }}
          >
            La auditoría registra cambios de configuración y de ciclo de vida.
            Los pagos, las entradas y las salidas no se auditan: para la
            recaudación usá la sección de Ingresos.
          </p>
        </>
      )}
    </div>
  );
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
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
  };
}

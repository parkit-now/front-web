import { useState } from 'react';
import { AUDITORIA } from '../../../../mock/auditoria';
import type { AuditSeveridad } from '../../../../types/api';
import { SectionHeader } from '../../../../shared/components/SectionHeader';
import { Button } from '../../../../shared/components/ui/Button';
import { Input } from '../../../../shared/components/ui/Input';
import {
  IconSearch,
  IconChevronLeft,
  IconChevronRight,
} from '../../../../shared/components/icons';

const PAGE_SIZE = 12;

type SevFilter = 'Todos' | 'Info' | 'Advertencia' | 'Crítico';

const SEV_MAP: Record<SevFilter, AuditSeveridad | null> = {
  Todos: null,
  Info: 'info',
  Advertencia: 'warn',
  Crítico: 'crit',
};

const SEV_FILTERS: SevFilter[] = ['Todos', 'Info', 'Advertencia', 'Crítico'];

const SEV_DOT_COLOR: Record<AuditSeveridad, string> = {
  info: 'var(--brand)',
  warn: 'var(--warn-text)',
  crit: 'var(--err-text)',
};

export function AuditoriaPage() {
  const [query, setQuery] = useState('');
  const [sevFilter, setSevFilter] = useState<SevFilter>('Todos');
  const [page, setPage] = useState(0);

  const sevValue = SEV_MAP[sevFilter];
  const filtered = AUDITORIA.filter((ev) => {
    const matchSev = sevValue ? ev.severidad === sevValue : true;
    const matchQ = query.trim()
      ? ev.actor_nombre.toLowerCase().includes(query.toLowerCase()) ||
        ev.accion.toLowerCase().includes(query.toLowerCase())
      : true;
    return matchSev && matchQ;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function handleFilterChange(f: SevFilter) {
    setSevFilter(f);
    setPage(0);
  }

  function handleSearch(val: string) {
    setQuery(val);
    setPage(0);
  }

  return (
    <div style={{ padding: 32 }}>
      <SectionHeader
        title="Auditoría"
        subtitle="Registro de eventos del sistema"
      />

      {/* Search + chips row */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 20,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <div style={{ flex: '1 1 240px', maxWidth: 340 }}>
          <Input
            placeholder="Buscar por actor o acción..."
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            icon={<IconSearch size={15} />}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {SEV_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => handleFilterChange(f)}
              style={{
                padding: '5px 14px',
                borderRadius: 999,
                border: '1px solid',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 150ms',
                borderColor: sevFilter === f ? 'var(--brand)' : 'var(--border)',
                background:
                  sevFilter === f ? 'var(--brand-soft)' : 'transparent',
                color: sevFilter === f ? 'var(--brand)' : 'var(--text-2)',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="pk-card" style={{ padding: '8px 0' }}>
        {pageData.length === 0 ? (
          <div
            style={{
              padding: '32px 24px',
              textAlign: 'center',
              color: 'var(--text-3)',
              fontSize: 14,
            }}
          >
            No hay eventos que coincidan con los filtros.
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            {/* Vertical line */}
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
            {pageData.map((ev, i) => (
              <div
                key={ev.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 16,
                  padding: '12px 20px',
                  borderBottom:
                    i < pageData.length - 1
                      ? '1px solid var(--border-soft)'
                      : 'none',
                  position: 'relative',
                }}
              >
                {/* Dot */}
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: SEV_DOT_COLOR[ev.severidad],
                    flexShrink: 0,
                    marginTop: 4,
                    zIndex: 1,
                    boxShadow: `0 0 0 3px var(--card)`,
                  }}
                />
                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      color: 'var(--text-1)',
                      lineHeight: 1.4,
                    }}
                  >
                    <strong style={{ fontWeight: 600 }}>
                      {ev.actor_nombre}
                    </strong>{' '}
                    <span style={{ color: 'var(--text-2)' }}>{ev.accion}</span>
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 12,
                      color: 'var(--text-3)',
                      fontFamily: 'var(--mono)',
                    }}
                  >
                    {ev.fecha_label} · {ev.ts}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 16,
          }}
        >
          <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
            Página {page + 1} de {totalPages} — {filtered.length} eventos
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              variant="secondary"
              size="sm"
              icon={<IconChevronLeft size={15} />}
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 0}
            >
              Anterior
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages - 1}
            >
              Siguiente
              <IconChevronRight size={15} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

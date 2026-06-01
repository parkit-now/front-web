import { useState } from 'react';
import { getAllTransactions } from '../../../../mock/transactions';
import type { TransactionEstado } from '../../../../types/api';
import { SectionHeader } from '../../../../shared/components/SectionHeader';
import { Badge } from '../../../../shared/components/ui/Badge';
import { Button } from '../../../../shared/components/ui/Button';
import {
  IconDownload,
  IconChevronLeft,
  IconChevronRight,
} from '../../../../shared/components/icons';
import { fmtMoney } from '../../../../shared/utils/fmt';
import { useToast } from '../../../../lib/notifications/ToastProvider';

const PAGE_SIZE = 8;

type Filter = 'Todas' | 'Exitosas' | 'Fallidas' | 'Canceladas';

const FILTER_TO_ESTADO: Record<Filter, TransactionEstado | null> = {
  Todas: null,
  Exitosas: 'ok',
  Fallidas: 'failed',
  Canceladas: 'cancelled',
};

const FILTERS: Filter[] = ['Todas', 'Exitosas', 'Fallidas', 'Canceladas'];

function estadoBadgeVariant(
  estado: TransactionEstado,
): 'ok' | 'err' | 'warn' | 'default' {
  if (estado === 'ok') return 'ok';
  if (estado === 'failed') return 'err';
  return 'warn';
}

function estadoLabel(estado: TransactionEstado): string {
  if (estado === 'ok') return 'Exitosa';
  if (estado === 'failed') return 'Fallida';
  return 'Cancelada';
}

export function TransaccionesPage() {
  const { showToast } = useToast();
  const [filter, setFilter] = useState<Filter>('Todas');
  const [page, setPage] = useState(0);

  const all = getAllTransactions();
  const estadoFilter = FILTER_TO_ESTADO[filter];
  const filtered = estadoFilter
    ? all.filter((t) => t.estado === estadoFilter)
    : all;
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function handleFilterChange(f: Filter) {
    setFilter(f);
    setPage(0);
  }

  function handleExport() {
    showToast({
      message: 'CSV de transacciones exportado correctamente.',
      kind: 'success',
    });
  }

  return (
    <div style={{ padding: 32 }}>
      <SectionHeader
        title="Transacciones"
        subtitle={`${filtered.length} transacciones`}
        action={
          <Button
            variant="secondary"
            size="sm"
            icon={<IconDownload size={15} />}
            onClick={handleExport}
          >
            Exportar CSV
          </Button>
        }
      />

      {/* Filter chips */}
      <div
        style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}
      >
        {FILTERS.map((f) => (
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
              borderColor: filter === f ? 'var(--brand)' : 'var(--border)',
              background: filter === f ? 'var(--brand-soft)' : 'transparent',
              color: filter === f ? 'var(--brand)' : 'var(--text-2)',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="pk-card" style={{ overflow: 'hidden', marginBottom: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-soft)' }}>
              {[
                'ID',
                'Patente',
                'Cliente',
                'Medio de pago',
                'Monto',
                'Estado',
                'Fecha',
              ].map((col) => (
                <th
                  key={col}
                  style={{
                    padding: '10px 16px',
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-3)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.map((tx, i) => (
              <tr
                key={tx.id}
                style={{
                  borderBottom:
                    i < pageData.length - 1
                      ? '1px solid var(--border-soft)'
                      : 'none',
                  background:
                    tx.estado === 'failed' ? 'var(--err-bg)' : undefined,
                }}
              >
                <td
                  style={{
                    padding: '11px 16px',
                    fontSize: 12,
                    color: 'var(--text-3)',
                    fontFamily: 'var(--mono)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tx.id}
                </td>
                <td
                  style={{
                    padding: '11px 16px',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--text-1)',
                    fontFamily: 'var(--mono)',
                  }}
                >
                  {tx.patente}
                </td>
                <td
                  style={{
                    padding: '11px 16px',
                    fontSize: 13,
                    color: 'var(--text-2)',
                  }}
                >
                  {tx.cliente}
                </td>
                <td
                  style={{
                    padding: '11px 16px',
                    fontSize: 13,
                    color: 'var(--text-2)',
                  }}
                >
                  {tx.medio_pago}
                </td>
                <td
                  style={{
                    padding: '11px 16px',
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--text-1)',
                    fontFamily: 'var(--mono)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {fmtMoney(tx.monto)}
                </td>
                <td style={{ padding: '11px 16px' }}>
                  <Badge variant={estadoBadgeVariant(tx.estado)}>
                    {estadoLabel(tx.estado)}
                  </Badge>
                </td>
                <td
                  style={{
                    padding: '11px 16px',
                    fontSize: 12,
                    color: 'var(--text-3)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tx.fecha_label}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
            Página {page + 1} de {totalPages} — {filtered.length} resultados
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

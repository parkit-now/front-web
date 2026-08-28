import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { getAllTransactions } from '../../../../mock/transactions';
import type { Transaction, TransactionEstado } from '../../../../types/api';
import { SectionHeader } from '../../../../shared/components/SectionHeader';
import { Badge } from '../../../../shared/components/ui/Badge';
import { Button } from '../../../../shared/components/ui/Button';
import { IconDownload } from '../../../../shared/components/icons';
import { fmtMoney } from '../../../../shared/utils/fmt';
import { DataTable } from '../../../../features/data-table';
import { useCurrentUserId } from '../../../../lib/supabase/useCurrentUserId';
import { useSucursal } from '../../context/SucursalContext';
import { useToast } from '../../../../lib/notifications/ToastProvider';

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

const mono: React.CSSProperties = {
  fontFamily: 'var(--mono)',
};

export function TransaccionesPage() {
  const { showToast } = useToast();
  const userId = useCurrentUserId();
  const { sucursalId } = useSucursal();

  const all = useMemo(() => getAllTransactions(), []);

  function handleExport() {
    showToast({
      message: 'CSV de transacciones exportado correctamente.',
      kind: 'success',
    });
  }

  const columns = useMemo<ColumnDef<Transaction, unknown>[]>(
    () => [
      {
        id: 'id',
        header: 'ID',
        accessorKey: 'id',
        cell: ({ row }) => (
          <span style={{ ...mono, fontSize: 12, color: 'var(--text-3)' }}>
            {row.original.id}
          </span>
        ),
      },
      {
        id: 'patente',
        header: 'Patente',
        accessorKey: 'patente',
        cell: ({ row }) => (
          <span
            style={{
              ...mono,
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-1)',
            }}
          >
            {row.original.patente}
          </span>
        ),
      },
      {
        id: 'cliente',
        header: 'Cliente',
        accessorKey: 'cliente',
        cell: ({ row }) => (
          <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
            {row.original.cliente}
          </span>
        ),
      },
      {
        id: 'medio_pago',
        header: 'Medio de pago',
        accessorKey: 'medio_pago',
        cell: ({ row }) => (
          <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
            {row.original.medio_pago}
          </span>
        ),
      },
      {
        id: 'monto',
        header: 'Monto',
        accessorKey: 'monto',
        sortingFn: 'basic',
        cell: ({ row }) => (
          <span
            style={{
              ...mono,
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text-1)',
            }}
          >
            {fmtMoney(row.original.monto)}
          </span>
        ),
      },
      {
        id: 'estado',
        header: 'Estado',
        accessorKey: 'estado',
        cell: ({ row }) => (
          <Badge variant={estadoBadgeVariant(row.original.estado)}>
            {estadoLabel(row.original.estado)}
          </Badge>
        ),
      },
      {
        id: 'procesado_at',
        header: 'Fecha',
        accessorKey: 'procesado_at',
        filterFn: 'dateRange',
        cell: ({ row }) => (
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
            {row.original.fecha_label}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div style={{ padding: 32 }}>
      <SectionHeader
        title="Transacciones"
        subtitle={`${all.length} transacciones`}
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

      <DataTable<Transaction>
        data={all}
        columns={columns}
        emptyMessage="No hay transacciones para mostrar."
        searchPlaceholder="Buscar por ID, patente o cliente"
        searchableKeys={['id', 'patente', 'cliente', 'medio_pago']}
        filterableColumns={['estado', 'medio_pago', 'procesado_at']}
        filterOptionsByColumn={{
          estado: [
            { value: 'ok', label: 'Exitosa' },
            { value: 'failed', label: 'Fallida' },
            { value: 'cancelled', label: 'Cancelada' },
          ],
        }}
        getRowId={(tx) => tx.id}
        initialPageSize={8}
        templateScope={
          userId && sucursalId
            ? { userId, tenantId: sucursalId, tableKey: 'owner-transactions' }
            : undefined
        }
      />
    </div>
  );
}

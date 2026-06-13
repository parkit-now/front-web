import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '../../../../shared/components/ui/Badge';
import { Button } from '../../../../shared/components/ui/Button';
import { ConfirmDialog } from '../../../../shared/components/ui/ConfirmDialog';
import {
  IconPlus,
  IconEye,
  IconPencil,
  IconTrash,
} from '../../../../shared/components/icons';
import { DataTable } from '../../../../features/data-table';
import { useCurrentUserId } from '../../../../lib/supabase/useCurrentUserId';
import { useParkingActions, useParkingsList } from '../../hooks/useParkings';
import type { Parking } from '../../services/parkings';
import { ParkingFormModal } from './ParkingFormModal';

// Client-side table: fetch a large page and let DataTable own search, sorting,
// filtering, pagination and the saved view templates.
const FETCH_PAGE_SIZE = 100;

export function InventoryPage() {
  const navigate = useNavigate();
  const userId = useCurrentUserId();

  const listQuery = useParkingsList({ pageSize: FETCH_PAGE_SIZE });
  const { deleteMutation } = useParkingActions();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Parking | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Parking | null>(null);

  const items = useMemo(() => listQuery.data?.items ?? [], [listQuery.data]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(parking: Parking) {
    setEditing(parking);
    setFormOpen(true);
  }

  /** Enter the parking's panel as admin (same panel the owner sees). */
  function openParking(parking: Parking) {
    void navigate(`/ops/estacionamientos/${parking.id}/dashboard`);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  }

  const columns = useMemo<ColumnDef<Parking, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Estacionamiento',
        accessorKey: 'name',
        cell: ({ row }) => {
          const parking = row.original;
          return (
            <button
              type="button"
              onClick={() => openParking(parking)}
              title={`Abrir panel de ${parking.name}`}
              style={{
                border: 'none',
                background: 'none',
                padding: 0,
                font: 'inherit',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-1)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--brand)';
                e.currentTarget.style.textDecoration = 'underline';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-1)';
                e.currentTarget.style.textDecoration = 'none';
              }}
            >
              {parking.name}
            </button>
          );
        },
      },
      {
        id: 'address',
        header: 'Domicilio',
        accessorFn: (parking) => parking.address ?? '',
        cell: ({ row }) => (
          <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
            {row.original.address ?? '—'}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Estado',
        accessorKey: 'status',
        cell: ({ row }) => (
          <Badge variant={row.original.status === 'active' ? 'ok' : 'warn'} dot>
            {row.original.status === 'active' ? 'Activo' : 'Mantenimiento'}
          </Badge>
        ),
      },
      {
        id: 'acciones',
        header: () => <div style={{ textAlign: 'center' }}>Acciones</div>,
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const parking = row.original;
          return (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
              }}
            >
              <button
                type="button"
                className="pk-btn pk-btn-ghost pk-btn-icon"
                title="Ver panel"
                aria-label={`Ver panel de ${parking.name}`}
                onClick={() => openParking(parking)}
              >
                <IconEye size={17} />
              </button>
              <button
                type="button"
                className="pk-btn pk-btn-ghost pk-btn-icon"
                title="Editar"
                aria-label={`Editar ${parking.name}`}
                onClick={() => openEdit(parking)}
              >
                <IconPencil size={16} />
              </button>
              <button
                type="button"
                className="pk-btn pk-btn-ghost pk-btn-icon"
                title="Eliminar"
                aria-label={`Eliminar ${parking.name}`}
                style={{ color: 'var(--err-text)' }}
                onClick={() => setDeleteTarget(parking)}
              >
                <IconTrash size={16} />
              </button>
            </div>
          );
        },
      },
    ],
    [],
  );

  return (
    <>
      <DataTable<Parking>
        data={items}
        columns={columns}
        title="Estacionamientos"
        isLoading={listQuery.isLoading}
        emptyMessage="Todavía no hay estacionamientos. Creá el primero."
        searchPlaceholder="Buscar por nombre o domicilio"
        searchableKeys={['name', 'address']}
        filterableColumns={['status']}
        filterOptionsByColumn={{
          status: [
            { value: 'active', label: 'Activo' },
            { value: 'maintenance', label: 'Mantenimiento' },
          ],
        }}
        getRowId={(parking) => parking.id}
        initialPageSize={20}
        templateScope={
          userId
            ? { userId, tenantId: 'admin', tableKey: 'admin-parkings' }
            : undefined
        }
        onRefresh={() => void listQuery.refetch()}
        refreshDisabled={listQuery.isFetching}
        headerAction={
          <Button
            variant="primary"
            size="sm"
            icon={<IconPlus size={15} />}
            onClick={openCreate}
          >
            Nuevo estacionamiento
          </Button>
        }
      />

      <ParkingFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        parking={editing}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Eliminar estacionamiento"
        destructive
        confirmLabel="Eliminar"
        loading={deleteMutation.isPending}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
        message={
          <>
            ¿Seguro que querés eliminar <strong>{deleteTarget?.name}</strong>?
            Se borrarán también sus zonas, tarifas, movimientos y vínculos de
            usuarios. Esta acción no se puede deshacer.
          </>
        }
      />
    </>
  );
}

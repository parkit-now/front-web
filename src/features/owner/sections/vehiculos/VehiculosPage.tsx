import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '../../../../shared/components/ui/Badge';
import { Button } from '../../../../shared/components/ui/Button';
import { ConfirmDialog } from '../../../../shared/components/ui/ConfirmDialog';
import {
  IconPencil,
  IconPlus,
  IconTrash,
} from '../../../../shared/components/icons';
import { DataTable } from '../../../../features/data-table';
import { useToast } from '../../../../lib/notifications/ToastProvider';
import { ApiError } from '../../../../lib/api/client';
import {
  translateApiError,
  type EndpointKey,
} from '../../../../lib/api/translate';
import { useCurrentUserId } from '../../../../lib/supabase/useCurrentUserId';
import { generateUuidV7 } from '../../../../shared/utils/uuid';
import { useSucursal } from '../../context/SucursalContext';
import {
  createVehicle,
  deleteVehicle,
  listVehicles,
  updateVehicle,
  type UpdateVehicleInput,
  type Vehicle,
} from '../../services/vehicles';
import { listVehicleTypes } from '../../services/vehicle-types';
import { VehicleFormModal } from './VehicleFormModal';
import { diffVehicleUpdate, type VehicleFormPayload } from './validation';

/**
 * El optimistic locking del backend devuelve 409 cuando la `version` que
 * mandamos quedó vieja. No reintentamos solo: reintentar pisaría el cambio de
 * la otra persona, que es justo lo que el control de versión evita.
 */
const CONFLICT_MESSAGE =
  'El vehículo fue modificado por otra persona. Actualizamos la lista, revisá los datos y volvé a intentar.';

export function VehiculosPage() {
  const { showToast } = useToast();
  const { sucursalId, sucursal } = useSucursal();
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();

  // El ABM es de los dueños del estacionamiento. SucursalContext ya fuerza
  // `role: 'owner'` para el admin global, así que el bypass entra por acá.
  const canManage = sucursal?.role === 'owner';

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Vehicle | null>(null);

  // El editor y el diálogo guardan una foto del vehículo (id y version) del
  // estacionamiento activo. Si se cambia de estacionamiento con alguno abierto,
  // esa foto queda apuntando a otra playa: la validación compara contra
  // catálogos ajenos y el guardado saldría contra el tenant equivocado. Se
  // descartan.
  useEffect(() => {
    setFormOpen(false);
    setEditing(null);
    setConfirmDelete(null);
  }, [sucursalId]);

  const queryKey = ['vehicles', sucursalId];
  const listQuery = useQuery({
    queryKey,
    queryFn: () => listVehicles(sucursalId),
    enabled: Boolean(sucursalId),
  });
  const vehicles = useMemo(() => listQuery.data ?? [], [listQuery.data]);

  // Los tipos se izan a la página porque la columna Tipo ya los necesita para
  // resolver `typeId -> nombre`; el modal los recibe por props. Misma queryKey
  // que la sección de tipos, así TanStack comparte caché.
  const typesQuery = useQuery({
    queryKey: ['vehicle-types', sucursalId],
    queryFn: () => listVehicleTypes(sucursalId),
    enabled: Boolean(sucursalId),
  });
  const types = useMemo(() => typesQuery.data ?? [], [typesQuery.data]);
  const typeNameById = useMemo(
    () => new Map(types.map((t) => [t.id, t.name])),
    [types],
  );

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey });
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
  }

  function onError(error: unknown, endpoint: EndpointKey) {
    if (error instanceof ApiError && error.status === 409) {
      // `editing` y `confirmDelete` son fotos congeladas de la fila: si
      // dejáramos el modal abierto, el próximo intento repetiría la `version`
      // vieja y volvería a chocar.
      closeForm();
      setConfirmDelete(null);
      invalidate();
      showToast({ message: CONFLICT_MESSAGE, kind: 'error' });
      return;
    }
    showToast({
      message: translateApiError(error, { endpoint }),
      kind: 'error',
    });
  }

  const saveMutation = useMutation({
    mutationFn: (
      vars:
        | { kind: 'create'; payload: VehicleFormPayload }
        | { kind: 'update'; vehicle: Vehicle; body: UpdateVehicleInput },
    ) =>
      vars.kind === 'create'
        ? createVehicle(sucursalId, {
            id: generateUuidV7(),
            ...vars.payload,
          })
        : updateVehicle(
            sucursalId,
            vars.vehicle.id,
            vars.vehicle.version,
            vars.body,
          ),
    onSuccess: (_result, vars) => {
      closeForm();
      invalidate();
      showToast({
        message:
          vars.kind === 'create'
            ? 'Vehículo agregado al catálogo.'
            : 'Vehículo actualizado.',
        kind: 'success',
      });
    },
    onError: (error, vars) =>
      onError(
        error,
        vars.kind === 'create' ? 'vehicles.create' : 'vehicles.update',
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: (vehicle: Vehicle) =>
      deleteVehicle(sucursalId, vehicle.id, vehicle.version),
    onSuccess: () => {
      setConfirmDelete(null);
      invalidate();
      showToast({ message: 'Vehículo eliminado.', kind: 'success' });
    },
    onError: (error) => onError(error, 'vehicles.delete'),
  });

  const isBusy = saveMutation.isPending || deleteMutation.isPending;

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(vehicle: Vehicle) {
    setEditing(vehicle);
    setFormOpen(true);
  }

  function handleFormSubmit(payload: VehicleFormPayload) {
    if (!editing) {
      saveMutation.mutate({ kind: 'create', payload });
      return;
    }
    // `typesLoaded` evita un borrado silencioso del tipo: si la lista no cargó,
    // el select queda vacío y un diff ingenuo mandaría `typeId` en blanco.
    const body = diffVehicleUpdate(payload, editing, types.length > 0);
    if (Object.keys(body).length === 0) {
      showToast({ message: 'No hay cambios para guardar.', kind: 'info' });
      return;
    }
    saveMutation.mutate({ kind: 'update', vehicle: editing, body });
  }

  const columns = useMemo<ColumnDef<Vehicle, unknown>[]>(() => {
    const base: ColumnDef<Vehicle, unknown>[] = [
      {
        id: 'brand',
        header: 'Marca',
        accessorKey: 'brand',
        size: 180,
        cell: ({ row }) => (
          <span
            style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}
          >
            {row.original.brand}
          </span>
        ),
      },
      {
        id: 'model',
        header: 'Modelo',
        accessorKey: 'model',
        size: 180,
        cell: ({ row }) => row.original.model,
      },
      {
        id: 'type',
        header: 'Tipo',
        // Se ordena y filtra por el NOMBRE, no por el uuid: es lo que el
        // usuario ve en la celda.
        accessorFn: (vehicle) => typeNameById.get(vehicle.typeId) ?? '',
        size: 150,
        cell: ({ row }) => {
          const name = typeNameById.get(row.original.typeId);
          // Un typeId que no resuelve significa que los tipos todavía no
          // llegaron (o esa etapa del fetch falló). Mejor un guion que un uuid.
          if (!name) return <span style={{ color: 'var(--text-3)' }}>—</span>;
          return name;
        },
      },
    ];

    if (!canManage) return base;

    return [
      ...base,
      {
        id: 'actions',
        header: () => <div style={{ textAlign: 'center' }}>Acciones</div>,
        size: 140,
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const vehicle = row.original;
          const name = `${vehicle.brand} ${vehicle.model}`;
          return (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <button
                type="button"
                className="pk-btn pk-btn-ghost pk-btn-icon"
                title="Editar vehículo"
                aria-label={`Editar ${name}`}
                disabled={isBusy}
                onClick={() => openEdit(vehicle)}
              >
                <IconPencil size={16} />
              </button>
              <button
                type="button"
                className="pk-btn pk-btn-ghost pk-btn-icon"
                title="Eliminar vehículo"
                aria-label={`Eliminar ${name}`}
                style={{ color: 'var(--err-text)' }}
                disabled={isBusy}
                onClick={() => setConfirmDelete(vehicle)}
              >
                <IconTrash size={16} />
              </button>
            </div>
          );
        },
      },
    ];
  }, [canManage, isBusy, typeNameById]);

  return (
    <>
      <DataTable<Vehicle>
        data={vehicles}
        columns={columns}
        title="Catálogo de vehículos"
        subtitle="Los vehículos que este estacionamiento puede registrar."
        isLoading={listQuery.isLoading}
        emptyMessage={
          // Sin esta rama, una carga fallida se ve igual que "no hay vehículos"
          // y el dueño puede creer que se le borró el catálogo.
          listQuery.isError
            ? 'No pudimos cargar los vehículos. Probá recargar la tabla.'
            : canManage
              ? 'No hay vehículos en el catálogo. Agregá el primero.'
              : 'No hay vehículos en el catálogo todavía.'
        }
        searchPlaceholder="Buscar por marca o modelo..."
        searchableKeys={['brand', 'model']}
        filterableColumns={['type']}
        getRowId={(vehicle) => vehicle.id}
        initialPageSize={10}
        onRefresh={() => void listQuery.refetch()}
        refreshDisabled={listQuery.isFetching || isBusy}
        templateScope={
          userId && sucursalId
            ? { userId, tenantId: sucursalId, tableKey: 'vehicles' }
            : undefined
        }
        headerAction={
          canManage ? (
            <Button
              variant="primary"
              size="sm"
              icon={<IconPlus size={15} />}
              disabled={isBusy}
              onClick={openCreate}
            >
              Nuevo vehículo
            </Button>
          ) : (
            <Badge>Solo lectura</Badge>
          )
        }
      />

      <VehicleFormModal
        types={types}
        typesLoading={typesQuery.isLoading}
        typesError={typesQuery.isError}
        open={formOpen}
        vehicle={editing}
        vehicles={vehicles}
        pending={saveMutation.isPending}
        onClose={() => {
          if (!saveMutation.isPending) closeForm();
        }}
        onSubmit={handleFormSubmit}
      />

      <ConfirmDialog
        open={confirmDelete !== null}
        title={
          confirmDelete
            ? `Eliminar "${confirmDelete.brand} ${confirmDelete.model}"`
            : ''
        }
        message="El vehículo saldrá del catálogo de este estacionamiento y dejará de estar disponible para cargar ingresos."
        confirmLabel="Eliminar"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (confirmDelete) deleteMutation.mutate(confirmDelete);
        }}
        onClose={() => {
          if (!isBusy) setConfirmDelete(null);
        }}
      />
    </>
  );
}

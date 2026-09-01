import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '../../../../shared/components/ui/Badge';
import { Button } from '../../../../shared/components/ui/Button';
import { ConfirmDialog } from '../../../../shared/components/ui/ConfirmDialog';
import { Switch } from '../../../../shared/components/ui/Switch';
import {
  IconPencil,
  IconPlus,
  IconTrash,
} from '../../../../shared/components/icons';
import { DataTable } from '../../../../features/data-table';
import { useToast } from '../../../../lib/notifications/ToastProvider';
import { ApiError } from '../../../../lib/api/client';
import { translateApiError } from '../../../../lib/api/translate';
import { useCurrentUserId } from '../../../../lib/supabase/useCurrentUserId';
import { generateUuidV7 } from '../../../../shared/utils/uuid';
import { useSucursal } from '../../context/SucursalContext';
import {
  createVehicleType,
  deleteVehicleType,
  listVehicleTypes,
  updateVehicleType,
  type VehicleType,
} from '../../services/vehicle-types';
import { DeleteVehicleTypeModal } from './DeleteVehicleTypeModal';
import { VehicleTypeFormModal } from './VehicleTypeFormModal';
import type { ReassignTarget } from './reassign';
import { diffVehicleTypeUpdate, type VehicleTypeFormState } from './validation';

const CONFLICT_MESSAGE =
  'El tipo fue modificado por otra persona. Actualizamos la lista, revisá los datos y volvé a intentar.';

/**
 * Qué diálogo de borrado abrir. Son dos flujos distintos: sin vehículos alcanza
 * un ConfirmDialog; con vehículos hay que pedir a dónde moverlos.
 */
type ConfirmAction =
  | { kind: 'delete'; type: VehicleType }
  | { kind: 'delete-reassign'; type: VehicleType; usageCount: number };

function problemCode(error: unknown): string | undefined {
  if (!(error instanceof ApiError)) return undefined;
  return (error.problem as { code?: string } | null)?.code;
}

export function TiposVehiculoPage() {
  const { showToast } = useToast();
  const { sucursalId, sucursal } = useSucursal();
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();

  const canManage = sucursal?.role === 'owner';

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<VehicleType | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(
    null,
  );
  const [nameError, setNameError] = useState<string | undefined>(undefined);

  // Los diálogos guardan una foto del tipo (id y version) del estacionamiento
  // activo. Si se cambia de playa con alguno abierto, esa foto apunta a otra:
  // se descartan.
  useEffect(() => {
    setFormOpen(false);
    setEditing(null);
    setConfirmAction(null);
    setNameError(undefined);
  }, [sucursalId]);

  const queryKey = ['vehicle-types', sucursalId];
  const listQuery = useQuery({
    queryKey,
    queryFn: () => listVehicleTypes(sucursalId),
    enabled: Boolean(sucursalId),
  });
  const types = useMemo(() => listQuery.data ?? [], [listQuery.data]);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey });
    // La reasignación cambió filas del catálogo: sin esto la columna Tipo de
    // /vehiculos mostraría nombres viejos.
    void queryClient.invalidateQueries({ queryKey: ['vehicles', sucursalId] });
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setNameError(undefined);
  }

  /**
   * Acá hay TRES 409 distintos, y el 409 de optimistic locking no tiene código
   * propio (sale con `CONFLICT` genérico). Ramificar por `status === 409` a
   * secas —como hacen Tasas y Vehículos, que solo tienen uno— metería el
   * duplicado y el "tipo en uso" dentro del toast equivocado.
   */
  function onError(error: unknown, ctx?: { type: VehicleType }) {
    const code = problemCode(error);

    // No es un error, es una ESCALACIÓN: alguien asignó un vehículo mientras el
    // diálogo estaba abierto. Se pasa al modal de reasignación en vez de tostar.
    if (code === 'VEHICLE_TYPE_IN_USE' && ctx) {
      const count = types.find((t) => t.id === ctx.type.id)?.vehicleCount ?? 1;
      setConfirmAction({
        kind: 'delete-reassign',
        type: ctx.type,
        usageCount: count,
      });
      return;
    }

    // El ÚNICO 409 que no debe cerrar el modal: el error va abajo del input
    // para que el usuario corrija el nombre sin perder lo que escribió.
    if (code === 'VEHICLE_TYPE_DUPLICATE') {
      setNameError('Ya tenés un tipo con ese nombre.');
      return;
    }

    if (error instanceof ApiError && error.status === 409) {
      closeForm();
      setConfirmAction(null);
      invalidate();
      showToast({ message: CONFLICT_MESSAGE, kind: 'error' });
      return;
    }

    showToast({ message: translateApiError(error), kind: 'error' });
  }

  const saveMutation = useMutation({
    mutationFn: (
      vars:
        | { kind: 'create'; payload: VehicleTypeFormState }
        | { kind: 'update'; type: VehicleType; payload: VehicleTypeFormState },
    ) =>
      vars.kind === 'create'
        ? createVehicleType(sucursalId, {
            id: generateUuidV7(),
            name: vars.payload.name,
            accepted: vars.payload.accepted,
          })
        : updateVehicleType(
            sucursalId,
            vars.type.id,
            vars.type.version,
            diffVehicleTypeUpdate(vars.payload, vars.type),
          ),
    onSuccess: (_result, vars) => {
      closeForm();
      invalidate();
      showToast({
        message:
          vars.kind === 'create'
            ? 'Tipo de vehículo creado.'
            : 'Tipo actualizado.',
        kind: 'success',
      });
    },
    onError: (error) => onError(error),
  });

  const toggleMutation = useMutation({
    mutationFn: (type: VehicleType) =>
      updateVehicleType(sucursalId, type.id, type.version, {
        accepted: !type.accepted,
      }),
    onSuccess: () => invalidate(),
    onError: (error) => onError(error),
  });

  /**
   * Borrado, con o sin reasignación.
   *
   * Cuando el destino es un tipo NUEVO son dos llamadas dependientes. Si la
   * segunda falla NO se hace rollback: borrar el tipo recién creado puede
   * fallar también, y si la reasignación sí impactó y solo se perdió la
   * respuesta, borrarlo dejaría N vehículos colgados. El efecto parcial es útil
   * —el tipo nuevo ya está en la lista— así que el reintento es una sola
   * llamada.
   */
  const deleteMutation = useMutation({
    mutationFn: async (vars: {
      type: VehicleType;
      target?: ReassignTarget;
    }) => {
      let reassignToTypeId: string | undefined;
      let createdName: string | undefined;

      if (vars.target?.kind === 'existing') {
        reassignToTypeId = vars.target.id;
      } else if (vars.target?.kind === 'new') {
        const created = await createVehicleType(sucursalId, {
          id: generateUuidV7(),
          name: vars.target.name.trim().replace(/\s+/g, ' '),
          accepted: true,
        });
        reassignToTypeId = created.id;
        createdName = created.name;
      }

      try {
        return await deleteVehicleType(
          sucursalId,
          vars.type.id,
          vars.type.version,
          reassignToTypeId,
        );
      } catch (error) {
        if (createdName) {
          // El tipo nuevo quedó creado. Se nombra el resultado parcial en vez
          // de fingir que no pasó nada: el reintento ahora es una sola llamada.
          throw new PartialReassignError(createdName, vars.type.name, error);
        }
        throw error;
      }
    },
    onSuccess: (result) => {
      setConfirmAction(null);
      invalidate();
      showToast({
        message:
          result.reassignedVehicles > 0
            ? `Tipo eliminado. Movimos ${result.reassignedVehicles} vehículo(s).`
            : 'Tipo eliminado.',
        kind: 'success',
      });
    },
    onError: (error, vars) => {
      if (error instanceof PartialReassignError) {
        setConfirmAction(null);
        invalidate();
        showToast({
          message: `Creamos "${error.createdName}" pero no pudimos eliminar "${error.deletingName}". El tipo nuevo ya está en la lista: volvé a intentar el borrado eligiéndolo como destino.`,
          kind: 'error',
        });
        return;
      }
      onError(error, { type: vars.type });
    },
  });

  const isBusy =
    saveMutation.isPending ||
    deleteMutation.isPending ||
    toggleMutation.isPending;

  function openCreate() {
    setEditing(null);
    setNameError(undefined);
    setFormOpen(true);
  }

  function openEdit(type: VehicleType) {
    setEditing(type);
    setNameError(undefined);
    setFormOpen(true);
  }

  function askDelete(type: VehicleType) {
    setNameError(undefined);
    setConfirmAction(
      type.vehicleCount > 0
        ? { kind: 'delete-reassign', type, usageCount: type.vehicleCount }
        : { kind: 'delete', type },
    );
  }

  function handleFormSubmit(payload: VehicleTypeFormState) {
    if (!editing) {
      saveMutation.mutate({ kind: 'create', payload });
      return;
    }
    if (Object.keys(diffVehicleTypeUpdate(payload, editing)).length === 0) {
      showToast({ message: 'No hay cambios para guardar.', kind: 'info' });
      return;
    }
    saveMutation.mutate({ kind: 'update', type: editing, payload });
  }

  const columns = useMemo<ColumnDef<VehicleType, unknown>[]>(() => {
    const base: ColumnDef<VehicleType, unknown>[] = [
      {
        id: 'name',
        header: 'Nombre',
        accessorKey: 'name',
        size: 220,
        cell: ({ row }) => (
          <span
            style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}
          >
            {row.original.name}
          </span>
        ),
      },
      {
        id: 'accepted',
        header: 'Aceptado',
        // Se ordena y filtra por lo que se ve, no por el booleano crudo.
        accessorFn: (type) => (type.accepted ? 'Sí' : 'No'),
        size: 130,
        cell: ({ row }) =>
          canManage ? (
            <Switch
              checked={row.original.accepted}
              disabled={isBusy}
              aria-label={`Aceptar ${row.original.name}`}
              onChange={() => toggleMutation.mutate(row.original)}
            />
          ) : (
            <Badge variant={row.original.accepted ? 'ok' : 'default'}>
              {row.original.accepted ? 'Sí' : 'No'}
            </Badge>
          ),
      },
      {
        id: 'vehicleCount',
        header: 'En uso',
        accessorKey: 'vehicleCount',
        size: 110,
        cell: ({ row }) => `${row.original.vehicleCount} vehículo(s)`,
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
          const type = row.original;
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
                title="Editar tipo"
                aria-label={`Editar ${type.name}`}
                disabled={isBusy}
                onClick={() => openEdit(type)}
              >
                <IconPencil size={16} />
              </button>
              <button
                type="button"
                className="pk-btn pk-btn-ghost pk-btn-icon"
                title="Eliminar tipo"
                aria-label={`Eliminar ${type.name}`}
                style={{ color: 'var(--err-text)' }}
                disabled={isBusy}
                onClick={() => askDelete(type)}
              >
                <IconTrash size={16} />
              </button>
            </div>
          );
        },
      },
    ];
  }, [canManage, isBusy]);

  return (
    <>
      <DataTable<VehicleType>
        data={types}
        columns={columns}
        title="Tipos de vehículo"
        subtitle="Las categorías con las que este estacionamiento clasifica su catálogo."
        isLoading={listQuery.isLoading}
        emptyMessage={
          listQuery.isError
            ? 'No pudimos cargar los tipos. Probá recargar la tabla.'
            : canManage
              ? 'No hay tipos configurados. Creá el primero.'
              : 'No hay tipos configurados todavía.'
        }
        searchPlaceholder="Buscar por nombre..."
        searchableKeys={['name']}
        filterableColumns={['accepted']}
        filterOptionsByColumn={{
          accepted: [
            { value: 'Sí', label: 'Aceptado' },
            { value: 'No', label: 'No aceptado' },
          ],
        }}
        getRowId={(type) => type.id}
        initialPageSize={10}
        onRefresh={() => void listQuery.refetch()}
        refreshDisabled={listQuery.isFetching || isBusy}
        templateScope={
          userId && sucursalId
            ? { userId, tenantId: sucursalId, tableKey: 'vehicle-types' }
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
              Nuevo tipo
            </Button>
          ) : (
            <Badge>Solo lectura</Badge>
          )
        }
      />

      <VehicleTypeFormModal
        open={formOpen}
        onClose={() => {
          if (!saveMutation.isPending) closeForm();
        }}
        type={editing}
        types={types}
        pending={saveMutation.isPending}
        nameError={nameError}
        onSubmit={handleFormSubmit}
      />

      <ConfirmDialog
        open={confirmAction?.kind === 'delete'}
        title="Eliminar tipo de vehículo"
        message={
          confirmAction?.kind === 'delete'
            ? `¿Eliminar "${confirmAction.type.name}"? No hay vehículos usándolo.`
            : ''
        }
        confirmLabel="Eliminar"
        destructive
        loading={deleteMutation.isPending}
        onClose={() => {
          if (!deleteMutation.isPending) setConfirmAction(null);
        }}
        onConfirm={() => {
          if (confirmAction?.kind === 'delete') {
            deleteMutation.mutate({ type: confirmAction.type });
          }
        }}
      />

      {confirmAction?.kind === 'delete-reassign' && (
        <DeleteVehicleTypeModal
          open
          type={confirmAction.type}
          usageCount={confirmAction.usageCount}
          types={types}
          pending={deleteMutation.isPending}
          nameError={nameError}
          onClose={() => {
            if (!deleteMutation.isPending) setConfirmAction(null);
          }}
          onSubmit={(target) =>
            deleteMutation.mutate({ type: confirmAction.type, target })
          }
        />
      )}
    </>
  );
}

/**
 * El tipo nuevo se creó pero el borrado falló. Se modela como error propio para
 * que el toast pueda nombrar el resultado parcial en vez de decir "algo salió
 * mal": el tipo nuevo YA está en la lista y el reintento es una sola llamada.
 */
class PartialReassignError extends Error {
  constructor(
    readonly createdName: string,
    readonly deletingName: string,
    readonly cause: unknown,
  ) {
    super('partial reassign');
    this.name = 'PartialReassignError';
  }
}

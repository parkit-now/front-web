import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '../../../../shared/components/ui/Badge';
import { Button } from '../../../../shared/components/ui/Button';
import { ConfirmDialog } from '../../../../shared/components/ui/ConfirmDialog';
import {
  IconPencil,
  IconPlus,
  IconPower,
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
import { fmtDateTimeAr, fmtMoney } from '../../../../shared/utils/fmt';
import { generateUuidV7 } from '../../../../shared/utils/uuid';
import { useSucursal } from '../../context/SucursalContext';
import {
  createRate,
  deleteRate,
  listRates,
  updateRate,
  type Rate,
  type UpdateRateInput,
} from '../../services/rates';
import { RateFormModal } from './RateFormModal';
import { diffRateUpdate, type RateFormPayload } from './validation';

/**
 * El optimistic locking del backend devuelve 409 cuando la `version` que
 * mandamos quedó vieja. No reintentamos solo: reintentar pisaría el cambio de
 * la otra persona, que es justo lo que el control de versión evita.
 */
const CONFLICT_MESSAGE =
  'La tasa fue modificada por otra persona. Actualizamos la lista, revisá los datos y volvé a intentar.';

type RateConfirmAction = {
  kind: 'activate' | 'deactivate' | 'delete';
  rate: Rate;
};

function rateStatus(rate: Rate): 'Activa' | 'Inactiva' {
  return rate.isActive ? 'Activa' : 'Inactiva';
}

export function TasasPage() {
  const { showToast } = useToast();
  const { sucursalId, sucursal } = useSucursal();
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();

  // El ABM es de los dueños del estacionamiento. SucursalContext ya fuerza
  // `role: 'owner'` para el admin global, así que el bypass entra por acá.
  const canManage = sucursal?.role === 'owner';

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Rate | null>(null);
  const [confirmAction, setConfirmAction] = useState<RateConfirmAction | null>(
    null,
  );

  const queryKey = ['rates', sucursalId, { includeInactive: true }];
  const listQuery = useQuery({
    queryKey,
    // El ABM tiene que ver también las inactivas para poder reactivarlas.
    queryFn: () => listRates(sucursalId, true),
    enabled: Boolean(sucursalId),
  });
  const rates = useMemo(() => listQuery.data ?? [], [listQuery.data]);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey });
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
  }

  function onError(error: unknown, endpoint: EndpointKey) {
    if (error instanceof ApiError && error.status === 409) {
      // `editing` y `confirmAction.rate` son fotos congeladas de la fila: si
      // dejáramos el modal abierto, el próximo intento repetiría la `version`
      // vieja y volvería a chocar.
      closeForm();
      setConfirmAction(null);
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
        | { kind: 'create'; payload: RateFormPayload }
        | { kind: 'update'; rate: Rate; body: UpdateRateInput },
    ) =>
      vars.kind === 'create'
        ? createRate(sucursalId, { id: generateUuidV7(), ...vars.payload })
        : updateRate(sucursalId, vars.rate.id, vars.rate.version, vars.body),
    onSuccess: (_result, vars) => {
      closeForm();
      invalidate();
      showToast({
        message: vars.kind === 'create' ? 'Tasa creada.' : 'Tasa actualizada.',
        kind: 'success',
      });
    },
    onError: (error, vars) =>
      onError(error, vars.kind === 'create' ? 'rates.create' : 'rates.update'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ rate, isActive }: { rate: Rate; isActive: boolean }) =>
      updateRate(sucursalId, rate.id, rate.version, { isActive }),
    onSuccess: (_result, vars) => {
      setConfirmAction(null);
      invalidate();
      showToast({
        message: vars.isActive ? 'Tasa reactivada.' : 'Tasa desactivada.',
        kind: 'success',
      });
    },
    onError: (error) => onError(error, 'rates.update'),
  });

  const deleteMutation = useMutation({
    mutationFn: (rate: Rate) => deleteRate(sucursalId, rate.id, rate.version),
    onSuccess: () => {
      setConfirmAction(null);
      invalidate();
      showToast({ message: 'Tasa eliminada.', kind: 'success' });
    },
    onError: (error) => onError(error, 'rates.delete'),
  });

  const isBusy =
    saveMutation.isPending ||
    toggleMutation.isPending ||
    deleteMutation.isPending;

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(rate: Rate) {
    setEditing(rate);
    setFormOpen(true);
  }

  function handleFormSubmit(payload: RateFormPayload) {
    if (!editing) {
      saveMutation.mutate({ kind: 'create', payload });
      return;
    }
    const body = diffRateUpdate(payload, editing);
    if (Object.keys(body).length === 0) {
      showToast({ message: 'No hay cambios para guardar.', kind: 'info' });
      return;
    }
    saveMutation.mutate({ kind: 'update', rate: editing, body });
  }

  function handleConfirm() {
    if (!confirmAction) return;
    const { kind, rate } = confirmAction;
    if (kind === 'delete') {
      deleteMutation.mutate(rate);
      return;
    }
    toggleMutation.mutate({ rate, isActive: kind === 'activate' });
  }

  const columns = useMemo<ColumnDef<Rate, unknown>[]>(() => {
    const base: ColumnDef<Rate, unknown>[] = [
      {
        id: 'shortcutNumber',
        header: '#',
        accessorKey: 'shortcutNumber',
        size: 56,
        cell: ({ row }) =>
          row.original.shortcutNumber != null ? (
            <Badge variant="brand">{row.original.shortcutNumber}</Badge>
          ) : (
            <span style={{ color: 'var(--text-3)' }}>—</span>
          ),
      },
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
        id: 'hourPriceArs',
        header: 'Hora',
        accessorKey: 'hourPriceArs',
        size: 130,
        cell: ({ row }) => fmtMoney(row.original.hourPriceArs),
      },
      {
        id: 'stayPriceArs',
        header: 'Estadía',
        accessorKey: 'stayPriceArs',
        size: 140,
        cell: ({ row }) => fmtMoney(row.original.stayPriceArs),
      },
      {
        id: 'fractionPriceArs',
        header: 'Fracción',
        accessorKey: 'fractionPriceArs',
        size: 140,
        cell: ({ row }) => fmtMoney(row.original.fractionPriceArs),
      },
      {
        id: 'status',
        header: 'Estado',
        accessorFn: (rate) => rateStatus(rate),
        size: 120,
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? 'ok' : 'default'}>
            {rateStatus(row.original)}
          </Badge>
        ),
      },
      {
        id: 'updatedAt',
        header: 'Actualizada',
        accessorKey: 'updatedAt',
        size: 170,
        cell: ({ row }) => (
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
            {fmtDateTimeAr(row.original.updatedAt)}
          </span>
        ),
      },
    ];

    if (!canManage) return base;

    return [
      ...base,
      {
        id: 'actions',
        header: () => <div style={{ textAlign: 'center' }}>Acciones</div>,
        size: 220,
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const rate = row.original;
          const inactive = !rate.isActive;
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
                title="Editar tasa"
                aria-label={`Editar ${rate.name}`}
                disabled={isBusy}
                onClick={() => openEdit(rate)}
              >
                <IconPencil size={16} />
              </button>
              <button
                type="button"
                className="pk-btn pk-btn-ghost pk-btn-icon"
                title={inactive ? 'Reactivar tasa' : 'Desactivar tasa'}
                aria-label={`${inactive ? 'Reactivar' : 'Desactivar'} ${rate.name}`}
                disabled={isBusy}
                onClick={() =>
                  setConfirmAction({
                    kind: inactive ? 'activate' : 'deactivate',
                    rate,
                  })
                }
              >
                <IconPower size={16} />
              </button>
              <button
                type="button"
                className="pk-btn pk-btn-ghost pk-btn-icon"
                title="Eliminar tasa"
                aria-label={`Eliminar ${rate.name}`}
                style={{ color: 'var(--err-text)' }}
                disabled={isBusy}
                onClick={() => setConfirmAction({ kind: 'delete', rate })}
              >
                <IconTrash size={16} />
              </button>
            </div>
          );
        },
      },
    ];
  }, [canManage, isBusy]);

  const confirmCopy = confirmAction
    ? {
        activate: {
          title: `Reactivar "${confirmAction.rate.name}"`,
          message: 'La tasa volverá a estar disponible para operar.',
          confirmLabel: 'Reactivar',
          destructive: false,
        },
        deactivate: {
          title: `Desactivar "${confirmAction.rate.name}"`,
          message:
            'La tasa quedará oculta de la operación activa. Podés volver a activarla desde la tabla.',
          confirmLabel: 'Desactivar',
          destructive: false,
        },
        delete: {
          title: `Eliminar "${confirmAction.rate.name}"`,
          message:
            'Esta acción es permanente e irreversible. La tasa será eliminada definitivamente.',
          confirmLabel: 'Eliminar',
          destructive: true,
        },
      }[confirmAction.kind]
    : null;

  return (
    <>
      <DataTable<Rate>
        data={rates}
        columns={columns}
        title="Tarifas configuradas"
        subtitle="Filtrá, ordená y guardá vistas para operar más rápido."
        isLoading={listQuery.isLoading}
        emptyMessage={
          // Sin esta rama, una carga fallida se ve igual que "no hay tasas" y el
          // dueño puede creer que se le borraron las tarifas.
          listQuery.isError
            ? 'No pudimos cargar las tasas. Probá recargar la tabla.'
            : canManage
              ? 'Creá la primera tasa para empezar a operar con precios desde la app.'
              : 'Todavía no hay tasas configuradas para este estacionamiento.'
        }
        searchPlaceholder="Buscar tasa por nombre..."
        searchableKeys={['name']}
        filterableColumns={['status']}
        filterOptionsByColumn={{
          status: [
            { value: 'Activa', label: 'Activa' },
            { value: 'Inactiva', label: 'Inactiva' },
          ],
        }}
        getRowId={(rate) => rate.id}
        initialPageSize={10}
        onRefresh={() => void listQuery.refetch()}
        refreshDisabled={listQuery.isFetching || isBusy}
        templateScope={
          userId && sucursalId
            ? { userId, tenantId: sucursalId, tableKey: 'rates' }
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
              Nueva tasa
            </Button>
          ) : (
            <Badge>Solo lectura</Badge>
          )
        }
      />

      <RateFormModal
        open={formOpen}
        rate={editing}
        rates={rates}
        pending={saveMutation.isPending}
        onClose={() => {
          if (!saveMutation.isPending) closeForm();
        }}
        onSubmit={handleFormSubmit}
      />

      <ConfirmDialog
        open={confirmCopy !== null}
        title={confirmCopy?.title ?? ''}
        message={confirmCopy?.message ?? ''}
        confirmLabel={confirmCopy?.confirmLabel}
        destructive={confirmCopy?.destructive}
        loading={toggleMutation.isPending || deleteMutation.isPending}
        onConfirm={handleConfirm}
        onClose={() => {
          if (!isBusy) setConfirmAction(null);
        }}
      />
    </>
  );
}

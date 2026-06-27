import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '../../../../shared/components/ui/Badge';
import { Button } from '../../../../shared/components/ui/Button';
import { Switch } from '../../../../shared/components/ui/Switch';
import { ConfirmDialog } from '../../../../shared/components/ui/ConfirmDialog';
import {
  IconCheckCircle,
  IconLock,
  IconPencil,
  IconPlus,
  IconTrash,
} from '../../../../shared/components/icons';
import { DataTable } from '../../../../features/data-table';
import { useToast } from '../../../../lib/notifications/ToastProvider';
import { translateApiError } from '../../../../lib/api/translate';
import { useCurrentUserId } from '../../../../lib/supabase/useCurrentUserId';
import { useSucursal } from '../../context/SucursalContext';
import {
  createPaymentMethod,
  deletePaymentMethod,
  listPaymentMethods,
  togglePaymentMethod,
  type PaymentMethodSummary,
} from '../../services/entities';
import { PaymentMethodFormModal } from './PaymentMethodFormModal';

function paymentMethodStatus(
  method: PaymentMethodSummary,
): 'Habilitado' | 'Deshabilitado' {
  return method.enabled ? 'Habilitado' : 'Deshabilitado';
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function PaymentMethodsPage() {
  const { showToast } = useToast();
  const { sucursalId } = useSucursal();
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentMethodSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PaymentMethodSummary | null>(
    null,
  );

  const queryKey = ['payment-methods', sucursalId];
  const listQuery = useQuery({
    queryKey,
    queryFn: () => listPaymentMethods(sucursalId),
    enabled: Boolean(sucursalId),
  });
  const medios = useMemo(() => listQuery.data ?? [], [listQuery.data]);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey });
  }

  function onError(error: unknown) {
    showToast({
      message: translateApiError(error, { endpoint: 'entities.payment' }),
      kind: 'error',
    });
  }

  const toggleMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: { enabled?: boolean; isDefault?: boolean };
    }) => togglePaymentMethod(sucursalId, id, body),
    onSuccess: invalidate,
    onError,
  });

  const saveMutation = useMutation({
    mutationFn: ({ id, name }: { id: string | null; name: string }) =>
      id === null
        ? createPaymentMethod(sucursalId, { name })
        : togglePaymentMethod(sucursalId, id, { name }),
    onSuccess: () => {
      setFormOpen(false);
      setEditing(null);
      invalidate();
    },
    onError,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePaymentMethod(sucursalId, id),
    onSuccess: () => {
      setDeleteTarget(null);
      invalidate();
    },
    onError: (error) => {
      setDeleteTarget(null);
      onError(error);
    },
  });

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(method: PaymentMethodSummary) {
    setEditing(method);
    setFormOpen(true);
  }

  function handleToggleEnabled(m: PaymentMethodSummary) {
    if (m.isDefault && m.enabled) {
      showToast({
        message: 'No podés desactivar el método de pago predeterminado.',
        kind: 'error',
      });
      return;
    }
    toggleMutation.mutate({ id: m.id, body: { enabled: !m.enabled } });
  }

  function handleMakeDefault(m: PaymentMethodSummary) {
    toggleMutation.mutate({ id: m.id, body: { isDefault: true } });
  }

  const columns = useMemo<ColumnDef<PaymentMethodSummary, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Nombre',
        accessorKey: 'name',
        cell: ({ row }) => {
          const m = row.original;
          return (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                minWidth: 0,
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text-1)',
                }}
              >
                {m.name}
              </span>
              {m.isSystem && <Badge>Sistema</Badge>}
              {m.isDefault && <Badge variant="brand">Por defecto</Badge>}
            </div>
          );
        },
      },
      {
        id: 'status',
        header: 'Estado',
        accessorFn: (m) => paymentMethodStatus(m),
        cell: ({ row }) => {
          const disabled =
            paymentMethodStatus(row.original) === 'Deshabilitado';
          return (
            <Badge variant={disabled ? 'default' : 'ok'}>
              {disabled ? 'Deshabilitado' : 'Habilitado'}
            </Badge>
          );
        },
      },
      {
        id: 'updatedAt',
        header: 'Actualizado',
        accessorKey: 'updatedAt',
        cell: ({ row }) => (
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
            {formatDateTime(row.original.updatedAt)}
          </span>
        ),
      },
      {
        id: 'acciones',
        header: () => <div style={{ textAlign: 'center' }}>Acciones</div>,
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const m = row.original;
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
                title="Editar nombre"
                aria-label={`Editar ${m.name}`}
                onClick={() => openEdit(m)}
              >
                <IconPencil size={16} />
              </button>
              {m.isSystem ? (
                <button
                  type="button"
                  className="pk-btn pk-btn-ghost pk-btn-icon"
                  title="Los medios de sistema no se pueden eliminar"
                  aria-label={`${m.name} es un medio de sistema y no se puede eliminar`}
                  disabled
                  style={{ opacity: 0.35 }}
                >
                  <IconTrash size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  className="pk-btn pk-btn-ghost pk-btn-icon"
                  title="Eliminar"
                  aria-label={`Eliminar ${m.name}`}
                  style={{ color: 'var(--err-text)' }}
                  onClick={() => setDeleteTarget(m)}
                >
                  <IconTrash size={16} />
                </button>
              )}
              {!m.isDefault && m.enabled ? (
                <button
                  type="button"
                  className="pk-btn pk-btn-ghost pk-btn-icon"
                  title="Marcar como predeterminado"
                  aria-label={`Marcar ${m.name} como predeterminado`}
                  disabled={toggleMutation.isPending}
                  onClick={() => handleMakeDefault(m)}
                >
                  <IconCheckCircle size={16} />
                </button>
              ) : null}
              {m.isDefault ? (
                // The default can't be disabled (it'd leave a disabled method
                // pre-selected at checkout). Communicate the rule instead of
                // showing a dead toggle: lock + tooltip on how to unlock it.
                <span
                  title="El medio predeterminado siempre está activo. Para desactivarlo, primero marcá otro como predeterminado."
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginLeft: 4,
                    fontSize: 12,
                    color: 'var(--text-3)',
                  }}
                >
                  <IconLock size={13} />
                  <span style={{ minWidth: 52 }}>Siempre activo</span>
                </span>
              ) : (
                <span
                  title={m.enabled ? 'Desactivar' : 'Activar'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginLeft: 4,
                  }}
                >
                  <Switch
                    checked={m.enabled}
                    onChange={() => handleToggleEnabled(m)}
                    aria-label={`Activar/desactivar ${m.name}`}
                  />
                  <span
                    style={{
                      fontSize: 12,
                      color: 'var(--text-3)',
                      minWidth: 52,
                    }}
                  >
                    {m.enabled ? 'Activo' : 'Inactivo'}
                  </span>
                </span>
              )}
            </div>
          );
        },
      },
    ],
    // Handlers close over stable mutate fns; isPending drives the "Marcar" button.
    [toggleMutation.isPending],
  );

  return (
    <>
      <DataTable<PaymentMethodSummary>
        data={medios}
        columns={columns}
        title="Métodos de pago"
        isLoading={listQuery.isLoading}
        emptyMessage="Todavía no hay métodos de pago. Agregá el primero."
        searchPlaceholder="Buscar método de pago"
        searchableKeys={['name']}
        filterableColumns={['status']}
        filterOptionsByColumn={{
          status: [
            { value: 'Habilitado', label: 'Habilitado' },
            { value: 'Deshabilitado', label: 'Deshabilitado' },
          ],
        }}
        getRowId={(m) => m.id}
        onRefresh={() => void listQuery.refetch()}
        refreshDisabled={listQuery.isFetching}
        templateScope={
          userId && sucursalId
            ? { userId, tenantId: sucursalId, tableKey: 'payment-methods' }
            : undefined
        }
        headerAction={
          <Button
            variant="primary"
            size="sm"
            icon={<IconPlus size={15} />}
            onClick={openCreate}
          >
            Agregar método de pago
          </Button>
        }
      />

      <PaymentMethodFormModal
        open={formOpen}
        method={editing}
        pending={saveMutation.isPending}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSubmit={(name) =>
          saveMutation.mutate({ id: editing?.id ?? null, name })
        }
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Eliminar método de pago"
        destructive
        confirmLabel="Eliminar"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
        onClose={() => setDeleteTarget(null)}
        message={
          <>
            ¿Seguro que querés eliminar <strong>{deleteTarget?.name}</strong>?
            Esta acción no se puede deshacer.
          </>
        }
      />
    </>
  );
}

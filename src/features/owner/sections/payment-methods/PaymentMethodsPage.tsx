import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '../../../../shared/components/ui/Badge';
import { Button } from '../../../../shared/components/ui/Button';
import { ConfirmDialog } from '../../../../shared/components/ui/ConfirmDialog';
import {
  IconCheckCircle,
  IconPencil,
  IconPlus,
  IconPower,
  IconTrash,
} from '../../../../shared/components/icons';
import { DataTable } from '../../../../features/data-table';
import { dateTimeSorting } from '../../../../features/data-table/utils';
import { useToast } from '../../../../lib/notifications/ToastProvider';
import { translateApiError } from '../../../../lib/api/translate';
import { useCurrentUserId } from '../../../../lib/supabase/useCurrentUserId';
import { useSucursal } from '../../context/SucursalContext';
import { useMpAccount } from '../../hooks/useMpAccount';
import {
  createPaymentMethod,
  deletePaymentMethod,
  listPaymentMethods,
  togglePaymentMethod,
  type PaymentMethodSummary,
} from '../../services/entities';
import { PaymentMethodFormModal } from './PaymentMethodFormModal';
import {
  paymentMethodToggleBlockReason,
  resolvePaymentMethodLock,
} from './validation';

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
  const [toggleTarget, setToggleTarget] = useState<{
    method: PaymentMethodSummary;
    enabled: boolean;
  } | null>(null);

  // El formulario y el diálogo guardan el medio de pago del estacionamiento
  // activo. Al cambiar de estacionamiento esa referencia queda apuntando a otra
  // playa y la acción saldría contra el tenant equivocado. Se descartan.
  useEffect(() => {
    setFormOpen(false);
    setEditing(null);
    setDeleteTarget(null);
    setToggleTarget(null);
  }, [sucursalId]);

  const queryKey = ['payment-methods', sucursalId];
  const listQuery = useQuery({
    queryKey,
    queryFn: () => listPaymentMethods(sucursalId),
    enabled: Boolean(sucursalId),
  });
  const medios = useMemo(() => listQuery.data ?? [], [listQuery.data]);

  // Los medios integrados dependen de una cuenta que vive en otro lado, así
  // que hay que ir a buscarla: la tabla sola no alcanza para saber si el
  // interruptor de "Mercado Pago QR" todavía significa algo.
  const mpAccountQuery = useMpAccount(sucursalId);
  const mpAccountStatus = mpAccountQuery.data?.status ?? null;
  // Si la consulta falló no sabemos nada: bloquear el interruptor de una playa
  // que sí tiene Mercado Pago vinculado, y encima ofrecerle "Volver a
  // vincular", es mentirle al dueño por un error de red. Ante la duda, no se
  // bloquea.
  const mpAccountKnown = mpAccountQuery.isSuccess;

  /**
   * El bloqueo de una fila, ya combinado con lo que sabemos de la cuenta.
   *
   * `mpAccountKnown` se aplica UNA sola vez, acá, y no en cada control: si la
   * consulta falló no sabemos si la cuenta está viva, y ante la duda no se
   * bloquea nada. Repetir ese `&&` en cada rama del render es cómo se termina
   * olvidando en una.
   */
  function resolveRowLock(m: PaymentMethodSummary) {
    const lock = resolvePaymentMethodLock({
      type: m.type,
      accountStatus: mpAccountStatus,
    });
    return {
      integrationBacked: lock.integrationBacked,
      enableLocked: mpAccountKnown && lock.enableLocked,
      setDefaultLocked: mpAccountKnown && lock.setDefaultLocked,
    };
  }

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
    onSuccess: () => {
      setToggleTarget(null);
      invalidate();
    },
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

  function handleToggleEnabled(m: PaymentMethodSummary, confirmed = false) {
    if (toggleMutation.isPending) return;
    const { enableLocked } = resolveRowLock(m);
    // El predeterminado no se apaga: dejaría un medio inactivo preseleccionado
    // en el modal de egreso.
    //
    // Salvo que sea un medio integrado con la cuenta caída. Ahí el QR ya no
    // cobra: el estado que la regla quiere evitar YA pasó, y el candado deja
    // de protegerlo para pasar a encerrarlo. Apagarlo es la única salida que
    // le queda al dueño, así que el bloqueo de la integración gana.
    const reason = paymentMethodToggleBlockReason(m, enableLocked);
    if (reason) {
      showToast({
        message: reason,
        kind: 'error',
      });
      return;
    }
    if (confirmed) {
      toggleMutation.mutate({ id: m.id, body: { enabled: !m.enabled } });
    } else {
      setToggleTarget({ method: m, enabled: !m.enabled });
    }
  }

  function handleMakeDefault(m: PaymentMethodSummary) {
    const { setDefaultLocked } = resolveRowLock(m);
    // El botón ya viene deshabilitado; esto es el cerrojo, no el cartel. El
    // backend NO valida `isDefault` contra la integración (sólo `enabled`), así
    // que si esta guarda no está, marcar predeterminado es una puerta abierta a
    // dejar un QR muerto preseleccionado en el egreso.
    if (setDefaultLocked) {
      showToast({
        message:
          'Mercado Pago no está vinculado. Volvé a vincular la cuenta antes de usar el QR como predeterminado.',
        kind: 'error',
      });
      return;
    }
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
          const { integrationBacked } = resolveRowLock(m);
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
              {/*
                El dueño puede renombrar el medio: "Mercado Pago QR" puede
                terminar llamándose "QR" o "Celular". El badge es lo único que
                queda diciendo de dónde salió, y por qué su interruptor a veces
                no se puede tocar. Va en `brand` y no en `warn`: es un dato,
                no un problema.
              */}
              {integrationBacked && <Badge variant="brand">Integrado</Badge>}
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
        sortingFn: dateTimeSorting((row) => row.updatedAt),
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
          const { enableLocked, setDefaultLocked } = resolveRowLock(m);
          const toggleBlockReason = paymentMethodToggleBlockReason(
            m,
            enableLocked,
          );
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
              <button
                type="button"
                className="pk-btn pk-btn-ghost pk-btn-icon"
                title={
                  toggleBlockReason ??
                  (m.enabled
                    ? 'Desactivar método de pago'
                    : 'Reactivar método de pago')
                }
                aria-label={`${m.enabled ? 'Desactivar' : 'Reactivar'} ${m.name}`}
                disabled={
                  toggleMutation.isPending || Boolean(toggleBlockReason)
                }
                style={toggleBlockReason ? { opacity: 0.35 } : undefined}
                onClick={() => handleToggleEnabled(m)}
              >
                <IconPower size={16} />
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
                // El predeterminado llega PRESELECCIONADO al modal de egreso.
                // Con la cuenta caída eso deja al operario arrancando cada
                // cobro sobre un QR que no cobra: la misma puerta que el
                // interruptor, y peor, porque no hace falta ni tocarlo.
                //
                // Va deshabilitado y no oculto a propósito: esconder el botón
                // deja al dueño buscando una acción que ayer estaba. El
                // tooltip dice qué pasó y adónde ir.
                <button
                  type="button"
                  className="pk-btn pk-btn-ghost pk-btn-icon"
                  title={
                    setDefaultLocked
                      ? 'Mercado Pago no está vinculado. Volvé a vincular la cuenta antes de usar el QR como predeterminado.'
                      : 'Marcar como predeterminado'
                  }
                  aria-label={
                    setDefaultLocked
                      ? `${m.name} no se puede marcar como predeterminado sin una cuenta de Mercado Pago vinculada`
                      : `Marcar ${m.name} como predeterminado`
                  }
                  disabled={toggleMutation.isPending || setDefaultLocked}
                  style={setDefaultLocked ? { opacity: 0.35 } : undefined}
                  onClick={() => handleMakeDefault(m)}
                >
                  <IconCheckCircle size={16} />
                </button>
              ) : null}
              {enableLocked ? (
                <span
                  title={
                    m.enabled
                      ? 'Mercado Pago no está vinculado y el QR no cobra. Podés apagarlo acá, o volver a vincular la cuenta.'
                      : 'Mercado Pago no está vinculado. Volvé a vincular la cuenta para poder cobrar con el QR.'
                  }
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginLeft: 4,
                  }}
                >
                  {/*
                    Ruta relativa: `metodos-de-pago` e `integraciones` son
                    hermanas, así que el mismo link sirve para el dueño
                    (`/app/...`) y para el admin mirando una playa ajena
                    (`/ops/estacionamientos/:tenantId/...`).
                  */}
                  <Link
                    to="../integraciones"
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: 'var(--brand)',
                      textDecoration: 'underline',
                      textUnderlineOffset: 3,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Volver a vincular
                  </Link>
                </span>
              ) : null}
            </div>
          );
        },
      },
    ],
    // Handlers close over stable mutate fns; isPending drives the "Marcar" button.
    // El estado de la cuenta de Mercado Pago decide el badge, el candado del
    // interruptor y si "Marcar como predeterminado" se puede tocar, así que
    // las columnas se rearman cuando cambia. `resolveRowLock` no va en las
    // deps: lo único que mira son estas dos, que sí están.
    [toggleMutation.isPending, mpAccountStatus, mpAccountKnown],
  );

  return (
    <>
      <DataTable<PaymentMethodSummary>
        data={medios}
        columns={columns}
        title="Métodos de pago"
        // Se espera también a la cuenta de Mercado Pago. Sin esto, una playa
        // vinculada dibuja primero el interruptor bloqueado (todavía no
        // sabemos que hay cuenta) y recién después lo libera: un parpadeo que
        // le dice al dueño que se le cayó la integración cuando no pasó nada.
        isLoading={listQuery.isLoading || mpAccountQuery.isLoading}
        emptyMessage={
          // Sin esta rama, una carga fallida se ve igual que "no hay métodos" y
          // el dueño puede creer que se le borró la configuración de cobros.
          listQuery.isError
            ? 'No pudimos cargar los métodos de pago. Probá recargar la tabla.'
            : 'Todavía no hay métodos de pago. Agregá el primero.'
        }
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
        open={toggleTarget !== null}
        title={`${toggleTarget?.enabled ? 'Reactivar' : 'Desactivar'} método de pago`}
        confirmLabel={toggleTarget?.enabled ? 'Reactivar' : 'Desactivar'}
        loading={toggleMutation.isPending}
        onConfirm={() => {
          if (!toggleTarget || toggleMutation.isPending) return;
          const current = medios.find((m) => m.id === toggleTarget.method.id);
          if (!current || current.enabled === toggleTarget.enabled) {
            setToggleTarget(null);
            return;
          }
          handleToggleEnabled(current, true);
        }}
        onClose={() => {
          if (!toggleMutation.isPending) setToggleTarget(null);
        }}
        message={
          <>
            ¿{toggleTarget?.enabled ? 'Reactivar' : 'Desactivar'}{' '}
            <strong>{toggleTarget?.method.name}</strong>?
          </>
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

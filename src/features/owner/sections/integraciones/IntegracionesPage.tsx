import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from '../../../../shared/components/ui/Alert';
import { Badge } from '../../../../shared/components/ui/Badge';
import { Button } from '../../../../shared/components/ui/Button';
import { SectionHeader } from '../../../../shared/components/SectionHeader';
import { IconAlert } from '../../../../shared/components/icons';
import { useToast } from '../../../../lib/notifications/ToastProvider';
import { translateApiError } from '../../../../lib/api/translate';
import { useSucursal } from '../../context/SucursalContext';
import { mpAccountQueryKey, useMpAccount } from '../../hooks/useMpAccount';
import { getEntityProfile } from '../../services/entities';
import {
  createMpAuthorizationUrl,
  resyncMpPos,
  unlinkMpAccount,
} from '../../services/mercado-pago';
import { MercadoPagoCard } from './MercadoPagoCard';
import { isAddressComplete, resolveMpCardState } from './validation';

/**
 * Integraciones del panel del dueño. Hoy: Mercado Pago.
 *
 * La página consulta y muta; qué se dibuja lo decide `resolveMpCardState`.
 */
export function IntegracionesPage() {
  const { showToast } = useToast();
  const { sucursalId, sucursal } = useSucursal();
  const { pathname } = useLocation();
  const queryClient = useQueryClient();

  // Vincular y desvincular es cosa del dueño. `SucursalContext` ya fuerza
  // `role: 'owner'` para el admin global, así que el bypass entra por acá.
  const canManage = sucursal?.role === 'owner';

  // El 404 `MP_NOT_LINKED` traducido a `null` vive en el hook: Métodos de pago
  // hace la misma consulta y la trampa tiene que estar escrita una sola vez.
  const accountQuery = useMpAccount(sucursalId);

  // Misma `queryKey` que la pestaña Perfil: comparten caché, y cargar la
  // dirección desde Configuración se refleja acá sin pedirla de nuevo.
  const entityQuery = useQuery({
    queryKey: ['entity-profile', sucursalId],
    queryFn: () => getEntityProfile(sucursalId),
    enabled: Boolean(sucursalId),
  });

  function invalidate() {
    void queryClient.invalidateQueries({
      queryKey: mpAccountQueryKey(sucursalId),
    });
  }

  const linkMutation = useMutation({
    // `pathname` es la ruta interna a la que volver después del callback:
    // `/app/integraciones` para el dueño, la base con `:tenantId` para el
    // admin. El backend la valida (relativa y con una sola `/`) para no
    // convertirse en un open redirect.
    mutationFn: () => createMpAuthorizationUrl(sucursalId, pathname),
    onSuccess: (result) => {
      // Mercado Pago es OTRO dominio: `navigate` del router no sale de la SPA.
      window.location.assign(result.authorizationUrl);
    },
    onError: (error) =>
      showToast({
        message: translateApiError(error, {
          endpoint: 'mercadoPago.authorizationUrl',
        }),
        kind: 'error',
      }),
  });

  const unlinkMutation = useMutation({
    mutationFn: () => unlinkMpAccount(sucursalId),
    onSuccess: () => {
      invalidate();
      showToast({
        message: 'Desvinculamos tu cuenta de Mercado Pago.',
        kind: 'success',
      });
    },
    onError: (error) =>
      showToast({
        message: translateApiError(error, { endpoint: 'mercadoPago.unlink' }),
        kind: 'error',
      }),
  });

  const resyncMutation = useMutation({
    mutationFn: () => resyncMpPos(sucursalId),
    onSuccess: () => {
      invalidate();
      showToast({ message: 'Sincronizamos el QR.', kind: 'success' });
    },
    onError: (error) =>
      showToast({
        message: translateApiError(error, {
          endpoint: 'mercadoPago.resyncPos',
        }),
        kind: 'error',
      }),
  });

  const account = accountQuery.data ?? null;
  const addressComplete = isAddressComplete(entityQuery.data);

  const state = useMemo(
    () => resolveMpCardState({ account, addressComplete }),
    [account, addressComplete],
  );

  const header = (
    <SectionHeader
      title="Integraciones"
      subtitle="Conectá Parkit con los servicios que ya usás en tu estacionamiento."
      action={canManage ? undefined : <Badge>Solo lectura</Badge>}
    />
  );

  // La dirección decide entre `address-incomplete` y `unlinked`: mostrar la
  // tarjeta antes de tenerla haría parpadear el aviso equivocado.
  if (accountQuery.isLoading || entityQuery.isLoading) {
    return (
      <div>
        {header}
        <div className="pk-card pk-card-pad" style={{ minHeight: 160 }}>
          <p style={{ color: 'var(--text-3)', fontSize: 14 }}>
            Cargando integraciones...
          </p>
        </div>
      </div>
    );
  }

  if (accountQuery.isError) {
    return (
      <div>
        {header}
        <Alert
          variant="err"
          icon={<IconAlert size={16} />}
          title="No pudimos consultar tu integración con Mercado Pago"
          description={translateApiError(accountQuery.error, {
            endpoint: 'mercadoPago.getAccount',
          })}
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void accountQuery.refetch()}
            >
              Reintentar
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div>
      {header}

      {/*
        La conexión rota se avisa ARRIBA DE TODO y a lo ancho, no sólo adentro
        de la tarjeta: mientras esté así el QR de la ventanilla no cobra, y eso
        tiene que ser imposible de pasar por alto al entrar a la sección.
      */}
      {state.kind === 'broken' && (
        <div style={{ marginBottom: 10 }}>
          <Alert
            variant="err"
            icon={<IconAlert size={18} />}
            title="Se perdió la conexión con Mercado Pago"
            description="Hasta que vuelvas a vincular tu cuenta no vas a poder cobrar con el QR: quien lo escanee va a ver un error. El resto del estacionamiento sigue funcionando normal."
            action={
              canManage ? (
                <Button
                  variant="primary"
                  size="sm"
                  loading={linkMutation.isPending}
                  onClick={() => linkMutation.mutate()}
                >
                  Re-vincular
                </Button>
              ) : undefined
            }
          />
        </div>
      )}

      <MercadoPagoCard
        state={state}
        account={account}
        canManage={canManage}
        linking={linkMutation.isPending}
        unlinking={unlinkMutation.isPending}
        resyncing={resyncMutation.isPending}
        onLink={() => linkMutation.mutate()}
        onUnlink={() => unlinkMutation.mutate()}
        onResync={() => resyncMutation.mutate()}
      />
    </div>
  );
}

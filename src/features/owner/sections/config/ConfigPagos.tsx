import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Switch } from '../../../../shared/components/ui/Switch';
import { Badge } from '../../../../shared/components/ui/Badge';
import { Button } from '../../../../shared/components/ui/Button';
import { useToast } from '../../../../lib/notifications/ToastProvider';
import { translateApiError } from '../../../../lib/api/translate';
import { useSucursal } from '../../context/SucursalContext';
import {
  listPaymentMethods,
  togglePaymentMethod,
  type PaymentMethodSummary,
  type TogglePaymentMethodInput,
} from '../../services/entities';

export function ConfigPagos() {
  const { showToast } = useToast();
  const { sucursalId } = useSucursal();
  const queryClient = useQueryClient();

  const queryKey = ['payment-methods', sucursalId];
  const { data: medios = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => listPaymentMethods(sucursalId),
    enabled: Boolean(sucursalId),
  });

  const mutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: TogglePaymentMethodInput;
    }) => togglePaymentMethod(sucursalId, id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => {
      showToast({
        message: translateApiError(error, { endpoint: 'entities.payment' }),
        kind: 'error',
      });
    },
  });

  function handleToggleEnabled(m: PaymentMethodSummary) {
    if (m.isDefault && m.enabled) {
      showToast({
        message: 'No podés desactivar el medio de pago predeterminado.',
        kind: 'error',
      });
      return;
    }
    mutation.mutate({ id: m.id, body: { enabled: !m.enabled } });
  }

  function handleMakeDefault(m: PaymentMethodSummary) {
    mutation.mutate({ id: m.id, body: { isDefault: true } });
  }

  if (isLoading) {
    return (
      <p style={{ color: 'var(--text-3)', fontSize: 14 }}>
        Cargando medios de pago...
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h2
        style={{
          margin: 0,
          fontSize: 16,
          fontWeight: 600,
          color: 'var(--text-1)',
        }}
      >
        Medios de pago
      </h2>

      <div className="pk-card" style={{ overflow: 'hidden' }}>
        {medios.map((medio, i) => (
          <div
            key={medio.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '14px 20px',
              borderBottom:
                i < medios.length - 1 ? '1px solid var(--border-soft)' : 'none',
            }}
          >
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                minWidth: 0,
              }}
            >
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--text-1)',
                }}
              >
                {medio.name}
              </span>
              {medio.isDefault && <Badge variant="brand">Por defecto</Badge>}
              {!medio.isDefault && medio.enabled && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleMakeDefault(medio)}
                  disabled={mutation.isPending}
                >
                  Hacer predeterminado
                </Button>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
                {medio.enabled ? 'Activo' : 'Inactivo'}
              </span>
              <Switch
                checked={medio.enabled}
                onChange={() => handleToggleEnabled(medio)}
                aria-label={`Toggle ${medio.name}`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

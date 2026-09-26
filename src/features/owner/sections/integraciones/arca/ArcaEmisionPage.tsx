import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from '../../../../../shared/components/ui/Alert';
import { Button } from '../../../../../shared/components/ui/Button';
import { Card } from '../../../../../shared/components/ui/Card';
import { Input } from '../../../../../shared/components/ui/Input';
import { IconAlert } from '../../../../../shared/components/icons';
import { SectionHeader } from '../../../../../shared/components/SectionHeader';
import { useToast } from '../../../../../lib/notifications/ToastProvider';
import { translateApiError } from '../../../../../lib/api/translate';
import { useSucursal } from '../../../context/SucursalContext';
import {
  arcaAccountQueryKey,
  useArcaAccount,
} from '../../../hooks/useArcaAccount';
import { updateArcaAccount } from '../../../services/arca';
import {
  listPaymentMethods,
  togglePaymentMethod,
  type PaymentMethodInvoiceMode,
} from '../../../services/entities';
import {
  buildInvoiceModeDraft,
  describeInvoiceEffect,
  didIvaRateChange,
  diffInvoiceModes,
  type InvoiceModeDraft,
} from './emision';

const PAYMENT_METHODS_QUERY_KEY = (tenantId: string) => [
  'payment-methods',
  tenantId,
];

const TH_STYLE: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--text-3)',
};

const TD_STYLE: React.CSSProperties = {
  padding: '8px 10px',
  color: 'var(--text-1)',
};

/**
 * "Configurar emisión": qué medios de pago facturan automáticamente al
 * cobrar, y la alícuota de IVA a usar. Sólo tiene sentido con ARCA `linked`:
 * en cualquier otro estado se manda al wizard en vez de mostrar la tabla.
 */
export function ArcaEmisionPage() {
  const { showToast } = useToast();
  const { sucursalId, sucursal } = useSucursal();
  const queryClient = useQueryClient();
  const canManage = sucursal?.role === 'owner';

  const arcaQuery = useArcaAccount(sucursalId);
  const account = arcaQuery.data ?? null;

  const methodsQuery = useQuery({
    queryKey: PAYMENT_METHODS_QUERY_KEY(sucursalId),
    queryFn: () => listPaymentMethods(sucursalId),
    enabled: Boolean(sucursalId) && account?.status === 'linked',
  });

  const [draft, setDraft] = useState<InvoiceModeDraft | null>(null);
  const [ivaRateDraft, setIvaRateDraft] = useState('');

  // Se resincroniza cada vez que llega una lista nueva del servidor, igual
  // que `ConfigPerfil`: al guardar se invalida la query y el borrador vuelve
  // a quedar en sincro con lo que el backend confirmó.
  useEffect(() => {
    if (methodsQuery.data) setDraft(buildInvoiceModeDraft(methodsQuery.data));
  }, [methodsQuery.data]);

  useEffect(() => {
    if (account) setIvaRateDraft(String(account.ivaRate));
  }, [account]);

  function invalidate() {
    void queryClient.invalidateQueries({
      queryKey: PAYMENT_METHODS_QUERY_KEY(sucursalId),
    });
    void queryClient.invalidateQueries({
      queryKey: arcaAccountQueryKey(sucursalId),
    });
  }

  const isResponsableInscripto =
    account?.condicionIva === 'responsable_inscripto';

  const saveMutation = useMutation({
    mutationFn: async () => {
      const methods = methodsQuery.data ?? [];
      const changes = diffInvoiceModes(methods, draft ?? {});
      for (const change of changes) {
        await togglePaymentMethod(sucursalId, change.id, {
          invoiceMode: change.invoiceMode,
        });
      }
      if (
        account &&
        isResponsableInscripto &&
        didIvaRateChange(account.ivaRate, ivaRateDraft)
      ) {
        await updateArcaAccount(sucursalId, { ivaRate: Number(ivaRateDraft) });
      }
    },
    onSuccess: () => {
      invalidate();
      showToast({
        message: 'Guardamos la configuración de emisión.',
        kind: 'success',
      });
    },
    onError: (error) =>
      showToast({
        message: translateApiError(error, { endpoint: 'entities.payment' }),
        kind: 'error',
      }),
  });

  function setMode(id: string, mode: PaymentMethodInvoiceMode) {
    setDraft((prev) => ({ ...prev, [id]: mode }));
  }

  const header = (
    <SectionHeader
      title="Configurar emisión"
      subtitle="Elegí qué medios de pago facturan automáticamente al cobrar."
    />
  );

  if (arcaQuery.isLoading) {
    return (
      <div>
        {header}
        <div className="pk-card pk-card-pad" style={{ minHeight: 160 }}>
          <p style={{ color: 'var(--text-3)', fontSize: 14 }}>Cargando...</p>
        </div>
      </div>
    );
  }

  if (arcaQuery.isError) {
    return (
      <div>
        {header}
        <Alert
          variant="err"
          icon={<IconAlert size={16} />}
          title="No pudimos consultar tu integración con ARCA"
          description={translateApiError(arcaQuery.error, {
            endpoint: 'arca.getAccount',
          })}
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void arcaQuery.refetch()}
            >
              Reintentar
            </Button>
          }
        />
      </div>
    );
  }

  if (account === null || account.status !== 'linked') {
    return (
      <div>
        {header}
        <Alert
          variant="warn"
          icon={<IconAlert size={16} />}
          title="Todavía no tenés ARCA vinculada"
          description="Vinculá ARCA para poder elegir qué medios de pago facturan automáticamente."
          action={
            <Link
              to="../integraciones/arca/vincular"
              className="pk-btn pk-btn-primary pk-btn-sm"
              style={{ textDecoration: 'none' }}
            >
              Ir al wizard
            </Link>
          }
        />
      </div>
    );
  }

  const methods = (methodsQuery.data ?? []).filter((m) => m.enabled);
  const allSelected =
    methods.length > 0 &&
    methods.every((m) => (draft?.[m.id] ?? m.invoiceMode) !== 'none');

  function toggleSelectAll() {
    if (!draft) return;
    const next: InvoiceModeDraft = { ...draft };
    for (const m of methods) {
      if (allSelected) {
        // Se destilda todo: cada medio deja de facturar.
        next[m.id] = 'none';
      } else if (next[m.id] === 'none') {
        // Se marca todo: los que estaban apagados arrancan en automática, y
        // los que ya tenían un modo elegido (auto/manual) lo conservan.
        next[m.id] = 'auto';
      }
    }
    setDraft(next);
  }

  const facturaLetra = isResponsableInscripto
    ? 'Factura B a consumidor final'
    : 'Factura C';

  return (
    <div>
      {header}

      <Card padding="lg">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              lineHeight: 1.55,
              color: 'var(--text-2)',
            }}
          >
            Con tu condición frente al IVA (
            {isResponsableInscripto
              ? 'Responsable Inscripto'
              : 'Monotributo/Exento'}
            ), al cobrar se emite automáticamente{' '}
            <strong>{facturaLetra}</strong>.
          </p>

          {methodsQuery.isLoading || !draft ? (
            <p style={{ color: 'var(--text-3)', fontSize: 14 }}>
              Cargando medios de pago...
            </p>
          ) : methods.length === 0 ? (
            <p style={{ color: 'var(--text-3)', fontSize: 14 }}>
              No hay medios de pago habilitados en esta sede.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: 13,
                }}
              >
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-soft)' }}>
                    <th style={TH_STYLE}>
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        disabled={!canManage || saveMutation.isPending}
                        aria-label="Seleccionar todos"
                      />
                    </th>
                    <th style={TH_STYLE}>Medio de pago</th>
                    <th style={TH_STYLE}>Modo</th>
                    <th style={TH_STYLE}>Qué pasa al cobrar</th>
                  </tr>
                </thead>
                <tbody>
                  {methods.map((m) => {
                    const mode = draft[m.id] ?? m.invoiceMode;
                    const checked = mode !== 'none';
                    return (
                      <tr
                        key={m.id}
                        style={{ borderBottom: '1px solid var(--border-soft)' }}
                      >
                        <td style={TD_STYLE}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setMode(m.id, checked ? 'none' : 'auto')
                            }
                            disabled={!canManage || saveMutation.isPending}
                            aria-label={`Facturar con ${m.name}`}
                          />
                        </td>
                        <td style={TD_STYLE}>{m.name}</td>
                        <td style={TD_STYLE}>
                          {checked ? (
                            <select
                              className="pk-input"
                              value={mode}
                              onChange={(e) =>
                                setMode(
                                  m.id,
                                  e.target.value as PaymentMethodInvoiceMode,
                                )
                              }
                              disabled={!canManage || saveMutation.isPending}
                            >
                              <option value="auto">Automática</option>
                              <option value="manual">Manual</option>
                            </select>
                          ) : (
                            <span style={{ color: 'var(--text-3)' }}>—</span>
                          )}
                        </td>
                        <td style={{ ...TD_STYLE, color: 'var(--text-2)' }}>
                          {describeInvoiceEffect(mode)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {isResponsableInscripto && (
            <div style={{ maxWidth: 220 }}>
              <Input
                label="IVA (%)"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={ivaRateDraft}
                onChange={(e) => setIvaRateDraft(e.target.value)}
                disabled={!canManage || saveMutation.isPending}
              />
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: 12,
                  color: 'var(--text-3)',
                }}
              >
                Confirmalo con tu contador.
              </p>
            </div>
          )}

          {canManage && (
            <div>
              <Button
                variant="primary"
                loading={saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                Guardar
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

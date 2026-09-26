import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '../../../../shared/components/ui/Alert';
import { Badge } from '../../../../shared/components/ui/Badge';
import { Button } from '../../../../shared/components/ui/Button';
import { Card } from '../../../../shared/components/ui/Card';
import { ConfirmDialog } from '../../../../shared/components/ui/ConfirmDialog';
import { IconAlert, IconReceipt } from '../../../../shared/components/icons';
import { fmtDateTimeAr } from '../../../../shared/utils/fmt';
import type { ArcaAccount } from '../../services/arca';
import {
  ARCA_TAX_CONDITION_LABELS,
  formatArcaCertDate,
  formatCuit,
  type ArcaCardState,
} from './validation';

interface ArcaCardProps {
  /** Estado ya resuelto por `resolveArcaCardState`: la tarjeta sólo pinta. */
  state: ArcaCardState;
  /** La cuenta cruda, para los datos que el estado no lleva. */
  account: ArcaAccount | null;
  /** `false` para un operador: ve todo, no toca nada. */
  canManage: boolean;
  unlinking?: boolean;
  onUnlink: () => void;
}

const ROW: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 10,
};

const HINT: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  lineHeight: 1.55,
  color: 'var(--text-2)',
};

const LABEL: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--text-3)',
};

/**
 * La tarjeta de ARCA (facturación electrónica) en Integraciones, calcada de
 * `MercadoPagoCard`: no consulta nada, recibe el `ArcaCardState` que resolvió
 * la página y los callbacks. La lógica de "qué estado es éste" vive en
 * `validation.ts`.
 */
export function ArcaCard({
  state,
  account,
  canManage,
  unlinking = false,
  onUnlink,
}: ArcaCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const linkedLike =
    state.kind === 'linked' ||
    state.kind === 'expiring' ||
    state.kind === 'broken';

  // El mismo DELETE sirve para las dos cosas: desvincular una cuenta viva o
  // cancelar un wizard a medias (el backend no distingue, y tampoco hace
  // falta: en los dos casos el efecto es "no queda nada vinculado").
  const cancelling = state.kind === 'in_progress';

  return (
    <Card padding="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ ...ROW, justifyContent: 'space-between' }}>
          <div style={ROW}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                borderRadius: 'var(--r-md)',
                background: 'var(--brand-soft)',
                color: 'var(--brand)',
              }}
            >
              <IconReceipt size={20} />
            </span>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 600,
                  color: 'var(--text-1)',
                }}
              >
                Facturación electrónica (ARCA)
              </h2>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>
                Emití el comprobante automáticamente al cobrar
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {linkedLike && account?.environment === 'homologacion' && (
              <Badge variant="warn">Homologación</Badge>
            )}
            <StatusBadge state={state} />
          </div>
        </div>

        {state.kind === 'unlinked' && (
          <>
            <p style={HINT}>
              Vinculá el CUIT de tu estacionamiento con ARCA para emitir factura
              electrónica automáticamente al cobrar, sin pasar por el sitio de
              ARCA en cada cierre.
            </p>
            {canManage ? (
              <div style={ROW}>
                <Link
                  to="arca/vincular"
                  className="pk-btn pk-btn-primary"
                  style={{ textDecoration: 'none' }}
                >
                  Vincular mi cuenta con ARCA
                </Link>
              </div>
            ) : null}
          </>
        )}

        {state.kind === 'in_progress' && (
          <>
            <p style={HINT}>
              Empezaste a vincular ARCA pero quedó a medias. Continuá desde
              donde dejaste, o cancelá si te arrepentiste.
            </p>
            {canManage ? (
              <div style={ROW}>
                <Link
                  to="arca/vincular"
                  className="pk-btn pk-btn-primary"
                  style={{ textDecoration: 'none' }}
                >
                  Continuar
                </Link>
                <Button
                  variant="secondary"
                  loading={unlinking && cancelling}
                  onClick={() => setConfirmOpen(true)}
                >
                  Cancelar
                </Button>
              </div>
            ) : null}
          </>
        )}

        {linkedLike && account !== null && (
          <>
            {state.kind === 'expiring' && (
              <Alert
                variant="warn"
                icon={<IconAlert size={16} />}
                title={`Tu certificado vence el ${formatArcaCertDate(
                  account.certExpiresAt,
                )} (en ${state.daysLeft} ${
                  state.daysLeft === 1 ? 'día' : 'días'
                }).`}
                description="Renovalo para seguir facturando. Hasta que venza seguís facturando normal."
                action={canManage ? <RenewLink /> : undefined}
              />
            )}
            {state.kind === 'broken' && (
              <Alert
                variant="err"
                icon={<IconAlert size={18} />}
                title="La facturación está pausada: el certificado venció"
                description="Los cobros se siguen registrando normal, pero no se factura hasta que renueves el certificado."
                action={canManage ? <RenewLink /> : undefined}
              />
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 12,
              }}
            >
              <Field label="CUIT" value={formatCuit(account.cuit)} />
              <Field
                label="Razón social"
                value={account.razonSocial ?? 'Sin datos'}
              />
              <Field
                label="Condición frente al IVA"
                value={
                  account.condicionIva
                    ? ARCA_TAX_CONDITION_LABELS[account.condicionIva]
                    : 'Sin datos'
                }
              />
              <Field
                label="Punto de venta"
                value={
                  account.ptoVta !== null && account.ptoVta !== undefined
                    ? String(account.ptoVta)
                    : 'Sin datos'
                }
              />
              <Field
                label="Vinculada el"
                value={fmtDateTimeAr(account.linkedAt)}
              />
              <Field
                label="Vencimiento del certificado"
                value={
                  account.certExpiresAt
                    ? fmtDateTimeAr(account.certExpiresAt)
                    : 'No vence'
                }
              />
            </div>

            {canManage ? (
              <div style={ROW}>
                <Link
                  to="arca/emision"
                  className="pk-btn pk-btn-secondary"
                  style={{ textDecoration: 'none' }}
                >
                  Configurar
                </Link>
                <Button
                  variant="danger"
                  loading={unlinking && !cancelling}
                  onClick={() => setConfirmOpen(true)}
                >
                  Desvincular
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={cancelling ? '¿Cancelar la vinculación?' : '¿Desvincular ARCA?'}
        message={
          cancelling ? (
            <p style={{ margin: 0 }}>
              Se descarta lo que llevás cargado del wizard. Podés volver a
              empezar cuando quieras.
            </p>
          ) : (
            <>
              <p style={{ margin: 0 }}>
                Las facturas emitidas se conservan. Los cobros nuevos no se
                facturan.
              </p>
              <p style={{ margin: '16px 0 0', color: 'var(--text-3)' }}>
                Podés volver a vincular cuando quieras, pero vas a tener que
                generar un certificado nuevo.
              </p>
            </>
          )
        }
        confirmLabel={cancelling ? 'Cancelar vinculación' : 'Desvincular'}
        destructive
        loading={unlinking}
        onConfirm={() => {
          setConfirmOpen(false);
          onUnlink();
        }}
        onClose={() => setConfirmOpen(false)}
      />
    </Card>
  );
}

function RenewLink() {
  return (
    <Link
      to="arca/renovar"
      className="pk-btn pk-btn-primary pk-btn-sm"
      style={{ textDecoration: 'none' }}
    >
      Renovar certificado
    </Link>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ ...LABEL, margin: '0 0 2px' }}>{label}</p>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--text-1)' }}>{value}</p>
    </div>
  );
}

function StatusBadge({ state }: { state: ArcaCardState }) {
  if (state.kind === 'broken') return <Badge variant="err">Vencido</Badge>;
  if (state.kind === 'in_progress') {
    return <Badge variant="warn">Vinculación en curso</Badge>;
  }
  if (state.kind === 'linked' || state.kind === 'expiring') {
    return <Badge variant="ok">Vinculada</Badge>;
  }
  return <Badge>Sin vincular</Badge>;
}

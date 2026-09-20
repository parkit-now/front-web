import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '../../../../shared/components/ui/Alert';
import { Badge } from '../../../../shared/components/ui/Badge';
import { Button } from '../../../../shared/components/ui/Button';
import { Card } from '../../../../shared/components/ui/Card';
import { ConfirmDialog } from '../../../../shared/components/ui/ConfirmDialog';
import {
  IconAlert,
  IconCheckCircle,
  IconDownload,
  IconExternalLink,
  IconMapPin,
  IconRefresh,
  IconMercadoPago,
} from '../../../../shared/components/icons';
import { fmtDateTimeAr } from '../../../../shared/utils/fmt';
import type { MpAccount } from '../../services/mercado-pago';
import type { MpCardState } from './validation';

interface MercadoPagoCardProps {
  /** Estado ya resuelto por `resolveMpCardState`: la tarjeta sólo pinta. */
  state: MpCardState;
  /** La cuenta cruda, para los datos que el estado no lleva (QR, fechas, ids). */
  account: MpAccount | null;
  /** `false` para un operador: ve todo, no toca nada. */
  canManage: boolean;
  linking?: boolean;
  unlinking?: boolean;
  resyncing?: boolean;
  onLink: () => void;
  onUnlink: () => void;
  onResync: () => void;
}

const BROKEN_COPY: Record<'token_expired' | 'revoked', string> = {
  token_expired:
    'Se venció el permiso que le diste a Parkit para cobrar en tu nombre. Es normal que pase cada tanto: volvé a vincular la cuenta y listo, no se pierde nada de lo que ya cobraste.',
  revoked:
    'Desde tu cuenta de Mercado Pago le quitaron el permiso a Parkit. Hasta que la vuelvas a vincular, el QR de la ventanilla no cobra.',
};

/**
 * Costos públicos de Mercado Pago para cobros con QR en Argentina.
 *
 * Es la landing de "Cobrar con QR" de mercadopago.com.ar: abierta, sin login y
 * con la tabla de costos por medio de pago (billetera, débito, crédito,
 * cuotas). Las otras candidatas no sirven: `/costos` y `/comisiones` devuelven
 * 200 pero con "La página que buscás ya no existe", y
 * `/costs-section/release-options` redirige al login de Mercado Pago, así que
 * un dueño que todavía no vinculó no ve nada.
 */
const MP_COSTS_URL =
  'https://www.mercadopago.com.ar/herramientas-para-vender/cobrar-con-qr';

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
 * La tarjeta de Mercado Pago en Integraciones.
 *
 * No consulta nada: recibe el `MpCardState` que resolvió la página y los
 * callbacks. Toda la lógica de "qué estado es éste" vive en `validation.ts`,
 * que se puede probar sin DOM.
 */
export function MercadoPagoCard({
  state,
  account,
  canManage,
  linking = false,
  unlinking = false,
  resyncing = false,
  onLink,
  onUnlink,
  onResync,
}: MercadoPagoCardProps) {
  const [confirmUnlink, setConfirmUnlink] = useState(false);

  const linkedLike = state.kind === 'linked' || state.kind === 'expiring';

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
                // Acá el isotipo identifica a la marca, no a una sección de
                // Parkit: va con el celeste de Mercado Pago en vez del azul
                // de la app. El icono hereda este `color` vía `currentColor`.
                background: 'var(--mp-brand-soft)',
                color: 'var(--mp-brand)',
              }}
            >
              <IconMercadoPago size={20} />
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
                Mercado Pago
              </h2>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>
                Cobrá con QR en la ventanilla
              </p>
            </div>
          </div>
          <StatusBadge state={state} />
        </div>

        {state.kind === 'address-incomplete' && (
          <>
            <Alert
              variant="warn"
              icon={<IconMapPin size={16} />}
              title="Completá la dirección de tu estacionamiento"
              description="Mercado Pago necesita la calle, la altura, la ciudad y la provincia para dar de alta tu sucursal. Cargalas y volvé acá para vincular."
              action={
                // `.pk-btn` no trae `text-decoration`: sin esto el link se
                // dibuja subrayado adentro del botón.
                <Link
                  to="../config"
                  className="pk-btn pk-btn-secondary pk-btn-sm"
                  style={{ textDecoration: 'none' }}
                >
                  Ir a Configuración
                </Link>
              }
            />
            <CostsLink />
            <div style={ROW}>
              <Button variant="primary" disabled>
                Vincular mi cuenta de Mercado Pago
              </Button>
            </div>
          </>
        )}

        {state.kind === 'unlinked' && (
          <>
            <p style={HINT}>
              Vinculá tu cuenta y generamos un QR para pegar en la ventanilla.
              Quien estaciona lo escanea, paga desde su celular y{' '}
              <strong>la plata le entra directo a tu cuenta</strong>: Parkit no
              toca el dinero, sólo registra el cobro en la caja del turno.
            </p>
            <CostsLink />
            {canManage ? (
              <div style={ROW}>
                <Button variant="primary" loading={linking} onClick={onLink}>
                  Vincular mi cuenta de Mercado Pago
                </Button>
              </div>
            ) : null}
          </>
        )}

        {state.kind === 'broken' && (
          <>
            <p style={HINT}>{BROKEN_COPY[state.reason]}</p>
            {canManage ? (
              <div style={ROW}>
                <Button variant="primary" loading={linking} onClick={onLink}>
                  Re-vincular mi cuenta
                </Button>
              </div>
            ) : null}
          </>
        )}

        {linkedLike && account !== null && (
          <>
            {state.kind === 'expiring' && (
              <Alert
                variant="info"
                icon={<IconRefresh size={16} />}
                title={`Tu vinculación vence en ${state.daysLeft} ${
                  state.daysLeft === 1 ? 'día' : 'días'
                }.`}
                description="Se renueva sola la próxima vez que cobres. No tenés que hacer nada."
              />
            )}

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 24,
                alignItems: 'flex-start',
              }}
            >
              <div style={{ display: 'grid', gap: 12, minWidth: 220 }}>
                <div>
                  <p style={{ ...LABEL, margin: '0 0 2px' }}>
                    Cuenta de Mercado Pago
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      color: 'var(--text-1)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {account.mpUserId}
                  </p>
                </div>
                <div>
                  <p style={{ ...LABEL, margin: '0 0 2px' }}>Vinculada el</p>
                  <p
                    style={{ margin: 0, fontSize: 14, color: 'var(--text-1)' }}
                  >
                    {fmtDateTimeAr(account.linkedAt)}
                  </p>
                </div>
              </div>

              <QrBlock
                account={account}
                canManage={canManage}
                resyncing={resyncing}
                onResync={onResync}
              />
            </div>

            {canManage ? (
              <div style={ROW}>
                <Button
                  variant="danger"
                  loading={unlinking}
                  onClick={() => setConfirmUnlink(true)}
                >
                  Desvincular
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmUnlink}
        title="¿Desvincular Mercado Pago?"
        message="Se da de baja el QR de la ventanilla y dejás de poder cobrar con Mercado Pago desde Parkit. Lo que ya cobraste queda como está. Podés volver a vincular cuando quieras, pero se genera un QR nuevo y vas a tener que imprimirlo de nuevo."
        confirmLabel="Sí, desvincular"
        destructive
        loading={unlinking}
        onConfirm={() => {
          setConfirmUnlink(false);
          onUnlink();
        }}
        onClose={() => setConfirmUnlink(false)}
      />
    </Card>
  );
}

/**
 * "Saber más sobre costos y comisiones", como link secundario.
 *
 * Va deliberadamente en texto y no con `.pk-btn`: al lado del botón primario
 * de vincular, dos cajas compitiendo mandan señales cruzadas. Acá el dueño
 * está decidiendo, no ejecutando.
 *
 * El subrayado se pone a mano porque `parkit.css` arranca con
 * `a { text-decoration: none }`: sin esto el link no se distingue de un
 * párrafo.
 */
function CostsLink() {
  return (
    <a
      href={MP_COSTS_URL}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 6,
        fontSize: 13,
        fontWeight: 500,
        color: 'var(--text-2)',
        textDecoration: 'underline',
        textDecorationColor: 'var(--border)',
        textUnderlineOffset: 3,
      }}
    >
      Saber más sobre costos y comisiones
      <IconExternalLink size={13} />
    </a>
  );
}

function StatusBadge({ state }: { state: MpCardState }) {
  if (state.kind === 'broken') {
    return <Badge variant="err">Desconectada</Badge>;
  }
  if (state.kind === 'linked' || state.kind === 'expiring') {
    return <Badge variant="ok">Vinculada</Badge>;
  }
  return <Badge>Sin vincular</Badge>;
}

/**
 * El QR y su PDF para imprimir.
 *
 * `qrImageUrl` puede venir en `null` con la cuenta perfectamente vinculada: el
 * backend responde `MP_POS_CREATE_FAILED` cuando el alta del punto de venta se
 * cae después del OAuth. Por eso hay fallback con resync y no un `<img>` pelado.
 */
function QrBlock({
  account,
  canManage,
  resyncing,
  onResync,
}: {
  account: MpAccount;
  canManage: boolean;
  resyncing: boolean;
  onResync: () => void;
}) {
  if (!account.qrImageUrl) {
    return (
      <div style={{ flex: '1 1 260px', minWidth: 240 }}>
        <Alert
          variant="warn"
          icon={<IconAlert size={16} />}
          title="Todavía no tenemos tu QR"
          description="La cuenta quedó vinculada pero Mercado Pago no nos devolvió el código para imprimir. Probá sincronizarlo de nuevo."
          action={
            canManage ? (
              <Button
                variant="secondary"
                size="sm"
                loading={resyncing}
                icon={<IconRefresh size={14} />}
                onClick={onResync}
              >
                Reintentar sincronización
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div
      style={{
        flex: '1 1 260px',
        minWidth: 240,
        display: 'flex',
        gap: 16,
        alignItems: 'flex-start',
      }}
    >
      <img
        src={account.qrImageUrl}
        alt="Código QR de Mercado Pago de tu estacionamiento"
        width={128}
        height={128}
        style={{
          width: 128,
          height: 128,
          objectFit: 'contain',
          background: '#fff',
          borderRadius: 'var(--r-md)',
          border: '1px solid var(--border-soft)',
          padding: 8,
          flexShrink: 0,
        }}
      />
      <div style={{ display: 'grid', gap: 10, minWidth: 0 }}>
        <p style={HINT}>
          Imprimí el QR y pegalo en la ventanilla, a la vista. El cliente lo
          escanea con su celular, escribe el monto que le pasás y paga.
        </p>
        {account.qrTemplateDocumentUrl ? (
          <div style={ROW}>
            <a
              href={account.qrTemplateDocumentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="pk-btn pk-btn-secondary pk-btn-sm"
              style={{ textDecoration: 'none' }}
            >
              <IconDownload size={14} />
              Descargar PDF para imprimir
            </a>
          </div>
        ) : (
          <p style={{ ...HINT, color: 'var(--text-3)' }}>
            El PDF para imprimir todavía no está disponible. Guardá la imagen
            del QR mientras tanto.
          </p>
        )}
        <p
          style={{
            ...HINT,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: 'var(--text-3)',
          }}
        >
          <IconCheckCircle size={14} />
          El dinero va directo a tu cuenta de Mercado Pago.
        </p>
      </div>
    </div>
  );
}

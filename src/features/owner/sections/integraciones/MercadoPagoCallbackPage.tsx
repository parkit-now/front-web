import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../../shared/components/ui/Button';
import { Spinner } from '../../../../shared/components/ui/Spinner';
import { translateApiError } from '../../../../lib/api/translate';
import {
  completeMpOauth,
  type MpOauthCallback,
  type MpOauthCallbackResult,
} from '../../services/mercado-pago';

/**
 * Cierre del OAuth de Mercado Pago.
 *
 * ⚠️ La ruta es `/integraciones/mercadopago/callback`, top-level y con
 * `mercadopago` SIN guion. No sigue la convención del resto del panel a
 * propósito: tiene que coincidir carácter por carácter con el `redirect_uri`
 * registrado en la aplicación de Mercado Pago. Cambiarla rompe la vinculación
 * en producción y el error que devuelve Mercado Pago no dice por qué.
 */
export const MP_CALLBACK_PATH = '/integraciones/mercadopago/callback';

/** A dónde volver cuando el backend no guardó un `returnPath`. */
const DEFAULT_RETURN_PATH = '/app/integraciones';

const MISSING_PARAMS_MESSAGE =
  'El enlace de vuelta de Mercado Pago no trae los datos de la vinculación. Volvé a Integraciones y empezá de nuevo.';

function readOauthParamsFromUrl(): MpOauthCallback | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  if (!code || !state) return null;
  return { code, state };
}

/**
 * La lectura y la limpieza de la URL van a NIVEL DE MÓDULO, fuera del
 * componente, igual que el token de reset en `features/auth/AuthPage.tsx`.
 *
 * Dos razones: el `code` desaparece de la barra de direcciones antes del
 * primer render (no queda en el historial ni en una captura), y los valores
 * sobreviven al doble montaje de StrictMode, que si no leería una query string
 * ya borrada en el segundo montaje.
 */
const initialOauthParams = readOauthParamsFromUrl();
if (initialOauthParams && typeof window !== 'undefined') {
  window.history.replaceState({}, '', MP_CALLBACK_PATH);
}

/**
 * El `state` se consume de forma ATÓMICA en el backend: el segundo POST con el
 * mismo `state` responde 400 `MP_OAUTH_STATE_INVALID`. El doble montaje de
 * StrictMode dispararía exactamente eso, así que la promesa se cachea a nivel
 * de módulo y los dos montajes se cuelgan del mismo viaje.
 */
let exchange: Promise<MpOauthCallbackResult> | null = null;

function exchangeOnce(params: MpOauthCallback): Promise<MpOauthCallbackResult> {
  exchange ??= completeMpOauth(params);
  return exchange;
}

export function MercadoPagoCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(
    initialOauthParams ? null : MISSING_PARAMS_MESSAGE,
  );

  useEffect(() => {
    if (!initialOauthParams) return;

    let alive = true;
    exchangeOnce(initialOauthParams)
      .then((result) => {
        if (!alive) return;
        void navigate(result.returnPath ?? DEFAULT_RETURN_PATH, {
          replace: true,
        });
      })
      .catch((cause: unknown) => {
        if (!alive) return;
        // No se reintenta: el `state` ya se consumió, un segundo intento choca
        // con `MP_OAUTH_STATE_INVALID` igual. Se vuelve a empezar el flujo.
        setError(
          translateApiError(cause, { endpoint: 'mercadoPago.oauthCallback' }),
        );
      });

    return () => {
      alive = false;
    };
  }, [navigate]);

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand-lockup">
          <div className="brand-badge" aria-hidden="true">
            <img src="/logo.jpeg" alt="" />
          </div>
          <h1>Parkit</h1>
        </div>

        {error === null ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Spinner size={20} />
            <div>
              <h2>Vinculando tu cuenta de Mercado Pago…</h2>
              <p className="muted">
                Estamos creando tu punto de venta y generando el QR. No cierres
                esta pestaña.
              </p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <h2>No pudimos completar la vinculación</h2>
              <p className="muted">{error}</p>
            </div>
            <div>
              <Button
                variant="primary"
                onClick={() =>
                  void navigate(DEFAULT_RETURN_PATH, { replace: true })
                }
              >
                Volver a Integraciones
              </Button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

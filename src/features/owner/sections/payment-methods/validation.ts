import type { MpAccountStatus } from '../../services/mercado-pago';
import type { PaymentMethodType } from '../../services/entities';

/**
 * Lógica pura de los medios de pago respaldados por una integración.
 *
 * Vive separada del componente (y con tests colocalizados) por la misma razón
 * que `sections/tasas/validation.ts` y `sections/integraciones/validation.ts`:
 * decidir si el interruptor se puede tocar no necesita ni DOM ni red, y si se
 * rompe lo hace en silencio.
 */

/**
 * Los tipos de medio de pago que NO los crea una persona: los crea (y los
 * apaga) una integración con un tercero.
 *
 * Hoy es uno solo. Vive acá igual, y no inline en el panel, para que sumar el
 * segundo sea agregar una línea y no salir a buscar `=== 'mercadopago_qr'`
 * desparramado por la UI.
 *
 * Mismo nombre y misma forma que `INTEGRATION_BACKED_TYPES` del desktop
 * (`front-desktop/src/features/payment-methods/paymentMethodUtils.ts`): son
 * repos distintos y no se pueden importar entre sí, pero quien lea los dos
 * tiene que reconocer el patrón sin tener que deducirlo.
 */
export const INTEGRATION_BACKED_TYPES: readonly PaymentMethodType[] = [
  'mercadopago_qr',
];

/** Si este medio lo administra una integración y no una persona. */
export function isIntegrationBacked(type: PaymentMethodType): boolean {
  return INTEGRATION_BACKED_TYPES.includes(type);
}

export interface PaymentMethodLock {
  /** Si el medio lo respalda una integración con un tercero. */
  integrationBacked: boolean;
  /** Si el dueño NO puede prender ni apagar el medio desde esta pantalla. */
  toggleLocked: boolean;
}

/**
 * Si el dueño puede tocar el interruptor de un medio de pago.
 *
 * La regla, en una línea: un medio integrado sólo se puede prender o apagar
 * mientras la cuenta que lo respalda siga viva.
 *
 * POR QUÉ NO ES SIEMPRE EDITABLE
 * Con la cuenta caída, `enabled: true` sobre "Mercado Pago QR" no habilita
 * nada: el operario ve la opción en el modal de egreso, la elige, y el QR no
 * cobra con el cliente parado en la ventanilla. El camino para arreglarlo no
 * es este interruptor, es volver a vincular en Integraciones.
 *
 * POR QUÉ NO ES SIEMPRE BLOQUEADO
 * Con la cuenta vinculada sí es una decisión del dueño: es su playa y puede
 * elegir no cobrar con QR este mes. Ahí el interruptor hace exactamente lo que
 * promete.
 *
 * `token_expired` y `revoked` NO cuentan como vinculada: en los dos casos el
 * QR está muerto hasta que alguien vuelva a autorizar.
 *
 * `accountStatus: null` es el camino feliz de una playa que nunca vinculó
 * nada (el backend responde 404 `MP_NOT_LINKED`), no un error.
 *
 * Los medios comunes (`cash`, `transfer`, `other`) no miran la cuenta: nunca
 * dependieron de Mercado Pago y no van a empezar ahora.
 */
export function resolvePaymentMethodLock(input: {
  type: PaymentMethodType;
  accountStatus: MpAccountStatus | null;
}): PaymentMethodLock {
  const integrationBacked = isIntegrationBacked(input.type);
  return {
    integrationBacked,
    toggleLocked: integrationBacked && input.accountStatus !== 'linked',
  };
}

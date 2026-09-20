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
  /**
   * Si el dueño NO puede PRENDER el medio desde esta pantalla.
   *
   * Sólo prender. Apagar no se bloquea nunca y por eso no tiene campo acá: ver
   * "POR QUÉ APAGAR NO SE BLOQUEA" abajo.
   */
  enableLocked: boolean;
  /** Si el dueño NO puede marcarlo como predeterminado. */
  setDefaultLocked: boolean;
}

/**
 * Qué le podés hacer a un medio de pago según la cuenta que lo respalda.
 *
 * La regla, en una línea: un medio integrado sólo se puede PONER en
 * circulación —prenderlo o dejarlo preseleccionado— mientras la cuenta que lo
 * respalda siga viva. Sacarlo de circulación siempre se puede.
 *
 * POR QUÉ PRENDER SE BLOQUEA
 * Con la cuenta caída, `enabled: true` sobre "Mercado Pago QR" no habilita
 * nada: el operario ve la opción en el modal de egreso, la elige, y el QR no
 * cobra con el cliente parado en la ventanilla. El camino para arreglarlo no
 * es este interruptor, es volver a vincular en Integraciones.
 *
 * POR QUÉ MARCAR PREDETERMINADO TAMBIÉN
 * Es la misma puerta con otro cartel, y encima peor: el predeterminado llega
 * PRESELECCIONADO al modal de egreso. Un QR muerto elegido por defecto es
 * exactamente el estado que `enableLocked` existe para evitar, alcanzado sin
 * tocar el interruptor.
 *
 * POR QUÉ APAGAR NO SE BLOQUEA
 * Es la salida de emergencia del dueño. Si la integración se rompió, sacar el
 * medio de la pantalla de cobro es justo lo que necesita hacer, y es lo único
 * que todavía tiene efecto real. Bloquearlo lo encerraría en el estado roto.
 * El backend piensa igual: `togglePaymentMethod` sólo exige la cuenta
 * vinculada cuando `enabled === true`.
 *
 * POR QUÉ RENOMBRAR TAMPOCO
 * Es cosmético: no pone ni saca nada de circulación.
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
  // Las dos puertas que ponen el medio en circulación se cierran con la misma
  // llave. Van en campos separados igual que decisiones distintas: quien lea
  // el panel tiene que ver POR QUÉ se apaga cada control, no deducirlo de un
  // booleano que se llama como ninguno de los dos.
  const accountDown = integrationBacked && input.accountStatus !== 'linked';
  return {
    integrationBacked,
    enableLocked: accountDown,
    setDefaultLocked: accountDown,
  };
}

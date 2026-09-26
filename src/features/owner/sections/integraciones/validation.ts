import {
  addressFromLocation,
  missingAddressFields,
  type EntityAddress,
} from '../../../../shared/components/AddressPicker/addressUtils';
import type { MpAccount } from '../../services/mercado-pago';
import type { ArcaAccount } from '../../services/arca';

/**
 * Lógica pura de la tarjeta de Mercado Pago: de la cuenta cruda del backend al
 * estado que la UI tiene que pintar.
 *
 * Vive separada del componente (y con tests colocalizados) por la misma razón
 * que `sections/tasas/validation.ts`: la precedencia entre "rota", "sin
 * dirección" y "por vencer" se rompe en silencio, y probarla no necesita ni
 * DOM ni red.
 */

/** Estado visual de la tarjeta de integración. */
export type MpCardState =
  | { kind: 'address-incomplete' }
  | { kind: 'unlinked' }
  | { kind: 'linked' }
  | { kind: 'expiring'; daysLeft: number }
  | { kind: 'broken'; reason: 'token_expired' | 'revoked' };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** A partir de acá avisamos que la vinculación está por vencer. */
export const MP_EXPIRING_THRESHOLD_DAYS = 30;

/**
 * Días que faltan para que venza el access token, redondeados HACIA ARRIBA y
 * con piso en 0.
 *
 * Hacia arriba porque "vence en 0 días" cuando todavía quedan 18 horas es
 * mentira: el dueño puede seguir cobrando hoy. El piso en 0 cubre el token ya
 * vencido, que igual se muestra (el estado `expiring` no depende de que el
 * backend ya lo haya marcado `token_expired`).
 */
export function daysUntil(isoDate: string, now: Date): number | null {
  const expiresAt = new Date(isoDate).getTime();
  if (Number.isNaN(expiresAt)) return null;
  return Math.max(0, Math.ceil((expiresAt - now.getTime()) / MS_PER_DAY));
}

/**
 * Si la dirección declarada del estacionamiento alcanza para vincular.
 *
 * REUTILIZA `missingAddressFields` del `AddressPicker` en vez de definir otra
 * lista de campos obligatorios: la regla ya existe, la usan el wizard de
 * onboarding (`features/onboarding/validation.ts`) y la revisión del admin
 * (`admin/sections/solicitudes`), y el backend la espeja en
 * `src/entities/tenant-address.ts` (`missingDeclaredAddressFields`). Una
 * segunda definición acá se desincronizaría con las otras tres y el aviso
 * diría "completá la dirección" sobre una dirección que Perfil da por buena.
 *
 * `addressFromLocation` con el `address` de una línea como fallback es el
 * mismo mapeo que hace la pestaña Perfil (`config/ConfigPerfil.tsx`): los
 * tenants viejos tienen `location` con todo en `null`.
 */
export function isAddressComplete(
  entity:
    | {
        location?: Partial<EntityAddress> | null;
        address?: string | null;
      }
    | null
    | undefined,
): boolean {
  if (!entity) return false;
  const value = addressFromLocation(entity.location, entity.address);
  return missingAddressFields(value).length === 0;
}

/**
 * Resuelve qué mostrar en la tarjeta de Integraciones.
 *
 * Precedencia, en este orden:
 *  1. `broken` gana sobre TODO. Si la conexión ya se rompió, avisar de la
 *     dirección es ruido: el dueño no puede cobrar con QR ahora mismo.
 *  2. Sin cuenta y sin dirección completa → `address-incomplete`: Mercado Pago
 *     exige la dirección para crear la sucursal, así que el botón de vincular
 *     fallaría con un 422 (`MP_ENTITY_ADDRESS_INCOMPLETE`).
 *  3. Sin cuenta → `unlinked`.
 *  4. Token por vencer (menos de 30 días) → `expiring`.
 *  5. Todo en orden → `linked`.
 *
 * OJO con el camino 2/3: `account === null` es el camino feliz de una playa
 * nueva, no un error. El backend responde 404 `MP_NOT_LINKED` y quien consulta
 * lo traduce a `null` (ver `IntegracionesPage`).
 */
export function resolveMpCardState(input: {
  account: MpAccount | null;
  addressComplete: boolean;
  now?: Date;
}): MpCardState {
  const { account, addressComplete, now = new Date() } = input;

  if (account?.status === 'token_expired' || account?.status === 'revoked') {
    return { kind: 'broken', reason: account.status };
  }

  if (account === null) {
    return addressComplete
      ? { kind: 'unlinked' }
      : { kind: 'address-incomplete' };
  }

  const expiresAt = new Date(account.accessTokenExpiresAt).getTime();
  // Una fecha que no parsea no es motivo para asustar al dueño: la vinculación
  // funciona, el que está roto es el dato.
  if (!Number.isNaN(expiresAt)) {
    const msLeft = expiresAt - now.getTime();
    if (msLeft < MP_EXPIRING_THRESHOLD_DAYS * MS_PER_DAY) {
      return {
        kind: 'expiring',
        daysLeft: daysUntil(account.accessTokenExpiresAt, now) ?? 0,
      };
    }
  }

  return { kind: 'linked' };
}

// ── ARCA (facturación electrónica) ──────────────────────────────────────────

/** Estado visual de la tarjeta de ARCA en Integraciones. */
export type ArcaCardState =
  | { kind: 'unlinked' }
  | { kind: 'in_progress' }
  | { kind: 'linked' }
  | { kind: 'expiring'; daysLeft: number }
  | { kind: 'broken' };

/** A partir de acá avisamos que el certificado está por vencer. */
export const ARCA_CERT_EXPIRING_THRESHOLD_DAYS = 30;

/**
 * Resuelve qué mostrar en la tarjeta de ARCA, a partir de la cuenta cruda del
 * backend.
 *
 * Precedencia:
 *  1. Sin cuenta → `unlinked`. `null` es el camino feliz de una playa que
 *     nunca vinculó (o se desvinculó): el backend responde 404
 *     `ARCA_NOT_LINKED` y quien consulta lo traduce a `null` (ver
 *     `useArcaAccount`).
 *  2. `pending_certificate` / `pending_sales_point` → `in_progress`: el wizard
 *     se arrancó pero no terminó.
 *  3. `cert_expired`, o `linked` con `certExpiresAt` YA pasado → `broken`: no
 *     se puede emitir hasta renovar el certificado.
 *  4. `linked` con `certExpiresAt` a 30 días o menos → `expiring`.
 *  5. Resto → `linked`.
 */
export function resolveArcaCardState(
  account: ArcaAccount | null,
  now: Date = new Date(),
): ArcaCardState {
  if (account === null) return { kind: 'unlinked' };

  if (
    account.status === 'pending_certificate' ||
    account.status === 'pending_sales_point'
  ) {
    return { kind: 'in_progress' };
  }

  if (account.status === 'cert_expired') {
    return { kind: 'broken' };
  }

  if (account.certExpiresAt) {
    const expiresAt = new Date(account.certExpiresAt).getTime();
    if (!Number.isNaN(expiresAt)) {
      if (expiresAt <= now.getTime()) return { kind: 'broken' };

      const daysLeft = daysUntil(account.certExpiresAt, now) ?? 0;
      if (daysLeft <= ARCA_CERT_EXPIRING_THRESHOLD_DAYS) {
        return { kind: 'expiring', daysLeft };
      }
    }
  }

  return { kind: 'linked' };
}

const AR_DATE = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'America/Argentina/Buenos_Aires',
});

/** `dd/mm/aaaa` en hora argentina, para «Tu certificado vence el ...». */
export function formatArcaCertDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : AR_DATE.format(date);
}

/**
 * Faltan datos que van impresos en la factura (RG 1415, Anexo II): Ingresos
 * Brutos y fecha de inicio de actividades. Una cuenta vinculada antes de que
 * fueran obligatorios puede no tenerlos.
 */
export function isArcaInvoiceDataMissing(
  account: Pick<ArcaAccount, 'iibb' | 'inicioActividad'>,
): boolean {
  return !account.iibb?.trim() || !account.inicioActividad;
}

/** Mensaje del campo Ingresos Brutos, o `null` si está bien. */
export function validateArcaIibb(raw: string): string | null {
  return raw.trim()
    ? null
    : 'Ingresá tu número de Ingresos Brutos, o «Exento» si no estás inscripto';
}

/** Mensaje del campo inicio de actividades (AAAA-MM-DD), o `null`. */
export function validateArcaInicioActividad(raw: string): string | null {
  if (!raw) return 'Ingresá la fecha de inicio de actividades';
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? null : 'La fecha no es válida';
}

/** Condición frente al IVA, en castellano, para mostrar en la tarjeta y el wizard. */
export const ARCA_TAX_CONDITION_LABELS: Record<
  NonNullable<ArcaAccount['condicionIva']>,
  string
> = {
  responsable_inscripto: 'Responsable Inscripto',
  monotributo: 'Monotributo',
  exento: 'Exento',
};

/** CUIT de 11 dígitos formateado `20-12345678-3`, para mostrar (no para mandar). */
export function formatCuit(cuit: string): string {
  const digits = cuit.replace(/\D/g, '');
  if (digits.length !== 11) return cuit;
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
}

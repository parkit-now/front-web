import type { StaffMembership } from '../../services/staff';

/**
 * Qué se puede hacer con UNA membresía, y por qué no.
 *
 * `reason` es el texto del tooltip del control deshabilitado. Se omite cuando
 * el bloqueo es transitorio (todavía no sabemos cuántos dueños hay): no hay
 * nada que explicarle al usuario, sólo hay que no dejarlo apretar.
 */
export interface MembershipPermissions {
  canChangeRole: boolean;
  canRemove: boolean;
  reason?: string;
}

export const SELF_MANAGEMENT_REASON =
  'No podés cambiar ni eliminar tu propio rol. Pedíselo a otro dueño.';

export const LAST_OWNER_REASON =
  'Es el único dueño de esta sucursal. Nombrá otro antes de hacer este cambio.';

/**
 * Las dos reglas que la API impone y la UI anticipa, para deshabilitar el
 * control en vez de dejar que el usuario choque contra un 403/409:
 *
 * 1. **Nadie se gestiona a sí mismo** (`403 STAFF_SELF_MANAGEMENT`). Existe
 *    para que un dueño no se auto-degrade y pierda el acceso a su propia playa.
 *    Consecuencia: no existe "irme yo de esta sucursal", depende de otro dueño.
 * 2. **Siempre queda al menos un dueño** (`409 STAFF_LAST_OWNER`). Degradar o
 *    eliminar al único `owner` de una sucursal está prohibido.
 *
 * La segunda sólo aplica a membresías `owner`: a un `operator` se lo puede
 * tocar aunque la sucursal tenga un solo dueño, porque no es él.
 */
export function membershipPermissions(args: {
  memberId: string;
  currentUserId: string | null;
  membership: StaffMembership;
  /** `undefined` mientras el conteo está cargando. */
  ownerCount: number | undefined;
}): MembershipPermissions {
  const { memberId, currentUserId, membership, ownerCount } = args;

  if (currentUserId !== null && memberId === currentUserId) {
    return {
      canChangeRole: false,
      canRemove: false,
      reason: SELF_MANAGEMENT_REASON,
    };
  }

  if (membership.role === 'owner') {
    if (ownerCount === undefined) {
      // Sin el conteo no podemos afirmar que se puede: se bloquea sin explicar.
      return { canChangeRole: false, canRemove: false };
    }
    if (ownerCount <= 1) {
      return {
        canChangeRole: false,
        canRemove: false,
        reason: LAST_OWNER_REASON,
      };
    }
  }

  return { canChangeRole: true, canRemove: true };
}

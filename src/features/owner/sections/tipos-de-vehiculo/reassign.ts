import type { VehicleType } from '../../services/vehicle-types';

/**
 * A dónde van los vehículos del tipo que se borra.
 *
 * Es un union discriminado y no un id porque el modal NO crea nada por su
 * cuenta: la creación ocurre únicamente en el submit del padre. Si el usuario
 * elige "crear uno nuevo", tipea un nombre y cancela, no quedó basura.
 */
export type ReassignTarget =
  | { kind: 'existing'; id: string }
  | { kind: 'new'; name: string };

const NAME_MAX_LENGTH = 60;

/** Los tipos a los que se puede mover, ordenados por nombre. */
export function reassignTargets(
  types: VehicleType[],
  deletingId: string,
): VehicleType[] {
  return types
    .filter((t) => t.id !== deletingId)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

/** Misma normalización que el índice único del backend: lower + trim. */
function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Valida el destino elegido. Devuelve el mensaje de error, o `null` si sirve.
 *
 * El caso de un nombre repetido se chequea acá para no gastar un request: la
 * verdad la impone `vehicle_types_tenant_name_uidx`, que devuelve 409.
 */
export function validateReassignTarget(
  target: ReassignTarget | null,
  types: VehicleType[],
): string | null {
  if (!target) return 'Elegí a qué tipo mover los vehículos.';

  if (target.kind === 'existing') {
    return types.some((t) => t.id === target.id)
      ? null
      : 'Ese tipo ya no existe. Actualizá la lista y probá de nuevo.';
  }

  const name = target.name.trim();
  if (name.length === 0) return 'El nombre es obligatorio.';
  if (name.length > NAME_MAX_LENGTH) return 'Máximo 60 caracteres.';
  if (types.some((t) => normalizeName(t.name) === normalizeName(name))) {
    return 'Ya tenés un tipo con ese nombre.';
  }
  return null;
}

/** "1 vehículo usa" / "N vehículos usan". */
export function describeUsage(count: number): string {
  return count === 1
    ? '1 vehículo usa este tipo.'
    : `${count} vehículos usan este tipo.`;
}

/** Cuenta cuántos vehículos referencian cada tipo. */
export function countVehiclesByType(
  vehicles: { typeId: string }[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const v of vehicles) {
    counts.set(v.typeId, (counts.get(v.typeId) ?? 0) + 1);
  }
  return counts;
}

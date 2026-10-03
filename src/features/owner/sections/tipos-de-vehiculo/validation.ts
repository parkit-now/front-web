import type { VehicleCategory } from '../../services/vehicle-categories';
import type {
  UpdateVehicleTypeInput,
  VehicleType,
} from '../../services/vehicle-types';

export interface VehicleTypeFormState {
  name: string;
  /** Vacía hasta que la persona elige: el select no preselecciona nada. */
  category: VehicleCategory | '';
  accepted: boolean;
}

/** Lo que sale de una validación exitosa: la categoría ya es obligatoria. */
export interface VehicleTypePayload {
  name: string;
  category: VehicleCategory;
  accepted: boolean;
}

export type VehicleTypeFormErrors = Partial<
  Record<keyof VehicleTypeFormState, string>
>;

const NAME_MAX_LENGTH = 60;

export function emptyVehicleTypeForm(): VehicleTypeFormState {
  return { name: '', category: '', accepted: true };
}

export function vehicleTypeToForm(type: VehicleType): VehicleTypeFormState {
  return {
    name: type.name,
    category: type.category,
    accepted: type.accepted,
  };
}

/**
 * Habilita el submit sin pintar errores mientras el usuario tipea. Mide sobre
 * `.trim()`: si mirara `.length` a secas, tres espacios habilitarían el botón.
 */
export function canSubmitVehicleTypeForm(form: VehicleTypeFormState): boolean {
  const name = form.name.trim();
  return (
    name.length > 0 && name.length <= NAME_MAX_LENGTH && form.category !== ''
  );
}

/** Misma normalización que `vehicle_types_tenant_name_uidx`: lower + trim. */
function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function validateVehicleTypeForm(
  form: VehicleTypeFormState,
  ctx: { types: VehicleType[]; editingId: string | null },
): { errors: VehicleTypeFormErrors; payload?: VehicleTypePayload } {
  const errors: VehicleTypeFormErrors = {};
  const name = form.name.trim().replace(/\s+/g, ' ');

  if (name.length === 0) {
    errors.name = 'El nombre es obligatorio.';
  } else if (name.length > NAME_MAX_LENGTH) {
    errors.name = 'Máximo 60 caracteres.';
  } else {
    // UX, no la verdad: la impone el índice único, que devuelve 409.
    const clash = ctx.types.find(
      (t) =>
        t.id !== ctx.editingId && normalizeName(t.name) === normalizeName(name),
    );
    if (clash) errors.name = 'Ya tenés un tipo con ese nombre.';
  }

  if (form.category === '') errors.category = 'Elegí una categoría.';

  if (Object.keys(errors).length > 0 || form.category === '') {
    return { errors };
  }
  return {
    errors,
    payload: { name, category: form.category, accepted: form.accepted },
  };
}

/**
 * Solo lo que cambió: `{}` cuando no hay nada que guardar.
 *
 * Si la categoría la infirió el sistema (`categoryInferred`), se manda siempre:
 * confirmarla sin cambiarla es justamente lo que apaga el aviso "Revisá".
 */
export function diffVehicleTypeUpdate(
  payload: VehicleTypePayload,
  current: VehicleType,
): UpdateVehicleTypeInput {
  const body: UpdateVehicleTypeInput = {};
  if (payload.name !== current.name) body.name = payload.name;
  if (payload.category !== current.category || current.categoryInferred) {
    body.category = payload.category;
  }
  if (payload.accepted !== current.accepted) body.accepted = payload.accepted;
  return body;
}

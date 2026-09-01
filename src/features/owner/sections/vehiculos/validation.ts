import type { UpdateVehicleInput, Vehicle } from '../../services/vehicles';

export interface VehicleFormState {
  brand: string;
  model: string;
  /** Id del tipo. Vacío = todavía no eligió. */
  typeId: string;
}

export type VehicleFormErrors = Partial<Record<keyof VehicleFormState, string>>;

export interface VehicleFormPayload {
  brand: string;
  model: string;
  typeId: string;
}

const TEXT_MAX_LENGTH = 120;

export function emptyVehicleForm(): VehicleFormState {
  return { brand: '', model: '', typeId: '' };
}

export function vehicleToForm(vehicle: Vehicle): VehicleFormState {
  return {
    brand: vehicle.brand,
    model: vehicle.model,
    typeId: vehicle.typeId,
  };
}

/**
 * Habilita el submit sin llegar a pintar errores mientras el usuario tipea.
 *
 * Mide sobre `.trim()`: si mirara `.length` a secas, tres espacios habilitarían
 * el botón y el error recién aparecería al guardar.
 *
 * El tipo es obligatorio: borrar un tipo obliga a reasignar, así que un vehículo
 * nunca queda sin tipo. "Otro" es el balde para lo que no encaja.
 */
export function canSubmitVehicleForm(form: VehicleFormState): boolean {
  const brand = form.brand.trim();
  const model = form.model.trim();
  return (
    brand.length > 0 &&
    brand.length <= TEXT_MAX_LENGTH &&
    model.length > 0 &&
    model.length <= TEXT_MAX_LENGTH &&
    form.typeId !== ''
  );
}

/** Misma normalización que el índice único del backend: lower + trim. */
function normalizeKey(brand: string, model: string): string {
  return `${brand.trim().toLowerCase()}|${model.trim().toLowerCase()}`;
}

export function validateVehicleForm(
  form: VehicleFormState,
  ctx: { vehicles: Vehicle[]; editingId: string | null },
): { errors: VehicleFormErrors; payload?: VehicleFormPayload } {
  const errors: VehicleFormErrors = {};

  const brand = form.brand.trim();
  const model = form.model.trim();

  if (brand.length === 0) {
    errors.brand = 'La marca es obligatoria.';
  } else if (brand.length > TEXT_MAX_LENGTH) {
    errors.brand = 'Máximo 120 caracteres.';
  }

  if (model.length === 0) {
    errors.model = 'El modelo es obligatorio.';
  } else if (model.length > TEXT_MAX_LENGTH) {
    errors.model = 'Máximo 120 caracteres.';
  }

  if (form.typeId === '') {
    errors.typeId = 'Elegí un tipo de vehículo.';
  }

  // Chequeo de duplicados del lado del cliente: es UX, no la verdad. La verdad
  // la impone `vehicles_tenant_brand_model_uidx` en la base, que devuelve 409.
  // Sirve para no gastar un request y para avisar antes de que el usuario
  // cierre el modal.
  if (!errors.brand && !errors.model) {
    const key = normalizeKey(brand, model);
    const clash = ctx.vehicles.find(
      (v) => v.id !== ctx.editingId && normalizeKey(v.brand, v.model) === key,
    );
    if (clash) {
      errors.model = 'Ya tenés un vehículo con esa marca y modelo.';
    }
  }

  if (Object.keys(errors).length > 0) return { errors };

  return { errors, payload: { brand, model, typeId: form.typeId } };
}

/**
 * Solo los campos que cambiaron. Devuelve `{}` cuando no hay nada que guardar,
 * para no gastar un PATCH al pedo.
 *
 * `typesLoaded` existe por un caso concreto de pérdida de datos: si la lista de
 * tipos no cargó, el select queda vacío y un diff ingenuo mandaría un `typeId`
 * en blanco, borrándole el tipo a un vehículo que sí lo tenía. Cuando no cargó,
 * el tipo no se toca.
 */
export function diffVehicleUpdate(
  payload: VehicleFormPayload,
  current: Vehicle,
  typesLoaded = true,
): UpdateVehicleInput {
  const body: UpdateVehicleInput = {};
  if (payload.brand !== current.brand) body.brand = payload.brand;
  if (payload.model !== current.model) body.model = payload.model;
  if (typesLoaded && payload.typeId !== current.typeId) {
    body.typeId = payload.typeId;
  }
  return body;
}

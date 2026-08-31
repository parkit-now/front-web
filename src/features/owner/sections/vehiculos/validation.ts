import type {
  UpdateVehicleInput,
  Vehicle,
  VehicleType,
} from '../../services/vehicles';

/**
 * Espeja el enum `VehicleType` del backend. `camioneta` se quitó porque se
 * pisaba con `pickup` y con `suv` (una Hilux es las dos cosas). `bici` y
 * `camion` se sumaron: son categorías con plazas asignables
 * (`ServiceCode.VEHICLE_BICYCLE` / `VEHICLE_TRUCK`) que antes no se podían
 * expresar acá.
 */
export const VEHICLE_TYPE_OPTIONS: { value: VehicleType; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'moto', label: 'Moto' },
  { value: 'bici', label: 'Bicicleta' },
  { value: 'suv', label: 'SUV' },
  { value: 'pickup', label: 'Pickup' },
  { value: 'van', label: 'Utilitario' },
  { value: 'camion', label: 'Camión' },
  { value: 'otro', label: 'Otro' },
];

export const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  VEHICLE_TYPE_OPTIONS.map((o) => [o.value, o.label]),
);

export interface VehicleFormState {
  brand: string;
  model: string;
  /** Vacío = sin tipo especificado. */
  type: string;
}

export type VehicleFormErrors = Partial<Record<keyof VehicleFormState, string>>;

export interface VehicleFormPayload {
  brand: string;
  model: string;
  type?: VehicleType;
}

const TEXT_MAX_LENGTH = 120;

export function emptyVehicleForm(): VehicleFormState {
  return { brand: '', model: '', type: '' };
}

export function vehicleToForm(vehicle: Vehicle): VehicleFormState {
  return {
    brand: vehicle.brand,
    model: vehicle.model,
    type: vehicle.type ?? '',
  };
}

/**
 * Habilita el submit sin llegar a pintar errores mientras el usuario tipea.
 *
 * Mide sobre `.trim()`: si mirara `.length` a secas, tres espacios habilitarían
 * el botón y el error recién aparecería al guardar.
 */
export function canSubmitVehicleForm(form: VehicleFormState): boolean {
  const brand = form.brand.trim();
  const model = form.model.trim();
  return (
    brand.length > 0 &&
    brand.length <= TEXT_MAX_LENGTH &&
    model.length > 0 &&
    model.length <= TEXT_MAX_LENGTH
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

  // Chequeo de duplicados del lado del cliente: es UX, no la verdad. La verdad
  // la impone `vehicles_scope_brand_model_uidx` en la base, que devuelve 409.
  // Sirve para no gastar un request y para dar un mensaje más claro que el del
  // backend, sobre todo en el caso del catálogo global.
  if (!errors.brand && !errors.model) {
    const key = normalizeKey(brand, model);
    const clash = ctx.vehicles.find(
      (v) => v.id !== ctx.editingId && normalizeKey(v.brand, v.model) === key,
    );
    if (clash) {
      errors.model = clash.tenantId
        ? 'Ya tenés un vehículo con esa marca y modelo.'
        : `"${clash.brand} ${clash.model}" ya está en el catálogo global, no hace falta cargarlo.`;
    }
  }

  if (Object.keys(errors).length > 0) return { errors };

  return {
    errors,
    payload: {
      brand,
      model,
      type: form.type === '' ? undefined : (form.type as VehicleType),
    },
  };
}

/**
 * Solo los campos que cambiaron. Devuelve `{}` cuando no hay nada que guardar,
 * para no gastar un PATCH al pedo.
 *
 * `type` es el caso incómodo: sacarle el tipo a un vehículo que lo tenía es un
 * cambio real, pero `UpdateVehicleDto` no acepta `null`. Se manda `'otro'`, que
 * es el escape hatch del enum — el desktop directamente no permite volver a
 * "sin tipo" una vez elegido.
 */
export function diffVehicleUpdate(
  payload: VehicleFormPayload,
  current: Vehicle,
): UpdateVehicleInput {
  const body: UpdateVehicleInput = {};
  if (payload.brand !== current.brand) body.brand = payload.brand;
  if (payload.model !== current.model) body.model = payload.model;

  const currentType = current.type ?? undefined;
  if (payload.type !== currentType) {
    body.type = payload.type ?? 'otro';
  }
  return body;
}

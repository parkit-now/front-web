import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../../../shared/components/ui/Button';
import { Input } from '../../../../shared/components/ui/Input';
import { Modal } from '../../../../shared/components/ui/Modal';
import type { VehicleType } from '../../services/vehicle-types';
import type { Vehicle } from '../../services/vehicles';
import {
  canSubmitVehicleForm,
  emptyVehicleForm,
  validateVehicleForm,
  vehicleToForm,
  type VehicleFormErrors,
  type VehicleFormPayload,
  type VehicleFormState,
} from './validation';

const GRID_2: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 10,
};

interface VehicleFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Vehículo a editar, o null para dar de alta uno nuevo. */
  vehicle: Vehicle | null;
  /** Todos los del estacionamiento: se usan para detectar duplicados. */
  vehicles: Vehicle[];
  /**
   * Los tipos vivos del estacionamiento. Vienen por props y no de una query
   * propia porque la página ya los necesita para la columna Tipo: fetchearlos
   * dos veces sería absurdo, y así la lista llega tibia al abrir el modal.
   */
  types: VehicleType[];
  typesLoading: boolean;
  typesError: boolean;
  pending: boolean;
  onSubmit: (payload: VehicleFormPayload) => void;
}

export function VehicleFormModal({
  open,
  onClose,
  vehicle,
  vehicles,
  types,
  typesLoading,
  typesError,
  pending,
  onSubmit,
}: VehicleFormModalProps) {
  const isEdit = vehicle !== null;
  const [form, setForm] = useState<VehicleFormState>(emptyVehicleForm);
  const [errors, setErrors] = useState<VehicleFormErrors>({});

  useEffect(() => {
    if (!open) return;
    setForm(vehicle ? vehicleToForm(vehicle) : emptyVehicleForm());
    setErrors({});
    // `vehicles` queda fuera de las deps a propósito: solo se usa para detectar
    // duplicados al guardar, y un refetch de la lista no tiene que pisar lo que
    // el usuario tipeó.
  }, [open, vehicle]);

  function set<K extends keyof VehicleFormState>(key: K, value: string): void {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function handleSubmit(): void {
    const { errors: nextErrors, payload } = validateVehicleForm(form, {
      vehicles,
      editingId: vehicle?.id ?? null,
    });
    setErrors(nextErrors);
    if (payload) onSubmit(payload);
  }

  function handleKeyDown(event: React.KeyboardEvent): void {
    if (event.key === 'Enter' && canSubmitVehicleForm(form)) handleSubmit();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar vehículo' : 'Nuevo vehículo'}
      width={620}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            loading={pending}
            disabled={!canSubmitVehicleForm(form)}
            onClick={handleSubmit}
          >
            {pending
              ? 'Guardando...'
              : isEdit
                ? 'Guardar cambios'
                : 'Crear vehículo'}
          </Button>
        </>
      }
    >
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-2)' }}>
        {isEdit
          ? 'Esta edición usa control de versión para evitar pisar cambios concurrentes.'
          : 'El vehículo se agrega al catálogo de este estacionamiento.'}
      </p>

      <div style={GRID_2}>
        <Input
          id="vehicle-brand"
          placeholder="Marca (ej. Volkswagen)"
          value={form.brand}
          error={errors.brand}
          maxLength={120}
          autoFocus
          onChange={(e) => set('brand', e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Input
          id="vehicle-model"
          placeholder="Modelo (ej. Bora)"
          value={form.model}
          error={errors.model}
          maxLength={120}
          onChange={(e) => set('model', e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          marginTop: 12,
        }}
      >
        <label className="pk-label" htmlFor="vehicle-type">
          Tipo
        </label>
        {/* El select depende de una query, así que tiene estados que antes no
            existían. Ninguno bloquea el formulario: marca y modelo siguen
            editables, y una lista lenta no puede tomar de rehén al alta. */}
        <select
          id="vehicle-type"
          className="pk-input"
          value={form.typeId}
          disabled={pending || typesLoading || typesError || types.length === 0}
          onChange={(e) => set('typeId', e.target.value)}
        >
          {typesLoading && <option value="">Cargando tipos...</option>}
          {!typesLoading && typesError && (
            <option value="">No se pudieron cargar los tipos</option>
          )}
          {!typesLoading && !typesError && types.length === 0 && (
            <option value="">No hay tipos configurados</option>
          )}
          {!typesLoading && !typesError && types.length > 0 && (
            <>
              <option value="" disabled>
                Elegí un tipo
              </option>
              {types.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </>
          )}
        </select>
        {errors.typeId && <p className="field-error">{errors.typeId}</p>}
        {!typesLoading && !typesError && types.length === 0 && (
          <p style={{ margin: 0, fontSize: 12 }}>
            {/* Relativo: resuelve igual bajo /app y bajo /ops/estacionamientos. */}
            <Link to="../tipos-de-vehiculo">Crear tipos de vehículo</Link>
          </p>
        )}
      </div>
    </Modal>
  );
}

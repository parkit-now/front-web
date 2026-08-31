import { useEffect, useState, type CSSProperties } from 'react';
import { Button } from '../../../../shared/components/ui/Button';
import { Input } from '../../../../shared/components/ui/Input';
import { Modal } from '../../../../shared/components/ui/Modal';
import type { Vehicle } from '../../services/vehicles';
import {
  canSubmitVehicleForm,
  emptyVehicleForm,
  validateVehicleForm,
  vehicleToForm,
  VEHICLE_TYPE_OPTIONS,
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
  pending: boolean;
  onSubmit: (payload: VehicleFormPayload) => void;
}

export function VehicleFormModal({
  open,
  onClose,
  vehicle,
  vehicles,
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
          : 'El vehículo quedará disponible solo para este estacionamiento.'}
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
        <select
          id="vehicle-type"
          className="pk-input"
          value={form.type}
          disabled={pending}
          onChange={(e) => set('type', e.target.value)}
        >
          {/* El desktop no tiene esta opción, así que una vez elegido un tipo
              no hay forma de volver a "sin tipo". Acá sí. */}
          <option value="">Sin tipo especificado</option>
          {VEHICLE_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <p style={{ margin: '16px 0 0', fontSize: 12, color: 'var(--text-3)' }}>
        Los vehículos del catálogo global no se editan desde acá: los administra
        la plataforma y aparecen en todos los estacionamientos.
      </p>
    </Modal>
  );
}

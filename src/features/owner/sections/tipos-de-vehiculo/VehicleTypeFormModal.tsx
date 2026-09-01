import { useEffect, useState } from 'react';
import { Button } from '../../../../shared/components/ui/Button';
import { Input } from '../../../../shared/components/ui/Input';
import { Modal } from '../../../../shared/components/ui/Modal';
import { Switch } from '../../../../shared/components/ui/Switch';
import type { VehicleType } from '../../services/vehicle-types';
import {
  canSubmitVehicleTypeForm,
  emptyVehicleTypeForm,
  validateVehicleTypeForm,
  vehicleTypeToForm,
  type VehicleTypeFormErrors,
  type VehicleTypeFormState,
} from './validation';

interface VehicleTypeFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Tipo a editar, o null para dar de alta uno nuevo. */
  type: VehicleType | null;
  /** Todos los del estacionamiento: se usan para detectar duplicados. */
  types: VehicleType[];
  pending: boolean;
  /** Error del servidor sobre el nombre (409 duplicado). */
  nameError?: string;
  onSubmit: (payload: VehicleTypeFormState) => void;
}

export function VehicleTypeFormModal({
  open,
  onClose,
  type,
  types,
  pending,
  nameError,
  onSubmit,
}: VehicleTypeFormModalProps) {
  const isEdit = type !== null;
  const [form, setForm] = useState<VehicleTypeFormState>(emptyVehicleTypeForm);
  const [errors, setErrors] = useState<VehicleTypeFormErrors>({});

  useEffect(() => {
    if (!open) return;
    setForm(type ? vehicleTypeToForm(type) : emptyVehicleTypeForm());
    setErrors({});
    // `types` queda fuera de las deps a propósito: solo se usa para detectar
    // duplicados al guardar, y un refetch no tiene que pisar lo que el usuario
    // tipeó.
  }, [open, type]);

  function handleSubmit(): void {
    const { errors: nextErrors, payload } = validateVehicleTypeForm(form, {
      types,
      editingId: type?.id ?? null,
    });
    setErrors(nextErrors);
    if (payload) onSubmit(payload);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar tipo de vehículo' : 'Nuevo tipo de vehículo'}
      width={520}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            loading={pending}
            disabled={!canSubmitVehicleTypeForm(form)}
            onClick={handleSubmit}
          >
            {pending
              ? 'Guardando...'
              : isEdit
                ? 'Guardar cambios'
                : 'Crear tipo'}
          </Button>
        </>
      }
    >
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-2)' }}>
        {isEdit
          ? 'Esta edición usa control de versión para evitar pisar cambios concurrentes.'
          : 'Los tipos son propios de este estacionamiento: podés crear los que necesites.'}
      </p>

      <Input
        id="vehicle-type-name"
        label="Nombre"
        placeholder="Ej. Utilitario"
        value={form.name}
        error={errors.name ?? nameError}
        maxLength={60}
        autoFocus
        onChange={(e) => {
          setForm((prev) => ({ ...prev, name: e.target.value }));
          if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && canSubmitVehicleTypeForm(form))
            handleSubmit();
        }}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginTop: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Aceptado</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
            Si el estacionamiento recibe este tipo de vehículo.
          </div>
        </div>
        <Switch
          checked={form.accepted}
          disabled={pending}
          onChange={(accepted) => setForm((prev) => ({ ...prev, accepted }))}
        />
      </div>
    </Modal>
  );
}

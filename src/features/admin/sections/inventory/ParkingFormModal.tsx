import { useEffect, useState } from 'react';
import { Button } from '../../../../shared/components/ui/Button';
import { Input } from '../../../../shared/components/ui/Input';
import { Modal } from '../../../../shared/components/ui/Modal';
import { useParkingActions } from '../../hooks/useParkings';
import type {
  CreateParkingInput,
  Parking,
  ParkingStatus,
} from '../../services/parkings';

interface ParkingFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Parking to edit, or null to create a new one. */
  parking: Parking | null;
}

type FormState = {
  name: string;
  address: string;
  email: string;
  phone: string;
  cuit: string;
  legalName: string;
  status: ParkingStatus;
};

const EMPTY: FormState = {
  name: '',
  address: '',
  email: '',
  phone: '',
  cuit: '',
  legalName: '',
  status: 'active',
};

function fromParking(parking: Parking): FormState {
  return {
    name: parking.name,
    address: parking.address ?? '',
    email: parking.email ?? '',
    phone: parking.phone ?? '',
    cuit: parking.cuit ?? '',
    legalName: parking.legalName ?? '',
    status: parking.status,
  };
}

/** Trims fields and drops empty optionals so we send a clean payload. */
function toPayload(form: FormState): CreateParkingInput {
  const optional = (v: string) => {
    const t = v.trim();
    return t.length > 0 ? t : undefined;
  };
  return {
    name: form.name.trim(),
    address: optional(form.address),
    email: optional(form.email),
    phone: optional(form.phone),
    cuit: optional(form.cuit),
    legalName: optional(form.legalName),
    status: form.status,
  };
}

export function ParkingFormModal({
  open,
  onClose,
  parking,
}: ParkingFormModalProps) {
  const isEdit = parking !== null;
  const { createMutation, updateMutation } = useParkingActions();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [nameError, setNameError] = useState<string | null>(null);

  // Reset the form whenever the modal opens for a different target.
  useEffect(() => {
    if (open) {
      setForm(parking ? fromParking(parking) : EMPTY);
      setNameError(null);
    }
  }, [open, parking]);

  const pending = createMutation.isPending || updateMutation.isPending;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit() {
    if (form.name.trim().length === 0) {
      setNameError('Ingresá el nombre del estacionamiento.');
      return;
    }
    const payload = toPayload(form);
    if (isEdit && parking) {
      updateMutation.mutate(
        { id: parking.id, body: payload },
        { onSuccess: onClose },
      );
    } else {
      createMutation.mutate(payload, { onSuccess: onClose });
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar estacionamiento' : 'Nuevo estacionamiento'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="primary" loading={pending} onClick={handleSubmit}>
            {isEdit ? 'Guardar cambios' : 'Crear'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input
          label="Nombre *"
          value={form.name}
          error={nameError ?? undefined}
          onChange={(e) => {
            set('name', e.target.value);
            if (nameError) setNameError(null);
          }}
          placeholder="Ej.: Cochera Centro"
        />
        <Input
          label="Domicilio"
          value={form.address}
          onChange={(e) => set('address', e.target.value)}
          placeholder="Calle y número"
        />
        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
        >
          <Input
            label="Email de contacto"
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
          />
          <Input
            label="Teléfono"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
          />
        </div>
        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
        >
          <Input
            label="CUIT"
            value={form.cuit}
            onChange={(e) => set('cuit', e.target.value)}
          />
          <Input
            label="Razón social"
            value={form.legalName}
            onChange={(e) => set('legalName', e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="parking-status" className="pk-label">
            Estado
          </label>
          <select
            id="parking-status"
            className="pk-input"
            value={form.status}
            onChange={(e) => set('status', e.target.value as ParkingStatus)}
          >
            <option value="active">Activo</option>
            <option value="maintenance">Mantenimiento</option>
          </select>
        </div>
      </div>
    </Modal>
  );
}

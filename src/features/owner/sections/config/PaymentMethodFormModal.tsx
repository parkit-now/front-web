import { useEffect, useState } from 'react';
import { Button } from '../../../../shared/components/ui/Button';
import { Input } from '../../../../shared/components/ui/Input';
import { Modal } from '../../../../shared/components/ui/Modal';
import type { PaymentMethodSummary } from '../../services/entities';

interface PaymentMethodFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Method to rename, or null to create a new one. */
  method: PaymentMethodSummary | null;
  pending: boolean;
  /** Persist the name; resolves when the mutation succeeds. */
  onSubmit: (name: string) => void;
}

export function PaymentMethodFormModal({
  open,
  onClose,
  method,
  pending,
  onSubmit,
}: PaymentMethodFormModalProps) {
  const isEdit = method !== null;
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(method?.name ?? '');
      setError(null);
    }
  }, [open, method]);

  function handleSubmit() {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError('Ingresá un nombre para el medio de pago.');
      return;
    }
    onSubmit(trimmed);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar medio de pago' : 'Nuevo medio de pago'}
      width={420}
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
      <Input
        label="Nombre *"
        value={name}
        error={error ?? undefined}
        maxLength={120}
        autoFocus
        placeholder="Ej.: Naranja X"
        onChange={(e) => {
          setName(e.target.value);
          if (error) setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
        }}
      />
    </Modal>
  );
}

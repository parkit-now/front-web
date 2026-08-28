import { useEffect, useState, type CSSProperties } from 'react';
import { Button } from '../../../../shared/components/ui/Button';
import { Input } from '../../../../shared/components/ui/Input';
import { Modal } from '../../../../shared/components/ui/Modal';
import type { Rate } from '../../services/rates';
import {
  canSubmitRateForm,
  emptyRateForm,
  nextFreeShortcut,
  rateToForm,
  validateRateForm,
  type RateFormPayload,
  type RateFormErrors,
  type RateFormState,
} from './validation';

const GRID_3: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 10,
};

interface RateFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Tasa a editar, o null para dar de alta una nueva. */
  rate: Rate | null;
  /** Todas las tasas del estacionamiento: unicidad del atajo y autonumerado. */
  rates: Rate[];
  pending: boolean;
  onSubmit: (payload: RateFormPayload) => void;
}

export function RateFormModal({
  open,
  onClose,
  rate,
  rates,
  pending,
  onSubmit,
}: RateFormModalProps) {
  const isEdit = rate !== null;
  const [form, setForm] = useState<RateFormState>(emptyRateForm);
  const [errors, setErrors] = useState<RateFormErrors>({});

  useEffect(() => {
    if (!open) return;
    setForm(
      rate
        ? rateToForm(rate)
        : {
            ...emptyRateForm(),
            shortcutNumber: String(nextFreeShortcut(rates)),
          },
    );
    setErrors({});
    // `rates` queda fuera de las deps a propósito: el atajo libre se calcula al
    // abrir, y un refetch de la lista no tiene que pisar lo que el usuario tipeó.
  }, [open, rate]);

  function set<K extends keyof RateFormState>(key: K, value: string): void {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function handleSubmit(): void {
    const { errors: nextErrors, payload } = validateRateForm(form, {
      rates,
      editingId: rate?.id ?? null,
    });
    setErrors(nextErrors);
    if (payload) onSubmit(payload);
  }

  function handleKeyDown(event: React.KeyboardEvent): void {
    if (event.key === 'Enter' && canSubmitRateForm(form)) handleSubmit();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar tasa' : 'Nueva tasa'}
      width={620}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            loading={pending}
            disabled={!canSubmitRateForm(form)}
            onClick={handleSubmit}
          >
            {pending
              ? 'Guardando...'
              : isEdit
                ? 'Guardar cambios'
                : 'Crear tasa'}
          </Button>
        </>
      }
    >
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-2)' }}>
        {isEdit
          ? 'Esta edición usa control de versión para evitar pisar cambios concurrentes.'
          : 'Creá una tarifa nueva para el estacionamiento activo.'}
      </p>

      <div style={GRID_3}>
        <Input
          id="rate-shortcut"
          inputMode="numeric"
          placeholder="Nº atajo (ej. 1)"
          value={form.shortcutNumber}
          error={errors.shortcutNumber}
          autoFocus
          onChange={(e) => set('shortcutNumber', e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div style={{ gridColumn: 'span 2' }}>
          <Input
            id="rate-name"
            placeholder="Nombre (ej. DIA AUTO)"
            value={form.name}
            error={errors.name}
            maxLength={120}
            onChange={(e) => set('name', e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
      </div>

      <div style={{ ...GRID_3, marginTop: 12 }}>
        <Input
          id="rate-hour-price"
          inputMode="decimal"
          placeholder="Precio hora"
          value={form.hourPriceArs}
          error={errors.hourPriceArs}
          onChange={(e) => set('hourPriceArs', e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Input
          id="rate-stay-price"
          inputMode="decimal"
          placeholder="Precio estadía"
          value={form.stayPriceArs}
          error={errors.stayPriceArs}
          onChange={(e) => set('stayPriceArs', e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Input
          id="rate-fraction-price"
          inputMode="decimal"
          placeholder="Precio fracción"
          value={form.fractionPriceArs}
          error={errors.fractionPriceArs}
          onChange={(e) => set('fractionPriceArs', e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>

      <p style={{ margin: '16px 0 0', fontSize: 12, color: 'var(--text-3)' }}>
        {isEdit
          ? 'Para cambiar el estado de la tasa usá el botón de activar/desactivar en la tabla.'
          : 'Las tasas nuevas se crean activas. Podés activarlas o desactivarlas desde la tabla.'}
      </p>
    </Modal>
  );
}

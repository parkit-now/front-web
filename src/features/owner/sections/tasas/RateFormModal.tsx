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
  derivedFractionPrice,
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

const GRID_2: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 10,
};

const CHECKBOX_ROW: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 9,
  marginTop: 12,
  padding: '10px 12px',
  border: '1px solid var(--border-1)',
  borderRadius: 8,
  fontSize: 13,
  lineHeight: 1.35,
  cursor: 'pointer',
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

  type TextField = Exclude<keyof RateFormState, 'autoFractionPrice'>;

  function set(key: TextField, value: string): void {
    setForm((prev) => ({
      ...prev,
      [key]: value,
      ...(key === 'hourPriceArs' && prev.autoFractionPrice
        ? { fractionPriceArs: derivedFractionPrice(value) }
        : {}),
    }));
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
          label="Nº atajo"
          inputMode="numeric"
          placeholder="ej. 1"
          value={form.shortcutNumber}
          error={errors.shortcutNumber}
          autoFocus
          onChange={(e) => set('shortcutNumber', e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div style={{ gridColumn: 'span 2' }}>
          <Input
            id="rate-name"
            label="Nombre"
            placeholder="ej. DIA AUTO"
            value={form.name}
            error={errors.name}
            maxLength={120}
            onChange={(e) => set('name', e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
      </div>

      <div style={{ ...GRID_2, marginTop: 12 }}>
        <Input
          id="rate-hour-price"
          label="Precio hora"
          inputMode="decimal"
          placeholder="0,00"
          value={form.hourPriceArs}
          error={errors.hourPriceArs}
          onChange={(e) => set('hourPriceArs', e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Input
          id="rate-fraction-price"
          label="Precio fracción (5 min)"
          inputMode="decimal"
          placeholder="0,00"
          value={form.fractionPriceArs}
          error={errors.fractionPriceArs}
          disabled={form.autoFractionPrice}
          onChange={(e) => set('fractionPriceArs', e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Input
          id="rate-media-estadia-price"
          label="Precio media estadía (12 h)"
          inputMode="decimal"
          placeholder="0,00"
          value={form.mediaEstadiaPriceArs}
          error={errors.mediaEstadiaPriceArs}
          onChange={(e) => set('mediaEstadiaPriceArs', e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Input
          id="rate-stay-price"
          label="Precio estadía (24 h)"
          inputMode="decimal"
          placeholder="0,00"
          value={form.stayPriceArs}
          error={errors.stayPriceArs}
          onChange={(e) => set('stayPriceArs', e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>

      <label style={CHECKBOX_ROW}>
        <input
          type="checkbox"
          checked={form.autoFractionPrice}
          style={{ width: 16, height: 16, margin: '1px 0 0' }}
          onChange={(e) => {
            const autoFractionPrice = e.target.checked;
            setForm((prev) => ({
              ...prev,
              autoFractionPrice,
              fractionPriceArs: autoFractionPrice
                ? derivedFractionPrice(prev.hourPriceArs)
                : prev.fractionPriceArs,
            }));
            setErrors((prev) => ({ ...prev, fractionPriceArs: undefined }));
          }}
        />
        <span>
          Autocalcular la fracción legal (hora ÷ 12)
          <span
            style={{
              display: 'block',
              marginTop: 2,
              fontSize: 12,
              color: 'var(--text-3)',
            }}
          >
            La fracción de 5 minutos no puede costar más que un doceavo de la
            hora.
          </span>
        </span>
      </label>

      <p style={{ margin: '16px 0 0', fontSize: 12, color: 'var(--text-3)' }}>
        {isEdit
          ? 'Para cambiar el estado de la tasa usá el botón de activar/desactivar en la tabla.'
          : 'Las tasas nuevas se crean activas. Podés activarlas o desactivarlas desde la tabla.'}
      </p>
    </Modal>
  );
}

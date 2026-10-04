import { useEffect, useState, type CSSProperties } from 'react';
import { Alert } from '../../../../shared/components/ui/Alert';
import { Button } from '../../../../shared/components/ui/Button';
import { Input } from '../../../../shared/components/ui/Input';
import { Modal } from '../../../../shared/components/ui/Modal';
import type { Rate } from '../../services/rates';
import {
  emptyRateForm,
  nextFreeShortcut,
  rateToForm,
  derivedFractionPrice,
  validateRateForm,
  type RateFormPayload,
  type RateFormErrors,
  type RateFormState,
} from './validation';

/** Orden visual de los campos: el primero con error recibe el foco. */
const FIELD_ORDER = [
  'shortcutNumber',
  'name',
  'hourPriceArs',
  'fractionPriceArs',
  'mediaEstadiaPriceArs',
  'stayPriceArs',
] as const;

const FIELD_IDS: Record<(typeof FIELD_ORDER)[number], string> = {
  shortcutNumber: 'rate-shortcut',
  name: 'rate-name',
  hourPriceArs: 'rate-hour-price',
  fractionPriceArs: 'rate-fraction-price',
  mediaEstadiaPriceArs: 'rate-media-estadia-price',
  stayPriceArs: 'rate-stay-price',
};

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
  /** Tarifa a editar, o null para dar de alta una nueva. */
  rate: Rate | null;
  /** Todas las tarifas del estacionamiento: unicidad del atajo y autonumerado. */
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
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [showSummary, setShowSummary] = useState(false);

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
    setTouched(new Set());
    setShowSummary(false);
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

  function runValidation() {
    return validateRateForm(form, { rates, editingId: rate?.id ?? null });
  }

  /** Valida un campo al salir de él (blur), sin pintar los que no se tocaron. */
  function handleBlur(key: TextField): void {
    const nextTouched = new Set(touched).add(key);
    setTouched(nextTouched);
    const { errors: all } = runValidation();
    setErrors((prev) => ({ ...prev, [key]: all[key] }));
  }

  function handleSubmit(): void {
    const { errors: nextErrors, payload } = runValidation();
    setTouched(new Set(FIELD_ORDER));
    setErrors(nextErrors);
    if (payload) {
      setShowSummary(false);
      onSubmit(payload);
      return;
    }
    setShowSummary(true);
    const firstInvalid = FIELD_ORDER.find((key) => nextErrors[key]);
    if (firstInvalid) {
      document.getElementById(FIELD_IDS[firstInvalid])?.focus();
    }
  }

  function handleKeyDown(event: React.KeyboardEvent): void {
    if (event.key === 'Enter') handleSubmit();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar tarifa' : 'Nueva tarifa'}
      width={620}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="primary" loading={pending} onClick={handleSubmit}>
            {pending
              ? 'Guardando...'
              : isEdit
                ? 'Guardar cambios'
                : 'Crear tarifa'}
          </Button>
        </>
      }
    >
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-2)' }}>
        {isEdit
          ? 'Esta edición usa control de versión para evitar pisar cambios concurrentes.'
          : 'Creá una tarifa nueva para el estacionamiento activo.'}
      </p>

      {showSummary && Object.values(errors).some(Boolean) ? (
        <div style={{ margin: '0 0 12px' }}>
          <Alert variant="err" title="Completá los campos marcados en rojo." />
        </div>
      ) : null}

      <div style={GRID_3}>
        <Input
          id="rate-shortcut"
          required
          label="Nº atajo"
          inputMode="numeric"
          placeholder="ej. 1"
          value={form.shortcutNumber}
          error={errors.shortcutNumber}
          autoFocus
          onChange={(e) => set('shortcutNumber', e.target.value)}
          onBlur={() => handleBlur('shortcutNumber')}
          onKeyDown={handleKeyDown}
        />
        <div style={{ gridColumn: 'span 2' }}>
          <Input
            id="rate-name"
            required
            label="Nombre"
            placeholder="ej. DIA AUTO"
            value={form.name}
            error={errors.name}
            maxLength={120}
            onChange={(e) => set('name', e.target.value)}
            onBlur={() => handleBlur('name')}
            onKeyDown={handleKeyDown}
          />
        </div>
      </div>

      <div style={{ ...GRID_2, marginTop: 12 }}>
        <Input
          id="rate-hour-price"
          required
          label="Precio hora"
          inputMode="decimal"
          placeholder="0,00"
          value={form.hourPriceArs}
          error={errors.hourPriceArs}
          onChange={(e) => set('hourPriceArs', e.target.value)}
          onBlur={() => handleBlur('hourPriceArs')}
          onKeyDown={handleKeyDown}
        />
        <Input
          id="rate-fraction-price"
          required
          label="Precio fracción (5 min)"
          inputMode="decimal"
          placeholder="0,00"
          value={form.fractionPriceArs}
          error={errors.fractionPriceArs}
          disabled={form.autoFractionPrice}
          onChange={(e) => set('fractionPriceArs', e.target.value)}
          onBlur={() => handleBlur('fractionPriceArs')}
          onKeyDown={handleKeyDown}
        />
        <Input
          id="rate-media-estadia-price"
          required
          label="Precio media estadía (12 h)"
          inputMode="decimal"
          placeholder="0,00"
          value={form.mediaEstadiaPriceArs}
          error={errors.mediaEstadiaPriceArs}
          onChange={(e) => set('mediaEstadiaPriceArs', e.target.value)}
          onBlur={() => handleBlur('mediaEstadiaPriceArs')}
          onKeyDown={handleKeyDown}
        />
        <Input
          id="rate-stay-price"
          required
          label="Precio estadía (24 h)"
          inputMode="decimal"
          placeholder="0,00"
          value={form.stayPriceArs}
          error={errors.stayPriceArs}
          onChange={(e) => set('stayPriceArs', e.target.value)}
          onBlur={() => handleBlur('stayPriceArs')}
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
          ? 'Para cambiar el estado de la tarifa usá el botón de activar/desactivar en la tabla.'
          : 'Las tarifas nuevas se crean activas. Podés activarlas o desactivarlas desde la tabla.'}
      </p>
    </Modal>
  );
}

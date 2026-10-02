import { PhoneInput } from '../../../shared/components/PhoneInput';
import { Input } from '../../../shared/components/ui/Input';
import type { ParkingFieldErrors, ParkingFormValues } from '../validation';

type Props = {
  values: ParkingFormValues;
  errors: ParkingFieldErrors;
  disabled: boolean;
  /** Nombre de la cuenta (`/auth/me`), o el email si la cuenta no tiene. */
  managerName: string;
  onChange: (field: 'name' | 'email', value: string) => void;
  onPhoneChange: (e164: string) => void;
};

/**
 * Paso 1: "Tu estacionamiento" — nombre del lugar y datos de la persona
 * encargada. Su nombre sale de la cuenta (se pidió al registrarse) y se muestra
 * en solo lectura; el email viene prellenado pero se puede cambiar.
 */
export function ParkingStep({
  values,
  errors,
  disabled,
  managerName,
  onChange,
  onPhoneChange,
}: Props) {
  return (
    <div className="onboarding-section">
      <h3>Tu estacionamiento</h3>
      <Input
        id="parking-name"
        label="Nombre del estacionamiento"
        required
        value={values.name}
        onChange={(e) => onChange('name', e.target.value)}
        placeholder="Estacionamiento del Centro"
        disabled={disabled}
        error={errors.name}
      />

      <fieldset className="onboarding-manager">
        <legend>Persona encargada</legend>
        <div className="onboarding-manager-name">
          <span className="onboarding-manager-label">Nombre</span>
          <strong>{managerName}</strong>
        </div>
        <div className="onboarding-grid">
          <Input
            id="parking-email"
            type="email"
            label="Email de la persona encargada"
            required
            autoComplete="email"
            value={values.email}
            onChange={(e) => onChange('email', e.target.value)}
            placeholder="encargado@estacionamiento.com"
            hint="Ejemplo: nombre@ejemplo.com"
            disabled={disabled}
            error={errors.email}
          />
          <PhoneInput
            id="parking-phone"
            label="Teléfono de la persona encargada"
            required
            placeholder="Teléfono de la persona encargada"
            value={values.phone}
            onChange={onPhoneChange}
            disabled={disabled}
            error={errors.phone}
          />
        </div>
      </fieldset>
    </div>
  );
}

import { AddressPicker } from '../../../shared/components/AddressPicker/AddressPicker';
import type { AddressFormValue } from '../../../shared/components/AddressPicker/addressUtils';
import { RequiredMark } from '../../../shared/components/ui/RequiredMark';
import type {
  SucursalFieldErrors,
  SucursalFormValues,
  SucursalTextField,
} from '../validation';

type Props = {
  values: SucursalFormValues;
  errors: SucursalFieldErrors;
  disabled: boolean;
  onChange: (field: SucursalTextField, value: string) => void;
  onAddressChange: (next: AddressFormValue) => void;
};

/**
 * Paso 1: el estacionamiento en sí — nombre y domicilio.
 *
 * Las plazas totales YA NO se piden acá. La capacidad se configura después,
 * desde `/app/config`, cuando el dueño ya tiene la playa andando y sabe el
 * número real: pedírselo en el alta era pedirle una estimación que después
 * nadie corregía. El backend la sigue tolerando en el borrador
 * (`entity.totalSpots ?? 0`), así que los borradores viejos no se rompen.
 */
export function SucursalStep({
  values,
  errors,
  disabled,
  onChange,
  onAddressChange,
}: Props) {
  return (
    <div className="onboarding-section">
      <h3>Datos de la sucursal</h3>
      <p className="section-hint">
        Contanos cómo se llama tu estacionamiento y dónde está. Los campos con{' '}
        <RequiredMark /> son obligatorios.
      </p>
      <div className="onboarding-grid">
        <div className="onboarding-field full-width">
          <label htmlFor="sucursal-name">
            Nombre del estacionamiento
            <RequiredMark />
          </label>
          <input
            id="sucursal-name"
            type="text"
            value={values.name}
            onChange={(e) => onChange('name', e.target.value)}
            placeholder="Estacionamiento del Centro"
            disabled={disabled}
            required
            aria-required
            className={errors.name ? 'input-error' : undefined}
            aria-invalid={errors.name ? true : undefined}
          />
          {errors.name ? <p className="field-error">{errors.name}</p> : null}
        </div>

        {/* El `AddressPicker` usa los primitivos `pk-*`, pero acá va adentro de
            un `.onboarding-field`: las reglas `.onboarding-field input` y
            `.onboarding-field label` de Onboarding.css le ganan por
            especificidad, así que el bloque queda visualmente igual al resto
            del wizard sin duplicar estilos ni forkear el componente.

            `collapsible`: en el alta la persona viene a CARGAR una dirección,
            no a auditarla. Con Georef resuelto el detalle se esconde. */}
        {/* Sin `<label>Domicilio</label>` envolvente: el propio picker ya
            rotula su input ("Dirección del estacionamiento") y llevaba el
            asterisco. Dos títulos para el mismo campo es exactamente el ruido
            que este ticket vino a sacar. */}
        <div className="onboarding-field full-width">
          <AddressPicker
            value={values.address}
            disabled={disabled}
            collapsible
            required
            onChange={onAddressChange}
          />
          {errors.address ? (
            <p className="field-error" data-testid="address-error">
              {errors.address}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

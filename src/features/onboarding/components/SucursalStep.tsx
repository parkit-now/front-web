import { AddressPicker } from '../../../shared/components/AddressPicker/AddressPicker';
import type { AddressFormValue } from '../../../shared/components/AddressPicker/addressUtils';
import { RequiredMark } from '../../../shared/components/ui/RequiredMark';
import type { SucursalFieldErrors, SucursalFormValues } from '../validation';

type Props = {
  values: SucursalFormValues;
  errors: SucursalFieldErrors;
  disabled: boolean;
  onAddressChange: (next: AddressFormValue) => void;
};

/**
 * Paso 2: la ubicación del estacionamiento.
 *
 * El nombre pasó al paso 1 ("Tu estacionamiento"); acá queda sólo el
 * `AddressPicker`, que sugiere direcciones mientras se tipea.
 */
export function SucursalStep({
  values,
  errors,
  disabled,
  onAddressChange,
}: Props) {
  return (
    <div className="onboarding-section">
      <h3>Ubicación</h3>
      <p className="section-hint">
        Los campos marcados con <RequiredMark /> son obligatorios.
      </p>
      <div className="onboarding-grid">
        {/* El `AddressPicker` usa los primitivos `pk-*`, pero acá va adentro de
            un `.onboarding-field`: las reglas `.onboarding-field input` y
            `.onboarding-field label` de Onboarding.css le ganan por
            especificidad, así que el bloque queda visualmente igual al resto
            del wizard sin duplicar estilos ni forkear el componente.

            `collapsible`: en el alta la persona viene a CARGAR una dirección,
            no a auditarla. Con Georef resuelto el detalle se esconde. El propio
            picker rotula su input y lleva el asterisco. */}
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

import type { SucursalFieldErrors, SucursalFormValues } from '../validation';

type Props = {
  values: SucursalFormValues;
  errors: SucursalFieldErrors;
  disabled: boolean;
  onChange: (field: keyof SucursalFormValues, value: string) => void;
};

/** Step 1: the parking lot itself — display name, address and spot counts. */
export function SucursalStep({ values, errors, disabled, onChange }: Props) {
  return (
    <div className="onboarding-section">
      <h3>Datos de la sucursal</h3>
      <p className="section-hint">
        Contanos cómo se llama tu estacionamiento, dónde está y cuántas plazas
        ofrece.
      </p>
      <div className="onboarding-grid">
        <div className="onboarding-field full-width">
          <label htmlFor="sucursal-name">Nombre del estacionamiento</label>
          <input
            id="sucursal-name"
            type="text"
            value={values.name}
            onChange={(e) => onChange('name', e.target.value)}
            placeholder="Estacionamiento del Centro"
            disabled={disabled}
            className={errors.name ? 'input-error' : undefined}
            aria-invalid={errors.name ? true : undefined}
          />
          {errors.name ? <p className="field-error">{errors.name}</p> : null}
        </div>

        <div className="onboarding-field full-width">
          <label htmlFor="sucursal-address">Domicilio</label>
          <input
            id="sucursal-address"
            type="text"
            value={values.address}
            onChange={(e) => onChange('address', e.target.value)}
            placeholder="Av. Corrientes 1234, CABA"
            disabled={disabled}
            className={errors.address ? 'input-error' : undefined}
            aria-invalid={errors.address ? true : undefined}
          />
          {errors.address ? (
            <p className="field-error">{errors.address}</p>
          ) : null}
        </div>

        <div className="onboarding-field">
          <label htmlFor="sucursal-carSpots">Plazas para autos</label>
          <input
            id="sucursal-carSpots"
            type="number"
            min={0}
            inputMode="numeric"
            value={values.carSpots}
            onChange={(e) => onChange('carSpots', e.target.value)}
            placeholder="0"
            disabled={disabled}
          />
        </div>

        <div className="onboarding-field">
          <label htmlFor="sucursal-motorcycleSpots">Plazas para motos</label>
          <input
            id="sucursal-motorcycleSpots"
            type="number"
            min={0}
            inputMode="numeric"
            value={values.motorcycleSpots}
            onChange={(e) => onChange('motorcycleSpots', e.target.value)}
            placeholder="0"
            disabled={disabled}
          />
        </div>

        <div className="onboarding-field">
          <label htmlFor="sucursal-bicycleSpots">Plazas para bicicletas</label>
          <input
            id="sucursal-bicycleSpots"
            type="number"
            min={0}
            inputMode="numeric"
            value={values.bicycleSpots}
            onChange={(e) => onChange('bicycleSpots', e.target.value)}
            placeholder="0"
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}

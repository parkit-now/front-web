import { useEffect, useState } from 'react';
import {
  addressFromLocation,
  toDeclaredLocation,
  type AddressFormValue,
} from '../../../shared/components/AddressPicker/addressUtils';
import {
  findScheduleIssues,
  type ScheduleRange,
} from '../../../shared/components/WeeklyScheduleEditor';
import { parseCapacityTotal } from '../../owner/sections/config/capacity';
import type {
  Application,
  CreateApplicationInput,
  UpdateApplicationInput,
} from '../services/onboarding';
import { readDeclaredEntity } from '../services/onboarding';
import {
  validateParkingForm,
  validateSucursalForm,
  type ParkingFieldErrors,
  type ParkingFormValues,
  type SucursalFieldErrors,
  type SucursalFormValues,
} from '../validation';
import { OperationalStep } from './OperationalStep';
import { ParkingStep } from './ParkingStep';
import { SucursalStep } from './SucursalStep';

type Props = {
  application: Application | null;
  rejected: boolean;
  creating: boolean;
  saving: boolean;
  submitting: boolean;
  /** Datos de la cuenta (`/auth/me`) para la "Persona encargada". */
  account: { name: string | null; email: string } | null;
  onCreate: (input: CreateApplicationInput) => void;
  onSave: (applicationId: string, input: UpdateApplicationInput) => void;
  /**
   * Envía la solicitud a revisión. Con `input` primero guarda esos datos
   * (capacidad y horarios); sin `input` envía tal cual, sin tocarlos.
   */
  onSubmit: (input?: UpdateApplicationInput) => void;
};

/**
 * Wizard de tres pasos para dar de alta un estacionamiento:
 *   1. Tu estacionamiento (nombre + persona encargada: email y teléfono)
 *   2. Ubicación (domicilio)
 *   3. Información operativa (capacidad y horarios, opcional)
 *
 * La solicitud se crea (POST) al pasar el paso 1; los pasos siguientes usan
 * PATCH y el paso 3 envía a revisión. Capacidad y horarios sólo viajan desde el
 * paso 3 ("Enviar solicitud"): el PATCH de `schedules` REEMPLAZA la lista
 * entera, así que no se manda en los pasos anteriores.
 */
export function DraftWizard({
  application,
  rejected,
  creating,
  saving,
  submitting,
  account,
  onCreate,
  onSave,
  onSubmit,
}: Props) {
  const declared = readDeclaredEntity(application);

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  const [parking, setParking] = useState<ParkingFormValues>(() => ({
    name: declared.name ?? '',
    email: declared.email ?? account?.email ?? '',
    // Un borrador viejo puede traer un teléfono que no es E.164: el
    // `PhoneInput` lo muestra crudo y `validatePhone` pide corregirlo.
    phone: declared.phone ?? '',
  }));
  const [parkingErrors, setParkingErrors] = useState<ParkingFieldErrors>({});

  const [sucursal, setSucursal] = useState<SucursalFormValues>(() => ({
    // Un borrador viejo sólo tiene `address` como string plano: entra como la
    // línea de display y el resto de los campos quedan vacíos, en vez de
    // perderse.
    address: addressFromLocation(declared.location, declared.address),
  }));
  const [sucursalErrors, setSucursalErrors] = useState<SucursalFieldErrors>({});

  const [totalSpots, setTotalSpots] = useState(() =>
    declared.totalSpots && declared.totalSpots > 0
      ? String(declared.totalSpots)
      : '',
  );
  const [totalSpotsError, setTotalSpotsError] = useState<string>();
  const [schedules, setSchedules] = useState<ScheduleRange[]>(
    () => declared.schedules ?? [],
  );
  const [schedulesError, setSchedulesError] = useState<string>();

  // Al crearse la solicitud (POST), se pasa al paso de ubicación.
  const [hadApplication, setHadApplication] = useState(!!application);
  useEffect(() => {
    if (application && !hadApplication) {
      setHadApplication(true);
      setCurrentStep(2);
    }
  }, [application, hadApplication]);

  const busy = creating || saving || submitting;

  function updateParking(field: 'name' | 'email', value: string) {
    setParking((prev) => ({ ...prev, [field]: value }));
    if (parkingErrors[field]) {
      setParkingErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function updatePhone(e164: string) {
    setParking((prev) => ({ ...prev, phone: e164 }));
    if (parkingErrors.phone) {
      setParkingErrors((prev) => ({ ...prev, phone: undefined }));
    }
  }

  /**
   * Tocar el domicilio LIMPIA su error: se dispara al apretar "Siguiente" y
   * nombra lo que falta; sin limpiarlo, la persona resuelve la dirección y el
   * cartel rojo sigue ahí hasta el próximo submit.
   */
  function updateAddress(address: AddressFormValue) {
    setSucursal({ address });
    if (sucursalErrors.address) {
      setSucursalErrors({});
    }
  }

  function updateTotalSpots(value: string) {
    setTotalSpots(value);
    setTotalSpotsError(undefined);
  }

  function updateSchedules(next: ScheduleRange[]) {
    setSchedules(next);
    setSchedulesError(undefined);
  }

  /** Datos de los pasos 1 y 2, para POST (crear) y PATCH (guardar). */
  function buildPayload(): CreateApplicationInput {
    // `location` se omite cuando no se cargó NADA: el DTO la tiene como
    // opcional y mandar un objeto con todo en `null` sólo ensucia el JSON
    // declarado. `legalName` y `cuit` ya no se piden (se completan después en
    // Configuración → Perfil); un borrador viejo no los pierde porque el PATCH
    // hace MERGE contra el `declaredEntity` guardado.
    const location = toDeclaredLocation(sucursal.address);
    return {
      name: parking.name.trim(),
      email: parking.email.trim(),
      phone: parking.phone.trim(),
      ...(location ? { location } : {}),
    };
  }

  function validateStep1(): boolean {
    const errors = validateParkingForm(parking);
    setParkingErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function validateStep2(): boolean {
    const errors = validateSucursalForm(sucursal);
    setSucursalErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // ── Paso 1 → 2 ───────────────────────────────────────────────────────────
  function handleNextFromStep1() {
    if (!validateStep1()) return;
    if (!application) {
      // POST — el efecto de arriba avanza al paso 2 cuando aparece la solicitud.
      onCreate(buildPayload());
    } else {
      onSave(application.id, buildPayload());
      setCurrentStep(2);
    }
  }

  // ── Paso 2 → 3 ───────────────────────────────────────────────────────────
  function handleNextFromStep2() {
    if (!validateStep2() || !application) return;
    onSave(application.id, buildPayload());
    setCurrentStep(3);
  }

  // ── Guardar sin avanzar (sólo con solicitud creada) ────────────────────────
  function handleSaveOnly() {
    if (!application) return;
    if (currentStep === 1 && !validateStep1()) return;
    if (currentStep === 2 && !validateStep2()) return;
    onSave(application.id, buildPayload());
  }

  // ── Paso 3: enviar con o sin información operativa ─────────────────────────
  function handleSubmitWithData() {
    if (!application) return;
    let hasError = false;

    const rawSpots = totalSpots.trim();
    let spots: number | undefined;
    if (rawSpots) {
      const parsed = parseCapacityTotal(rawSpots);
      if ('error' in parsed) {
        setTotalSpotsError(parsed.error);
        hasError = true;
      } else {
        spots = parsed.total;
      }
    }

    if (findScheduleIssues(schedules).length > 0) {
      setSchedulesError('Corregí las franjas marcadas antes de enviar.');
      hasError = true;
    }
    if (hasError) return;

    onSubmit({
      ...buildPayload(),
      ...(spots !== undefined ? { totalSpots: spots } : {}),
      // El PATCH reemplaza la lista: mandar [] borra horarios que hubiera
      // guardado un intento anterior.
      schedules: schedules.map(({ day, openMinute, closeMinute }) => ({
        day,
        openMinute,
        closeMinute,
      })),
    });
  }

  function handleSubmitLater() {
    if (!application) return;
    onSubmit();
  }

  const steps = [
    { step: 1 as const, label: 'Tu estacionamiento' },
    { step: 2 as const, label: 'Ubicación' },
    { step: 3 as const, label: 'Información operativa' },
  ];

  const saveButton =
    application !== null && currentStep !== 3 ? (
      <button
        type="button"
        className="secondary-button"
        onClick={handleSaveOnly}
        disabled={busy}
      >
        {saving ? 'Guardando...' : 'Guardar cambios'}
      </button>
    ) : null;

  const managerName = account?.name?.trim() || account?.email || 'Tu cuenta';

  return (
    <div className="onboarding-card">
      {rejected ? (
        <div className="onboarding-banner banner-warning" role="alert">
          <strong>Tu solicitud fue rechazada</strong>
          {application?.rejectionReason ? (
            <>
              <span style={{ display: 'block', marginTop: 4 }}>
                Motivo: {application.rejectionReason}
              </span>
            </>
          ) : null}
          <span style={{ display: 'block', marginTop: 4 }}>
            Revisá y corregí los datos, y volvé a enviarla para una nueva
            revisión.
          </span>
        </div>
      ) : null}

      {/* Stepper */}
      <div className="onboarding-stepper">
        {steps.map(({ step, label }) => {
          const isDone = step < currentStep;
          const isActive = step === currentStep;
          const canGoBack = step < currentStep;
          return (
            <button
              key={step}
              type="button"
              className={[
                'stepper-step',
                isActive ? 'stepper-step--active' : '',
                isDone ? 'stepper-step--done' : '',
                !isDone && !isActive ? 'stepper-step--disabled' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => canGoBack && setCurrentStep(step)}
              disabled={!canGoBack && !isActive}
              aria-current={isActive ? 'step' : undefined}
            >
              <span className="stepper-step-num">{isDone ? '✓' : step}</span>
              <span className="stepper-step-label">{label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Paso 1: Tu estacionamiento ── */}
      {currentStep === 1 && (
        <>
          <ParkingStep
            values={parking}
            errors={parkingErrors}
            disabled={busy}
            managerName={managerName}
            onChange={updateParking}
            onPhoneChange={updatePhone}
          />
          <div className="onboarding-actions">
            <div className="action-left" />
            <div className="action-center">{saveButton}</div>
            <div className="action-right">
              <button
                type="button"
                className="nav-button nav-button--primary"
                onClick={handleNextFromStep1}
                disabled={busy}
              >
                {creating ? 'Creando...' : 'Siguiente →'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Paso 2: Ubicación ── */}
      {currentStep === 2 && (
        <>
          <SucursalStep
            values={sucursal}
            errors={sucursalErrors}
            disabled={busy}
            onAddressChange={updateAddress}
          />
          <div className="onboarding-actions">
            <div className="action-left">
              <button
                type="button"
                className="nav-button"
                onClick={() => setCurrentStep(1)}
                disabled={busy}
              >
                ← Anterior
              </button>
            </div>
            <div className="action-center">{saveButton}</div>
            <div className="action-right">
              <button
                type="button"
                className="nav-button nav-button--primary"
                onClick={handleNextFromStep2}
                disabled={busy}
              >
                Siguiente →
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Paso 3: Información operativa ── */}
      {currentStep === 3 && (
        <>
          <OperationalStep
            totalSpots={totalSpots}
            totalSpotsError={totalSpotsError}
            schedules={schedules}
            disabled={busy}
            onTotalSpotsChange={updateTotalSpots}
            onSchedulesChange={updateSchedules}
          />
          {schedulesError ? (
            <p className="field-error" role="alert">
              {schedulesError}
            </p>
          ) : null}
          <div className="onboarding-actions">
            <div className="action-left">
              <button
                type="button"
                className="nav-button"
                onClick={() => setCurrentStep(2)}
                disabled={busy}
              >
                ← Anterior
              </button>
            </div>
            <div className="action-center">
              <button
                type="button"
                className="secondary-button"
                onClick={handleSubmitLater}
                disabled={busy || !application}
              >
                Completar después
              </button>
            </div>
            <div className="action-right">
              <button
                type="button"
                className="nav-button nav-button--primary"
                onClick={handleSubmitWithData}
                disabled={busy || !application}
              >
                {submitting ? 'Enviando...' : 'Enviar solicitud'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

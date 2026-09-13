import { useEffect, useState } from 'react';
import {
  addressFromLocation,
  toDeclaredLocation,
  type AddressFormValue,
} from '../../../shared/components/AddressPicker/addressUtils';
import type {
  Application,
  CreateApplicationInput,
  UpdateApplicationInput,
} from '../services/onboarding';
import { readDeclaredEntity } from '../services/onboarding';
import {
  normalizeCuit,
  validateContactForm,
  validateSucursalForm,
  type ContactFieldErrors,
  type ContactFormValues,
  type SucursalFieldErrors,
  type SucursalFormValues,
  type SucursalTextField,
} from '../validation';
import { RequiredMark } from '../../../shared/components/ui/RequiredMark';
import { DocumentsStep } from './DocumentsStep';
import { SucursalStep } from './SucursalStep';

type Props = {
  application: Application | null;
  rejected: boolean;
  pendingReview: boolean;
  creating: boolean;
  saving: boolean;
  uploadingDocument: boolean;
  submitting: boolean;
  uploadedNames: string[];
  onCreate: (input: CreateApplicationInput) => void;
  onSave: (applicationId: string, input: UpdateApplicationInput) => void;
  onUploadDocument: (file: File) => void;
  onSubmit: () => void;
};

/**
 * Three-step wizard to register a single parking lot:
 *   1. Sucursal (nombre y domicilio)
 *   2. Contacto (legal name, CUIT, email, phone)
 *   3. Documentación (optional uploads)
 *
 * The application is created (POST) once steps 1 and 2 are complete, since the
 * backend requires every contact field; later edits use PATCH.
 */
export function DraftWizard({
  application,
  rejected,
  pendingReview,
  creating,
  saving,
  uploadingDocument,
  submitting,
  uploadedNames,
  onCreate,
  onSave,
  onUploadDocument,
  onSubmit,
}: Props) {
  const declared = readDeclaredEntity(application);

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  const [sucursal, setSucursal] = useState<SucursalFormValues>(() => ({
    name: declared.name ?? '',
    // Un borrador viejo sólo tiene `address` como string plano: entra como la
    // línea de display y el resto de los campos quedan vacíos, en vez de
    // perderse.
    address: addressFromLocation(declared.location, declared.address),
  }));
  const [sucursalErrors, setSucursalErrors] = useState<SucursalFieldErrors>({});

  const [contact, setContact] = useState<ContactFormValues>(() => ({
    legalName: declared.legalName ?? '',
    cuit: declared.cuit ?? '',
    email: declared.email ?? '',
    phone: declared.phone ?? '',
  }));
  const [contactErrors, setContactErrors] = useState<ContactFieldErrors>({});

  // When the application is created (POST), jump to the documents step.
  const [hadApplication, setHadApplication] = useState(!!application);
  useEffect(() => {
    if (application && !hadApplication) {
      setHadApplication(true);
      setCurrentStep(3);
    }
  }, [application, hadApplication]);

  const busy = creating || saving || submitting;
  const canSubmit = !!application && !busy && !uploadingDocument;

  function updateSucursal(field: SucursalTextField, value: string) {
    setSucursal((prev) => ({ ...prev, [field]: value }));
    if (field in sucursalErrors) {
      setSucursalErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  /**
   * Igual que `updateSucursal` y `updateContact`: tocar el campo LIMPIA su
   * error.
   *
   * No es cosmético. El error del domicilio se dispara al apretar "Siguiente"
   * y nombra lo que falta ("falta la calle, la altura…"); sin limpiarlo, la
   * persona busca la dirección, Georef la resuelve, aparece el pin… y el
   * cartel rojo sigue ahí hasta el próximo submit. El formulario le dice que
   * está mal algo que ya está bien.
   */
  function updateAddress(address: AddressFormValue) {
    setSucursal((prev) => ({ ...prev, address }));
    if (sucursalErrors.address) {
      setSucursalErrors((prev) => ({ ...prev, address: undefined }));
    }
  }

  function updateContact(field: keyof ContactFormValues, value: string) {
    setContact((prev) => ({ ...prev, [field]: value }));
    if (contactErrors[field]) {
      setContactErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  /** Full declared-entity payload, used for both POST (create) and PATCH (save). */
  function buildPayload(): CreateApplicationInput {
    // `location` se omite cuando no se cargó NADA: el DTO la tiene como
    // opcional y mandar un objeto con todo en `null` sólo ensucia el JSON
    // declarado. Ya no se manda el `address` plano — `location.formatted`
    // le gana en el backend y es el mismo valor.
    const location = toDeclaredLocation(sucursal.address);
    return {
      name: sucursal.name.trim(),
      legalName: contact.legalName.trim(),
      cuit: normalizeCuit(contact.cuit),
      email: contact.email.trim(),
      phone: contact.phone.trim(),
      ...(location ? { location } : {}),
      // `totalSpots` NO se manda más: las plazas salieron del alta y se
      // configuran en `/app/config`. El backend lo sigue tolerando
      // (`entity.totalSpots ?? 0` en `approve()`) y el PATCH hace MERGE contra
      // el `declaredEntity` guardado, así que un borrador viejo que ya lo
      // tenía NO lo pierde al editarlo con el wizard nuevo.
    };
  }

  // ── Step 1 → 2 ───────────────────────────────────────────────────────────
  function handleNextFromStep1() {
    const errors = validateSucursalForm(sucursal);
    if (Object.keys(errors).length > 0) {
      setSucursalErrors(errors);
      return;
    }
    setSucursalErrors({});
    setCurrentStep(2);
  }

  // ── Step 2 → 3 ───────────────────────────────────────────────────────────
  function handleNextFromStep2() {
    const errors = validateContactForm(contact);
    if (Object.keys(errors).length > 0) {
      setContactErrors(errors);
      return;
    }
    setContactErrors({});
    if (!application) {
      // POST — the effect above advances to step 3 once the application appears.
      onCreate(buildPayload());
    } else {
      onSave(application.id, buildPayload());
      setCurrentStep(3);
    }
  }

  // ── Save without advancing (only when an application exists) ───────────────
  function handleSaveOnly() {
    if (!application) return;
    if (currentStep === 1) {
      const errors = validateSucursalForm(sucursal);
      if (Object.keys(errors).length > 0) {
        setSucursalErrors(errors);
        return;
      }
      setSucursalErrors({});
    }
    if (currentStep === 2) {
      const errors = validateContactForm(contact);
      if (Object.keys(errors).length > 0) {
        setContactErrors(errors);
        return;
      }
      setContactErrors({});
    }
    onSave(application.id, buildPayload());
  }

  const steps = [
    { step: 1 as const, label: 'Sucursal' },
    { step: 2 as const, label: 'Contacto' },
    { step: 3 as const, label: 'Documentación' },
  ];

  const saveButton =
    application !== null ? (
      <button
        type="button"
        className="secondary-button"
        onClick={handleSaveOnly}
        disabled={busy}
      >
        {saving ? 'Guardando...' : 'Guardar cambios'}
      </button>
    ) : null;

  return (
    <div className="onboarding-card">
      {rejected ? (
        <div className="onboarding-banner banner-warning">
          <strong>Tu solicitud fue rechazada</strong>
          Revisá y corregí los datos, y volvé a enviarla para una nueva
          revisión.
        </div>
      ) : null}
      {pendingReview ? (
        <div className="onboarding-banner banner-info">
          <strong>Tu solicitud está en revisión</strong>
          Podés actualizar tus datos y documentación en cualquier momento
          mientras esperás la respuesta.
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

      {/* ── Paso 1: Sucursal ── */}
      {currentStep === 1 && (
        <>
          <SucursalStep
            values={sucursal}
            errors={sucursalErrors}
            disabled={busy}
            onChange={updateSucursal}
            onAddressChange={updateAddress}
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
                Siguiente →
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Paso 2: Contacto ── */}
      {currentStep === 2 && (
        <div className="onboarding-section">
          <h3>Datos de contacto</h3>
          <p className="section-hint">
            Datos legales y de contacto del titular del estacionamiento. Los
            campos con <RequiredMark /> son obligatorios.
          </p>
          <div className="onboarding-grid">
            <div className="onboarding-field full-width">
              <label htmlFor="contact-legalName">
                Razón social
                <RequiredMark />
              </label>
              <input
                id="contact-legalName"
                type="text"
                value={contact.legalName}
                onChange={(e) => updateContact('legalName', e.target.value)}
                placeholder="Estacionamientos del Centro S.A."
                disabled={busy}
                required
                aria-required
                className={contactErrors.legalName ? 'input-error' : undefined}
                aria-invalid={contactErrors.legalName ? true : undefined}
              />
              {contactErrors.legalName ? (
                <p className="field-error">{contactErrors.legalName}</p>
              ) : null}
            </div>

            <div className="onboarding-field">
              <label htmlFor="contact-cuit">
                CUIT
                <RequiredMark />
              </label>
              <input
                id="contact-cuit"
                type="text"
                inputMode="numeric"
                value={contact.cuit}
                onChange={(e) => updateContact('cuit', e.target.value)}
                placeholder="30123456789"
                disabled={busy}
                required
                aria-required
                className={contactErrors.cuit ? 'input-error' : undefined}
                aria-invalid={contactErrors.cuit ? true : undefined}
              />
              {contactErrors.cuit ? (
                <p className="field-error">{contactErrors.cuit}</p>
              ) : null}
            </div>

            <div className="onboarding-field">
              <label htmlFor="contact-email">
                Email de contacto
                <RequiredMark />
              </label>
              <input
                id="contact-email"
                type="email"
                value={contact.email}
                onChange={(e) => updateContact('email', e.target.value)}
                placeholder="contacto@estacionamiento.com"
                disabled={busy}
                required
                aria-required
                className={contactErrors.email ? 'input-error' : undefined}
                aria-invalid={contactErrors.email ? true : undefined}
              />
              {contactErrors.email ? (
                <p className="field-error">{contactErrors.email}</p>
              ) : null}
            </div>

            <div className="onboarding-field">
              <label htmlFor="contact-phone">
                Teléfono
                <RequiredMark />
              </label>
              <input
                id="contact-phone"
                type="tel"
                value={contact.phone}
                onChange={(e) => updateContact('phone', e.target.value)}
                placeholder="+54 11 4567 8900"
                disabled={busy}
                required
                aria-required
                className={contactErrors.phone ? 'input-error' : undefined}
                aria-invalid={contactErrors.phone ? true : undefined}
              />
              {contactErrors.phone ? (
                <p className="field-error">{contactErrors.phone}</p>
              ) : null}
            </div>
          </div>

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
                {creating ? 'Creando...' : 'Siguiente →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Paso 3: Documentación ── */}
      {currentStep === 3 && (
        <>
          <DocumentsStep
            docsCount={application?.docsCount ?? 0}
            uploadedNames={uploadedNames}
            uploading={uploadingDocument}
            disabled={busy}
            onUpload={onUploadDocument}
          />
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
            <div className="action-center">{saveButton}</div>
            <div className="action-right">
              <button
                type="button"
                className="nav-button nav-button--primary"
                onClick={onSubmit}
                disabled={!canSubmit}
              >
                {submitting
                  ? 'Enviando...'
                  : pendingReview
                    ? 'Actualizar solicitud'
                    : 'Enviar para revisión'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

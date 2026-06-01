import { useState, useEffect } from 'react';
import type { ApplicationView, CompanyProfile } from '../services/onboarding';
import {
  normalizeCuit,
  validateCompanyForm,
  type CompanyFieldErrors,
  type CompanyFormValues,
} from '../validation';
import {
  BranchesStep,
  branchesToInput,
  emptyBranch,
  type BranchDraft,
} from './BranchesStep';
import { DocumentsStep } from './DocumentsStep';

type SaveAllPayload = { company: CompanyFormValues; branches: BranchDraft[] };

type Props = {
  company: CompanyProfile | null;
  application: ApplicationView | null;
  rejected: boolean;
  pendingReview: boolean;
  creatingCompany: boolean;
  savingApplication: boolean;
  addingDocument: boolean;
  submitting: boolean;
  onCreateCompany: (values: CompanyFormValues) => void;
  onSaveApplication: (applicationId: string, payload: SaveAllPayload) => void;
  onAddDocument: (name: string) => void;
  onSubmit: () => void;
};

/**
 * Three-step wizard shown while the application is in draft (or rejected),
 * or while creating the company for the first time.
 */
export function DraftWizard({
  company,
  application,
  rejected,
  pendingReview,
  creatingCompany,
  savingApplication,
  addingDocument,
  submitting,
  onCreateCompany,
  onSaveApplication,
  onAddDocument,
  onSubmit,
}: Props) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  const [companyValues, setCompanyValues] = useState<CompanyFormValues>(() =>
    company
      ? {
          legalName: company.legalName,
          cuit: company.cuit,
          email: company.email,
          phone: company.phone ?? '',
          address: company.address ?? '',
        }
      : { legalName: '', cuit: '', email: '', phone: '', address: '' },
  );
  const [companyErrors, setCompanyErrors] = useState<CompanyFieldErrors>({});

  const [branches, setBranches] = useState<BranchDraft[]>(() =>
    application && application.declaredBranchCount > 0 ? [] : [emptyBranch()],
  );

  // Track whether company existed at mount so we can detect the transition
  const [hasCompany, setHasCompany] = useState(!!company);

  // When the company is created (POST), advance to step 2 automatically
  useEffect(() => {
    if (company && !hasCompany) {
      setHasCompany(true);
      setCurrentStep(2);
    }
  }, [company]); // intentionally only tracking `company` — detecting the null→non-null transition

  const busy = creatingCompany || savingApplication || submitting;
  const validBranches = branchesToInput(branches);
  const canSubmit =
    !busy &&
    !addingDocument &&
    (validBranches.length > 0 || (application?.declaredBranchCount ?? 0) > 0);

  function updateCompany(field: keyof CompanyFormValues, value: string) {
    setCompanyValues((prev) => ({ ...prev, [field]: value }));
    if (companyErrors[field]) {
      setCompanyErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  // ── Step 1 → 2 ──────────────────────────────────────────────────────────────
  function handleNextFromStep1() {
    const errors = validateCompanyForm(companyValues);
    if (Object.keys(errors).length > 0) {
      setCompanyErrors(errors);
      return;
    }
    setCompanyErrors({});
    const normalized: CompanyFormValues = {
      ...companyValues,
      cuit: normalizeCuit(companyValues.cuit),
    };
    if (!company) {
      // POST — the useEffect above will advance once company appears
      onCreateCompany(normalized);
    } else if (application) {
      onSaveApplication(application.id, { company: normalized, branches });
      setCurrentStep(2);
    } else {
      setCurrentStep(2);
    }
  }

  // ── Step 2 → 3 ──────────────────────────────────────────────────────────────
  const [step2Error, setStep2Error] = useState<string | null>(null);

  function handleNextFromStep2() {
    const valid = branchesToInput(branches);
    if (valid.length === 0) {
      setStep2Error('Agregá al menos una sucursal con nombre y domicilio.');
      return;
    }
    setStep2Error(null);
    if (application) {
      onSaveApplication(application.id, { company: companyValues, branches });
    }
    setCurrentStep(3);
  }

  // ── Save without advancing ───────────────────────────────────────────────────
  function handleSaveOnly() {
    if (!application) return;
    if (currentStep === 1) {
      const errors = validateCompanyForm(companyValues);
      if (Object.keys(errors).length > 0) {
        setCompanyErrors(errors);
        return;
      }
      setCompanyErrors({});
    }
    onSaveApplication(application.id, { company: companyValues, branches });
  }

  // ── Stepper ──────────────────────────────────────────────────────────────────
  const steps = [
    { step: 1 as const, label: 'Empresa' },
    { step: 2 as const, label: 'Sucursales' },
    { step: 3 as const, label: 'Documentación' },
  ];

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

      {/* ── Paso 1: Empresa ── */}
      {currentStep === 1 && (
        <div className="onboarding-section">
          <h3>Datos de la empresa</h3>
          <p className="section-hint">
            Completá los datos de tu empresa para avanzar con el registro.
          </p>
          <div className="onboarding-grid">
            <div className="onboarding-field full-width">
              <label htmlFor="wizard-legalName">Razón social</label>
              <input
                id="wizard-legalName"
                type="text"
                value={companyValues.legalName}
                onChange={(e) => updateCompany('legalName', e.target.value)}
                placeholder="Estacionamientos del Centro S.A."
                disabled={busy}
                className={companyErrors.legalName ? 'input-error' : undefined}
                aria-invalid={companyErrors.legalName ? true : undefined}
              />
              {companyErrors.legalName ? (
                <p className="field-error">{companyErrors.legalName}</p>
              ) : null}
            </div>

            <div className="onboarding-field">
              <label htmlFor="wizard-cuit">CUIT</label>
              <input
                id="wizard-cuit"
                type="text"
                inputMode="numeric"
                value={companyValues.cuit}
                onChange={(e) => updateCompany('cuit', e.target.value)}
                placeholder="30123456789"
                disabled={busy}
                className={companyErrors.cuit ? 'input-error' : undefined}
                aria-invalid={companyErrors.cuit ? true : undefined}
              />
              {companyErrors.cuit ? (
                <p className="field-error">{companyErrors.cuit}</p>
              ) : null}
            </div>

            <div className="onboarding-field">
              <label htmlFor="wizard-email">Email de contacto</label>
              <input
                id="wizard-email"
                type="email"
                value={companyValues.email}
                onChange={(e) => updateCompany('email', e.target.value)}
                placeholder="contacto@estacionamiento.com"
                disabled={busy}
                className={companyErrors.email ? 'input-error' : undefined}
                aria-invalid={companyErrors.email ? true : undefined}
              />
              {companyErrors.email ? (
                <p className="field-error">{companyErrors.email}</p>
              ) : null}
            </div>

            <div className="onboarding-field">
              <label htmlFor="wizard-phone">Teléfono</label>
              <input
                id="wizard-phone"
                type="tel"
                value={companyValues.phone}
                onChange={(e) => updateCompany('phone', e.target.value)}
                placeholder="+54 11 4567 8900"
                disabled={busy}
                className={companyErrors.phone ? 'input-error' : undefined}
                aria-invalid={companyErrors.phone ? true : undefined}
              />
              {companyErrors.phone ? (
                <p className="field-error">{companyErrors.phone}</p>
              ) : null}
            </div>

            <div className="onboarding-field">
              <label htmlFor="wizard-address">Domicilio</label>
              <input
                id="wizard-address"
                type="text"
                value={companyValues.address}
                onChange={(e) => updateCompany('address', e.target.value)}
                placeholder="Av. Corrientes 1234, CABA"
                disabled={busy}
                className={companyErrors.address ? 'input-error' : undefined}
                aria-invalid={companyErrors.address ? true : undefined}
              />
              {companyErrors.address ? (
                <p className="field-error">{companyErrors.address}</p>
              ) : null}
            </div>
          </div>

          <div className="onboarding-actions">
            <div className="action-left" />
            <div className="action-center">
              {application ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleSaveOnly}
                  disabled={busy}
                >
                  {savingApplication ? 'Guardando...' : 'Guardar cambios'}
                </button>
              ) : null}
            </div>
            <div className="action-right">
              <button
                type="button"
                className="nav-button nav-button--primary"
                onClick={handleNextFromStep1}
                disabled={busy}
              >
                {creatingCompany ? 'Creando...' : 'Siguiente →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Paso 2: Sucursales ── */}
      {currentStep === 2 && (
        <>
          <div className="onboarding-section">
            <h3>Sucursales</h3>
            <p className="section-hint">
              Declarar al menos una sucursal con nombre y domicilio.
            </p>
          </div>
          <BranchesStep
            branches={branches}
            disabled={busy}
            onChange={setBranches}
          />
          {step2Error ? (
            <p className="field-error" style={{ paddingLeft: '4px' }}>
              {step2Error}
            </p>
          ) : null}
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
            <div className="action-center">
              {application ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleSaveOnly}
                  disabled={busy}
                >
                  {savingApplication ? 'Guardando...' : 'Guardar cambios'}
                </button>
              ) : null}
            </div>
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

      {/* ── Paso 3: Documentación ── */}
      {currentStep === 3 && (
        <>
          <DocumentsStep
            docsCount={application?.docsCount ?? 0}
            pending={addingDocument}
            disabled={busy}
            onAdd={onAddDocument}
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
            <div className="action-center">
              {application ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleSaveOnly}
                  disabled={busy}
                >
                  {savingApplication ? 'Guardando...' : 'Guardar cambios'}
                </button>
              ) : null}
            </div>
            <div className="action-right">
              <button
                type="button"
                className="nav-button nav-button--primary"
                onClick={onSubmit}
                disabled={!canSubmit}
                title={
                  canSubmit
                    ? undefined
                    : 'Agregá al menos una sucursal para poder enviar la solicitud.'
                }
              >
                {submitting
                  ? 'Enviando...'
                  : pendingReview
                    ? 'Actualizar solicitud'
                    : 'Enviar para revisión'}
              </button>
            </div>
          </div>
          {validBranches.length === 0 &&
          (application?.declaredBranchCount ?? 0) === 0 ? (
            <p className="section-hint" style={{ paddingLeft: '4px' }}>
              Agregá al menos una sucursal y guardá los cambios para poder
              enviar la solicitud.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

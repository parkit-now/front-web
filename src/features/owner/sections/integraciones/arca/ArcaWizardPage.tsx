import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../../../../../lib/api/client';
import { Alert } from '../../../../../shared/components/ui/Alert';
import { Button } from '../../../../../shared/components/ui/Button';
import { Card } from '../../../../../shared/components/ui/Card';
import { Input } from '../../../../../shared/components/ui/Input';
import { RequiredMark } from '../../../../../shared/components/ui/RequiredMark';
import {
  IconAlert,
  IconCheck,
  IconCheckCircle,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconExternalLink,
  IconXCircle,
} from '../../../../../shared/components/icons';
import { SectionHeader } from '../../../../../shared/components/SectionHeader';
import { useToast } from '../../../../../lib/notifications/ToastProvider';
import { translateApiError } from '../../../../../lib/api/translate';
import { useSucursal } from '../../../context/SucursalContext';
import {
  arcaAccountQueryKey,
  useArcaAccount,
} from '../../../hooks/useArcaAccount';
import {
  createArcaAccount,
  getArcaCsr,
  listArcaReusableCertificates,
  reuseArcaCertificate,
  setArcaSalesPoint,
  updateArcaAccount,
  uploadArcaCertificate,
  uploadArcaSalesPointConstancia,
  type ArcaAccount,
  type ArcaCertificateResult,
  type ArcaCsr,
  type ArcaEnvironment,
  type ArcaTaxCondition,
} from '../../../services/arca';
import { fmtDateTimeAr } from '../../../../../shared/utils/fmt';
import { ARCA_TAX_CONDITION_LABELS, formatCuit } from '../validation';
import {
  resolveArcaStep1ViewMode,
  resolveArcaStep2ViewMode,
  resolveArcaWizardStep,
  resolveClickableArcaWizardSteps,
  validateArcaConstancia,
  validateArcaFiscalDataForm,
  validateArcaPtoVta,
  validateArcaStep1Form,
  validatePastedCertificate,
  type ArcaFiscalDataFormValues,
  type ArcaWizardNumericStep,
  type ArcaWizardStep,
} from './wizard';
import { normalizeArcaCuit } from './cuit';
import {
  ARCA_LOGIN_URL,
  ARCA_ADMIN_RELACIONES_URL,
  SUPPORT_CONTACT,
} from './links';
import {
  applyCertVerifyError,
  EMPTY_CERT_PROGRESS,
  loadCertProgress,
  markCertSubstepDone,
  resolveCertSubstepState,
  resolveCertVerifyErrorEffect,
  resolveOpenCertSubstep,
  toggleExpandedCertSubstep,
  resolvePreviousCertSubstep,
  saveCertProgress,
  type CertProgress,
  type CertSubstepId,
  type CertSubstepVisualState,
} from './certSubsteps';

const ROW: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 10,
};

const HINT: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  lineHeight: 1.55,
  color: 'var(--text-2)',
};

/** Baja `content` como un archivo de texto, sin pasar por el servidor. */
function downloadTextFile(fileName: string, content: string): void {
  const blob = new Blob([content], { type: 'application/x-pem-file' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** El `code` estable del problem details, para decidir qué sub-paso marcar. */
function readProblemCode(error: unknown): string | undefined {
  if (!(error instanceof ApiError)) return undefined;
  const code = (error.problem as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : undefined;
}

/**
 * Wizard de 3 pasos para vincular ARCA, calcado del patrón de `DraftWizard`
 * (onboarding): retoma el paso desde el estado de la cuenta, no desde el
 * historial de navegación. `resolveArcaWizardStep` hace esa cuenta.
 */
export function ArcaWizardPage() {
  const { showToast } = useToast();
  const { sucursalId, sucursal } = useSucursal();
  const queryClient = useQueryClient();
  const canManage = sucursal?.role === 'owner';

  const accountQuery = useArcaAccount(sucursalId);
  const account = accountQuery.data ?? null;

  // Sólo mientras se está subiendo el certificado: pausa el paso 2 en la
  // confirmación del padrón (o el formulario de datos fiscales) hasta que el
  // dueño la vea, aunque la cuenta ya haya avanzado de estado.
  const [certResult, setCertResult] = useState<ArcaCertificateResult | null>(
    null,
  );

  // ── Volver a un paso anterior desde el stepper ─────────────────────────────
  // `null` = seguir el paso natural (`resolveArcaWizardStep`). Un valor acá es
  // "el dueño clickeó un paso ya alcanzado para volver a mirarlo": nunca
  // apunta a un paso más adelantado que el natural (sólo se llega acá vía
  // `resolveClickableArcaWizardSteps`, que ya lo garantiza).
  const [viewStep, setViewStep] = useState<ArcaWizardNumericStep | null>(null);
  // Reactivar "Cargar otro certificado" (recap del paso 2) muestra el
  // acordeón aunque la cuenta ya esté en `pending_sales_point`.
  const [reissuingCertificate, setReissuingCertificate] = useState(false);

  useEffect(() => {
    // Cualquier cambio real de estado de la cuenta (avanzar de paso, o
    // reiniciar por "Cambiar CUIT") invalida un "volver" que haya quedado
    // pisado: se vuelve a seguir el paso natural.
    setViewStep(null);
    setReissuingCertificate(false);
  }, [account?.id, account?.status]);

  // ── Progreso del acordeón de sub-pasos (paso 2) ────────────────────────────
  // Persistido en localStorage por cuenta: si el dueño recarga o vuelve de la
  // pestaña de ARCA, retoma donde había quedado (ver `certSubsteps.ts`).
  const [certProgress, setCertProgress] =
    useState<CertProgress>(EMPTY_CERT_PROGRESS);
  const [certVerifyError, setCertVerifyError] = useState<{
    message: string;
    /** El sub-paso culpable (4 o 5), o `null` si el error no apunta a uno. */
    culpritSubstep: CertSubstepId | null;
  } | null>(null);

  useEffect(() => {
    if (!account) return;
    setCertProgress(loadCertProgress(sucursalId, account.id));
    // Un progreso guardado de OTRA cuenta (ej. se desvinculó y volvió a
    // arrancar) no tiene por qué traer un error viejo colgando.
    setCertVerifyError(null);
    // Sólo cuando cambia la cuenta (no en cada re-render, que redisparía la
    // lectura de storage y pisaría lo que el dueño acaba de tildar).
  }, [account?.id, sucursalId]);

  function updateCertProgress(updater: (prev: CertProgress) => CertProgress) {
    setCertProgress((prev) => {
      const next = updater(prev);
      if (account) saveCertProgress(sucursalId, account.id, next);
      return next;
    });
  }

  function handleCertSubstepDone(id: CertSubstepId) {
    updateCertProgress((prev) => markCertSubstepDone(prev, id));
    setCertVerifyError(null);
  }

  /**
   * Después de un `POST account` (que reinicia la cuenta en
   * `pending_certificate`) el progreso del acordeón queda en `localStorage`
   * bajo la cuenta VIEJA. Si el backend
   * reutiliza el mismo id, además, ni el `useEffect` que lee el storage por
   * `account.id` se dispara solo (el id no cambió) — por eso se limpia acá
   * explícito, para el id que sea.
   */
  function resetCertProgressAfterCuitChange(newAccountId: string) {
    setCertProgress(EMPTY_CERT_PROGRESS);
    setCertVerifyError(null);
    saveCertProgress(sucursalId, newAccountId, EMPTY_CERT_PROGRESS);
    setViewStep(null);
  }

  // Escribe la cuenta que devolvió la mutación DIRECTO en la caché, en vez de
  // sólo invalidar y esperar el refetch: cada paso decide qué pintar mirando
  // `account.status`, y la vuelta de red de un `invalidateQueries` tarda lo
  // suyo. Sin esto, justo después de subir el certificado el paso 2 seguía
  // mostrando el formulario de subida un instante (con el estado viejo en
  // caché) en vez de saltar al resumen del padrón.
  function syncAccount(next: ArcaAccount) {
    queryClient.setQueryData(arcaAccountQueryKey(sucursalId), next);
  }

  function onMutationError(endpoint: Parameters<typeof translateApiError>[1]) {
    return (error: unknown) =>
      showToast({ message: translateApiError(error, endpoint), kind: 'error' });
  }

  // ── Paso 1: datos comerciales ──────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (input: { cuit: string; iibb: string }) =>
      createArcaAccount(sucursalId, {
        cuit: input.cuit,
        ...(input.iibb.trim() ? { iibb: input.iibb.trim() } : {}),
      }),
    // Toda solicitud nueva (primera vez, "Cambiar CUIT" o volver a vincular
    // después de desvincular) arranca el paso 2 de cero. Al re-vincular el
    // backend reutiliza la fila, o sea el mismo `account.id`: sin esto el
    // acordeón abría con el progreso viejo. Y el CSR cacheado es el de la
    // solicitud ANTERIOR: copiarlo daría un certificado para otra clave.
    onSuccess: (next) => {
      syncAccount(next);
      resetCertProgressAfterCuitChange(next.id);
      queryClient.removeQueries({ queryKey: ['arca', 'csr', sucursalId] });
    },
    onError: onMutationError({ endpoint: 'arca.createAccount' }),
  });

  // ── Paso 2: certificado ─────────────────────────────────────────────────────
  // Se trae SOLO con llegar al paso (no con un botón): homologación la
  // necesita para el textarea de "pegar en ARCA", que es el camino principal
  // ahí, no un extra detrás de un click.
  const csrQuery = useQuery({
    queryKey: ['arca', 'csr', sucursalId],
    queryFn: () => getArcaCsr(sucursalId),
    // También mientras se "carga otro certificado" desde el recap del paso
    // 2: ahí también se puede reabrir el sub-paso 3, que necesita el CSR.
    enabled:
      Boolean(sucursalId) &&
      (account?.status === 'pending_certificate' || reissuingCertificate),
  });

  const reusableQuery = useQuery({
    queryKey: ['arca', 'reusable-certificates', sucursalId],
    queryFn: () => listArcaReusableCertificates(sucursalId),
    enabled: Boolean(sucursalId) && account?.status === 'pending_certificate',
  });

  const reuseMutation = useMutation({
    mutationFn: (fromTenantId: string) =>
      reuseArcaCertificate(sucursalId, { fromTenantId }),
    onSuccess: (result) => {
      syncAccount(result);
      showToast({
        message: 'Reutilizamos el certificado de esa sede.',
        kind: 'success',
      });
    },
    onError: onMutationError({ endpoint: 'arca.reuseCertificate' }),
  });

  const uploadCertMutation = useMutation({
    mutationFn: (certificate: string) =>
      uploadArcaCertificate(sucursalId, { certificate }),
    onSuccess: (result) => {
      if (reissuingCertificate) {
        // El backend acepta un certificado nuevo con la cuenta ya en
        // `pending_sales_point`: no hay resumen de padrón que mostrar de
        // nuevo, sólo volver al recap (que ahora refleja el certificado
        // nuevo: alias igual, `certExpiresAt` actualizado).
        setReissuingCertificate(false);
        syncAccount(result.account);
        showToast({
          message: 'Cargamos el certificado nuevo.',
          kind: 'success',
        });
        return;
      }
      setCertResult(result);
      syncAccount(result.account);
    },
    onError: (error) => {
      const code = readProblemCode(error);
      const effect = resolveCertVerifyErrorEffect(code);
      updateCertProgress((prev) => applyCertVerifyError(prev, code));
      setCertVerifyError({
        culpritSubstep: effect.culpritSubstep,
        message: translateApiError(error, {
          endpoint: 'arca.uploadCertificate',
        }),
      });
    },
  });

  const updateFiscalMutation = useMutation({
    mutationFn: (input: {
      razonSocial: string;
      condicionIva: ArcaTaxCondition;
      domicilioFiscal: string;
      inicioActividad?: string;
    }) => updateArcaAccount(sucursalId, input),
    onSuccess: (result) => {
      setCertResult(null);
      syncAccount(result);
    },
    onError: onMutationError({ endpoint: 'arca.updateAccount' }),
  });

  // ── Paso 3: punto de venta ───────────────────────────────────────────────────
  const salesPointMutation = useMutation({
    mutationFn: async (input: { ptoVta: number; constancia: File | null }) => {
      if (input.constancia) {
        await uploadArcaSalesPointConstancia(sucursalId, input.constancia);
      }
      return setArcaSalesPoint(sucursalId, { ptoVta: input.ptoVta });
    },
    onSuccess: (result) => {
      syncAccount(result);
      showToast({ message: 'ARCA quedó vinculada.', kind: 'success' });
    },
    onError: onMutationError({ endpoint: 'arca.setSalesPoint' }),
  });

  if (accountQuery.isLoading) {
    return (
      <div>
        <SectionHeader title="Vincular ARCA" />
        <div className="pk-card pk-card-pad" style={{ minHeight: 160 }}>
          <p style={{ color: 'var(--text-3)', fontSize: 14 }}>Cargando...</p>
        </div>
      </div>
    );
  }

  if (accountQuery.isError) {
    return (
      <div>
        <SectionHeader title="Vincular ARCA" />
        <Alert
          variant="err"
          icon={<IconAlert size={16} />}
          title="No pudimos consultar tu integración con ARCA"
          description={translateApiError(accountQuery.error, {
            endpoint: 'arca.getAccount',
          })}
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void accountQuery.refetch()}
            >
              Reintentar
            </Button>
          }
        />
      </div>
    );
  }

  if (!canManage) {
    return (
      <div>
        <SectionHeader title="Vincular ARCA" />
        <Alert
          variant="warn"
          icon={<IconAlert size={16} />}
          title="Sólo el dueño puede vincular ARCA"
          description="Pedile a un dueño de esta sede que complete la vinculación."
          action={
            <Link
              to="../integraciones"
              className="pk-btn pk-btn-secondary pk-btn-sm"
              style={{ textDecoration: 'none' }}
            >
              Volver a Integraciones
            </Link>
          }
        />
      </div>
    );
  }

  const naturalStep = resolveArcaWizardStep(account);
  // Nunca apunta más adelante que `naturalStep`: sólo se llega a `viewStep`
  // clickeando un paso de `resolveClickableArcaWizardSteps`, que ya lo exige.
  const displayStep: ArcaWizardNumericStep =
    viewStep ?? (naturalStep === 'done' ? 3 : naturalStep);

  return (
    <div>
      <SectionHeader
        title="Vincular ARCA"
        subtitle="Facturación electrónica automática al cobrar."
      />

      {/*
        El dueño se confundió pensando que WSASS era de producción. El aviso
        va arriba de TODO el wizard (no sólo del paso 2) porque homologación
        también condiciona el paso 3 (punto de venta). Sin cuenta todavía no
        sabemos el entorno, así que no hace falta mostrarlo.
      */}
      {account !== null && account.environment === 'homologacion' && (
        <div style={{ marginBottom: 12 }}>
          <Alert
            variant="info"
            icon={<IconAlert size={16} />}
            title="Modo de prueba (homologación)"
            description="Estás vinculando el entorno de pruebas de ARCA: las facturas no tienen validez fiscal. En producción los pasos cambian (se usa «Administración de Certificados Digitales» en lugar de WSASS)."
          />
        </div>
      )}

      <Stepper
        naturalStep={naturalStep}
        activeStep={displayStep}
        onStepClick={setViewStep}
      />

      <Card padding="lg">
        {naturalStep === 'done' ? (
          <WizardDone />
        ) : (
          <>
            {displayStep === 1 &&
              (resolveArcaStep1ViewMode(naturalStep) === 'form' ? (
                <Step1Form
                  pending={createMutation.isPending}
                  onSubmit={(values) => createMutation.mutate(values)}
                />
              ) : (
                account !== null && (
                  <Step1Recap
                    cuit={account.cuit}
                    iibb={account.iibb ?? null}
                    pending={createMutation.isPending}
                    onContinue={() => setViewStep(null)}
                    onChangeCuit={(values) => createMutation.mutate(values)}
                  />
                )
              ))}

            {displayStep === 2 &&
              resolveArcaStep2ViewMode(naturalStep) === 'in_progress' && (
                <>
                  {account !== null &&
                    account.status === 'pending_certificate' && (
                      <Step2Upload
                        account={account}
                        csr={csrQuery.data ?? null}
                        csrLoading={csrQuery.isLoading}
                        reusable={reusableQuery.data ?? []}
                        reusing={reuseMutation.isPending}
                        verifying={uploadCertMutation.isPending}
                        progress={certProgress}
                        verifyError={certVerifyError}
                        onSubstepDone={handleCertSubstepDone}
                        onReuse={(fromTenantId) =>
                          reuseMutation.mutate(fromTenantId)
                        }
                        onVerify={(certificate) => {
                          setCertVerifyError(null);
                          uploadCertMutation.mutate(certificate);
                        }}
                      />
                    )}

                  {account !== null &&
                    account.status === 'pending_sales_point' &&
                    certResult?.padronFound && (
                      <PadronSummary
                        account={certResult.account}
                        onContinue={() => setCertResult(null)}
                      />
                    )}

                  {account !== null &&
                    account.status === 'pending_sales_point' &&
                    !certResult?.padronFound && (
                      <FiscalDataForm
                        environment={account.environment}
                        pending={updateFiscalMutation.isPending}
                        onSubmit={(values) =>
                          updateFiscalMutation.mutate({
                            razonSocial: values.razonSocial,
                            condicionIva:
                              values.condicionIva as ArcaTaxCondition,
                            domicilioFiscal: values.domicilioFiscal,
                            ...(values.inicioActividad
                              ? { inicioActividad: values.inicioActividad }
                              : {}),
                          })
                        }
                      />
                    )}
                </>
              )}

            {displayStep === 2 &&
              resolveArcaStep2ViewMode(naturalStep) === 'recap' &&
              account !== null &&
              (reissuingCertificate ? (
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
                >
                  <div style={ROW}>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<IconChevronLeft size={14} />}
                      onClick={() => setReissuingCertificate(false)}
                    >
                      Cancelar y volver al resumen
                    </Button>
                  </div>
                  <Step2Upload
                    account={account}
                    csr={csrQuery.data ?? null}
                    csrLoading={csrQuery.isLoading}
                    reusable={[]}
                    reusing={false}
                    verifying={uploadCertMutation.isPending}
                    // Progreso FORZADO, no el real (`certProgress`): los
                    // sub-pasos 1 a 3 se dan por hechos (la cuenta ya está
                    // certificada, no tiene sentido pedirle que los repita) y
                    // se arranca siempre limpio en el 4, así sea que la
                    // primera vuelta ya los haya dejado en 4 o 5 (por
                    // ejemplo, si el certificado venía de "reutilizar el de
                    // otra sede", sin pasar por el acordeón). No se persiste:
                    // es sólo para ESTA pantalla.
                    progress={REISSUE_CERT_PROGRESS}
                    verifyError={certVerifyError}
                    onSubstepDone={handleCertSubstepDone}
                    onReuse={() => {
                      /* No aplica: ya hay un certificado vinculado a esta cuenta. */
                    }}
                    onVerify={(certificate) => {
                      setCertVerifyError(null);
                      uploadCertMutation.mutate(certificate);
                    }}
                  />
                </div>
              ) : (
                <Step2Recap
                  account={account}
                  onContinue={() => setViewStep(null)}
                  onReissue={() => setReissuingCertificate(true)}
                />
              ))}

            {displayStep === 3 && account !== null && (
              <Step3Form
                account={account}
                pending={salesPointMutation.isPending}
                onSubmit={(values) => salesPointMutation.mutate(values)}
              />
            )}
          </>
        )}
      </Card>
    </div>
  );
}

// ── Stepper ──────────────────────────────────────────────────────────────────

/**
 * El stepper de arriba. Clickeable en los pasos ya alcanzados
 * (`resolveClickableArcaWizardSteps`): sirve para volver a mirarlos, no para
 * saltar para adelante. Con la cuenta `linked` (`naturalStep === 'done'`)
 * ninguno es clickeable — ya no se puede cambiar nada desde acá.
 */
function Stepper({
  naturalStep,
  activeStep,
  onStepClick,
}: {
  naturalStep: ArcaWizardStep;
  activeStep: ArcaWizardNumericStep;
  onStepClick: (step: ArcaWizardNumericStep) => void;
}) {
  const doneThreshold = naturalStep === 'done' ? 4 : naturalStep;
  const clickable = resolveClickableArcaWizardSteps(naturalStep);
  const labels = ['Datos comerciales', 'Certificado ARCA', 'Punto de venta'];
  return (
    <div style={{ ...ROW, marginBottom: 16 }}>
      {labels.map((label, index) => {
        const n = (index + 1) as ArcaWizardNumericStep;
        const done = doneThreshold > n;
        const active = activeStep === n;
        const isClickable = clickable.includes(n);
        return (
          <span
            key={label}
            style={{ display: 'inline-flex', alignItems: 'center' }}
          >
            <button
              type="button"
              disabled={!isClickable}
              onClick={() => onStepClick(n)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: active ? 600 : 500,
                color: active || done ? 'var(--text-1)' : 'var(--text-3)',
                background: 'none',
                border: 'none',
                padding: 0,
                font: 'inherit',
                cursor: isClickable ? 'pointer' : 'default',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  fontSize: 11,
                  background: done
                    ? 'var(--brand)'
                    : active
                      ? 'var(--brand-soft)'
                      : 'var(--border-soft)',
                  color: done
                    ? '#fff'
                    : active
                      ? 'var(--brand)'
                      : 'var(--text-3)',
                }}
              >
                {done ? <IconCheck size={12} /> : n}
              </span>
              {label}
            </button>
            {index < labels.length - 1 ? (
              <span style={{ color: 'var(--border)', margin: '0 4px' }}>›</span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

// ── Paso 1 ───────────────────────────────────────────────────────────────────

function Step1Form({
  pending,
  onSubmit,
  initialValues,
  submitLabel = 'Continuar',
}: {
  pending: boolean;
  onSubmit: (values: { cuit: string; iibb: string }) => void;
  /** Sólo para "Cambiar CUIT": arranca con lo que ya tenía cargado la cuenta. */
  initialValues?: { cuit: string; iibb: string };
  submitLabel?: string;
}) {
  const [cuit, setCuit] = useState(initialValues?.cuit ?? '');
  const [iibb, setIibb] = useState(initialValues?.iibb ?? '');
  const [errors, setErrors] = useState<{ cuit?: string }>({});

  function handleSubmit() {
    const validation = validateArcaStep1Form({ cuit, iibb });
    if (validation.cuit) {
      setErrors(validation);
      return;
    }
    setErrors({});
    onSubmit({ cuit: normalizeArcaCuit(cuit), iibb });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600 }}>
          Datos comerciales
        </h3>
        <p style={HINT}>
          El CUIT con el que vas a facturar. Lo verificamos contra ARCA más
          adelante, en el paso del certificado.
        </p>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Input
            label="CUIT"
            required
            placeholder="20-12345678-6"
            inputMode="numeric"
            value={cuit}
            error={errors.cuit ?? undefined}
            onChange={(e) => {
              setCuit(e.target.value);
              if (errors.cuit) setErrors({});
            }}
            disabled={pending}
          />
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)' }}>
            Con o sin guiones.
          </p>
        </div>
        <Input
          label="Ingresos Brutos (opcional)"
          placeholder="901-123456-7"
          value={iibb}
          onChange={(e) => setIibb(e.target.value)}
          disabled={pending}
        />
      </div>
      <div style={ROW}>
        <Button variant="primary" loading={pending} onClick={handleSubmit}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

/**
 * Resumen de sólo lectura del paso 1, para cuando el dueño vuelve a mirarlo
 * desde el stepper con la cuenta ya creada. Cambiar el CUIT reinicia la
 * vinculación (mismo `POST account` de siempre), así que va detrás de un
 * aviso y un segundo click.
 */
function Step1Recap({
  cuit,
  iibb,
  pending,
  onContinue,
  onChangeCuit,
}: {
  cuit: string;
  iibb: string | null;
  pending: boolean;
  onContinue: () => void;
  onChangeCuit: (values: { cuit: string; iibb: string }) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Alert
          variant="warn"
          icon={<IconAlert size={16} />}
          title="Cambiar el CUIT reinicia la vinculación"
          description="Se genera una solicitud nueva: el certificado que hayas creado en ARCA con el CUIT anterior deja de servir y vas a tener que repetir el paso 2."
        />
        <Step1Form
          pending={pending}
          initialValues={{ cuit, iibb: iibb ?? '' }}
          submitLabel="Guardar y reiniciar"
          onSubmit={onChangeCuit}
        />
        <div style={ROW}>
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => setEditing(false)}
          >
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600 }}>
          Datos comerciales
        </h3>
        <p style={HINT}>Ya cargados; sólo se pueden ver o reiniciar.</p>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
        }}
      >
        <InfoRow label="CUIT" value={formatCuit(cuit)} />
        <InfoRow label="Ingresos Brutos" value={iibb ?? 'Sin datos'} />
      </div>
      <div style={ROW}>
        <Button variant="primary" onClick={onContinue}>
          Continuar
        </Button>
        <Button variant="secondary" onClick={() => setEditing(true)}>
          Cambiar CUIT
        </Button>
      </div>
    </div>
  );
}

// ── Paso 2: certificado ──────────────────────────────────────────────────────

/**
 * Link a ARCA, siempre a la misma URL de login (ver `links.ts`: los
 * servicios internos no se pueden linkear directo, exigen la sesión SSO del
 * portal).
 */
function ArcaLoginLink() {
  return (
    <a
      href={ARCA_LOGIN_URL}
      target="_blank"
      rel="noopener noreferrer"
      // Primario (azul): es LA acción del sub-paso, tiene que saltar a la vista.
      className="pk-btn pk-btn-primary pk-btn-sm"
      style={{
        textDecoration: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        // Ancho del contenido, tanto en contenedores flex como grid.
        alignSelf: 'flex-start',
        justifySelf: 'start',
      }}
    >
      Entrar a ARCA
      <IconExternalLink size={13} />
    </a>
  );
}

/** Link en línea a una pantalla de ARCA (azul, subrayado, nueva pestaña). */
function ArcaInlineLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        color: 'var(--brand)',
        textDecoration: 'underline',
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
      }}
    >
      {children}
      <IconExternalLink size={12} />
    </a>
  );
}

/** Un valor para pegar en ARCA (alias, CUIT...), en monoespaciado, con botón de copiar. */
function CopyRow({
  label,
  displayValue,
  copyValue,
}: {
  label: string;
  displayValue: string;
  copyValue: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(copyValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin permiso de portapapeles: el valor ya está a la vista para copiar
      // a mano, no hace falta avisar con un error.
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
        padding: '8px 12px',
        background: 'var(--surface-2, var(--bg-2))',
        borderRadius: 'var(--r-md)',
        border: '1px solid var(--border-soft)',
      }}
    >
      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{label}</span>
      <code style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
        {displayValue}
      </code>
      <Button variant="ghost" size="sm" onClick={() => void handleCopy()}>
        {copied ? 'Copiado' : 'Copiar'}
      </Button>
    </div>
  );
}

/** Igual que `CopyRow`, sin botón de copiar: para la tabla del sub-paso 5, que es informativa. */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
        padding: '8px 12px',
        background: 'var(--surface-2, var(--bg-2))',
        borderRadius: 'var(--r-md)',
        border: '1px solid var(--border-soft)',
      }}
    >
      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{label}</span>
      <code style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
        {value}
      </code>
    </div>
  );
}

/**
 * Botón único para copiar el CSR al portapapeles, sin mostrar el texto: es un
 * bloque largo que no aporta nada mirado de arriba a abajo, sólo hay que
 * pegarlo en ARCA.
 */
function CopyCsrButton({
  csr,
  loading,
}: {
  csr: ArcaCsr | null;
  loading: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!csr) return;
    try {
      await navigator.clipboard.writeText(csr.csrPem);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin permiso de portapapeles no hay mucho más para ofrecer acá: el
      // botón no tiene un texto visible de respaldo (a propósito, ver spec).
    }
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      loading={loading}
      disabled={!csr}
      onClick={() => void handleCopy()}
    >
      {copied ? '¡Copiada!' : 'Copiar solicitud al portapapeles'}
    </Button>
  );
}

/**
 * El certificado que devuelve ARCA, pegado a mano: es el único camino. Antes
 * había un link para subir el archivo `.crt` en vez de pegarlo, pero el
 * dueño lo probó y no le servía de nada, así que se sacó junto con el input
 * de archivo que lo respaldaba.
 *
 * `error` sólo se pinta cuando el dueño ya escribió algo (ver
 * `validatePastedCertificate`): con el campo vacío no hay nada que
 * "corregir" todavía.
 */
function CertificateTextarea({
  value,
  onChange,
  disabled,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  error: string | null;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          '-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----'
        }
        rows={8}
        disabled={disabled}
        aria-label="Certificado"
        aria-invalid={error ? true : undefined}
        style={{
          fontFamily: 'monospace',
          fontSize: 12,
          padding: 8,
          borderRadius: 'var(--r-md)',
          border: `1px solid ${error ? 'var(--err-border)' : 'var(--border-soft)'}`,
          resize: 'vertical',
        }}
      />
      {error && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--err-text)' }}>
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Capturas de los manuales oficiales de ARCA (WSASS y "Cómo adherirse"), con
 * CUIT y nombres tapados. Sólo hay para homologación por ahora. Clickeable
 * para verla en grande (se abre en una pestaña nueva: no hace falta un
 * visor propio).
 */
function GuideImage({ src, alt }: { src: string; alt: string }) {
  return (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      style={{ display: 'inline-block', alignSelf: 'flex-start' }}
    >
      <img
        src={src}
        alt={alt}
        style={{
          display: 'block',
          width: '100%',
          maxWidth: 560,
          borderRadius: 'var(--r-md)',
          border: '1px solid var(--border-soft)',
        }}
      />
    </a>
  );
}

/** Desplegable nativo para la info secundaria ("¿no te aparece...?", "¿ya existe...?"). */
function Disclosure({
  summary,
  children,
}: {
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <details>
      <summary
        style={{
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--brand)',
        }}
      >
        {summary}
      </summary>
      <div style={{ marginTop: 10, display: 'grid', gap: 12, paddingLeft: 2 }}>
        {children}
      </div>
    </details>
  );
}

/** El círculo de estado en el título de cada sub-paso del acordeón. */
function CertSubstepBadge({
  id,
  state,
}: {
  id: CertSubstepId;
  state: CertSubstepVisualState;
}) {
  const common: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
    height: 22,
    borderRadius: '50%',
    fontSize: 11,
    fontWeight: 700,
    flexShrink: 0,
  };
  if (state === 'completed') {
    return (
      <span style={{ ...common, background: 'var(--ok-text)', color: '#fff' }}>
        <IconCheck size={12} />
      </span>
    );
  }
  if (state === 'error') {
    return (
      <span style={{ ...common, background: 'var(--err-text)', color: '#fff' }}>
        <IconXCircle size={13} />
      </span>
    );
  }
  if (state === 'current') {
    return (
      <span
        style={{
          ...common,
          background: 'var(--brand-soft)',
          color: 'var(--brand)',
          border: '1.5px solid var(--brand)',
        }}
      >
        {id}
      </span>
    );
  }
  return (
    <span
      style={{
        ...common,
        background: 'var(--border-soft)',
        color: 'var(--text-3)',
      }}
    >
      {id}
    </span>
  );
}

/** Un sub-paso del acordeón: título + contenido, y si tiene el botón "Listo, sigo →". */
/** La acción primaria del pie de un sub-paso: "Listo, sigo →" (1 a 4) o "Verificar" (el 5). */
interface CertSubstepPrimaryAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Sólo el 5 lo usa: "Puede tardar varios segundos...". */
  loadingHint?: string;
  variant?: 'primary' | 'secondary';
}

interface CertSubstepDef {
  id: CertSubstepId;
  title: string;
  body: React.ReactNode;
  primaryAction: CertSubstepPrimaryAction;
}

/**
 * El acordeón de sub-pasos, bloqueado en secuencia (no se puede abrir el N+1
 * sin completar el N). Cada sub-paso disponible (completado o el actual) se
 * abre y se cierra por separado con su título; los bloqueados no. El estado
 * de cada título lo decide `resolveCertSubstepState` (`certSubsteps.ts`),
 * puro y testeado; acá sólo se pinta.
 *
 * Lo abierto es estado LOCAL: no toca el progreso. Cuando el progreso cambia
 * (se completó un sub-paso, o volvió un error de "Verificar") se cierra todo
 * y queda abierto sólo el sub-paso natural, para guiar al siguiente. "Volver"
 * hace lo mismo con el anterior.
 */
/**
 * Progreso con el que se abre el acordeón al "Cargar otro certificado":
 * los sub-pasos 1–3 dados por hechos, arranca en el 4. Constante de módulo y
 * no un literal en el JSX: el acordeón reinicia lo abierto cuando cambia la
 * referencia del progreso, y un literal nuevo en cada render lo reiniciaría
 * siempre.
 */
const REISSUE_CERT_PROGRESS: CertProgress = {
  completed: [1, 2, 3],
  errorSubstep: null,
};

function CertSubstepAccordion({
  substeps,
  progress,
  verifyError,
}: {
  substeps: readonly CertSubstepDef[];
  progress: CertProgress;
  verifyError: {
    message: string;
    culpritSubstep: CertSubstepId | null;
  } | null;
}) {
  const [expanded, setExpanded] = useState<CertSubstepId[]>(() => [
    resolveOpenCertSubstep(progress),
  ]);
  useEffect(() => {
    setExpanded([resolveOpenCertSubstep(progress)]);
  }, [progress]);

  function handleBack(id: CertSubstepId) {
    const previous = resolvePreviousCertSubstep(id);
    if (previous !== null) setExpanded([previous]);
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {substeps.map((s) => {
        const state = resolveCertSubstepState(s.id, progress);
        const locked = state === 'locked';
        const isOpen = expanded.includes(s.id);
        return (
          <div
            key={s.id}
            style={{
              border: '1px solid var(--border-soft)',
              borderRadius: 'var(--r-md)',
              overflow: 'hidden',
            }}
          >
            <button
              type="button"
              onClick={() =>
                setExpanded((prev) =>
                  toggleExpandedCertSubstep(prev, s.id, progress),
                )
              }
              disabled={locked}
              aria-expanded={isOpen}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                background: isOpen ? 'var(--brand-soft)' : 'transparent',
                border: 'none',
                cursor: locked ? 'not-allowed' : 'pointer',
                textAlign: 'left',
              }}
            >
              <CertSubstepBadge id={s.id} state={state} />
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: locked ? 'var(--text-3)' : 'var(--text-1)',
                }}
              >
                {s.title}
              </span>
              {!locked && (
                <span
                  aria-hidden
                  style={{ marginLeft: 'auto', color: 'var(--text-3)' }}
                >
                  {isOpen ? (
                    <IconChevronDown size={16} />
                  ) : (
                    <IconChevronRight size={16} />
                  )}
                </span>
              )}
            </button>
            {isOpen && (
              <div
                style={{
                  padding: '12px 14px 16px',
                  display: 'grid',
                  gap: 12,
                  borderTop: '1px solid var(--border-soft)',
                }}
              >
                {/*
                  El error de "Verificar" siempre se lee ACÁ, en el sub-paso
                  6: es donde vive el botón, así que no importa cuál haya
                  sido el sub-paso culpable (`resolveCertVerifyErrorEffect`
                  siempre devuelve `openSubstep: 6`). Ese culpable (4 o 5) ya
                  está marcado en rojo en su propio título; acá sólo se
                  nombra, como pista de adónde ir.
                */}
                {verifyError && s.id === 6 && (
                  <>
                    <Alert
                      variant="err"
                      icon={<IconAlert size={16} />}
                      title="No pudimos verificar la vinculación"
                      description={`${verifyError.message} ${
                        verifyError.culpritSubstep !== null
                          ? `Revisá el paso ${verifyError.culpritSubstep} («${
                              substeps.find(
                                (x) => x.id === verifyError.culpritSubstep,
                              )?.title ?? ''
                            }»), que quedó marcado en rojo, y volvé a verificar.`
                          : 'Revisá que hayas completado todos los pasos y volvé a intentar.'
                      }`}
                    />
                    <p
                      style={{
                        margin: 0,
                        fontSize: 12,
                        color: 'var(--text-3)',
                      }}
                    >
                      Si el problema sigue,{' '}
                      {SUPPORT_CONTACT ? (
                        <a
                          href={SUPPORT_CONTACT.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--brand)' }}
                        >
                          {SUPPORT_CONTACT.label}
                        </a>
                      ) : (
                        'contactá a soporte'
                      )}
                      .
                    </p>
                  </>
                )}
                {s.body}
                <div style={ROW}>
                  {s.id > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<IconChevronLeft size={14} />}
                      aria-label="Volver al paso anterior"
                      style={{ color: 'var(--err-text)' }}
                      onClick={() => handleBack(s.id)}
                    >
                      Volver
                    </Button>
                  )}
                  <Button
                    variant={s.primaryAction.variant ?? 'secondary'}
                    size="sm"
                    loading={s.primaryAction.loading}
                    disabled={s.primaryAction.disabled}
                    onClick={s.primaryAction.onClick}
                  >
                    {s.primaryAction.label}
                  </Button>
                  {s.primaryAction.loading && s.primaryAction.loadingHint && (
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      {s.primaryAction.loadingHint}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Step2Upload({
  account,
  csr,
  csrLoading,
  reusable,
  reusing,
  verifying,
  progress,
  verifyError,
  onSubstepDone,
  onReuse,
  onVerify,
}: {
  account: { certAlias: string; environment: ArcaEnvironment; cuit: string };
  csr: ArcaCsr | null;
  csrLoading: boolean;
  reusable: readonly { tenantId: string; tenantName: string }[];
  reusing: boolean;
  verifying: boolean;
  progress: CertProgress;
  verifyError: {
    message: string;
    culpritSubstep: CertSubstepId | null;
  } | null;
  onSubstepDone: (id: CertSubstepId) => void;
  onReuse: (fromTenantId: string) => void;
  onVerify: (certificate: string) => void;
}) {
  const [certText, setCertText] = useState('');

  const certValidation = validatePastedCertificate(certText);
  // "Listo, sigo" del sub-paso 4 se deshabilita con cualquier error,
  // incluido el campo vacío (`validatePastedCertificate('')` también
  // devuelve el genérico). El TEXTO del error sólo se pinta con algo
  // escrito: con el campo vacío no hay nada que "corregir" todavía.
  const certInvalid = certValidation !== null;
  const certError = certText.trim() ? certValidation : null;

  // El sub-paso 6 es el único sin "Listo, sigo": termina en "Verificar", la
  // llamada real a ARCA. Se deshabilita con el mismo criterio que "Listo,
  // sigo" del sub-paso 4: si el certificado pegado no valida (incluido el
  // caso de una recarga que se llevó puesto el texto — ver el aviso en el
  // body del sub-paso 6).
  const verifyAction: CertSubstepPrimaryAction = {
    label: 'Verificar',
    variant: 'primary',
    loading: verifying,
    disabled: certInvalid,
    loadingHint: 'Puede tardar varios segundos: estamos hablando con ARCA.',
    onClick: () => onVerify(certText),
  };

  // Mismo texto en los dos entornos: verificar es lo mismo lo hayas
  // certificado en homologación o en producción.
  const verifySubstepBody = (
    <>
      <p style={HINT}>
        Con todo listo en ARCA, verificamos que Parkit pueda usar tu
        certificado. Puede tardar unos segundos.
      </p>
      {/* El texto pegado es estado LOCAL (no se persiste): una recarga justo
          acá se lo lleva puesto, aunque el progreso (sub-pasos 1 a 5 ya
          completados) siga intacto en localStorage. */}
      {!certText.trim() && (
        <p style={{ ...HINT, color: 'var(--text-3)' }}>
          Volvé al paso 4 y pegá el certificado de nuevo.
        </p>
      )}
    </>
  );

  const homologacionSubsteps: CertSubstepDef[] = [
    {
      id: 1,
      title: 'Entrá a ARCA',
      body: (
        <>
          <p style={HINT}>Ingresá con tu CUIT y tu clave fiscal.</p>
          <ArcaLoginLink />
        </>
      ),
      primaryAction: {
        label: 'Listo, sigo →',
        onClick: () => onSubstepDone(1),
      },
    },
    {
      id: 2,
      title: 'Abrí el servicio WSASS',
      body: (
        <>
          <p style={HINT}>
            En{' '}
            <ArcaInlineLink href={ARCA_ADMIN_RELACIONES_URL}>
              Mis servicios
            </ArcaInlineLink>{' '}
            buscá <strong>WSASS – Autogestión Certificados Homologación</strong>{' '}
            y abrilo.
          </p>
          <GuideImage
            src="/arca-guide/homologacion/05-wsass-en-mis-servicios.png"
            alt="WSASS listado en Mis servicios de ARCA"
          />
          <Disclosure summary="¿No te aparece WSASS? Adherilo (se hace una sola vez)">
            <ol
              style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 14 }}
            >
              <li style={HINT}>
                En el inicio de ARCA, entrá a{' '}
                <ArcaInlineLink href={ARCA_ADMIN_RELACIONES_URL}>
                  Administrador de relaciones
                </ArcaInlineLink>
                .
                <div style={{ marginTop: 6 }}>
                  <GuideImage
                    src="/arca-guide/homologacion/02-mis-servicios.png"
                    alt="Administrador de relaciones en el inicio de ARCA"
                  />
                </div>
              </li>
              <li style={HINT}>
                Apretá <strong>Adherir servicio</strong>.
                <div style={{ marginTop: 6 }}>
                  <GuideImage
                    src="/arca-guide/homologacion/03-adherir-servicio.png"
                    alt="Botón Adherir servicio"
                  />
                </div>
              </li>
              <li style={HINT}>
                Elegí <strong>ARCA</strong> →{' '}
                <strong>Servicios interactivos</strong>, buscá{' '}
                <strong>WSASS – Autogestión Certificados Homologación</strong> y
                confirmá con <strong>Continuar</strong>.
                <div style={{ marginTop: 6 }}>
                  <GuideImage
                    src="/arca-guide/homologacion/04-arca-servicios-interactivos.png"
                    alt="Selección de ARCA y Servicios interactivos"
                  />
                </div>
              </li>
              <li style={HINT}>
                <strong>Cerrá la sesión y volvé a entrar</strong>: WSASS va a
                aparecer en Mis servicios.
              </li>
            </ol>
          </Disclosure>
          <p style={{ ...HINT, color: 'var(--text-3)' }}>
            Tenés que entrar con tu clave fiscal de persona física (no la de una
            empresa).
          </p>
        </>
      ),
      primaryAction: {
        label: 'Listo, sigo →',
        onClick: () => onSubstepDone(2),
      },
    },
    {
      id: 3,
      title: 'Creá el certificado',
      body: (
        <>
          <p style={HINT}>
            En el menú de la izquierda elegí <strong>Nuevo Certificado</strong>{' '}
            y completá:
          </p>
          <CopyRow
            label="Nombre simbólico del DN"
            displayValue={account.certAlias}
            copyValue={account.certAlias}
          />
          <div style={{ display: 'grid', gap: 6 }}>
            <p style={HINT}>
              <strong>Solicitud de certificado en formato PKCS10</strong>:
            </p>
            <div>
              <CopyCsrButton csr={csr} loading={csrLoading} />
            </div>
          </div>
          <p style={HINT}>
            Apretá <strong>Crear DN y Obtener Certificado</strong>.
          </p>
          <GuideImage
            src="/arca-guide/homologacion/06-nuevo-certificado.jpg"
            alt="Formulario para crear el DN y el certificado en WSASS"
          />
          <Disclosure summary="¿WSASS dice que ese nombre ya existe?">
            <p style={HINT}>
              Pasa si ya vinculaste antes. Usá{' '}
              <strong>Agregar certificado a alias</strong>, elegí ese nombre,
              pegá la solicitud y apretá{' '}
              <strong>Crear certificado adicional para el DN</strong>.
            </p>
            <GuideImage
              src="/arca-guide/homologacion/08-agregar-certificado-alias.jpg"
              alt="Formulario Agregar certificado a alias en WSASS"
            />
          </Disclosure>
        </>
      ),
      primaryAction: {
        label: 'Listo, sigo →',
        onClick: () => onSubstepDone(3),
      },
    },
    {
      id: 4,
      title: 'Pegá el certificado',
      body: (
        <>
          <p style={HINT}>
            Abajo, en <strong>Resultado</strong>, ARCA te muestra el
            certificado. Copialo completo y pegalo acá:
          </p>
          <CertificateTextarea
            value={certText}
            onChange={setCertText}
            disabled={verifying}
            error={certError}
          />
        </>
      ),
      primaryAction: {
        label: 'Listo, sigo →',
        disabled: certInvalid,
        onClick: () => onSubstepDone(4),
      },
    },
    {
      id: 5,
      title: 'Autorizá los servicios',
      body: (
        <>
          <p style={HINT}>
            Volvé a WSASS, elegí <strong>Crear autorización a servicio</strong>{' '}
            y creá <strong>dos</strong> autorizaciones con estos datos:
          </p>
          <div style={{ display: 'grid', gap: 8 }}>
            <InfoRow
              label="Nombre simbólico del DN a autorizar"
              value={account.certAlias}
            />
            <InfoRow
              label="CUIT representado"
              value={formatCuit(account.cuit)}
            />
            <div>
              <p style={{ ...HINT, marginBottom: 4 }}>
                Servicio al que desea acceder:
              </p>
              <ul
                style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 4 }}
              >
                <li style={HINT}>
                  <strong>wsfe</strong> (Facturación Electrónica)
                </li>
                <li style={HINT}>
                  <strong>ws_sr_constancia_inscripcion</strong> (Constancia de
                  Inscripción)
                </li>
              </ul>
            </div>
          </div>
          <p style={HINT}>
            Confirmá cada una con <strong>Crear Autorización de Acceso</strong>.
          </p>
          <GuideImage
            src="/arca-guide/homologacion/07-crear-autorizacion.jpg"
            alt="Formulario Crear autorización a servicio en WSASS"
          />
        </>
      ),
      primaryAction: {
        label: 'Listo, sigo →',
        onClick: () => onSubstepDone(5),
      },
    },
    {
      id: 6,
      title: 'Verificá la vinculación',
      body: verifySubstepBody,
      primaryAction: verifyAction,
    },
  ];

  const produccionSubsteps: CertSubstepDef[] = [
    {
      id: 1,
      title: 'Entrá a ARCA',
      body: (
        <>
          <p style={HINT}>Ingresá con la clave fiscal del titular del CUIT.</p>
          <ArcaLoginLink />
        </>
      ),
      primaryAction: {
        label: 'Listo, sigo →',
        onClick: () => onSubstepDone(1),
      },
    },
    {
      id: 2,
      title: 'Abrí Administración de Certificados Digitales',
      body: (
        <>
          <p style={HINT}>
            En{' '}
            <ArcaInlineLink href={ARCA_ADMIN_RELACIONES_URL}>
              Mis servicios
            </ArcaInlineLink>{' '}
            buscá <strong>Administración de Certificados Digitales</strong> y
            abrilo.
          </p>
          <Disclosure summary="¿No te aparece? Adherilo (se hace una sola vez)">
            <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 8 }}>
              <li style={HINT}>
                Entrá a{' '}
                <ArcaInlineLink href={ARCA_ADMIN_RELACIONES_URL}>
                  Administrador de relaciones
                </ArcaInlineLink>
                .
              </li>
              <li style={HINT}>
                Apretá <strong>Adherir servicio</strong>.
              </li>
              <li style={HINT}>
                Elegí <strong>ARCA</strong> →{' '}
                <strong>Administración de Certificados Digitales</strong> y
                confirmá con <strong>Continuar</strong>.
              </li>
              <li style={HINT}>
                <strong>Cerrá la sesión y volvé a entrar.</strong>
              </li>
            </ol>
          </Disclosure>
        </>
      ),
      primaryAction: {
        label: 'Listo, sigo →',
        onClick: () => onSubstepDone(2),
      },
    },
    {
      id: 3,
      title: 'Creá el certificado',
      body: (
        <>
          <p style={HINT}>
            Elegí <strong>Agregar alias</strong> y poné este nombre:
          </p>
          <CopyRow
            label="Alias"
            displayValue={account.certAlias}
            copyValue={account.certAlias}
          />
          <p style={HINT}>
            Subí la solicitud de certificado (CSR): ARCA pide el archivo.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <Button
              variant="secondary"
              icon={<IconDownload size={14} />}
              disabled={!csr}
              onClick={() => csr && downloadTextFile(csr.fileName, csr.csrPem)}
            >
              Descargar solicitud (CSR)
            </Button>
            <CopyCsrButton csr={csr} loading={csrLoading} />
          </div>
        </>
      ),
      primaryAction: {
        label: 'Listo, sigo →',
        onClick: () => onSubstepDone(3),
      },
    },
    {
      id: 4,
      title: 'Pegá el certificado',
      body: (
        <>
          <p style={HINT}>
            Descargá el certificado que genera ARCA, abrilo con el Bloc de notas
            y pegá todo el contenido acá:
          </p>
          <CertificateTextarea
            value={certText}
            onChange={setCertText}
            disabled={verifying}
            error={certError}
          />
        </>
      ),
      primaryAction: {
        label: 'Listo, sigo →',
        disabled: certInvalid,
        onClick: () => onSubstepDone(4),
      },
    },
    {
      id: 5,
      title: 'Autorizá los servicios',
      body: (
        <>
          <p style={HINT}>
            Entrá a{' '}
            <ArcaInlineLink href={ARCA_ADMIN_RELACIONES_URL}>
              Administrador de relaciones
            </ArcaInlineLink>{' '}
            → <strong>Nueva relación</strong> y asociá a ese certificado{' '}
            <strong>Facturación Electrónica</strong> y{' '}
            <strong>Constancia de Inscripción</strong>.
          </p>
          <ArcaLoginLink />
        </>
      ),
      primaryAction: {
        label: 'Listo, sigo →',
        onClick: () => onSubstepDone(5),
      },
    },
    {
      id: 6,
      title: 'Verificá la vinculación',
      body: verifySubstepBody,
      primaryAction: verifyAction,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600 }}>
          Certificado ARCA
        </h3>
        <p style={HINT}>
          Completá cada sub-paso y confirmalo antes de pasar al siguiente.
        </p>
      </div>

      {reusable.length > 0 && (
        <Alert
          variant="info"
          icon={<IconCheckCircle size={16} />}
          title="Ya tenés un certificado de este CUIT en otra sede"
          description="Podés reutilizarlo en vez de generar uno nuevo en ARCA."
          action={
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {reusable.map((r) => (
                <Button
                  key={r.tenantId}
                  variant="secondary"
                  size="sm"
                  loading={reusing}
                  onClick={() => onReuse(r.tenantId)}
                >
                  {`Usar el certificado de ${r.tenantName}`}
                </Button>
              ))}
            </div>
          }
        />
      )}

      <CertSubstepAccordion
        substeps={
          account.environment === 'homologacion'
            ? homologacionSubsteps
            : produccionSubsteps
        }
        progress={progress}
        verifyError={verifyError}
      />
    </div>
  );
}

/**
 * Recap del paso 2 al volver desde el stepper con el certificado YA
 * verificado (la cuenta pasó al paso 3: `pending_sales_point` con
 * `condicionIva` cargada). No hay datos fiscales que completar acá — si
 * faltaran, `resolveArcaWizardStep` todavía tendría al wizard parado en este
 * paso, y éste sería el modo `'in_progress'`, no el recap.
 */
function Step2Recap({
  account,
  onContinue,
  onReissue,
}: {
  account: ArcaAccount;
  onContinue: () => void;
  onReissue: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Alert
        variant="info"
        icon={<IconCheckCircle size={16} />}
        title="Certificado verificado"
        description="Ya podés continuar al punto de venta, o cargar uno nuevo si hace falta reemplazarlo."
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
        }}
      >
        <InfoRow label="Alias del certificado" value={account.certAlias} />
        <InfoRow
          label="Vence"
          value={
            account.certExpiresAt
              ? fmtDateTimeAr(account.certExpiresAt)
              : 'No vence'
          }
        />
        <InfoRow
          label="Razón social"
          value={account.razonSocial ?? 'Sin datos'}
        />
        <InfoRow
          label="Condición frente al IVA"
          value={
            account.condicionIva
              ? ARCA_TAX_CONDITION_LABELS[account.condicionIva]
              : 'Sin datos'
          }
        />
      </div>
      <div style={ROW}>
        <Button variant="primary" onClick={onContinue}>
          Continuar
        </Button>
        <Button variant="secondary" onClick={onReissue}>
          Cargar otro certificado
        </Button>
      </div>
    </div>
  );
}

function PadronSummary({
  account,
  onContinue,
}: {
  account: {
    razonSocial?: string | null;
    condicionIva?: ArcaTaxCondition | null;
    domicilioFiscal?: string | null;
  };
  onContinue: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Alert
        variant="info"
        icon={<IconCheckCircle size={16} />}
        title="Certificado verificado"
        description="Encontramos estos datos en el padrón de ARCA."
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-3)' }}>
            Razón social
          </p>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-1)' }}>
            {account.razonSocial ?? 'Sin datos'}
          </p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-3)' }}>
            Condición frente al IVA
          </p>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-1)' }}>
            {account.condicionIva
              ? ARCA_TAX_CONDITION_LABELS[account.condicionIva]
              : 'Sin datos'}
          </p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-3)' }}>
            Domicilio fiscal
          </p>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-1)' }}>
            {account.domicilioFiscal ?? 'Sin datos'}
          </p>
        </div>
      </div>
      <div style={ROW}>
        <Button variant="primary" onClick={onContinue}>
          Continuar
        </Button>
      </div>
    </div>
  );
}

function FiscalDataForm({
  environment,
  pending,
  onSubmit,
}: {
  environment: ArcaEnvironment;
  pending: boolean;
  onSubmit: (values: ArcaFiscalDataFormValues) => void;
}) {
  const [values, setValues] = useState<ArcaFiscalDataFormValues>({
    razonSocial: '',
    condicionIva: '',
    domicilioFiscal: '',
    inicioActividad: '',
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof ArcaFiscalDataFormValues, string>>
  >({});

  function set<K extends keyof ArcaFiscalDataFormValues>(
    key: K,
    value: ArcaFiscalDataFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function handleSubmit() {
    const validation = validateArcaFiscalDataForm(values);
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      return;
    }
    setErrors({});
    onSubmit(values);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {environment === 'homologacion' && (
        <Alert
          variant="warn"
          icon={<IconAlert size={16} />}
          title="Datos de prueba"
          description="El padrón de homologación no tiene este CUIT, así que ARCA no nos devolvió los datos fiscales. Cargalos a mano para poder seguir probando."
        />
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
        }}
      >
        <Input
          label="Razón social"
          required
          value={values.razonSocial}
          error={errors.razonSocial}
          onChange={(e) => set('razonSocial', e.target.value)}
          disabled={pending}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label className="pk-label">
            Condición frente al IVA
            <RequiredMark />
          </label>
          <select
            className="pk-input"
            value={values.condicionIva}
            onChange={(e) =>
              set('condicionIva', e.target.value as ArcaTaxCondition | '')
            }
            disabled={pending}
          >
            <option value="">Elegí una opción</option>
            <option value="responsable_inscripto">Responsable Inscripto</option>
            <option value="monotributo">Monotributo</option>
            <option value="exento">Exento</option>
          </select>
          {errors.condicionIva && (
            <span style={{ fontSize: 12, color: 'var(--err-text)' }}>
              {errors.condicionIva}
            </span>
          )}
        </div>
        <Input
          label="Domicilio fiscal"
          required
          value={values.domicilioFiscal}
          error={errors.domicilioFiscal}
          onChange={(e) => set('domicilioFiscal', e.target.value)}
          disabled={pending}
        />
        <Input
          label="Inicio de actividad (opcional)"
          type="date"
          value={values.inicioActividad}
          onChange={(e) => set('inicioActividad', e.target.value)}
          disabled={pending}
        />
      </div>
      <div style={ROW}>
        <Button variant="primary" loading={pending} onClick={handleSubmit}>
          Continuar
        </Button>
      </div>
    </div>
  );
}

// ── Paso 3 ───────────────────────────────────────────────────────────────────

function Step3Form({
  account,
  pending,
  onSubmit,
}: {
  account: {
    environment: ArcaEnvironment;
    condicionIva?: ArcaTaxCondition | null;
  };
  pending: boolean;
  onSubmit: (values: { ptoVta: number; constancia: File | null }) => void;
}) {
  const [ptoVta, setPtoVta] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<{ ptoVta?: string; file?: string }>({});

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    e.target.value = '';
    setFile(selected);
    if (errors.file) setErrors((prev) => ({ ...prev, file: undefined }));
  }

  function handleSubmit() {
    const ptoVtaError = validateArcaPtoVta(ptoVta);
    const fileError = validateArcaConstancia({
      file,
      environment: account.environment,
    });
    if (ptoVtaError || fileError) {
      setErrors({
        ptoVta: ptoVtaError ?? undefined,
        file: fileError ?? undefined,
      });
      return;
    }
    setErrors({});
    onSubmit({ ptoVta: Number(ptoVta), constancia: file });
  }

  const posLabel =
    account.condicionIva === 'monotributo' || account.condicionIva === 'exento'
      ? '«Factura Electrónica – Monotributo – Web Services»'
      : '«RECE para aplicativo y web services»';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600 }}>
          Punto de venta
        </h3>
        <p style={HINT}>
          En ARCA: "Administración de puntos de venta y domicilios" → Agregar →{' '}
          {posLabel}.
        </p>
        <div style={{ marginTop: 8 }}>
          <ArcaLoginLink />
        </div>
        {account.environment === 'homologacion' ? (
          <p style={{ ...HINT, color: 'var(--text-3)', marginTop: 8 }}>
            En homologación no hace falta darlo de alta en ARCA: cualquier
            número sirve para probar, y la constancia es opcional.
          </p>
        ) : null}
      </div>

      <Input
        label="Número de punto de venta"
        required
        inputMode="numeric"
        placeholder="3"
        value={ptoVta}
        error={errors.ptoVta}
        onChange={(e) => {
          setPtoVta(e.target.value);
          if (errors.ptoVta)
            setErrors((prev) => ({ ...prev, ptoVta: undefined }));
        }}
        disabled={pending}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label className="pk-label">
          Constancia del punto de venta (PDF, máx. 5 MB)
          {account.environment === 'produccion' ? (
            <RequiredMark />
          ) : (
            ' (opcional)'
          )}
        </label>
        <input
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          disabled={pending}
        />
        {file && (
          <p style={{ ...HINT, color: 'var(--text-3)' }}>
            Archivo cargado: {file.name}
          </p>
        )}
        {errors.file && (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--err-text)' }}>
            {errors.file}
          </p>
        )}
      </div>

      <div style={ROW}>
        <Button variant="primary" loading={pending} onClick={handleSubmit}>
          Verificar y vincular
        </Button>
        {pending && (
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
            Puede tardar varios segundos: estamos hablando con ARCA.
          </span>
        )}
      </div>
    </div>
  );
}

// ── Pantalla final ───────────────────────────────────────────────────────────

function WizardDone() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Alert
        variant="info"
        icon={<IconCheckCircle size={18} />}
        title="ARCA quedó vinculada"
        description="Ya podés configurar qué medios de pago facturan automáticamente al cobrar."
      />
      <div style={ROW}>
        <Link
          to="../integraciones"
          className="pk-btn pk-btn-secondary"
          style={{ textDecoration: 'none' }}
        >
          Volver a integraciones
        </Link>
        <Link
          to="../integraciones/arca/emision"
          className="pk-btn pk-btn-primary"
          style={{ textDecoration: 'none' }}
        >
          Configurar emisión
        </Link>
      </div>
    </div>
  );
}

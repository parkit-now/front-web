import { useEffect, useRef, useState } from 'react';
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
import { ARCA_TAX_CONDITION_LABELS, formatCuit } from '../validation';
import {
  validateArcaConstancia,
  validateArcaFiscalDataForm,
  validateArcaPtoVta,
  validateArcaStep1Form,
  resolveArcaWizardStep,
  type ArcaFiscalDataFormValues,
} from './wizard';
import { normalizeArcaCuit } from './cuit';
import { ARCA_LOGIN_URL } from './links';
import {
  applyCertVerifyError,
  EMPTY_CERT_PROGRESS,
  loadCertProgress,
  markCertSubstepDone,
  resolveCertSubstepState,
  resolveCertVerifyErrorEffect,
  resolveOpenCertSubstep,
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

  // ── Progreso del acordeón de sub-pasos (paso 2) ────────────────────────────
  // Persistido en localStorage por cuenta: si el dueño recarga o vuelve de la
  // pestaña de ARCA, retoma donde había quedado (ver `certSubsteps.ts`).
  const [certProgress, setCertProgress] =
    useState<CertProgress>(EMPTY_CERT_PROGRESS);
  const [certVerifyError, setCertVerifyError] = useState<{
    substep: CertSubstepId;
    message: string;
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
    onSuccess: syncAccount,
    onError: onMutationError({ endpoint: 'arca.createAccount' }),
  });

  // ── Paso 2: certificado ─────────────────────────────────────────────────────
  // Se trae SOLO con llegar al paso (no con un botón): homologación la
  // necesita para el textarea de "pegar en ARCA", que es el camino principal
  // ahí, no un extra detrás de un click.
  const csrQuery = useQuery({
    queryKey: ['arca', 'csr', sucursalId],
    queryFn: () => getArcaCsr(sucursalId),
    enabled: Boolean(sucursalId) && account?.status === 'pending_certificate',
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
      setCertResult(result);
      syncAccount(result.account);
    },
    onError: (error) => {
      const code = readProblemCode(error);
      const effect = resolveCertVerifyErrorEffect(code);
      updateCertProgress((prev) => applyCertVerifyError(prev, code));
      setCertVerifyError({
        substep: effect.substep,
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

  const step = resolveArcaWizardStep(account);

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

      <Stepper step={step} />

      <Card padding="lg">
        {step === 1 && (
          <Step1Form
            pending={createMutation.isPending}
            onSubmit={(values) => createMutation.mutate(values)}
          />
        )}

        {step === 2 &&
          account !== null &&
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
              onReuse={(fromTenantId) => reuseMutation.mutate(fromTenantId)}
              onVerify={(certificate) => {
                setCertVerifyError(null);
                // El sub-paso 5 no tiene "Listo, sigo": reintentar
                // "Verificar" ES la forma de decir "ya lo arreglé" cuando lo
                // que había fallado era la autorización de servicios.
                updateCertProgress((prev) =>
                  prev.errorSubstep === 5
                    ? { ...prev, errorSubstep: null }
                    : prev,
                );
                uploadCertMutation.mutate(certificate);
              }}
            />
          )}

        {step === 2 &&
          account !== null &&
          account.status === 'pending_sales_point' &&
          certResult?.padronFound && (
            <PadronSummary
              account={certResult.account}
              onContinue={() => setCertResult(null)}
            />
          )}

        {step === 2 &&
          account !== null &&
          account.status === 'pending_sales_point' &&
          !certResult?.padronFound && (
            <FiscalDataForm
              environment={account.environment}
              pending={updateFiscalMutation.isPending}
              onSubmit={(values) =>
                updateFiscalMutation.mutate({
                  razonSocial: values.razonSocial,
                  condicionIva: values.condicionIva as ArcaTaxCondition,
                  domicilioFiscal: values.domicilioFiscal,
                  ...(values.inicioActividad
                    ? { inicioActividad: values.inicioActividad }
                    : {}),
                })
              }
            />
          )}

        {step === 3 && account !== null && (
          <Step3Form
            account={account}
            pending={salesPointMutation.isPending}
            onSubmit={(values) => salesPointMutation.mutate(values)}
          />
        )}

        {step === 'done' && <WizardDone />}
      </Card>
    </div>
  );
}

// ── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({ step }: { step: 1 | 2 | 3 | 'done' }) {
  const current = step === 'done' ? 4 : step;
  const labels = ['Datos comerciales', 'Certificado ARCA', 'Punto de venta'];
  return (
    <div style={{ ...ROW, marginBottom: 16 }}>
      {labels.map((label, index) => {
        const n = index + 1;
        const done = current > n;
        const active = current === n;
        return (
          <span
            key={label}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: active ? 600 : 500,
              color: active || done ? 'var(--text-1)' : 'var(--text-3)',
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
}: {
  pending: boolean;
  onSubmit: (values: { cuit: string; iibb: string }) => void;
}) {
  const [cuit, setCuit] = useState('');
  const [iibb, setIibb] = useState('');
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
          Continuar
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
      className="pk-btn pk-btn-secondary pk-btn-sm"
      style={{
        textDecoration: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
      }}
    >
      Entrar a ARCA
      <IconExternalLink size={13} />
    </a>
  );
}

/** Botón de texto chico, para acciones secundarias (no compiten con el CTA del paso). */
function SmallLinkButton({
  children,
  onClick,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        alignSelf: 'flex-start',
        background: 'none',
        border: 'none',
        padding: 0,
        fontSize: 12,
        color: 'var(--text-2)',
        textDecoration: 'underline',
        textDecorationColor: 'var(--border)',
        textUnderlineOffset: 3,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
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
 * El certificado que devuelve ARCA, pegado a mano: es el camino principal,
 * así el dueño no depende de encontrar y adjuntar un archivo .crt. Subir el
 * archivo queda como atajo secundario, que sólo rellena este mismo textarea.
 */
function CertificateTextarea({
  value,
  onChange,
  disabled,
  secondaryLabel = '¿Tenés el archivo .crt? Subilo',
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  secondaryLabel?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      onChange(text);
    } catch {
      // Si no se pudo leer, el textarea sigue como estaba: el dueño puede
      // pegar el contenido a mano igual.
    }
  }

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
        style={{
          fontFamily: 'monospace',
          fontSize: 12,
          padding: 8,
          borderRadius: 'var(--r-md)',
          border: '1px solid var(--border-soft)',
          resize: 'vertical',
        }}
      />
      <input
        ref={inputRef}
        type="file"
        accept=".crt,application/x-x509-ca-cert,application/pkix-cert,text/plain"
        onChange={(e) => void handleFileChange(e)}
        style={{ display: 'none' }}
      />
      <SmallLinkButton
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        {secondaryLabel}
      </SmallLinkButton>
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
interface CertSubstepDef {
  id: CertSubstepId;
  title: string;
  body: React.ReactNode;
  /** El sub-paso 5 no lo tiene: termina en "Verificar", no en una casilla. */
  doneButton?: { disabled?: boolean };
}

/**
 * El acordeón de sub-pasos: sólo uno abierto a la vez, y bloqueado en
 * secuencia (no se puede abrir el N+1 sin completar el N). El estado de cada
 * título lo decide `resolveCertSubstepState` (`certSubsteps.ts`), puro y
 * testeado; acá sólo se pinta.
 */
function CertSubstepAccordion({
  substeps,
  progress,
  verifyError,
  onSubstepDone,
}: {
  substeps: readonly CertSubstepDef[];
  progress: CertProgress;
  verifyError: { substep: CertSubstepId; message: string } | null;
  onSubstepDone: (id: CertSubstepId) => void;
}) {
  // Abrir un sub-paso ya completado para releerlo es un override LOCAL: en
  // cuanto el progreso cambia (se completó otro, o hubo un error nuevo) gana
  // de nuevo el sub-paso natural.
  const [manualOpen, setManualOpen] = useState<CertSubstepId | null>(null);
  useEffect(() => {
    setManualOpen(null);
  }, [progress]);

  const openId = manualOpen ?? resolveOpenCertSubstep(progress);

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {substeps.map((s) => {
        const state = resolveCertSubstepState(s.id, progress);
        const locked = state === 'locked';
        const isOpen = openId === s.id;
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
              onClick={() => !locked && setManualOpen(s.id)}
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
                {verifyError && verifyError.substep === s.id && (
                  <Alert
                    variant="err"
                    icon={<IconAlert size={16} />}
                    title="ARCA no pudo verificar el certificado"
                    description={verifyError.message}
                  />
                )}
                {s.body}
                {s.doneButton && (
                  <div style={ROW}>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={s.doneButton.disabled}
                      onClick={() => onSubstepDone(s.id)}
                    >
                      Listo, sigo →
                    </Button>
                  </div>
                )}
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
  verifyError: { substep: CertSubstepId; message: string } | null;
  onSubstepDone: (id: CertSubstepId) => void;
  onReuse: (fromTenantId: string) => void;
  onVerify: (certificate: string) => void;
}) {
  const [certText, setCertText] = useState('');

  // Vive en el sub-paso 5 (informativo, sin "Listo, sigo"): ahí es donde
  // realmente se llama a ARCA, así que el CTA primario y el loading van ahí.
  const verifyButton = (
    <div style={ROW}>
      <Button
        variant="primary"
        loading={verifying}
        disabled={!certText.trim()}
        onClick={() => onVerify(certText)}
      >
        Verificar
      </Button>
      {verifying && (
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
          Puede tardar varios segundos: estamos hablando con ARCA.
        </span>
      )}
    </div>
  );

  const homologacionSubsteps: CertSubstepDef[] = [
    {
      id: 1,
      title: 'Entrá a ARCA',
      body: (
        <>
          <p style={HINT}>Ingresá con tu CUIT y tu clave fiscal.</p>
          <ArcaLoginLink />
          <GuideImage
            src="/arca-guide/homologacion/01-login.png"
            alt="Pantalla de ARCA para ingresar con clave fiscal"
          />
        </>
      ),
      doneButton: {},
    },
    {
      id: 2,
      title: 'Abrí el servicio WSASS',
      body: (
        <>
          <p style={HINT}>
            En <strong>Mis servicios</strong> buscá{' '}
            <strong>WSASS – Autogestión Certificados Homologación</strong> y
            abrilo.
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
                <strong>Administrador de relaciones</strong>.
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
      doneButton: {},
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
      doneButton: {},
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
          />
        </>
      ),
      doneButton: { disabled: !certText.trim() },
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
          {verifyButton}
        </>
      ),
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
      doneButton: {},
    },
    {
      id: 2,
      title: 'Abrí Administración de Certificados Digitales',
      body: (
        <>
          <p style={HINT}>
            En <strong>Mis servicios</strong> buscá{' '}
            <strong>Administración de Certificados Digitales</strong> y abrilo.
          </p>
          <Disclosure summary="¿No te aparece? Adherilo (se hace una sola vez)">
            <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 8 }}>
              <li style={HINT}>
                Entrá a <strong>Administrador de relaciones</strong>.
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
      doneButton: {},
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
      doneButton: {},
    },
    {
      id: 4,
      title: 'Pegá el certificado',
      body: (
        <>
          <p style={HINT}>
            Descargá el certificado que genera ARCA, abrilo con el Bloc de notas
            y pegá el contenido acá:
          </p>
          <CertificateTextarea
            value={certText}
            onChange={setCertText}
            disabled={verifying}
            secondaryLabel="¿Preferís subir el archivo .crt?"
          />
        </>
      ),
      doneButton: { disabled: !certText.trim() },
    },
    {
      id: 5,
      title: 'Autorizá los servicios',
      body: (
        <>
          <p style={HINT}>
            Entrá a <strong>Administrador de relaciones</strong> →{' '}
            <strong>Nueva relación</strong> y asociá a ese certificado{' '}
            <strong>Facturación Electrónica</strong> y{' '}
            <strong>Constancia de Inscripción</strong>.
          </p>
          <ArcaLoginLink />
          {verifyButton}
        </>
      ),
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
        onSubstepDone={onSubstepDone}
      />
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

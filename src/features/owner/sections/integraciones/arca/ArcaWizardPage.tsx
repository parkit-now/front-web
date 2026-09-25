import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
    onError: onMutationError({ endpoint: 'arca.uploadCertificate' }),
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
              onReuse={(fromTenantId) => reuseMutation.mutate(fromTenantId)}
              onVerify={(certificate) => uploadCertMutation.mutate(certificate)}
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

/**
 * El texto de la solicitud (CSR), oculto por defecto: es un bloque de texto
 * largo que no aporta nada mirado de arriba a abajo, sólo hay que pegarlo en
 * ARCA. `Copiar` funciona SIN mostrarlo (copia `csr.csrPem` desde el estado,
 * no desde el textarea visible).
 */
function CsrBlock({
  csr,
  loading,
  showDownloadLink = true,
}: {
  csr: ArcaCsr | null;
  loading: boolean;
  showDownloadLink?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!csr) return;
    try {
      await navigator.clipboard.writeText(csr.csrPem);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin permiso de portapapeles: mostrando el texto se puede copiar a mano.
    }
  }

  if (loading || !csr) {
    return (
      <p style={{ ...HINT, color: 'var(--text-3)' }}>
        Preparando la solicitud (CSR)...
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={ROW}>
        <Button variant="ghost" size="sm" onClick={() => setVisible((v) => !v)}>
          {visible ? 'Ocultar' : 'Mostrar'}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => void handleCopy()}>
          {copied ? 'Copiado' : 'Copiar'}
        </Button>
        {showDownloadLink && (
          <SmallLinkButton
            onClick={() => downloadTextFile(csr.fileName, csr.csrPem)}
          >
            Descargar como archivo
          </SmallLinkButton>
        )}
      </div>
      {visible && (
        <textarea
          readOnly
          value={csr.csrPem}
          rows={6}
          aria-label="Solicitud de certificado (CSR)"
          style={{
            fontFamily: 'monospace',
            fontSize: 12,
            padding: 8,
            borderRadius: 'var(--r-md)',
            border: '1px solid var(--border-soft)',
            resize: 'vertical',
            color: 'var(--text-1)',
            background: 'var(--card)',
          }}
        />
      )}
    </div>
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

function Step2Upload({
  account,
  csr,
  csrLoading,
  reusable,
  reusing,
  verifying,
  onReuse,
  onVerify,
}: {
  account: { certAlias: string; environment: ArcaEnvironment; cuit: string };
  csr: ArcaCsr | null;
  csrLoading: boolean;
  reusable: readonly { tenantId: string; tenantName: string }[];
  reusing: boolean;
  verifying: boolean;
  onReuse: (fromTenantId: string) => void;
  onVerify: (certificate: string) => void;
}) {
  const [certText, setCertText] = useState('');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600 }}>
          Certificado ARCA
        </h3>
        <p style={HINT}>
          Seguí estos pasos en el sitio de ARCA y después pegá acá el
          certificado para verificarlo.
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

      {account.environment === 'homologacion' ? (
        <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 18 }}>
          <li style={HINT}>
            Entrá a ARCA con tu clave fiscal y abrí el servicio{' '}
            <strong>WSASS – Autogestión Certificados Homologación</strong>.
            <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
              <ArcaLoginLink />
              <p style={{ ...HINT, color: 'var(--text-3)' }}>
                Si no lo ves en tus servicios, adherilo desde el Administrador
                de Relaciones de Clave Fiscal.
              </p>
            </div>
          </li>
          <li style={HINT}>
            En el menú, elegí <strong>Nuevo Certificado</strong>. En{' '}
            <strong>Nombre simbólico del DN</strong> poné:
            <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
              <CopyRow
                label="Nombre simbólico del DN"
                displayValue={account.certAlias}
                copyValue={account.certAlias}
              />
              <p style={{ ...HINT, color: 'var(--text-3)' }}>
                Si WSASS te avisa que ese nombre ya existe (porque ya lo
                vinculaste antes), usá{' '}
                <strong>Agregar certificado a alias</strong> con ese mismo
                nombre.
              </p>
            </div>
          </li>
          <li style={HINT}>
            En <strong>Solicitud de certificado en formato PKCS10</strong> pegá
            este texto y confirmá con{' '}
            <strong>Crear DN y Obtener Certificado</strong>:
            <div style={{ marginTop: 8 }}>
              <CsrBlock csr={csr} loading={csrLoading} />
            </div>
          </li>
          <li style={HINT}>
            ARCA te muestra el certificado. Copialo completo (incluidas las
            líneas BEGIN y END) y pegalo acá:
            <div style={{ marginTop: 8 }}>
              <CertificateTextarea
                value={certText}
                onChange={setCertText}
                disabled={verifying}
              />
            </div>
          </li>
          <li style={HINT}>
            Volvé a WSASS, entrá a{' '}
            <strong>Crear autorización a servicio</strong> y creá dos
            autorizaciones:
            <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
              <CopyRow
                label="Nombre simbólico del DN a autorizar"
                displayValue={account.certAlias}
                copyValue={account.certAlias}
              />
              <CopyRow
                label="CUIT representado"
                displayValue={formatCuit(account.cuit)}
                copyValue={account.cuit}
              />
              <ul
                style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 4 }}
              >
                <li style={HINT}>
                  <strong>Servicio al que desea acceder:</strong> wsfe
                  (Facturación Electrónica)
                </li>
                <li style={HINT}>
                  <strong>Servicio al que desea acceder:</strong>{' '}
                  ws_sr_constancia_inscripcion (Constancia de Inscripción)
                </li>
              </ul>
              <p style={{ ...HINT, color: 'var(--text-3)' }}>
                Confirmá cada una con{' '}
                <strong>Crear Autorización de Acceso</strong>.
              </p>
              <ArcaLoginLink />
            </div>
          </li>
        </ol>
      ) : (
        <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 18 }}>
          <li style={HINT}>
            Entrá a ARCA con la clave fiscal del titular del CUIT y abrí{' '}
            <strong>Administración de Certificados Digitales</strong>.
            <div style={{ marginTop: 8 }}>
              <ArcaLoginLink />
            </div>
          </li>
          <li style={HINT}>
            Elegí <strong>Agregar alias</strong> y poné este nombre:
            <div style={{ marginTop: 8 }}>
              <CopyRow
                label="Alias"
                displayValue={account.certAlias}
                copyValue={account.certAlias}
              />
            </div>
          </li>
          <li style={HINT}>
            Subí la solicitud de certificado (CSR).
            <div style={{ marginTop: 8, display: 'grid', gap: 10 }}>
              <div>
                <Button
                  variant="secondary"
                  icon={<IconDownload size={14} />}
                  disabled={!csr}
                  onClick={() =>
                    csr && downloadTextFile(csr.fileName, csr.csrPem)
                  }
                >
                  Descargar solicitud (CSR)
                </Button>
              </div>
              <CsrBlock
                csr={csr}
                loading={csrLoading}
                showDownloadLink={false}
              />
            </div>
          </li>
          <li style={HINT}>
            Descargá el certificado que genera ARCA, abrilo y pegá el contenido
            acá:
            <div style={{ marginTop: 8 }}>
              <CertificateTextarea
                value={certText}
                onChange={setCertText}
                disabled={verifying}
                secondaryLabel="¿Preferís subir el archivo .crt?"
              />
            </div>
          </li>
          <li style={HINT}>
            Entrá a <strong>Administrador de Relaciones de Clave Fiscal</strong>{' '}
            → <strong>Nueva Relación</strong> y asociá a ese certificado los
            servicios <strong>Facturación Electrónica</strong> (wsfe) y{' '}
            <strong>Constancia de Inscripción</strong> (
            ws_sr_constancia_inscripcion).
            <div style={{ marginTop: 8 }}>
              <ArcaLoginLink />
            </div>
          </li>
        </ol>
      )}

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

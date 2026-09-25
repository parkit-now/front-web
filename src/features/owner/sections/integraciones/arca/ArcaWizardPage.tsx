import { useState } from 'react';
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
  type ArcaEnvironment,
  type ArcaTaxCondition,
} from '../../../services/arca';
import { ARCA_TAX_CONDITION_LABELS } from '../validation';
import {
  validateArcaConstancia,
  validateArcaFiscalDataForm,
  validateArcaPtoVta,
  validateArcaStep1Form,
  resolveArcaWizardStep,
  type ArcaFiscalDataFormValues,
} from './wizard';
import { normalizeArcaCuit } from './cuit';

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
  const [downloadingCsr, setDownloadingCsr] = useState(false);
  async function handleDownloadCsr() {
    setDownloadingCsr(true);
    try {
      const csr = await getArcaCsr(sucursalId);
      downloadTextFile(csr.fileName, csr.csrPem);
    } catch (error) {
      showToast({
        message: translateApiError(error, { endpoint: 'arca.getCsr' }),
        kind: 'error',
      });
    } finally {
      setDownloadingCsr(false);
    }
  }

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
              reusable={reusableQuery.data ?? []}
              reusing={reuseMutation.isPending}
              downloadingCsr={downloadingCsr}
              verifying={uploadCertMutation.isPending}
              onDownloadCsr={() => void handleDownloadCsr()}
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

const ARCA_INSTRUCTIONS: Record<ArcaEnvironment, string[]> = {
  homologacion: [
    'Entrá a ARCA con tu clave fiscal y abrí el servicio WSASS.',
    'Elegí "Nuevo certificado" y como nombre simbólico del DN usá el alias que aparece arriba (copialo con el botón).',
    'Pegá el contenido del archivo CSR que descargaste y confirmá con "Crear DN y obtener certificado".',
    'Guardá el certificado que te da ARCA como archivo .crt.',
    'Volvé a WSASS y creá una autorización a servicio con ese mismo DN, dos veces: una para "wsfe" y otra para "ws_sr_constancia_inscripcion".',
  ],
  produccion: [
    'Entrá a ARCA con tu clave fiscal y abrí "Administración de Certificados Digitales".',
    'Agregá un alias nuevo con el valor que aparece arriba (copialo con el botón) y subí el archivo CSR que descargaste.',
    'Descargá el certificado que te devuelve ARCA (.crt).',
    'Andá a "Administrador de Relaciones de Clave Fiscal" y creá una Nueva Relación: asociá "Facturación Electrónica" y "Constancia de Inscripción" a este certificado.',
  ],
};

function Step2Upload({
  account,
  reusable,
  reusing,
  downloadingCsr,
  verifying,
  onDownloadCsr,
  onReuse,
  onVerify,
}: {
  account: { certAlias: string; environment: ArcaEnvironment };
  reusable: readonly { tenantId: string; tenantName: string }[];
  reusing: boolean;
  downloadingCsr: boolean;
  verifying: boolean;
  onDownloadCsr: () => void;
  onReuse: (fromTenantId: string) => void;
  onVerify: (certificate: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileText, setFileText] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  async function handleCopyAlias() {
    try {
      await navigator.clipboard.writeText(account.certAlias);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin permiso de portapapeles: el alias ya está a la vista para copiar
      // a mano, no hace falta avisar con un error.
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setFileError(null);
    try {
      const text = await file.text();
      setFileName(file.name);
      setFileText(text);
    } catch {
      setFileError('No pudimos leer el archivo. Probá de nuevo.');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600 }}>
          Certificado ARCA
        </h3>
        <p style={HINT}>
          Generá el certificado en el sitio de ARCA con la solicitud (CSR) que
          te damos acá, y después subilo para verificarlo.
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

      <div style={ROW}>
        <Button
          variant="secondary"
          icon={<IconDownload size={14} />}
          loading={downloadingCsr}
          onClick={onDownloadCsr}
        >
          Descargar solicitud (CSR)
        </Button>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          background: 'var(--surface-2, var(--bg-2))',
          borderRadius: 'var(--r-md)',
          border: '1px solid var(--border-soft)',
        }}
      >
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
          Nombre simbólico del DN
        </span>
        <code style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
          {account.certAlias}
        </code>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void handleCopyAlias()}
        >
          {copied ? 'Copiado' : 'Copiar'}
        </Button>
      </div>

      <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6 }}>
        {ARCA_INSTRUCTIONS[account.environment].map((step) => (
          <li key={step} style={HINT}>
            {step}
          </li>
        ))}
      </ol>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label className="pk-label">Certificado (.crt)</label>
        <input
          type="file"
          accept=".crt,application/x-x509-ca-cert,application/pkix-cert,text/plain"
          onChange={(e) => void handleFileChange(e)}
          disabled={verifying}
        />
        {fileName && (
          <p style={{ ...HINT, color: 'var(--text-3)' }}>
            Archivo cargado: {fileName}
          </p>
        )}
        {fileError && (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--err-text)' }}>
            {fileError}
          </p>
        )}
      </div>

      <div style={ROW}>
        <Button
          variant="primary"
          loading={verifying}
          disabled={!fileText}
          onClick={() => fileText && onVerify(fileText)}
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
        {account.environment === 'homologacion' ? (
          <p style={{ ...HINT, color: 'var(--text-3)' }}>
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

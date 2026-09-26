import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from '../../../../../shared/components/ui/Alert';
import { Button } from '../../../../../shared/components/ui/Button';
import { Card } from '../../../../../shared/components/ui/Card';
import {
  IconAlert,
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
  getArcaRenewalCsr,
  uploadArcaRenewalCertificate,
  type ArcaAccount,
  type ArcaCsr,
} from '../../../services/arca';
import { formatArcaCertDate } from '../validation';
import {
  ArcaInlineLink,
  ArcaLoginLink,
  CertificateTextarea,
  CopyCsrButton,
  CopyRow,
  downloadTextFile,
  GuideImage,
} from './guideParts';
import { ARCA_MY_SERVICES_URL } from './links';
import { validatePastedCertificate } from './wizard';

const HINT: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  lineHeight: 1.55,
  color: 'var(--text-2)',
};

/**
 * «Renovar certificado»: un solo paso. Parkit ya preparó la solicitud (el job
 * diario, o el GET en el momento) con el MISMO alias del certificado vigente,
 * así que en ARCA alcanza con «Agregar certificado» sobre ese alias: los
 * servicios quedan asociados y no hay que volver a autorizar nada. El
 * certificado viejo sigue andando hasta que se verifica el nuevo.
 */
export function ArcaRenovarPage() {
  const { showToast } = useToast();
  const { sucursalId, sucursal } = useSucursal();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const canManage = sucursal?.role === 'owner';

  const accountQuery = useArcaAccount(sucursalId);
  const account = accountQuery.data ?? null;
  const renewable =
    account?.status === 'linked' || account?.status === 'cert_expired';

  // Apenas se verifica el certificado nuevo, la solicitud deja de pedirse:
  // sin esto, limpiar el caché con la pantalla todavía montada la vuelve a
  // pedir y el backend prepara OTRA renovación, ya para el certificado nuevo.
  const [renewed, setRenewed] = useState(false);

  const csrQuery = useQuery({
    queryKey: ['arca', 'renewal-csr', sucursalId],
    queryFn: () => getArcaRenewalCsr(sucursalId),
    enabled: Boolean(sucursalId) && renewable && canManage && !renewed,
    // Es la misma solicitud hasta que se renueva: no hay nada que refrescar.
    staleTime: Infinity,
  });

  const verify = useMutation({
    mutationFn: (certificate: string) =>
      uploadArcaRenewalCertificate(sucursalId, { certificate }),
    onSuccess: async (updated) => {
      setRenewed(true);
      queryClient.setQueryData(arcaAccountQueryKey(sucursalId), updated);
      const until = formatArcaCertDate(updated.certExpiresAt);
      showToast({
        kind: 'success',
        message: until
          ? `Certificado renovado. Vence el ${until}.`
          : 'Certificado renovado.',
      });
      await navigate('../integraciones');
      queryClient.removeQueries({
        queryKey: ['arca', 'renewal-csr', sucursalId],
      });
    },
  });

  const header = (
    <SectionHeader
      title="Renovar certificado de ARCA"
      subtitle={account ? expirySubtitle(account) : undefined}
    />
  );

  if (accountQuery.isLoading) {
    return (
      <div>
        {header}
        <div className="pk-card pk-card-pad" style={{ minHeight: 160 }}>
          <p style={{ color: 'var(--text-3)', fontSize: 14 }}>Cargando...</p>
        </div>
      </div>
    );
  }

  if (accountQuery.isError || !account || !renewable || !canManage) {
    return (
      <div>
        {header}
        <Alert
          variant="warn"
          icon={<IconAlert size={16} />}
          title={
            accountQuery.isError
              ? 'No pudimos consultar tu integración con ARCA'
              : !canManage
                ? 'Sólo el dueño puede renovar el certificado'
                : 'No hay un certificado para renovar'
          }
          description={
            accountQuery.isError
              ? translateApiError(accountQuery.error, {
                  endpoint: 'arca.getAccount',
                })
              : undefined
          }
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

  return (
    <div>
      {header}
      <Card padding="lg">
        <RenewalSteps
          account={account}
          csr={csrQuery.data ?? null}
          csrLoading={csrQuery.isLoading}
          csrError={
            csrQuery.isError
              ? translateApiError(csrQuery.error, {
                  endpoint: 'arca.getRenewalCsr',
                })
              : null
          }
          verifying={verify.isPending}
          verifyError={
            verify.isError
              ? translateApiError(verify.error, {
                  endpoint: 'arca.uploadRenewalCertificate',
                })
              : null
          }
          onVerify={(certificate) => verify.mutate(certificate)}
          onCancel={() => void navigate('../integraciones')}
        />
      </Card>
    </div>
  );
}

function expirySubtitle(account: ArcaAccount): string {
  const date = formatArcaCertDate(account.certExpiresAt);
  const expired =
    account.status === 'cert_expired' ||
    (account.certExpiresAt !== null &&
      account.certExpiresAt !== undefined &&
      new Date(account.certExpiresAt).getTime() <= Date.now());
  if (expired) {
    return date
      ? `Tu certificado venció el ${date}: la facturación está pausada hasta que lo renueves.`
      : 'Tu certificado venció: la facturación está pausada hasta que lo renueves.';
  }
  return date
    ? `Tu certificado vence el ${date}. Hasta entonces seguís facturando normal.`
    : 'Hasta que lo renueves seguís facturando normal.';
}

function RenewalSteps({
  account,
  csr,
  csrLoading,
  csrError,
  verifying,
  verifyError,
  onVerify,
  onCancel,
}: {
  account: ArcaAccount;
  csr: ArcaCsr | null;
  csrLoading: boolean;
  csrError: string | null;
  verifying: boolean;
  verifyError: string | null;
  onVerify: (certificate: string) => void;
  onCancel: () => void;
}) {
  const [certText, setCertText] = useState('');
  const certValidation = validatePastedCertificate(certText);
  const certError = certText.trim() ? certValidation : null;
  const alias = csr?.alias ?? account.certAlias;
  const homologacion = account.environment === 'homologacion';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <ol
        style={{
          margin: 0,
          padding: 0,
          listStyle: 'none',
          display: 'grid',
          gap: 20,
        }}
      >
        <Step n={1} title="Entrá a ARCA">
          <p style={HINT}>Ingresá con la clave fiscal del titular del CUIT.</p>
          <ArcaLoginLink />
        </Step>

        {homologacion ? (
          <Step n={2} title="Agregá el certificado nuevo al alias">
            <p style={HINT}>
              En{' '}
              <ArcaInlineLink href={ARCA_MY_SERVICES_URL}>
                Mis servicios
              </ArcaInlineLink>{' '}
              abrí <strong>WSASS</strong> y elegí{' '}
              <strong>Agregar certificado a alias</strong>:
            </p>
            <CopyRow label="Alias" displayValue={alias} copyValue={alias} />
            <div style={{ display: 'grid', gap: 6 }}>
              <p style={HINT}>
                <strong>Solicitud de certificado en formato PKCS10</strong>:
              </p>
              <div>
                <CopyCsrButton csr={csr} loading={csrLoading} />
              </div>
            </div>
            <p style={HINT}>
              Apretá <strong>Crear certificado adicional para el DN</strong>.
            </p>
            <GuideImage
              src="/arca-guide/homologacion/08-agregar-certificado-alias.jpg"
              alt="Formulario Agregar certificado a alias en WSASS"
            />
          </Step>
        ) : (
          <Step n={2} title="Agregá el certificado nuevo al alias">
            <p style={HINT}>
              En{' '}
              <ArcaInlineLink href={ARCA_MY_SERVICES_URL}>
                Mis servicios
              </ArcaInlineLink>{' '}
              abrí <strong>Administración de Certificados Digitales</strong>,
              entrá al alias y apretá <strong>Agregar certificado</strong>:
            </p>
            <CopyRow label="Alias" displayValue={alias} copyValue={alias} />
            <p style={HINT}>Subí esta solicitud de certificado (CSR):</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
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
              <CopyCsrButton csr={csr} loading={csrLoading} />
            </div>
          </Step>
        )}

        <Step n={3} title="Pegá el certificado nuevo">
          <p style={HINT}>
            {homologacion ? (
              <>
                Abajo, en <strong>Resultado</strong>, ARCA te muestra el
                certificado. Copialo completo y pegalo acá:
              </>
            ) : (
              'Descargá el certificado que genera ARCA, abrilo con el Bloc de notas y pegá todo el contenido acá:'
            )}
          </p>
          <CertificateTextarea
            value={certText}
            onChange={setCertText}
            disabled={verifying}
            error={certError}
          />
        </Step>

        <Step n={4} title="Verificá el certificado">
          <p style={HINT}>
            No hace falta volver a autorizar los servicios: quedan asociados al
            alias. Parkit prueba el certificado con ARCA y, si anda, empieza a
            usarlo en todas las sedes que lo comparten.
          </p>
        </Step>
      </ol>

      {csrError && (
        <Alert
          variant="err"
          icon={<IconAlert size={16} />}
          title="No pudimos preparar la solicitud"
          description={csrError}
        />
      )}
      {verifyError && (
        <Alert
          variant="err"
          icon={<IconAlert size={16} />}
          title="No pudimos verificar el certificado"
          description={verifyError}
        />
      )}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Button
          variant="primary"
          loading={verifying}
          disabled={certValidation !== null}
          onClick={() => onVerify(certText)}
        >
          Verificar y renovar
        </Button>
        <Button variant="secondary" disabled={verifying} onClick={onCancel}>
          Cancelar
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

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li style={{ display: 'grid', gridTemplateColumns: '28px 1fr', gap: 12 }}>
      <span
        aria-hidden
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: 'var(--brand-soft)',
          color: 'var(--brand)',
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        {n}
      </span>
      <div style={{ display: 'grid', gap: 10, minWidth: 0 }}>
        <h3
          style={{
            margin: '4px 0 0',
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--text-1)',
          }}
        >
          {title}
        </h3>
        {children}
      </div>
    </li>
  );
}

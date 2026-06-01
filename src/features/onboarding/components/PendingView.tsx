import type { ApplicationView, CompanyProfile } from '../services/onboarding';

type Props = {
  company: CompanyProfile;
  application: ApplicationView;
};

function formatDate(value: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

/** Read-only status screen shown once the application is pending review. */
export function PendingView({ company, application }: Props) {
  return (
    <div className="onboarding-card">
      <div className="onboarding-banner banner-info">
        <strong>Tu solicitud está en revisión</strong>
        Nuestro equipo está revisando los datos de tu estacionamiento. Te
        avisaremos cuando esté aprobada.
      </div>

      <div className="onboarding-section">
        <h3>Datos enviados</h3>
        <div className="onboarding-summary">
          <div className="summary-item">
            <span className="summary-label">Razón social</span>
            <span className="summary-value">{company.legalName}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">CUIT</span>
            <span className="summary-value">{company.cuit}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Email</span>
            <span className="summary-value">{company.email}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Teléfono</span>
            <span className="summary-value">{company.phone ?? '—'}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Domicilio</span>
            <span className="summary-value">{company.address ?? '—'}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Sucursales declaradas</span>
            <span className="summary-value">
              {application.declaredBranchCount}
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Documentos</span>
            <span className="summary-value">{application.docsCount}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Enviada el</span>
            <span className="summary-value">
              {formatDate(application.submittedAt)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

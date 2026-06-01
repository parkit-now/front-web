import { Link } from 'react-router-dom';

/** Edge case: the company is already approved (the router normally redirects). */
export function ApprovedView() {
  return (
    <div className="onboarding-card">
      <div className="onboarding-banner banner-success">
        <strong>¡Tu estacionamiento fue aprobado!</strong>
        Ya podés gestionar tu estacionamiento desde el panel.
      </div>
      <div className="onboarding-actions">
        <Link
          to="/app"
          className="primary-button"
          style={{
            textAlign: 'center',
            lineHeight: '48px',
            textDecoration: 'none',
          }}
        >
          Ir al panel
        </Link>
      </div>
    </div>
  );
}

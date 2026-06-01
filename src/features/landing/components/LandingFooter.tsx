import { Logo } from '../../../shared/components/Logo';

export function LandingFooter() {
  return (
    <footer className="landing-footer">
      <div className="footer-inner">
        <Logo size="sm" />
        <div className="footer-links">
          <a href="#" className="footer-link">
            Términos
          </a>
          <a href="#" className="footer-link">
            Privacidad
          </a>
          <a href="#" className="footer-link">
            Contacto
          </a>
          <a href="#" className="footer-link">
            Soporte
          </a>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: '#9ca3af' }}>
          © 2026 PARKIT. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
}

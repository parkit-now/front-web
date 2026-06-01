type Props = {
  onStart: () => void;
};

export function WelcomeScreen({ onStart }: Props) {
  return (
    <div className="onboarding-card welcome-screen">
      <div className="welcome-header">
        <div className="brand-badge" aria-hidden="true">
          P
        </div>
        <h2>¡Bienvenido a Parkit!</h2>
        <p className="welcome-subtitle">
          Registrá tu empresa en pocos pasos para empezar a gestionar tu
          estacionamiento.
        </p>
      </div>
      <div className="welcome-steps">
        <div className="welcome-step">
          <span className="welcome-step-number">1</span>
          <div>
            <strong>Datos de tu empresa</strong>
            <p>Razón social, CUIT, contacto y domicilio.</p>
          </div>
        </div>
        <div className="welcome-step">
          <span className="welcome-step-number">2</span>
          <div>
            <strong>Tus sucursales</strong>
            <p>Nombre y domicilio de cada estacionamiento.</p>
          </div>
        </div>
        <div className="welcome-step">
          <span className="welcome-step-number">3</span>
          <div>
            <strong>Documentación</strong>
            <p>
              Adjuntá la documentación requerida (opcional en este momento).
            </p>
          </div>
        </div>
      </div>
      <div className="onboarding-actions">
        <button type="button" className="primary-button" onClick={onStart}>
          Comenzar
        </button>
      </div>
    </div>
  );
}

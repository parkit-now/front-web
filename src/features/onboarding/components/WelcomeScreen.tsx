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
          Registrá tu estacionamiento en pocos pasos para empezar a gestionarlo.
        </p>
      </div>
      <div className="welcome-steps">
        <div className="welcome-step">
          <span className="welcome-step-number">1</span>
          <div>
            <strong>Datos de la sucursal</strong>
            <p>Nombre, domicilio y plazas del estacionamiento.</p>
          </div>
        </div>
        <div className="welcome-step">
          <span className="welcome-step-number">2</span>
          <div>
            <strong>Datos de contacto</strong>
            <p>Razón social, CUIT, email y teléfono del titular.</p>
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

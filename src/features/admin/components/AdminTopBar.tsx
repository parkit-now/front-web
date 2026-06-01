import { useLocation } from 'react-router-dom';

const SECTION_TITLES: Record<string, string> = {
  '/ops/solicitudes': 'Solicitudes de alta',
  '/ops/usuarios': 'Usuarios y roles',
  '/ops/inventory': 'Estacionamientos',
};

export function AdminTopBar() {
  const { pathname } = useLocation();
  const title = SECTION_TITLES[pathname] ?? 'Panel operativo';

  return (
    <header
      style={{
        height: 64,
        background: '#fcfdff',
        borderBottom: '1px solid var(--border-soft)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '0 24px',
        flexShrink: 0,
      }}
    >
      <h2
        style={{
          margin: 0,
          flex: 1,
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--text-1)',
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </h2>

      {/* ENV pill */}
      <span
        style={{
          background: '#101828',
          color: '#fff',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.04em',
          padding: '4px 10px',
          borderRadius: 999,
        }}
      >
        ENV · production
      </span>
    </header>
  );
}

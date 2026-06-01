import { useLocation } from 'react-router-dom';
import {
  IconSearch,
  IconBell,
  IconRefresh,
} from '../../../shared/components/icons';
import { SucursalSwitcher } from './SucursalSwitcher';

const SECTION_TITLES: Record<string, string> = {
  '/app/dashboard': 'Monitoreo en vivo',
  '/app/estacionamientos': 'Estacionamientos',
  '/app/personal': 'Personal',
  '/app/estadisticas': 'Estadísticas',
  '/app/transacciones': 'Transacciones',
  '/app/auditoria': 'Auditoría',
  '/app/config': 'Configuración',
};

export function OwnerTopBar() {
  const { pathname } = useLocation();
  const title = SECTION_TITLES[pathname] ?? 'Portal';

  return (
    <header
      style={{
        height: 64,
        background: 'var(--card)',
        borderBottom: '1px solid var(--border-soft)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 20px',
        flexShrink: 0,
      }}
    >
      <SucursalSwitcher />

      <div
        style={{
          width: 1,
          height: 24,
          background: 'var(--border-soft)',
          flexShrink: 0,
        }}
      />

      <h2
        style={{
          margin: 0,
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--text-1)',
          letterSpacing: '-0.01em',
          flex: 1,
        }}
      >
        {title}
      </h2>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          type="button"
          className="pk-btn pk-btn-ghost pk-btn-icon"
          title="Buscar"
          aria-label="Buscar"
        >
          <IconSearch size={18} />
        </button>
        <button
          type="button"
          className="pk-btn pk-btn-ghost pk-btn-icon"
          title="Notificaciones"
          aria-label="Notificaciones"
        >
          <span style={{ position: 'relative' }}>
            <IconBell size={18} />
            <span
              style={{
                position: 'absolute',
                top: -4,
                right: -4,
                width: 8,
                height: 8,
                background: 'var(--err-text)',
                borderRadius: '50%',
                border: '1.5px solid var(--card)',
              }}
            />
          </span>
        </button>
        <button
          type="button"
          className="pk-btn pk-btn-ghost pk-btn-icon"
          title="Actualizar"
          aria-label="Actualizar"
        >
          <IconRefresh size={18} />
        </button>
      </div>
    </header>
  );
}

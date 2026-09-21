import { useLocation, Link } from 'react-router-dom';
import { Logo } from '../../../shared/components/Logo';
import { Avatar } from '../../../shared/components/Avatar';
import {
  IconUsers,
  IconChart,
  IconShield,
  IconDollar,
  IconClock,
  IconInbox,
  IconAuto,
  IconLayers,
  IconCreditCard,
  IconPlug,
  IconSettings,
  IconLogout,
} from '../../../shared/components/icons';

interface NavItem {
  /** Path segment, joined to the sidebar's `basePath`. */
  segment: string;
  label: string;
  icon: React.ReactNode;
}

export const OWNER_NAV_ITEMS: NavItem[] = [
  {
    segment: 'historial',
    label: 'Historial',
    icon: <IconClock size={18} />,
  },
  {
    segment: 'caja',
    label: 'Caja',
    icon: <IconInbox size={18} />,
  },
  { segment: 'personal', label: 'Personal', icon: <IconUsers size={18} /> },
  {
    segment: 'estadisticas',
    label: 'Estadísticas',
    icon: <IconChart size={18} />,
  },
  {
    segment: 'auditoria',
    label: 'Auditoría',
    icon: <IconShield size={18} />,
  },
  { segment: 'tasas', label: 'Tasas', icon: <IconDollar size={18} /> },
  { segment: 'vehiculos', label: 'Vehículos', icon: <IconAuto size={18} /> },
  {
    segment: 'tipos-de-vehiculo',
    label: 'Tipos de vehículo',
    icon: <IconLayers size={18} />,
  },
  {
    segment: 'metodos-de-pago',
    label: 'Métodos de pago',
    icon: <IconCreditCard size={18} />,
  },
  {
    segment: 'integraciones',
    label: 'Integraciones',
    // Genérico a propósito: la sección es "Integraciones", no "Mercado Pago".
    // El isotipo de la marca acá diría que la sección ES Mercado Pago y
    // mentiría apenas entre la segunda integración. El logo va en la tarjeta,
    // que sí identifica a la marca.
    // El enchufe además comunica "conectar", que es lo que hace la sección
    // (un rayo hablaría de energía, que no tiene nada que ver).
    icon: <IconPlug size={18} />,
  },
  {
    segment: 'config',
    label: 'Configuración',
    icon: <IconSettings size={18} />,
  },
];

interface OwnerSidebarProps {
  userName: string;
  userRole?: string;
  onSignOut: () => void;
  /** Route prefix the nav items hang off. `/app` for owners, the
   * `/ops/estacionamientos/:tenantId` base for admins entering a lot. */
  basePath?: string;
  /** Push the sticky sidebar down when an impersonation bar sits above it. */
  topOffset?: number;
}

export function OwnerSidebar({
  userName,
  userRole = 'Dueño',
  onSignOut,
  basePath = '/app',
  topOffset = 0,
}: OwnerSidebarProps) {
  const { pathname } = useLocation();

  return (
    <aside
      className="portal-sidebar"
      style={{
        width: 260,
        flexShrink: 0,
        background: 'var(--card)',
        borderRight: '1px solid var(--border-soft)',
        display: 'flex',
        flexDirection: 'column',
        height: `calc(100vh - ${topOffset}px)`,
        position: 'sticky',
        top: topOffset,
      }}
    >
      {/* Logo */}
      <div
        style={{
          height: 64,
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <Logo size="md" />
      </div>

      <div className="pk-divider" />

      {/* Nav label */}
      <p
        style={{
          margin: '16px 20px 8px',
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--text-3)',
        }}
      >
        Operación
      </p>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: '0 8px', overflowY: 'auto' }}>
        {OWNER_NAV_ITEMS.map((item) => {
          const to = `${basePath}/${item.segment}`;
          const isActive = pathname === to || pathname.startsWith(to);
          return (
            <Link
              key={item.segment}
              to={to}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                borderRadius: 'var(--r-md)',
                marginBottom: 2,
                textDecoration: 'none',
                background: isActive ? 'var(--brand-soft)' : 'transparent',
                color: isActive ? 'var(--brand)' : 'var(--text-2)',
                fontWeight: isActive ? 600 : 400,
                fontSize: 14,
                transition: 'all 120ms',
              }}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="pk-divider" />

      {/* User footer */}
      <div
        style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 10 }}
      >
        <Avatar name={userName} size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-1)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {userName}
          </p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)' }}>
            {userRole}
          </p>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          title="Cerrar sesión"
          className="pk-btn pk-btn-ghost pk-btn-icon"
          style={{ flexShrink: 0 }}
        >
          <IconLogout size={16} />
        </button>
      </div>
    </aside>
  );
}

import { useLocation, Link } from 'react-router-dom';
import { Logo } from '../../../shared/components/Logo';
import { Avatar } from '../../../shared/components/Avatar';
import {
  IconDashboard,
  IconUsers,
  IconChart,
  IconReceipt,
  IconShield,
  IconCar,
  IconDollar,
  IconAuto,
  IconCreditCard,
  IconSettings,
  IconLogout,
} from '../../../shared/components/icons';

interface NavItem {
  /** Path segment, joined to the sidebar's `basePath`. */
  segment: string;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    segment: 'dashboard',
    label: 'Monitoreo en vivo',
    icon: <IconDashboard size={18} />,
  },
  { segment: 'personal', label: 'Personal', icon: <IconUsers size={18} /> },
  {
    segment: 'estadisticas',
    label: 'Estadísticas',
    icon: <IconChart size={18} />,
  },
  {
    segment: 'transacciones',
    label: 'Transacciones',
    icon: <IconReceipt size={18} />,
  },
  {
    segment: 'auditoria',
    label: 'Auditoría',
    icon: <IconShield size={18} />,
  },
  {
    segment: 'revision-lpr',
    label: 'Patentes descartadas',
    icon: <IconCar size={18} />,
  },
  { segment: 'tasas', label: 'Tasas', icon: <IconDollar size={18} /> },
  { segment: 'vehiculos', label: 'Vehículos', icon: <IconAuto size={18} /> },
  {
    segment: 'metodos-de-pago',
    label: 'Métodos de pago',
    icon: <IconCreditCard size={18} />,
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
      <div style={{ padding: '20px 20px 16px' }}>
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
        {NAV_ITEMS.map((item) => {
          const to = `${basePath}/${item.segment}`;
          const isActive =
            pathname === to ||
            (item.segment !== 'dashboard' && pathname.startsWith(to));
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

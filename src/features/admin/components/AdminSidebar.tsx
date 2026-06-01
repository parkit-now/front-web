import { useLocation, Link } from 'react-router-dom';
import { Avatar } from '../../../shared/components/Avatar';
import { Logo } from '../../../shared/components/Logo';
import {
  IconInbox,
  IconUsers,
  IconBuilding,
  IconLogout,
} from '../../../shared/components/icons';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    path: '/ops/solicitudes',
    label: 'Solicitudes',
    icon: <IconInbox size={18} />,
  },
  {
    path: '/ops/usuarios',
    label: 'Usuarios y roles',
    icon: <IconUsers size={18} />,
  },
  {
    path: '/ops/inventory',
    label: 'Estacionamientos',
    icon: <IconBuilding size={18} />,
  },
];

interface AdminSidebarProps {
  pendingCount: number;
  userName: string;
  onSignOut: () => void;
}

export function AdminSidebar({
  pendingCount,
  userName,
  onSignOut,
}: AdminSidebarProps) {
  const { pathname } = useLocation();

  return (
    <aside
      style={{
        width: 260,
        flexShrink: 0,
        background: '#fcfdff',
        borderRight: '1px solid var(--border-soft)',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'sticky',
        top: 0,
      }}
    >
      {/* Logo */}
      <div style={{ padding: '20px 20px 16px' }}>
        <Logo size="md" variant="ops" />
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
        Administración
      </p>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: '0 8px', overflowY: 'auto' }}>
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.path || pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
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
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.path === '/ops/solicitudes' && pendingCount > 0 && (
                <span
                  style={{
                    minWidth: 20,
                    height: 20,
                    padding: '0 6px',
                    background: 'var(--brand)',
                    color: '#fff',
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {pendingCount}
                </span>
              )}
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
            Administrador
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

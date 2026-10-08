import { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Logo } from '../../../shared/components/Logo';
import { ListChecks } from 'lucide-react';
import { Avatar } from '../../../shared/components/Avatar';
import {
  IconUsers,
  IconChart,
  IconShield,
  IconDollar,
  IconClock,
  IconInbox,
  IconCalendar,
  IconAuto,
  IconLayers,
  IconCreditCard,
  IconPlug,
  IconSettings,
  IconLogout,
  IconChevronDown,
  IconChevronRight,
  IconAlert,
  IconUser,
  IconZap,
} from '../../../shared/components/icons';

interface NavLeaf {
  /** Path segment, joined to the sidebar's `basePath` (puede tener `/`). */
  segment: string;
  label: string;
  icon: React.ReactNode;
}

interface NavGroup {
  /** Identificador estable (clave de persistencia). */
  id: string;
  label: string;
  icon: React.ReactNode;
  children: NavLeaf[];
}

type NavEntry = NavLeaf | NavGroup;

function isGroup(entry: NavEntry): entry is NavGroup {
  return 'children' in entry;
}

export const OWNER_NAV: NavEntry[] = [
  { segment: 'historial', label: 'Historial', icon: <IconClock size={18} /> },
  { segment: 'caja', label: 'Caja', icon: <IconInbox size={18} /> },
  { segment: 'reservas', label: 'Reservas', icon: <IconCalendar size={18} /> },
  { segment: 'personal', label: 'Personal', icon: <IconUsers size={18} /> },
  {
    segment: 'estadisticas',
    label: 'Estadísticas',
    icon: <IconChart size={18} />,
  },
  { segment: 'auditoria', label: 'Auditoría', icon: <IconShield size={18} /> },
  {
    id: 'config',
    label: 'Configuración',
    icon: <IconSettings size={18} />,
    children: [
      {
        segment: 'config/perfil',
        label: 'Perfil',
        icon: <IconUser size={16} />,
      },
      {
        segment: 'config/horarios',
        label: 'Horarios',
        icon: <IconClock size={16} />,
      },
      {
        segment: 'config/servicios',
        label: 'Servicios',
        icon: <IconZap size={16} />,
      },
      {
        segment: 'config/retencion',
        label: 'Retención',
        icon: <IconShield size={16} />,
      },
      { segment: 'tarifas', label: 'Tarifas', icon: <IconDollar size={16} /> },
      {
        segment: 'metodos-de-pago',
        label: 'Métodos de pago',
        icon: <IconCreditCard size={16} />,
      },
      {
        segment: 'vehiculos',
        label: 'Vehículos',
        icon: <IconAuto size={16} />,
      },
      {
        segment: 'tipos-de-vehiculo',
        label: 'Tipos de vehículo',
        icon: <IconLayers size={16} />,
      },
      {
        segment: 'integraciones',
        label: 'Integraciones',
        // Genérico a propósito: la sección es "Integraciones", no "Mercado
        // Pago". El enchufe comunica "conectar", que es lo que hace la sección.
        icon: <IconPlug size={16} />,
      },
      {
        segment: 'config/clientes',
        label: 'Clientes',
        icon: <IconUsers size={16} />,
      },
      {
        segment: 'config/lista-blanca',
        label: 'Lista blanca',
        icon: <ListChecks size={16} />,
      },
    ],
  },
];

/**
 * Lista plana (grupos aplanados) para la navegación móvil, que no tiene
 * submenús: los hijos de "Configuración" quedan como ítems propios.
 */
export const OWNER_NAV_ITEMS: NavLeaf[] = OWNER_NAV.flatMap((entry) =>
  isGroup(entry) ? entry.children : [entry],
);

const GROUP_OPEN_KEY = 'owner-nav-groups-open';

function readOpenGroups(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(GROUP_OPEN_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, boolean>)
      : {};
  } catch {
    return {};
  }
}

function writeOpenGroups(value: Record<string, boolean>) {
  try {
    localStorage.setItem(GROUP_OPEN_KEY, JSON.stringify(value));
  } catch {
    // Sin storage (modo privado, bloqueado): el estado vive solo en memoria.
  }
}

function matchesPath(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(`${to}/`);
}

interface OwnerSidebarProps {
  userName: string;
  userRole?: string;
  onSignOut: () => void;
  /** Route prefix the nav items hang off. `/app` for owners, the
   * `/ops/estacionamientos/:tenantId` base for admins entering a lot. */
  basePath?: string;
  /** Push the sticky sidebar down when an impersonation bar sits above it. */
  topOffset?: number;
  /** Contador por sección (`segment`), p. ej. las reservas por aceptar. */
  badges?: Record<string, number>;
  /** Secciones (`segment`) con un aviso de alerta, p. ej. reservas desactivadas. */
  alerts?: Record<string, string>;
}

export function OwnerSidebar({
  userName,
  userRole = 'Dueño',
  onSignOut,
  basePath = '/app',
  topOffset = 0,
  badges = {},
  alerts = {},
}: OwnerSidebarProps) {
  const { pathname } = useLocation();
  const [openGroups, setOpenGroups] = useState(readOpenGroups);

  function toggleGroup(id: string, current: boolean) {
    const next = { ...openGroups, [id]: !current };
    setOpenGroups(next);
    writeOpenGroups(next);
  }

  function renderLeaf(item: NavLeaf, nested: boolean) {
    const to = `${basePath}/${item.segment}`;
    const isActive = matchesPath(pathname, to);
    const alert = alerts[item.segment];
    return (
      <Link
        key={item.segment}
        to={to}
        aria-current={isActive ? 'page' : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: nested ? '7px 12px 7px 40px' : '8px 12px',
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
        {!nested && item.icon}
        <span style={{ flex: 1 }}>{item.label}</span>
        {alert && (
          <span
            role="img"
            aria-label={alert}
            title={alert}
            style={{ color: 'var(--warn, #b45309)', display: 'inline-flex' }}
          >
            <IconAlert size={16} />
          </span>
        )}
        {(badges[item.segment] ?? 0) > 0 && (
          <span
            className="pk-badge pk-badge-brand"
            aria-label={`${badges[item.segment]} por atender`}
            style={{ fontFamily: 'var(--mono)' }}
          >
            {badges[item.segment]}
          </span>
        )}
      </Link>
    );
  }

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
        {OWNER_NAV.map((entry) => {
          if (!isGroup(entry)) return renderLeaf(entry, false);
          const childActive = entry.children.some((c) =>
            matchesPath(pathname, `${basePath}/${c.segment}`),
          );
          // Abierto si el usuario lo abrió o si la ruta activa es hija.
          const open = childActive || (openGroups[entry.id] ?? false);
          const panelId = `nav-group-${entry.id}`;
          return (
            <div key={entry.id}>
              <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => toggleGroup(entry.id, open)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--r-md)',
                  marginBottom: 2,
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  background: 'transparent',
                  color: childActive ? 'var(--brand)' : 'var(--text-2)',
                  fontWeight: childActive ? 600 : 400,
                  fontSize: 14,
                  fontFamily: 'inherit',
                }}
              >
                {entry.icon}
                <span style={{ flex: 1 }}>{entry.label}</span>
                {open ? (
                  <IconChevronDown size={16} />
                ) : (
                  <IconChevronRight size={16} />
                )}
              </button>
              {open && (
                <div id={panelId}>
                  {entry.children.map((c) => renderLeaf(c, true))}
                </div>
              )}
            </div>
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

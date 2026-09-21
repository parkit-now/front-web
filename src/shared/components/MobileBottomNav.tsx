import { Link, useLocation } from 'react-router-dom';

export interface MobileBottomNavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

interface MobileBottomNavProps {
  items: MobileBottomNavItem[];
  ariaLabel: string;
}

export function MobileBottomNav({ items, ariaLabel }: MobileBottomNavProps) {
  const { pathname } = useLocation();

  return (
    <nav className="portal-bottom-nav" aria-label={ariaLabel}>
      <div className="portal-bottom-nav-scroll">
        {items.map((item) => {
          const isActive =
            pathname === item.to || pathname.startsWith(`${item.to}/`);

          return (
            <Link
              key={item.to}
              to={item.to}
              className={`portal-bottom-nav-item${isActive ? ' is-active' : ''}`}
            >
              <span className="portal-bottom-nav-icon">
                {item.icon}
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="portal-bottom-nav-badge">{item.badge}</span>
                )}
              </span>
              <span className="portal-bottom-nav-label">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

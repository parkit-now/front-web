import { SucursalSwitcher } from './SucursalSwitcher';

export function OwnerTopBar() {
  return (
    <header
      className="portal-topbar owner-topbar"
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
    </header>
  );
}

interface Tab {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}
interface TabsProps {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
}

export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div
      style={{
        display: 'flex',
        borderBottom: '1px solid var(--border-soft)',
        gap: 0,
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 16px',
              border: 'none',
              background: 'none',
              fontSize: 14,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--brand)' : 'var(--text-2)',
              borderBottom: `2px solid ${isActive ? 'var(--brand)' : 'transparent'}`,
              marginBottom: -1,
              cursor: 'pointer',
              transition: 'all 160ms',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: isActive ? 'var(--brand)' : 'var(--text-3)',
                  fontFamily: 'var(--mono)',
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

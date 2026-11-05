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
    <div className="segmented-control">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            className={isActive ? 'active' : ''}
            aria-pressed={isActive}
            onClick={() => onChange(tab.id)}
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

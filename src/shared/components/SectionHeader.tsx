interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  kicker?: string;
  action?: React.ReactNode;
}

export function SectionHeader({
  title,
  subtitle,
  kicker,
  action,
}: SectionHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 24,
      }}
    >
      <div>
        {kicker && (
          <p
            style={{
              margin: '0 0 4px',
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--brand)',
            }}
          >
            {kicker}
          </p>
        )}
        <h1
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: '-0.015em',
            color: 'var(--text-1)',
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--text-2)' }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}

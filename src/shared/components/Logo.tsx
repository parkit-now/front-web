interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'ops';
}

const sizes = {
  sm: { badge: 24, text: 15 },
  md: { badge: 30, text: 18 },
  lg: { badge: 36, text: 22 },
};

export function Logo({ size = 'md', variant = 'default' }: LogoProps) {
  const s = sizes[size];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div
        style={{
          width: s.badge,
          height: s.badge,
          background: 'linear-gradient(135deg, #0e5fd8, #1a7bff)',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <span
          style={{ color: '#fff', fontWeight: 700, fontSize: s.badge * 0.5 }}
        >
          P
        </span>
      </div>
      <span
        style={{
          fontWeight: 700,
          fontSize: s.text,
          letterSpacing: '-0.02em',
          color: 'var(--text-1)',
        }}
      >
        PARKIT
      </span>
      {variant === 'ops' && (
        <span
          style={{
            background: '#101828',
            color: '#fff',
            fontSize: 10,
            fontWeight: 600,
            padding: '2px 6px',
            borderRadius: 4,
            letterSpacing: '0.04em',
          }}
        >
          OPS
        </span>
      )}
    </div>
  );
}

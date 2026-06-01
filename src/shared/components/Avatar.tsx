interface AvatarProps {
  name: string;
  size?: number;
  soft?: boolean;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

export function Avatar({ name, size = 32, soft = false }: AvatarProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: soft ? 'var(--brand-soft)' : 'var(--brand)',
        color: soft ? 'var(--brand)' : '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 600,
        fontSize: size * 0.4,
        flexShrink: 0,
        letterSpacing: '-0.02em',
      }}
    >
      {getInitials(name)}
    </div>
  );
}

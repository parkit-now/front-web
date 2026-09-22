type BadgeVariant = 'default' | 'brand' | 'ok' | 'err' | 'warn';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
  className?: string;
}

const VARIANT_MAP: Record<BadgeVariant, string> = {
  default: '',
  brand: 'pk-badge-brand',
  ok: 'pk-badge-ok',
  err: 'pk-badge-err',
  warn: 'pk-badge-warn',
};

export function Badge({
  children,
  variant = 'default',
  dot = false,
  className = '',
  ...spanProps
}: BadgeProps) {
  const cls = [
    'pk-badge',
    VARIANT_MAP[variant],
    dot ? 'pk-badge-dot' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <span className={cls} {...spanProps}>
      {children}
    </span>
  );
}

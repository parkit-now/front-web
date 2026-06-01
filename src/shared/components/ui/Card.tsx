interface CardProps {
  children: React.ReactNode;
  padding?: 'none' | 'md' | 'lg';
  className?: string;
  style?: React.CSSProperties;
}

export function Card({
  children,
  padding = 'md',
  className = '',
  style,
}: CardProps) {
  const cls = [
    'pk-card',
    padding === 'md' ? 'pk-card-pad' : '',
    padding === 'lg' ? 'pk-card-pad-lg' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls} style={style}>
      {children}
    </div>
  );
}

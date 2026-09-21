type AlertVariant = 'info' | 'warn' | 'err';

interface AlertProps {
  variant?: AlertVariant;
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

const VARIANT_MAP: Record<AlertVariant, string> = {
  info: 'pk-alert-info',
  warn: 'pk-alert-warn',
  err: 'pk-alert-err',
};

export function Alert({
  variant = 'info',
  icon,
  title,
  description,
  action,
  className = '',
}: AlertProps) {
  const cls = ['pk-alert', VARIANT_MAP[variant], className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cls} role={variant === 'err' ? 'alert' : 'status'}>
      {icon ? <span className="pk-alert-icon">{icon}</span> : null}
      <span className="pk-alert-copy">
        <strong>{title}</strong>
        {description === undefined ? null : <span>{description}</span>}
      </span>
      {action === undefined ? null : (
        <span className="pk-alert-action">{action}</span>
      )}
    </div>
  );
}

import { Spinner } from './Spinner';
import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  disabled,
  className = '',
  ...rest
}: ButtonProps) {
  const cls = [
    'pk-btn',
    variant === 'primary' ? 'pk-btn-primary' : '',
    variant === 'secondary' ? 'pk-btn-secondary' : '',
    variant === 'ghost' ? 'pk-btn-ghost' : '',
    variant === 'danger' ? 'pk-btn-danger' : '',
    size === 'sm' ? 'pk-btn-sm' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={cls}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <Spinner
          size={14}
          color={variant === 'primary' ? '#fff' : 'var(--brand)'}
        />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}

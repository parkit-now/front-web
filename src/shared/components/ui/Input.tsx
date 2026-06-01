import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export function Input({
  label,
  error,
  icon,
  className = '',
  id,
  ...rest
}: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s/g, '-');
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        width: '100%',
      }}
    >
      {label && (
        <label htmlFor={inputId} className="pk-label">
          {label}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        {icon && (
          <span
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-3)',
              display: 'flex',
            }}
          >
            {icon}
          </span>
        )}
        <input
          id={inputId}
          className={`pk-input ${icon ? 'has-icon' : ''} ${className}`}
          style={icon ? { paddingLeft: 34 } : undefined}
          {...rest}
        />
      </div>
      {error && (
        <span style={{ fontSize: 12, color: 'var(--err-text)' }}>{error}</span>
      )}
    </div>
  );
}

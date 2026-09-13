import type { InputHTMLAttributes } from 'react';
import { RequiredMark } from './RequiredMark';

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
  required,
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
          {/* `required` ya existía como atributo nativo (la interfaz extiende
              `InputHTMLAttributes`) pero se iba derecho al `<input>` sin
              pintar nada. Ahora también marca la etiqueta: un campo
              obligatorio que no lo dice es una trampa, y repetir el asterisco
              a mano en cada llamador se despega solo. */}
          {required ? <RequiredMark /> : null}
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
          // El asterisco no puede ser el único indicador: `required` viaja al
          // DOM y `aria-required` lo deja explícito para los lectores que no
          // infieren el estado del atributo nativo.
          required={required}
          aria-required={required ? true : undefined}
          {...rest}
        />
      </div>
      {error && (
        <span style={{ fontSize: 12, color: 'var(--err-text)' }}>{error}</span>
      )}
    </div>
  );
}

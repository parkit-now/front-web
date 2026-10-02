import { Eye, EyeOff } from 'lucide-react';
import { useState, type InputHTMLAttributes } from 'react';
import { IconAlert } from '../icons';
import { RequiredMark } from './RequiredMark';

interface PasswordInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type'
> {
  id: string;
  label?: string;
  error?: string;
}

/**
 * Campo de contraseña con botón "ojito" para mostrar/ocultar. Usa el estilo de
 * los formularios de auth (`form-field`, `password-input-wrap`, `field-error`).
 * El botón es `type="button"` para no disparar el submit, y el mousedown no
 * le roba el foco al input.
 */
export function PasswordInput({
  id,
  label,
  error,
  required,
  className,
  ...rest
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const errorId = `${id}-error`;
  const classes = [error ? 'input-error' : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className="form-field">
      {label ? (
        <label htmlFor={id} className="auth-label">
          {label}
          {required ? <RequiredMark /> : null}
        </label>
      ) : null}
      <div className="password-input-wrap">
        <input
          {...rest}
          id={id}
          type={visible ? 'text' : 'password'}
          required={required}
          aria-required={required ? true : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={classes || undefined}
        />
        <button
          type="button"
          className="password-visibility-button"
          onClick={() => setVisible((current) => !current)}
          // Evita que el mousedown mueva el foco al botón y deje el input
          // sin cursor mientras se escribe.
          onMouseDown={(event) => event.preventDefault()}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
        >
          {visible ? (
            <EyeOff size={18} aria-hidden="true" />
          ) : (
            <Eye size={18} aria-hidden="true" />
          )}
        </button>
      </div>
      {error ? (
        <p id={errorId} className="field-error" role="alert">
          <IconAlert size={14} />
          {error}
        </p>
      ) : null}
    </div>
  );
}

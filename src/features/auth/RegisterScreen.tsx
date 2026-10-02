import { useState, type FormEvent } from 'react';
import { IconAlert } from '../../shared/components/icons';
import { PasswordInput } from '../../shared/components/ui/PasswordInput';
import { RequiredMark } from '../../shared/components/ui/RequiredMark';
import { useToast } from '../../lib/notifications/ToastProvider';
import {
  registerWithEmail,
  signInWithProvider,
} from '../../lib/supabase/session';
import { getErrorMessage, mapAuthError } from './errors';
import { ProviderIcon, type SocialProvider } from './ProviderIcon';
import {
  validateEmail,
  validateFullName,
  validatePassword,
  validatePasswordConfirmation,
  type FieldErrors,
} from './validation';

const OAUTH_OPTIONS: { provider: SocialProvider; label: string }[] = [
  { provider: 'google', label: 'Google' },
  { provider: 'github', label: 'GitHub' },
];

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="field-error" role="alert">
      <IconAlert size={14} />
      {message}
    </p>
  );
}

type Props = {
  onSwitchToLogin: () => void;
};

export function RegisterScreen({ onSwitchToLogin }: Props) {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pendingEmail, setPendingEmail] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<SocialProvider | null>(
    null,
  );

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    const next: FieldErrors = {};
    const nameError = validateFullName(name);
    if (nameError) next.name = nameError;
    const emailError = validateEmail(email);
    if (emailError) next.email = emailError;
    const passwordError = validatePassword(password, { isNew: true });
    if (passwordError) next.password = passwordError;
    const confirmationError = validatePasswordConfirmation(
      password,
      passwordConfirmation,
    );
    if (confirmationError) next.passwordConfirmation = confirmationError;
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    setErrors({});
    setPendingEmail(true);
    try {
      await registerWithEmail(name, email, password);
    } catch (error) {
      const mapped = mapAuthError(error, 'register');
      if (mapped.fieldErrors) {
        setErrors(mapped.fieldErrors);
      }
      if (mapped.toastMessage) {
        showToast({ message: mapped.toastMessage, kind: 'error' });
      }
    } finally {
      setPendingEmail(false);
    }
  }

  async function handleProvider(provider: SocialProvider) {
    setPendingProvider(provider);
    try {
      await signInWithProvider(provider);
    } catch (error) {
      showToast({ message: getErrorMessage(error), kind: 'error' });
      setPendingProvider(null);
    }
  }

  const anyPending = pendingEmail || pendingProvider !== null;

  return (
    <>
      <h2>Crear cuenta</h2>

      <div className="oauth-list">
        {OAUTH_OPTIONS.map((option) => (
          <button
            key={option.provider}
            type="button"
            className="oauth-button"
            onClick={() => {
              void handleProvider(option.provider);
            }}
            disabled={anyPending}
          >
            <ProviderIcon provider={option.provider} />
            <span className="sr-only">{option.label}</span>
          </button>
        ))}
      </div>

      <div className="auth-divider" role="presentation">
        <span>o registrate con email</span>
      </div>

      <form
        className="auth-form"
        noValidate
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
        <div className="form-field">
          <label htmlFor="register-name" className="auth-label">
            Nombre y apellido
            <RequiredMark />
          </label>
          <input
            id="register-name"
            type="text"
            required
            aria-required="true"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? 'register-name-error' : undefined}
            autoComplete="name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (errors.name) {
                setErrors((prev) => ({ ...prev, name: undefined }));
              }
            }}
            placeholder="Nombre y apellido"
            className={errors.name ? 'input-error' : undefined}
          />
          <FieldError id="register-name-error" message={errors.name} />
        </div>

        <div className="form-field">
          <label htmlFor="register-email" className="auth-label">
            Email
            <RequiredMark />
          </label>
          <input
            id="register-email"
            type="email"
            required
            aria-required="true"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={
              errors.email ? 'register-email-error' : 'register-email-hint'
            }
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (errors.email) {
                setErrors((prev) => ({ ...prev, email: undefined }));
              }
            }}
            placeholder="Email"
            className={errors.email ? 'input-error' : undefined}
          />
          {errors.email ? null : (
            <p id="register-email-hint" className="field-hint">
              Ejemplo: nombre@ejemplo.com
            </p>
          )}
          <FieldError id="register-email-error" message={errors.email} />
        </div>

        <PasswordInput
          id="register-password"
          label="Contraseña"
          required
          autoComplete="new-password"
          value={password}
          onChange={(event) => {
            const value = event.target.value;
            setPassword(value);
            setErrors((prev) => {
              if (!prev.password && !prev.passwordConfirmation) return prev;
              const next = { ...prev, password: undefined };
              // Si ahora coinciden, el error de confirmación ya no aplica.
              if (prev.passwordConfirmation && value === passwordConfirmation) {
                next.passwordConfirmation = undefined;
              }
              return next;
            });
          }}
          placeholder="Contraseña (mín. 8 caracteres)"
          error={errors.password}
        />

        <PasswordInput
          id="register-password-confirmation"
          label="Repetir contraseña"
          required
          autoComplete="new-password"
          value={passwordConfirmation}
          onChange={(event) => {
            setPasswordConfirmation(event.target.value);
            if (errors.passwordConfirmation) {
              setErrors((prev) => ({
                ...prev,
                passwordConfirmation: undefined,
              }));
            }
          }}
          placeholder="Repetí la contraseña"
          error={errors.passwordConfirmation}
        />

        <button type="submit" className="primary-button" disabled={anyPending}>
          {pendingEmail ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>
      </form>

      <p className="form-helper">
        ¿Ya tenés cuenta?{' '}
        <button
          type="button"
          className="link-button"
          onClick={onSwitchToLogin}
          disabled={anyPending}
        >
          Ingresar
        </button>
      </p>
    </>
  );
}

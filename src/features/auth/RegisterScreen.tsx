import { useState, type FormEvent } from 'react';
import { useToast } from '../../lib/notifications/ToastProvider';
import {
  registerWithEmail,
  signInWithProvider,
} from '../../lib/supabase/session';
import { getErrorMessage, mapAuthError } from './errors';
import { ProviderIcon, type SocialProvider } from './ProviderIcon';
import {
  validateEmail,
  validatePassword,
  type FieldErrors,
} from './validation';

const OAUTH_OPTIONS: { provider: SocialProvider; label: string }[] = [
  { provider: 'google', label: 'Google' },
  { provider: 'github', label: 'GitHub' },
];

type Props = {
  onSwitchToLogin: () => void;
};

export function RegisterScreen({ onSwitchToLogin }: Props) {
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    const emailError = validateEmail(email);
    if (emailError) next.email = emailError;
    const passwordError = validatePassword(password, { isNew: true });
    if (passwordError) next.password = passwordError;
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    setErrors({});
    setPendingEmail(true);
    try {
      await registerWithEmail(email, password);
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
          <input
            type="email"
            aria-label="Email"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? 'register-email-error' : undefined}
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
          {errors.email ? (
            <p id="register-email-error" className="field-error">
              {errors.email}
            </p>
          ) : null}
        </div>

        <div className="form-field">
          <input
            type="password"
            aria-label="Contraseña"
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={
              errors.password ? 'register-password-error' : undefined
            }
            autoComplete="new-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (errors.password) {
                setErrors((prev) => ({ ...prev, password: undefined }));
              }
            }}
            placeholder="Contraseña (mín. 8 caracteres)"
            className={errors.password ? 'input-error' : undefined}
          />
          {errors.password ? (
            <p id="register-password-error" className="field-error">
              {errors.password}
            </p>
          ) : null}
        </div>

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

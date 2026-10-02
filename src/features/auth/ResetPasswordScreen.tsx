import { useState, type FormEvent } from 'react';
import { confirmPasswordReset } from '../../lib/api/auth';
import { translateApiError } from '../../lib/api/translate';
import { PasswordInput } from '../../shared/components/ui/PasswordInput';
import { useToast } from '../../lib/notifications/ToastProvider';
import {
  validatePassword,
  validatePasswordConfirmation,
  type FieldErrors,
} from './validation';

type Props = {
  token: string;
  onSuccess: () => void;
};

export function ResetPasswordScreen({ token, onSuccess }: Props) {
  const { showToast } = useToast();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    const next: FieldErrors = {};
    const passwordError = validatePassword(password, { isNew: true });
    if (passwordError) next.password = passwordError;
    const confirmationError = validatePasswordConfirmation(
      password,
      confirmation,
    );
    if (confirmationError) next.passwordConfirmation = confirmationError;
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    setErrors({});
    setPending(true);
    try {
      await confirmPasswordReset(token, password);
      showToast({
        message: 'Tu contraseña fue actualizada. Iniciá sesión.',
        kind: 'success',
      });
      onSuccess();
    } catch (error) {
      showToast({
        message: translateApiError(error, { endpoint: 'auth.resetPassword' }),
        kind: 'error',
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <h2>Elegí una nueva contraseña</h2>

      <form
        className="auth-form"
        noValidate
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
        <PasswordInput
          id="reset-password"
          aria-label="Nueva contraseña"
          autoComplete="new-password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            if (errors.password) {
              setErrors((prev) => ({ ...prev, password: undefined }));
            }
          }}
          placeholder="Contraseña nueva (mín. 8 caracteres)"
          error={errors.password}
        />

        <PasswordInput
          id="reset-confirmation"
          aria-label="Repetir contraseña"
          autoComplete="new-password"
          value={confirmation}
          onChange={(event) => {
            setConfirmation(event.target.value);
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

        <button type="submit" className="primary-button" disabled={pending}>
          {pending ? 'Guardando...' : 'Guardar contraseña'}
        </button>
      </form>
    </>
  );
}

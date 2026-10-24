// @vitest-environment happy-dom
import { useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/api/client';
import {
  change,
  click,
  field,
  mount,
  pageText,
  unmountAll,
} from '../../test/dom';
import { AuthPage } from './AuthPage';
import { ResetPasswordScreen } from './ResetPasswordScreen';

const session = vi.hoisted(() => ({
  getSession: vi.fn(),
  resolveHomePath: vi.fn(),
  onSessionChange: vi.fn(),
  signOut: vi.fn(),
  signInWithEmail: vi.fn(),
  signInWithProvider: vi.fn(),
  registerWithEmail: vi.fn(),
}));
const api = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
  confirmPasswordReset: vi.fn(),
}));

vi.mock('../../lib/supabase/session', () => session);
vi.mock('../../lib/api/auth', () => api);

function Path() {
  return <output data-path>{useLocation().pathname}</output>;
}

function submit(label: string) {
  const buttons = [
    ...document.querySelectorAll<HTMLButtonElement>('button[type="submit"]'),
  ];
  return click(buttons.find((b) => b.textContent?.trim() === label)!);
}

describe('AuthPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session.getSession.mockResolvedValue(null);
    session.onSessionChange.mockReturnValue(() => undefined);
    session.signInWithEmail.mockResolvedValue({});
    session.signInWithProvider.mockResolvedValue(undefined);
    session.registerWithEmail.mockResolvedValue({});
    session.resolveHomePath.mockResolvedValue('/app');
    session.signOut.mockResolvedValue(undefined);
    api.requestPasswordReset.mockResolvedValue(undefined);
    api.confirmPasswordReset.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await unmountAll();
  });

  it('con sesión activa redirige al panel', async () => {
    session.getSession.mockResolvedValue({ access_token: 't' });
    await mount(
      <>
        <AuthPage />
        <Path />
      </>,
      { path: '/login' },
    );

    expect(document.querySelector('[data-path]')!.textContent).toBe('/app');
  });

  it('valida el login antes de llamar al backend', async () => {
    await mount(<AuthPage />);

    await submit('Ingresar');

    expect(session.signInWithEmail).not.toHaveBeenCalled();
    expect(pageText()).toContain('Ingresá tu email');
  });

  it('inicia sesión con email y contraseña', async () => {
    await mount(<AuthPage />);

    await change(field('Email'), 'ana@parkit.test');
    await change(field('Contraseña'), 'secreto123');
    await submit('Ingresar');

    expect(session.signInWithEmail).toHaveBeenCalledWith(
      'ana@parkit.test',
      'secreto123',
    );
  });

  it('avisa si el backend rechaza las credenciales', async () => {
    session.signInWithEmail.mockRejectedValue(
      new ApiError(401, 'Unauthorized', null),
    );
    await mount(<AuthPage />);

    await change(field('Email'), 'ana@parkit.test');
    await change(field('Contraseña'), 'mala');
    await submit('Ingresar');

    expect(document.querySelector('.toast-error')).toBeTruthy();
  });

  it('entra con Google', async () => {
    await mount(<AuthPage />);

    await click(/Google/);

    expect(session.signInWithProvider).toHaveBeenCalledWith('google');
  });

  it('crea una cuenta', async () => {
    await mount(<AuthPage />);

    await click('Crear una');
    await change(field('Nombre y apellido'), 'Ana Pérez');
    await change(field('Email'), 'ana@parkit.test');
    await change(field('Contraseña (mín. 8 caracteres)'), 'secreto123');
    await change(field('Repetí la contraseña'), 'secreto123');
    await submit('Crear cuenta');

    expect(session.registerWithEmail).toHaveBeenCalledWith(
      'Ana Pérez',
      'ana@parkit.test',
      'secreto123',
    );
  });

  it('el registro marca las contraseñas distintas', async () => {
    await mount(<AuthPage />, { path: '/login?mode=register' });

    await change(field('Nombre y apellido'), 'Ana Pérez');
    await change(field('Email'), 'ana@parkit.test');
    await change(field('Contraseña (mín. 8 caracteres)'), 'secreto123');
    await change(field('Repetí la contraseña'), 'otra-cosa');
    await submit('Crear cuenta');

    expect(session.registerWithEmail).not.toHaveBeenCalled();
    expect(pageText()).toContain('Las contraseñas no coinciden');
  });

  it('pide el link para recuperar la contraseña', async () => {
    await mount(<AuthPage />);

    await click('¿Olvidaste tu contraseña?');
    await change(field('Email'), 'ana@parkit.test');
    await submit('Enviar link');

    expect(api.requestPasswordReset).toHaveBeenCalledWith('ana@parkit.test');
  });
});

describe('ResetPasswordScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.confirmPasswordReset.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await unmountAll();
  });

  it('guarda la contraseña nueva con el token del link', async () => {
    const onSuccess = vi.fn();
    await mount(<ResetPasswordScreen token="tok" onSuccess={onSuccess} />);

    await change(field('Nueva contraseña'), 'nueva-clave-1');
    await change(field('Repetir contraseña'), 'nueva-clave-1');
    await submit('Guardar contraseña');

    expect(api.confirmPasswordReset).toHaveBeenCalledWith(
      'tok',
      'nueva-clave-1',
    );
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it('valida y muestra el error del backend', async () => {
    api.confirmPasswordReset.mockRejectedValue(new ApiError(400, 'x', null));
    const onSuccess = vi.fn();
    await mount(<ResetPasswordScreen token="tok" onSuccess={onSuccess} />);

    await submit('Guardar contraseña');
    expect(api.confirmPasswordReset).not.toHaveBeenCalled();

    await change(field('Nueva contraseña'), 'nueva-clave-1');
    await change(field('Repetir contraseña'), 'nueva-clave-1');
    await submit('Guardar contraseña');

    expect(document.querySelector('.toast-error')).toBeTruthy();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});

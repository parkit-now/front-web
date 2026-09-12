import { describe, expect, it } from 'vitest';
import { ApiError } from './client';
import { isSessionRejected } from './session-errors';

function apiError(status: number): ApiError {
  return new ApiError(status, 'boom', null);
}

describe('isSessionRejected', () => {
  it('trata el 401 como sesión rechazada', () => {
    expect(isSessionRejected(apiError(401))).toBe(true);
  });

  it('no toca la sesión ante un 403: el token vale, falta el rol', () => {
    expect(isSessionRejected(apiError(403))).toBe(false);
  });

  it('no toca la sesión ante errores del servidor', () => {
    expect(isSessionRejected(apiError(500))).toBe(false);
    expect(isSessionRejected(apiError(502))).toBe(false);
    expect(isSessionRejected(apiError(504))).toBe(false);
  });

  it('no desloguea por falta de red (fetch falla con TypeError)', () => {
    expect(isSessionRejected(new TypeError('Failed to fetch'))).toBe(false);
  });

  it('ignora lo que no es un error de la API', () => {
    expect(isSessionRejected(new Error('401'))).toBe(false);
    expect(isSessionRejected({ status: 401 })).toBe(false);
    expect(isSessionRejected(null)).toBe(false);
    expect(isSessionRejected(undefined)).toBe(false);
  });
});

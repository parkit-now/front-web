import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../lib/api/client';
import { phoneFieldError } from './phoneErrors';

function badRequest(field: string) {
  return new ApiError(400, 'Bad Request', {
    title: 'Bad Request',
    status: 400,
    detail: 'x',
    instance: '/x',
    code: 'VALIDATION_FAILED',
    validationsErrors: [{ field, reason: 'x', code: 'isPhoneNumber' }],
  });
}

describe('phoneFieldError', () => {
  it('reconoce el 400 sobre phone', () => {
    expect(phoneFieldError(badRequest('phone'))).toBe(
      'Ingresá un teléfono válido',
    );
  });

  it('ignora otros campos y otros errores', () => {
    expect(phoneFieldError(badRequest('email'))).toBeNull();
    expect(phoneFieldError(new Error('x'))).toBeNull();
  });
});

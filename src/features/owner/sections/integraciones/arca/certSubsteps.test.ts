import { describe, expect, it } from 'vitest';
import {
  applyCertVerifyError,
  EMPTY_CERT_PROGRESS,
  markCertSubstepDone,
  resolveCertSubstepState,
  resolveCertVerifyErrorEffect,
  resolveOpenCertSubstep,
  type CertProgress,
} from './certSubsteps';

describe('resolveOpenCertSubstep', () => {
  it('arranca en el 1 sin nada completado', () => {
    expect(resolveOpenCertSubstep(EMPTY_CERT_PROGRESS)).toBe(1);
  });

  it('abre el primero sin completar', () => {
    expect(
      resolveOpenCertSubstep({ completed: [1, 2], errorSubstep: null }),
    ).toBe(3);
  });

  it('con 1 a 4 completados, el destino es el 5', () => {
    expect(
      resolveOpenCertSubstep({ completed: [1, 2, 3, 4], errorSubstep: null }),
    ).toBe(5);
  });

  it('un sub-paso en rojo gana y se abre él, aunque haya otros sin completar después', () => {
    expect(
      resolveOpenCertSubstep({ completed: [1, 2, 3, 4], errorSubstep: 4 }),
    ).toBe(4);
  });
});

describe('resolveCertSubstepState', () => {
  const base: CertProgress = { completed: [1, 2], errorSubstep: null };

  it('completado', () => {
    expect(resolveCertSubstepState(1, base)).toBe('completed');
    expect(resolveCertSubstepState(2, base)).toBe('completed');
  });

  it('el siguiente sin completar es el actual', () => {
    expect(resolveCertSubstepState(3, base)).toBe('current');
  });

  it('los de después quedan bloqueados', () => {
    expect(resolveCertSubstepState(4, base)).toBe('locked');
    expect(resolveCertSubstepState(5, base)).toBe('locked');
  });

  it('el sub-paso 5 nunca es "completed": es current recién con 1-4 listos', () => {
    const done: CertProgress = { completed: [1, 2, 3, 4], errorSubstep: null };
    expect(resolveCertSubstepState(5, done)).toBe('current');
  });

  it('el error pisa a "completed": un sub-paso ya confirmado puede volver a fallar', () => {
    const withError: CertProgress = {
      completed: [1, 2, 3, 4],
      errorSubstep: 4,
    };
    expect(resolveCertSubstepState(4, withError)).toBe('error');
    // El 5 pasa a bloqueado de nuevo: no se puede verificar con el 4 en rojo.
    expect(resolveCertSubstepState(5, withError)).toBe('locked');
  });
});

describe('markCertSubstepDone', () => {
  it('agrega el sub-paso a completados', () => {
    const next = markCertSubstepDone(EMPTY_CERT_PROGRESS, 1);
    expect(next.completed).toEqual([1]);
  });

  it('no lo duplica si ya estaba', () => {
    const next = markCertSubstepDone({ completed: [1], errorSubstep: null }, 1);
    expect(next.completed).toEqual([1]);
  });

  it('rehacer el sub-paso en rojo lo vuelve a poner verde', () => {
    const next = markCertSubstepDone(
      { completed: [1, 2, 3, 4], errorSubstep: 4 },
      4,
    );
    expect(next.errorSubstep).toBeNull();
    expect(resolveCertSubstepState(4, next)).toBe('completed');
  });

  it('completar OTRO sub-paso no borra un rojo que sigue pendiente', () => {
    const next = markCertSubstepDone(
      { completed: [1, 2, 3], errorSubstep: 4 },
      3,
    );
    expect(next.errorSubstep).toBe(4);
  });
});

describe('resolveCertVerifyErrorEffect', () => {
  it('ARCA_CERT_NOT_AUTHORIZED manda al 5 y lo marca', () => {
    expect(resolveCertVerifyErrorEffect('ARCA_CERT_NOT_AUTHORIZED')).toEqual({
      substep: 5,
      markError: true,
    });
  });

  it.each([
    'ARCA_CERT_INVALID',
    'ARCA_CERT_CUIT_MISMATCH',
    'ARCA_CERT_EXPIRED',
    'ARCA_CERT_KEY_MISMATCH',
  ])('%s manda al 4 y lo marca', (code) => {
    expect(resolveCertVerifyErrorEffect(code)).toEqual({
      substep: 4,
      markError: true,
    });
  });

  it('ARCA_UNAVAILABLE se queda en el 5 pero no marca nada', () => {
    expect(resolveCertVerifyErrorEffect('ARCA_UNAVAILABLE')).toEqual({
      substep: 5,
      markError: false,
    });
  });

  it('un código desconocido (o sin código) también cae en el 5 sin marcar', () => {
    expect(resolveCertVerifyErrorEffect(undefined)).toEqual({
      substep: 5,
      markError: false,
    });
    expect(resolveCertVerifyErrorEffect('ALGO_RARO')).toEqual({
      substep: 5,
      markError: false,
    });
  });
});

describe('applyCertVerifyError', () => {
  it('marca el sub-paso 4 con un error de certificado', () => {
    const next = applyCertVerifyError(EMPTY_CERT_PROGRESS, 'ARCA_CERT_INVALID');
    expect(next.errorSubstep).toBe(4);
  });

  it('marca el sub-paso 5 cuando falta autorizar servicios', () => {
    const next = applyCertVerifyError(
      { completed: [1, 2, 3, 4], errorSubstep: null },
      'ARCA_CERT_NOT_AUTHORIZED',
    );
    expect(next.errorSubstep).toBe(5);
  });

  // El caso que motivó la regla: un 4 en rojo sin resolver, y encima ARCA no
  // responde en el reintento. El 4 sigue sin arreglarse.
  it('un error que no marca nada NO borra un rojo previo', () => {
    const withError: CertProgress = {
      completed: [1, 2, 3, 4],
      errorSubstep: 4,
    };
    const next = applyCertVerifyError(withError, 'ARCA_UNAVAILABLE');
    expect(next.errorSubstep).toBe(4);
  });

  it('sin error previo, uno que no marca nada deja todo en null', () => {
    const next = applyCertVerifyError(EMPTY_CERT_PROGRESS, 'ARCA_UNAVAILABLE');
    expect(next.errorSubstep).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import {
  applyCertVerifyError,
  EMPTY_CERT_PROGRESS,
  markCertSubstepDone,
  resolveCertSubstepState,
  resolveCertVerifyErrorEffect,
  resolveOpenCertSubstep,
  resolvePreviousCertSubstep,
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

  it('con 1 a 5 completados, el destino es el 6 (verificar)', () => {
    expect(
      resolveOpenCertSubstep({
        completed: [1, 2, 3, 4, 5],
        errorSubstep: null,
      }),
    ).toBe(6);
  });

  it('con un sub-paso en rojo, el abierto sigue siendo el 6 (ahí se lee el aviso)', () => {
    expect(
      resolveOpenCertSubstep({ completed: [1, 2, 3, 4, 5], errorSubstep: 4 }),
    ).toBe(6);
    expect(
      resolveOpenCertSubstep({ completed: [1, 2, 3, 4, 5], errorSubstep: 5 }),
    ).toBe(6);
  });

  // Progreso guardado por una versión anterior (sin el 6): con el 4
  // completado y el 5 todavía no, el destino natural sigue siendo el 5 — el
  // dueño lo confirma y de ahí pasa solo al 6, que es nuevo.
  it('progreso viejo (sin el 5 completado) retoma en el 5', () => {
    expect(
      resolveOpenCertSubstep({ completed: [1, 2, 3, 4], errorSubstep: null }),
    ).toBe(5);
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
    expect(resolveCertSubstepState(6, base)).toBe('locked');
  });

  it('el 5 se completa con "Listo, sigo" como los anteriores', () => {
    const done: CertProgress = {
      completed: [1, 2, 3, 4, 5],
      errorSubstep: null,
    };
    expect(resolveCertSubstepState(5, done)).toBe('completed');
  });

  it('el sub-paso 6 nunca es "completed": es current recién con 1-5 listos', () => {
    const done: CertProgress = {
      completed: [1, 2, 3, 4, 5],
      errorSubstep: null,
    };
    expect(resolveCertSubstepState(6, done)).toBe('current');
  });

  it('el error pisa a "completed": un sub-paso ya confirmado puede volver a fallar', () => {
    const withError: CertProgress = {
      completed: [1, 2, 3, 4, 5],
      errorSubstep: 4,
    };
    expect(resolveCertSubstepState(4, withError)).toBe('error');
    // El resto de los completados (el 5) sigue verde: el culpable es el 4.
    expect(resolveCertSubstepState(5, withError)).toBe('completed');
    // El 6 sigue abierto (current), no bloqueado: ahí se lee el aviso.
    expect(resolveCertSubstepState(6, withError)).toBe('current');
  });

  it('el 6 nunca se marca en rojo, aunque errorSubstep apunte a otro', () => {
    const withError: CertProgress = {
      completed: [1, 2, 3, 4, 5],
      errorSubstep: 5,
    };
    expect(resolveCertSubstepState(6, withError)).toBe('current');
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
      { completed: [1, 2, 3, 4, 5], errorSubstep: 4 },
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

  it('el 5 se marca completado igual que los anteriores', () => {
    const next = markCertSubstepDone(
      { completed: [1, 2, 3, 4], errorSubstep: null },
      5,
    );
    expect(next.completed).toEqual([1, 2, 3, 4, 5]);
    expect(resolveOpenCertSubstep(next)).toBe(6);
  });
});

describe('resolveCertVerifyErrorEffect', () => {
  it('ARCA_CERT_NOT_AUTHORIZED abre el 6 y marca el 5', () => {
    expect(resolveCertVerifyErrorEffect('ARCA_CERT_NOT_AUTHORIZED')).toEqual({
      openSubstep: 6,
      culpritSubstep: 5,
    });
  });

  it.each([
    'ARCA_CERT_INVALID',
    'ARCA_CERT_CUIT_MISMATCH',
    'ARCA_CERT_EXPIRED',
    'ARCA_CERT_KEY_MISMATCH',
  ])('%s abre el 6 y marca el 4', (code) => {
    expect(resolveCertVerifyErrorEffect(code)).toEqual({
      openSubstep: 6,
      culpritSubstep: 4,
    });
  });

  it('ARCA_UNAVAILABLE abre el 6 sin marcar ningún sub-paso', () => {
    expect(resolveCertVerifyErrorEffect('ARCA_UNAVAILABLE')).toEqual({
      openSubstep: 6,
      culpritSubstep: null,
    });
  });

  it('un código desconocido (o sin código) también abre el 6 sin marcar', () => {
    expect(resolveCertVerifyErrorEffect(undefined)).toEqual({
      openSubstep: 6,
      culpritSubstep: null,
    });
    expect(resolveCertVerifyErrorEffect('ALGO_RARO')).toEqual({
      openSubstep: 6,
      culpritSubstep: null,
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
      { completed: [1, 2, 3, 4, 5], errorSubstep: null },
      'ARCA_CERT_NOT_AUTHORIZED',
    );
    expect(next.errorSubstep).toBe(5);
  });

  // El caso que motivó la regla: un 4 en rojo sin resolver, y encima ARCA no
  // responde en el reintento. El 4 sigue sin arreglarse.
  it('un error que no marca nada NO borra un rojo previo', () => {
    const withError: CertProgress = {
      completed: [1, 2, 3, 4, 5],
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

describe('resolvePreviousCertSubstep', () => {
  it('el 1 no tiene anterior', () => {
    expect(resolvePreviousCertSubstep(1)).toBeNull();
  });

  it.each([
    [2, 1],
    [3, 2],
    [4, 3],
    [5, 4],
    [6, 5],
  ] as const)('el anterior a %i es %i', (id, previous) => {
    expect(resolvePreviousCertSubstep(id)).toBe(previous);
  });
});

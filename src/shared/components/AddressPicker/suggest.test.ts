import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDebouncer, shouldSuggest } from './suggest';

describe('shouldSuggest', () => {
  it('exige 4 caracteres sin contar espacios de los bordes', () => {
    expect(shouldSuggest('Av')).toBe(false);
    expect(shouldSuggest('  abc ')).toBe(false);
    expect(shouldSuggest('Av. ')).toBe(false);
    expect(shouldSuggest('Av C')).toBe(true);
  });
});

describe('createDebouncer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('dispara una sola vez tras el tiempo de espera', () => {
    const fn = vi.fn();
    const d = createDebouncer(fn, 350);
    d.schedule();
    vi.advanceTimersByTime(200);
    d.schedule();
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(150);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('cancel evita la ejecución pendiente', () => {
    const fn = vi.fn();
    const d = createDebouncer(fn, 350);
    d.schedule();
    d.cancel();
    vi.advanceTimersByTime(1000);
    expect(fn).not.toHaveBeenCalled();
  });
});

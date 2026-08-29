import { describe, expect, it } from 'vitest';
import {
  caseInsensitiveSort,
  dedupeIds,
  getPaginationPageCount,
  getPaginationSummary,
  getVisiblePageNumbers,
  normalizeText,
} from './utils';

describe('data-table utils', () => {
  it('normalizes text for accent-insensitive search', () => {
    expect(normalizeText('  Estadía Ñandú  ')).toBe('estadia nandu');
  });

  it('dedupes ids preserving order', () => {
    expect(dedupeIds(['name', 'status', 'name', 'updatedAt'])).toEqual([
      'name',
      'status',
      'updatedAt',
    ]);
  });

  it('calculates page count and summary', () => {
    expect(getPaginationPageCount(101, 10)).toBe(11);
    expect(
      getPaginationSummary({ pageIndex: 2, pageSize: 10, totalRows: 27 }),
    ).toEqual({ from: 21, to: 27, totalRows: 27 });
  });

  it('returns visible page numbers with ellipses', () => {
    expect(getVisiblePageNumbers(5, 12)).toEqual([
      1,
      'start-ellipsis',
      4,
      5,
      6,
      7,
      8,
      'end-ellipsis',
      12,
    ]);
  });

  describe('caseInsensitiveSort', () => {
    // El comparador recibe filas de tanstack; alcanza con getValue.
    const sort = (a: unknown, b: unknown) =>
      caseInsensitiveSort(
        { getValue: () => a } as never,
        { getValue: () => b } as never,
        'col',
      );

    it('ordena numeros por valor y no como texto', () => {
      expect(sort(2, 10)).toBeLessThan(0);
      expect(sort(100, 20)).toBeGreaterThan(0);
      expect(sort(3, 3)).toBe(0);
      // El caso que delataba el bug: [1, 2, 10, 100] no debe quedar 1,10,100,2
      expect([100, 2, 10, 1].sort(sort)).toEqual([1, 2, 10, 100]);
    });

    it('ordena decimales correctamente', () => {
      expect([9500.5, 300, 4200.75, 8000].sort(sort)).toEqual([
        300, 4200.75, 8000, 9500.5,
      ]);
    });

    it('sigue ordenando texto sin acentos ni mayusculas', () => {
      expect(['Ñandu', 'estadia', 'Álamo'].sort(sort)).toEqual([
        'Álamo',
        'estadia',
        'Ñandu',
      ]);
    });

    it('ordena fechas por instante', () => {
      const antes = new Date('2026-01-01T00:00:00Z');
      const despues = new Date('2026-08-28T00:00:00Z');
      expect(sort(antes, despues)).toBeLessThan(0);
    });

    it('agrupa los vacios de un solo lado, sin romper la transitividad', () => {
      expect(sort(null, 5)).toBeLessThan(0);
      expect(sort(5, null)).toBeGreaterThan(0);
      expect(sort(null, undefined)).toBe(0);
      expect(sort('', 5)).toBeLessThan(0);
      // Sin `undefined` en el array: Array.sort lo manda al final por su cuenta,
      // sin pasarlo por el comparador.
      expect([10, null, 2, 1].sort(sort)).toEqual([null, 1, 2, 10]);
    });
  });
});

import { describe, expect, it } from 'vitest';
import {
  categoryLabel,
  reservableCategories,
  typeOptionLabel,
  type VehicleCategoryItem,
} from './vehicle-categories';

const CATEGORIES: VehicleCategoryItem[] = [
  { code: 'car', label: 'Auto', sortOrder: 1, reservable: true },
  { code: 'van', label: 'Utilitario / Van', sortOrder: 4, reservable: true },
  { code: 'truck', label: 'Camión', sortOrder: 7, reservable: false },
];

describe('categoryLabel', () => {
  it('resuelve la etiqueta', () => {
    expect(categoryLabel(CATEGORIES, 'van')).toBe('Utilitario / Van');
  });

  it('si la lista no cargó o no la conoce, cae al código', () => {
    expect(categoryLabel([], 'van')).toBe('van');
    expect(categoryLabel(CATEGORIES, 'bicycle')).toBe('bicycle');
  });
});

describe('reservableCategories', () => {
  it('deja solo las reservables, en el mismo orden', () => {
    expect(reservableCategories(CATEGORIES).map((c) => c.code)).toEqual([
      'car',
      'van',
    ]);
  });
});

describe('typeOptionLabel', () => {
  it('arma "Nombre · Categoría"', () => {
    expect(typeOptionLabel({ name: 'pepe', category: 'car' }, CATEGORIES)).toBe(
      'pepe · Auto',
    );
  });
});

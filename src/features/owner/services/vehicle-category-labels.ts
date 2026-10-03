import type { VehicleCategoryItem } from './vehicle-categories';

/** Etiqueta de una categoría; si la lista no cargó todavía, el código crudo. */
export function categoryLabel(
  categories: readonly VehicleCategoryItem[],
  code: string,
): string {
  return categories.find((c) => c.code === code)?.label ?? code;
}

/** Solo las categorías que el conductor puede reservar, en el orden del servidor. */
export function reservableCategories(
  categories: readonly VehicleCategoryItem[],
): VehicleCategoryItem[] {
  return categories.filter((c) => c.reservable);
}

/** "Nombre · Categoría", como se muestra en los selects de tipo. */
export function typeOptionLabel(
  type: { name: string; category: string },
  categories: readonly VehicleCategoryItem[],
): string {
  return `${type.name} · ${categoryLabel(categories, type.category)}`;
}

import type {
  PaginationState,
  SortingFn,
  SortingState,
} from '@tanstack/react-table';

export const NON_PICKABLE_COLUMN_IDS = new Set([
  'acciones',
  'actions',
  'Acciones',
  'info',
]);

export function normalizeText(value: unknown): string {
  const text =
    value === null || value === undefined
      ? ''
      : value instanceof Date
        ? value.toISOString()
        : typeof value === 'string' ||
            typeof value === 'number' ||
            typeof value === 'boolean' ||
            typeof value === 'bigint'
          ? String(value)
          : '';

  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function isEmptyValue(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

/**
 * Orden por defecto de todas las columnas.
 *
 * Compara según el TIPO del valor, no según su representación en texto: si se
 * normaliza todo a string, una columna numérica queda ordenada
 * lexicográficamente (`1, 10, 100, 11, 2, 20, 3`) en vez de por su valor.
 *
 * Los vacíos se resuelven primero y siempre para el mismo lado, para que el
 * comparador sea transitivo aun en columnas que mezclan valores y nulos.
 */
export const caseInsensitiveSort: SortingFn<unknown> = (
  rowA,
  rowB,
  columnId,
) => {
  const left: unknown = rowA.getValue(columnId);
  const right: unknown = rowB.getValue(columnId);

  const leftEmpty = isEmptyValue(left);
  const rightEmpty = isEmptyValue(right);
  if (leftEmpty || rightEmpty) {
    if (leftEmpty && rightEmpty) return 0;
    return leftEmpty ? -1 : 1;
  }

  if (typeof left === 'number' && typeof right === 'number') {
    return left === right ? 0 : left < right ? -1 : 1;
  }

  if (typeof left === 'bigint' && typeof right === 'bigint') {
    return left === right ? 0 : left < right ? -1 : 1;
  }

  if (left instanceof Date && right instanceof Date) {
    return left.getTime() - right.getTime();
  }

  if (typeof left === 'boolean' && typeof right === 'boolean') {
    return left === right ? 0 : left ? 1 : -1;
  }

  return normalizeText(left).localeCompare(normalizeText(right), 'es');
};

export function defaultSortOrder(keys: string[]): SortingState {
  return keys.map((id) => ({ id, desc: false }));
}

export function dedupeIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }

  return result;
}

export function getPaginationPageCount(
  totalRows: number,
  pageSize: number,
): number {
  if (totalRows <= 0) return 0;
  return Math.ceil(totalRows / pageSize);
}

export function getPaginationSummary({
  pageIndex,
  pageSize,
  totalRows,
}: PaginationState & { totalRows: number }): {
  from: number;
  to: number;
  totalRows: number;
} {
  if (totalRows <= 0) return { from: 0, to: 0, totalRows };

  return {
    from: pageIndex * pageSize + 1,
    to: Math.min((pageIndex + 1) * pageSize, totalRows),
    totalRows,
  };
}

export function getVisiblePageNumbers(
  pageIndex: number,
  pageCount: number,
  maxButtons = 5,
): Array<number | 'start-ellipsis' | 'end-ellipsis'> {
  if (pageCount <= 0) return [];

  const pages: Array<number | 'start-ellipsis' | 'end-ellipsis'> = [];
  const half = Math.floor(maxButtons / 2);
  const currentPage = pageIndex + 1;
  let start = Math.max(1, currentPage - half);
  let end = Math.min(pageCount, currentPage + half);

  if (currentPage <= half) {
    end = Math.min(pageCount, maxButtons);
  } else if (currentPage + half >= pageCount) {
    start = Math.max(1, pageCount - maxButtons + 1);
  }

  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }

  if (start > 1) {
    pages.unshift(1);
    if (start > 2) pages.splice(1, 0, 'start-ellipsis');
  }

  if (end < pageCount) {
    pages.push(pageCount);
    if (end < pageCount - 1) pages.splice(pages.length - 1, 0, 'end-ellipsis');
  }

  return pages;
}

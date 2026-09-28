import type {
  ColumnDef,
  ColumnFiltersState,
  VisibilityState,
} from '@tanstack/react-table';
import type { ReactNode } from 'react';
import type { TableTemplateScope } from '../table-view-template';

export type DataTableFilterOption = {
  value: string;
  label: string;
  includeWhenEmpty?: boolean;
};

export type DataTableServerState = {
  rowCount: number;
  isFetching?: boolean;
  onPaginationChange?: (state: { pageIndex: number; pageSize: number }) => void;
  onGlobalFilterChange?: (value: string) => void;
};

/**
 * Selección de filas (controlada). Con esto la tabla suma una columna de
 * checkboxes y, mientras haya algo elegido, una barra con `actions`.
 */
export type DataTableRowSelection<TData> = {
  selectedIds: readonly string[];
  onChange: (ids: string[]) => void;
  /** Qué filas se pueden elegir (p. ej. sólo las que se pueden facturar). */
  canSelect?: (row: TData) => boolean;
  actions?: ReactNode;
};

export type DataTableProps<TData> = {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  title?: string;
  subtitle?: string;
  isLoading?: boolean;
  emptyMessage?: string;
  searchPlaceholder?: string;
  searchableKeys?: string[];
  filterableColumns?: string[];
  filterOptionsByColumn?: Record<string, DataTableFilterOption[]>;
  initialColumnFilters?: ColumnFiltersState;
  onColumnFiltersChange?: (filters: ColumnFiltersState) => void;
  columnFiltersOverride?: ColumnFiltersState;
  columnFiltersOverrideKey?: string | number;
  initialColumnVisibility?: VisibilityState;
  initialPageSize?: number;
  pageSizeOptions?: number[];
  getRowId?: (row: TData, index: number) => string;
  templateScope?: TableTemplateScope;
  headerAction?: ReactNode;
  toolbarExtra?: ReactNode;
  toolbarLeading?: ReactNode;
  onRefresh?: () => void;
  refreshDisabled?: boolean;
  serverState?: DataTableServerState;
  onRowClick?: (row: TData) => void;
  /** Requiere `getRowId`: la selección se guarda por id. */
  rowSelection?: DataTableRowSelection<TData>;
};

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
};

export type DataTableServerState = {
  rowCount: number;
  isFetching?: boolean;
  onPaginationChange?: (state: { pageIndex: number; pageSize: number }) => void;
  onGlobalFilterChange?: (value: string) => void;
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
};

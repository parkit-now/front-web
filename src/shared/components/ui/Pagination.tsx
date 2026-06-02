import { IconChevronLeft, IconChevronRight } from '../icons';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

/** Compact "X–Y de Z" range with prev/next controls. */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 12,
        padding: '12px 24px',
        borderTop: '1px solid var(--border-soft)',
      }}
    >
      <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
        {from}–{to} de {total}
      </span>
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          type="button"
          className="pk-btn pk-btn-ghost pk-btn-icon pk-btn-sm"
          aria-label="Página anterior"
          disabled={!canPrev}
          onClick={() => canPrev && onPageChange(page - 1)}
        >
          <IconChevronLeft size={16} />
        </button>
        <button
          type="button"
          className="pk-btn pk-btn-ghost pk-btn-icon pk-btn-sm"
          aria-label="Página siguiente"
          disabled={!canNext}
          onClick={() => canNext && onPageChange(page + 1)}
        >
          <IconChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

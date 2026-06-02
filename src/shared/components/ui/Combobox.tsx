import { useState } from 'react';
import { IconSearch } from '../icons';
import { Spinner } from './Spinner';

interface ComboboxProps<T> {
  /** Current text in the search input (controlled by the parent). */
  query: string;
  onQueryChange: (query: string) => void;
  /** Results to show in the dropdown (parent fetches them, debounced). */
  items: T[];
  loading?: boolean;
  onSelect: (item: T) => void;
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  getSecondary?: (item: T) => string | null;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
}

/**
 * Generic autocomplete: a search input with a results dropdown. The parent owns
 * the query string and the (debounced) result set; this component handles the
 * open/close UX and selection. Options are committed on `mousedown` so the
 * click is not lost to the input's `blur`.
 */
export function Combobox<T>({
  query,
  onQueryChange,
  items,
  loading = false,
  onSelect,
  getKey,
  getLabel,
  getSecondary,
  placeholder,
  emptyMessage = 'Sin resultados.',
  disabled = false,
}: ComboboxProps<T>) {
  const [open, setOpen] = useState(false);
  const showDropdown = open && query.trim().length > 0;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative' }}>
        <span
          style={{
            position: 'absolute',
            left: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-3)',
            display: 'flex',
          }}
        >
          <IconSearch size={15} />
        </span>
        <input
          className="pk-input has-icon"
          style={{ paddingLeft: 34 }}
          value={query}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onQueryChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          role="combobox"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
        />
      </div>

      {showDropdown && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 20,
            background: 'var(--card)',
            border: '1px solid var(--border-soft)',
            borderRadius: 'var(--r-md)',
            boxShadow: 'var(--shadow-deep)',
            maxHeight: 260,
            overflowY: 'auto',
          }}
        >
          {loading ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 14px',
                fontSize: 13,
                color: 'var(--text-3)',
              }}
            >
              <Spinner size={14} /> Buscando…
            </div>
          ) : items.length === 0 ? (
            <p
              style={{
                margin: 0,
                padding: '12px 14px',
                fontSize: 13,
                color: 'var(--text-3)',
              }}
            >
              {emptyMessage}
            </p>
          ) : (
            items.map((item) => {
              const secondary = getSecondary?.(item);
              return (
                <button
                  key={getKey(item)}
                  type="button"
                  // mousedown fires before the input blur, so selection is not lost
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelect(item);
                    setOpen(false);
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 14px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--border-soft)',
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = 'var(--bg-b)')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = 'transparent')
                  }
                >
                  <span
                    style={{
                      display: 'block',
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--text-1)',
                    }}
                  >
                    {getLabel(item)}
                  </span>
                  {secondary && (
                    <span
                      style={{
                        display: 'block',
                        fontSize: 12,
                        color: 'var(--text-3)',
                      }}
                    >
                      {secondary}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

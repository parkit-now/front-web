import { useEffect, useState } from 'react';

/**
 * Returns a debounced copy of `value` that only updates after `delayMs` of
 * quiet time. Used by search inputs to avoid firing a request on every
 * keystroke.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

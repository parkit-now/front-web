import { type RefObject, useEffect } from 'react';

/** Marks a portaled popover panel (see e.g. AppSelect, DateRangeFilter) so
 * outside-click detection can recognize it even though it isn't a DOM
 * descendant of whatever ref triggered it — a portal escapes the DOM tree
 * while staying nested in the React tree, so plain `ref.contains()` would
 * otherwise see a click inside it as "outside" and close prematurely. */
export const POPOVER_PANEL_ATTRIBUTE = 'data-popover-panel';

export function useCloseOnOutsideClick<TElement extends HTMLElement>(
  ref: RefObject<TElement | null>,
  isOpen: boolean,
  onClose: () => void,
): void {
  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent): void {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (ref.current?.contains(target)) return;
      if (
        target instanceof Element &&
        target.closest(`[${POPOVER_PANEL_ATTRIBUTE}]`)
      ) {
        return;
      }
      onClose();
    }

    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [isOpen, onClose, ref]);
}

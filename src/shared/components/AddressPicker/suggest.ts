/** Debounce de las sugerencias mientras se tipea la dirección. */
export const SUGGEST_DEBOUNCE_MS = 350;
/** Mínimo de caracteres para buscar sin que la persona apriete Enter. */
export const SUGGEST_MIN_CHARS = 4;

export function shouldSuggest(query: string): boolean {
  return query.trim().length >= SUGGEST_MIN_CHARS;
}

export interface Debouncer {
  /** Programa `fn`; una llamada nueva cancela la pendiente. */
  schedule: () => void;
  cancel: () => void;
}

export function createDebouncer(fn: () => void, delayMs: number): Debouncer {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  return {
    schedule() {
      cancel();
      timer = setTimeout(() => {
        timer = null;
        fn();
      }, delayMs);
    },
    cancel,
  };
}

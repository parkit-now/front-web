import { useEffect, useId, useMemo, useRef, useState } from 'react';
import * as Flags from 'country-flag-icons/react/3x2';
import { IconAlert, IconChevronDown, IconSearch } from '../icons';
import { RequiredMark } from '../ui/RequiredMark';
import {
  DEFAULT_PHONE_COUNTRY,
  applyTypedPhone,
  callingCodeOf,
  changePhoneCountry,
  filterPhoneCountries,
  getPhoneCountryOptions,
  getPhoneExample,
  parseStoredPhone,
  type PhoneCountry,
} from './phoneUtils';

interface PhoneInputProps {
  /** Teléfono en E.164 (`+5491123456789`) o '' si está vacío. */
  value: string;
  onChange: (e164: string) => void;
  label?: string;
  required?: boolean;
  /** Mensaje de error (lo calcula el formulario, p. ej. con `validatePhone`). */
  error?: string | null;
  placeholder?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  /** País inicial cuando `value` está vacío. */
  defaultCountry?: PhoneCountry;
  onBlur?: () => void;
}

const FlagMap = Flags as unknown as Record<
  string,
  React.ComponentType<React.SVGProps<SVGSVGElement>> | undefined
>;
const FLAG_CODES: ReadonlySet<string> = new Set(
  Object.keys(FlagMap).filter((k) => /^[A-Z]{2}$/.test(k)),
);
const COUNTRY_OPTIONS = getPhoneCountryOptions(FLAG_CODES);

function Flag({ country }: { country: string }) {
  const Svg = FlagMap[country];
  if (!Svg) return null;
  return (
    <Svg
      aria-hidden="true"
      style={{ width: 22, height: 15, borderRadius: 2, flex: 'none' }}
    />
  );
}

const ERROR_COLOR = 'var(--err-text, #b42318)';

/**
 * Teléfono con selector de país (bandera + prefijo) y formato mientras se
 * tipea. Controlado por un string E.164: lo que se guarda y lo que viaja a la
 * API es siempre `+<país><número>`.
 */
export function PhoneInput({
  value,
  onChange,
  label,
  required = false,
  error,
  placeholder,
  id,
  name,
  disabled = false,
  defaultCountry = DEFAULT_PHONE_COUNTRY,
  onBlur,
}: PhoneInputProps) {
  const uid = useId();
  const inputId = id ?? `${uid}-phone`;
  const helpId = `${inputId}-help`;
  const errorId = `${inputId}-error`;
  const listId = `${inputId}-countries`;

  const [initial] = useState(() => parseStoredPhone(value));
  const [country, setCountry] = useState<PhoneCountry>(
    initial?.country ?? defaultCountry,
  );
  const [text, setText] = useState(initial?.text ?? value);
  // Último E.164 que emitimos: distingue un cambio del padre (cargar un valor
  // guardado, resetear) del eco de lo que acabamos de tipear.
  const lastEmitted = useRef(value);

  useEffect(() => {
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    const parsed = parseStoredPhone(value);
    if (parsed) {
      setCountry(parsed.country);
      setText(parsed.text);
    } else {
      // Vacío o teléfono viejo no E.164: se muestra crudo, sin pisar el país.
      setText(value);
    }
  }, [value]);

  function emit(e164: string) {
    lastEmitted.current = e164;
    onChange(e164);
  }

  function handleType(raw: string) {
    const next = applyTypedPhone(raw, country, text);
    setCountry(next.country);
    setText(next.text);
    emit(next.e164);
  }

  function handleCountry(code: PhoneCountry) {
    const next = changePhoneCountry(text, code);
    setCountry(code);
    setText(next.text);
    emit(next.e164);
  }

  const hasError = Boolean(error);
  const example = getPhoneExample(country);
  const describedBy = hasError ? errorId : example ? helpId : undefined;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        width: '100%',
      }}
    >
      {label && (
        <label htmlFor={inputId} className="pk-label">
          {label}
          {required ? <RequiredMark /> : null}
        </label>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        <CountrySelect
          country={country}
          disabled={disabled}
          hasError={hasError}
          listId={listId}
          onSelect={handleCountry}
        />
        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <input
            id={inputId}
            name={name}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            className="pk-input"
            style={{
              paddingRight: hasError ? 34 : undefined,
              borderColor: hasError ? ERROR_COLOR : undefined,
            }}
            value={text}
            placeholder={placeholder}
            disabled={disabled}
            required={required}
            aria-required={required ? true : undefined}
            aria-invalid={hasError ? true : undefined}
            aria-describedby={describedBy}
            onChange={(e) => handleType(e.target.value)}
            onBlur={onBlur}
          />
          {hasError ? (
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'flex',
                color: ERROR_COLOR,
              }}
            >
              <IconAlert size={16} />
            </span>
          ) : null}
        </div>
      </div>
      {hasError ? (
        <span
          id={errorId}
          role="alert"
          style={{ fontSize: 12, color: ERROR_COLOR }}
        >
          {error}
        </span>
      ) : example ? (
        <span id={helpId} style={{ fontSize: 12, color: 'var(--text-3)' }}>
          Ejemplo: {example}
        </span>
      ) : null}
    </div>
  );
}

interface CountrySelectProps {
  country: PhoneCountry;
  disabled: boolean;
  hasError: boolean;
  listId: string;
  onSelect: (code: PhoneCountry) => void;
}

function CountrySelect({
  country,
  disabled,
  hasError,
  listId,
  onSelect,
}: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const filtered = useMemo(
    () => filterPhoneCountries(COUNTRY_OPTIONS, query),
    [query],
  );
  const current = COUNTRY_OPTIONS.find((o) => o.code === country);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) close();
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  function close() {
    setOpen(false);
    setQuery('');
    setActive(0);
  }

  function choose(code: PhoneCountry) {
    onSelect(code);
    close();
  }

  return (
    <div ref={rootRef} style={{ position: 'relative', flex: 'none' }}>
      <button
        type="button"
        className="pk-input"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`País: ${current?.name ?? country} ${callingCodeOf(country)}`}
        onClick={() => (open ? close() : setOpen(true))}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: 'auto',
          height: '100%',
          minHeight: 40,
          cursor: disabled ? 'not-allowed' : 'pointer',
          borderColor: hasError ? ERROR_COLOR : undefined,
          whiteSpace: 'nowrap',
        }}
      >
        <Flag country={country} />
        <span style={{ fontSize: 14 }}>{callingCodeOf(country)}</span>
        <IconChevronDown size={14} />
      </button>

      {open ? (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 30,
            width: 300,
            maxWidth: '85vw',
            background: 'var(--card, #fff)',
            border: '1px solid var(--border-soft)',
            borderRadius: 'var(--r-md)',
            boxShadow: 'var(--shadow-deep)',
          }}
        >
          <div style={{ position: 'relative', padding: 8 }}>
            <span
              style={{
                position: 'absolute',
                left: 18,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-3)',
                display: 'flex',
              }}
            >
              <IconSearch size={15} />
            </span>
            <input
              ref={searchRef}
              className="pk-input has-icon"
              style={{ paddingLeft: 34 }}
              value={query}
              placeholder="Buscá un país"
              aria-label="Buscar país"
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={
                filtered[active]
                  ? `${listId}-${filtered[active].code}`
                  : undefined
              }
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActive((i) => Math.min(i + 1, filtered.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActive((i) => Math.max(i - 1, 0));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  if (filtered[active]) choose(filtered[active].code);
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  close();
                }
              }}
            />
          </div>
          <ul
            id={listId}
            role="listbox"
            aria-label="Países"
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              maxHeight: 240,
              overflowY: 'auto',
            }}
          >
            {filtered.length === 0 ? (
              <li
                style={{
                  padding: '12px 14px',
                  fontSize: 13,
                  color: 'var(--text-3)',
                }}
              >
                Sin resultados.
              </li>
            ) : (
              filtered.map((o, i) => (
                <li
                  key={o.code}
                  id={`${listId}-${o.code}`}
                  role="option"
                  aria-selected={o.code === country}
                  // mousedown: el click no se pierde por el blur del buscador.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(o.code);
                  }}
                  onMouseEnter={() => setActive(i)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 14px',
                    fontSize: 13,
                    cursor: 'pointer',
                    background: i === active ? 'var(--bg-b)' : 'transparent',
                    fontWeight: o.code === country ? 600 : 400,
                    color: 'var(--text-1)',
                  }}
                >
                  <Flag country={o.code} />
                  <span style={{ flex: 1 }}>{o.name}</span>
                  <span style={{ color: 'var(--text-3)' }}>
                    {o.callingCode}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

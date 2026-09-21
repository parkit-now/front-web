import { RequiredMark } from '../ui/RequiredMark';

interface Props {
  id: string;
  label: string;
  /** Valor actual. Puede NO estar en `options`: ver `unknown` más abajo. */
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  /** Texto de la opción vacía ("Elegí la provincia"). */
  placeholder: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  /** Por qué está deshabilitado, cuando el motivo no es obvio. */
  hint?: string;
  'data-testid'?: string;
}

/**
 * Selector de una lista cerrada del catálogo de Mercado Pago.
 *
 * ── Por qué un `<select>` nativo y no un combobox con búsqueda ────────────
 *
 * La lista más larga es Buenos Aires con 261 localidades, y un `<select>` con
 * 261 `<option>` NO es la opción cómoda — es la opción CORRECTA acá, por cuatro
 * motivos concretos:
 *
 *  1. El repo NO tiene tests de componente: vitest corre en `node`, sin jsdom y
 *     sin testing-library. Un listbox con búsqueda propio son ~150 líneas de
 *     JSX, foco y teclado que NADIE puede testear, en el camino crítico del
 *     onboarding. El `<select>` lo implementa el browser.
 *  2. El `<select>` ya sabe hacer casi todo lo que le pediríamos al combobox:
 *     type-ahead (tipear "san i" salta a San Isidro), navegación por teclado, y
 *     en mobile abre el picker nativo, que en iOS y Android trae su propio
 *     buscador. Gratis y accesible.
 *  3. El `Combobox` que existe no sirve sin modificarlo (no abre con query
 *     vacía, no filtra solo, sin navegación por teclado) y su único consumidor
 *     es `UserDetailDrawer`. Extenderlo es arriesgar una pantalla ajena por un
 *     caso de uso distinto.
 *  4. Hay precedente: el repo usa `<select className="pk-input">` crudo en 12
 *     archivos.
 *
 * El tradeoff es real y no lo escondo: 261 opciones se scrollean incómodas con
 * el mouse. Si UX lo pide, la mejora es un listbox con filtro — pero eso entra
 * junto con jsdom y testing-library, no antes.
 *
 * ── Compatibilidad hacia atrás ────────────────────────────────────────────
 *
 * Hay tenants guardados con valores que el catálogo no tiene ("Martínez"). Ese
 * dato NO se borra nunca al abrir el formulario: se agrega como una opción
 * extra, seleccionada y marcada "(no reconocido)", con un aviso al lado. La
 * persona ve qué tiene guardado, entiende por qué hay que cambiarlo y lo
 * cambia. Borrárselo en silencio sería hacerle perder un dato que ella cargó.
 */
export function CatalogSelect({
  id,
  label,
  value,
  options,
  onChange,
  placeholder,
  disabled = false,
  readOnly = false,
  required = false,
  hint,
  'data-testid': testId,
}: Props) {
  const current = value.trim();
  const unknown = current.length > 0 && !options.includes(current);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        width: '100%',
      }}
    >
      <label htmlFor={id} className="pk-label">
        {label}
        {required ? <RequiredMark /> : null}
      </label>
      {/* A diferencia de los `<Input>` de al lado, acá el modo "ya está
          resuelto" SÍ usa `disabled`: un `<select>` no tiene `readOnly` (el
          atributo existe en el DOM pero el browser lo ignora), y la alternativa
          —dejarlo abierto y revertir el cambio por código— le mentiría a quien
          lo está usando. El botón "corregirla a mano" de arriba lo habilita,
          igual que al resto del detalle: griseado sigue significando "ya está
          resuelto", nunca "no lo podés corregir". */}
      <select
        id={id}
        data-testid={testId}
        className="pk-input"
        value={current}
        disabled={disabled || readOnly}
        required={required}
        aria-required={required ? true : undefined}
        aria-invalid={unknown ? true : undefined}
        style={
          readOnly
            ? { background: 'var(--surface-2, #f2f5fa)' }
            : unknown
              ? { borderColor: 'var(--err-text, #b42318)' }
              : undefined
        }
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {/* El valor viejo va PRIMERO y fuera del grupo: es el que está
            seleccionado, y esconderlo al final de 261 opciones sería esconder
            justamente lo que hay que corregir. */}
        {unknown ? (
          <option value={current}>{current} — no reconocido</option>
        ) : null}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {/* Los dos mensajes se apilan y NO se excluyen. Si se excluyeran, el
          caso peor —un tenant viejo con la provincia Y la localidad sin
          reconocer— leería "elegí una opción de la lista" al lado de una lista
          deshabilitada, sin que nada le diga que primero tiene que arreglar la
          provincia. Eso es exactamente "quedar trabado" desde la vereda de la
          persona, aunque el camino exista. */}
      {unknown ? (
        <span
          data-testid={testId ? `${testId}-unknown` : undefined}
          style={{ fontSize: 12, color: 'var(--err-text, #b42318)' }}
        >
          Mercado Pago no conoce “{current}”. Elegí una opción de la lista para
          poder cobrar con Mercado Pago.
        </span>
      ) : null}
      {hint ? (
        <span style={{ fontSize: 12, color: 'var(--text-3, #667085)' }}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { RequiredMark } from '../ui/RequiredMark';
import type {
  GeocodedAddress,
  GeocodingProvider,
  GeocodingStatus,
} from '../../../lib/geocoding/GeocodingProvider';
import { georefProvider } from '../../../lib/geocoding/georef';
import { AddressMap } from './AddressMap';
import {
  addressFromGeocoded,
  addressPrimaryLine,
  addressSummaryDetail,
  describeGeocodingSource,
  hasCoordinates,
  isAddressEmpty,
  isGeorefNormalized,
  missingAddressFields,
  moveAddressPin,
  REQUIRED_ADDRESS_FIELDS,
  setAddressDetailField,
  type AddressFormValue,
  type AddressTextField,
} from './addressUtils';

interface Props {
  value: AddressFormValue;
  onChange: (next: AddressFormValue) => void;
  disabled?: boolean;
  /** Inyectable para poder cambiar de proveedor sin tocar el componente. */
  provider?: GeocodingProvider;
  /**
   * Progressive disclosure: con Georef resuelto, el detalle desglosado se
   * esconde detrás de un desplegable griseado en vez de mostrarse siempre.
   *
   * Por defecto está APAGADO. El comportamiento colapsado es para el alta
   * (onboarding), donde la persona viene a *cargar* una dirección y cada campo
   * de más es un campo donde equivocarse. En la pantalla de configuración del
   * perfil la persona viene justamente a *revisar* los datos ya guardados:
   * esconderlos ahí agrega un click a la tarea principal.
   */
  collapsible?: boolean;
  /**
   * La dirección es obligatoria: pinta el asterisco rojo y marca los inputs
   * con `required` / `aria-required`. NO valida ni bloquea — de eso se ocupa
   * el formulario que usa el componente.
   */
  required?: boolean;
}

/** Estado del buscador. `idle` = todavía no se buscó nada en esta sesión. */
type SearchState =
  | { kind: 'idle' }
  | { kind: 'searching' }
  | {
      kind: 'done';
      status: Exclude<GeocodingStatus, 'aborted'>;
      results: GeocodedAddress[];
    };

/**
 * El detalle desglosado, en el orden en que se lee en voz alta una dirección
 * argentina. La línea de display NO está: se deduce (ver `composeFormatted`).
 */
const TEXT_FIELDS: {
  field: AddressTextField;
  label: string;
  placeholder: string;
}[] = [
  { field: 'streetName', label: 'Calle', placeholder: 'Av. Corrientes' },
  { field: 'streetNumber', label: 'Altura', placeholder: '1234' },
  { field: 'floor', label: 'Piso / Depto', placeholder: 'PB' },
  { field: 'cityName', label: 'Localidad', placeholder: 'Balvanera' },
  {
    field: 'stateName',
    label: 'Provincia',
    placeholder: 'Ciudad Autónoma de Buenos Aires',
  },
  { field: 'postalCode', label: 'Código postal', placeholder: 'C1043' },
];

const REQUIRED_FIELDS: readonly AddressTextField[] = REQUIRED_ADDRESS_FIELDS;

/**
 * Formulario de dirección estructurada.
 *
 * El orden de la pantalla es deliberado y va de lo general a lo específico:
 *
 *   1. UN input en lenguaje natural + el botón de búsqueda.
 *   2. El mapa con el pin arrastrable — "dónde cayó".
 *   3. DEBAJO del mapa: la línea resuelta y, recién ahí, el detalle desglosado.
 *
 * El detalle está para VERIFICAR, no para cargar. Cada campo que se le pide a
 * la persona es un campo donde se puede equivocar: si Georef ya sabe la
 * respuesta, preguntarla otra vez no es darle control, es delegarle trabajo y
 * sumar errores de tipeo.
 *
 * Dos reglas de diseño que vienen del plan y NO son negociables:
 *
 *  1. NUNCA queda trabado. Con Georef caído los campos aparecen solos,
 *     habilitados: la persona escribe la dirección a mano y guarda igual. El
 *     buscador es una comodidad, no un portón.
 *  2. Griseado significa "ya está resuelto", NUNCA "no lo podés corregir".
 *     Georef acierta casi siempre, pero cuando erra tiene que haber una acción
 *     explícita —"Editar"— que habilite los campos.
 *
 * Es un componente controlado: el dueño del estado es el formulario que lo usa
 * (`ConfigPerfil`, `DraftWizard`), igual que el resto del repo — `useState` de
 * strings arriba, lógica pura en `addressUtils.ts`.
 */
export function AddressPicker({
  value,
  onChange,
  disabled = false,
  provider = georefProvider,
  collapsible = false,
  required = false,
}: Props) {
  const uid = useId();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<SearchState>({ kind: 'idle' });
  const abortRef = useRef<AbortController | null>(null);

  /**
   * Si la dirección que hay AHORA la produjo Georef.
   *
   * Se guarda aparte de `value.geocodingSource` a propósito: arrastrar el pin
   * pasa el origen a `manual` (y así tiene que ser), pero eso no es motivo
   * para abrirle los seis campos en la cara a alguien que sólo corrigió la
   * ubicación exacta del portal.
   */
  const [georefApplied, setGeorefApplied] = useState(() =>
    isGeorefNormalized(value),
  );
  /**
   * La persona pidió cargarla a mano, O la dirección que hay está incompleta y
   * hay que mostrarle los campos que faltan.
   *
   * Arranca en `true` con una dirección a medias (un borrador viejo, o una
   * `location` guardada sin altura): esconder el detalle ahí sería esconder
   * justo el campo que el formulario va a rechazar.
   *
   * Es un LATCH a propósito: una vez abierto, completar el último campo que
   * faltaba no vuelve a cerrar el panel en la cara de quien está tipeando.
   * Sólo lo resetea elegir un candidato nuevo de Georef.
   */
  const [manualChosen, setManualChosen] = useState(
    () => !isAddressEmpty(value) && missingAddressFields(value).length > 0,
  );
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailEditable, setDetailEditable] = useState(false);

  // Corta la request en vuelo si el componente se desmonta (cambiar de
  // pestaña, cerrar el wizard): sin esto quedaría un setState sobre un
  // componente muerto.
  useEffect(() => () => abortRef.current?.abort(), []);

  async function runSearch() {
    const trimmed = query.trim();
    if (!trimmed) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setSearch({ kind: 'searching' });
    const result = await provider.search(trimmed, {
      signal: controller.signal,
    });

    // Llegó una búsqueda más nueva: esta respuesta ya no le importa a nadie.
    if (result.status === 'aborted' || controller.signal.aborted) return;

    setSearch({ kind: 'done', status: result.status, results: result.results });

    if (result.status === 'ok') {
      // Un único candidato no merece una lista de un item: se aplica derecho.
      if (result.results.length === 1) applyCandidate(result.results[0]);
      return;
    }

    // Georef no resolvió (caído o sin resultados): el detalle se despliega
    // solo y habilitado. Que la persona tenga que ir a buscar cómo abrirlo
    // sería convertir una caída del Estado en una barrera de alta.
    setGeorefApplied(false);
  }

  function applyCandidate(candidate: GeocodedAddress) {
    const next = addressFromGeocoded(candidate, value);
    onChange(next);
    setGeorefApplied(true);
    // Georef resuelve A MEDIAS más seguido de lo que parece: buscar una calle
    // sin altura devuelve un candidato con `altura: null` y una
    // `nomenclatura` igual de prolija. Esa dirección no le sirve a Mercado
    // Pago, así que el formulario la rechaza — y si el detalle quedara
    // escondido, la persona leería "falta la altura" sin ver dónde escribirla.
    const incomplete = missingAddressFields(next).length > 0;
    setManualChosen(incomplete);
    setDetailEditable(incomplete);
    setDetailOpen(incomplete);
  }

  function pickCandidate(candidate: GeocodedAddress) {
    applyCandidate(candidate);
    setSearch({ kind: 'idle' });
  }

  function updateField(field: AddressTextField, text: string) {
    onChange(setAddressDetailField(value, field, text));
  }

  function handlePinMove(latitude: number, longitude: number) {
    onChange(moveAddressPin(value, latitude, longitude));
  }

  function clearCoordinates() {
    onChange({
      ...value,
      latitude: null,
      longitude: null,
      geocodingSource: 'manual',
      geocodedAt: new Date().toISOString(),
    });
  }

  function startManualEntry() {
    setManualChosen(true);
    setDetailOpen(true);
    setDetailEditable(true);
  }

  const addressEmpty = isAddressEmpty(value);
  const searchFellBack =
    search.kind === 'done' &&
    (search.status === 'empty' || search.status === 'unavailable');

  /**
   * Estado B: la dirección se carga a mano. El detalle va desplegado,
   * habilitado y con los campos obligatorios marcados.
   *
   * `!georefApplied && !addressEmpty` cubre el borrador viejo que se abre con
   * datos que Georef nunca vio: no tiene sentido ofrecerle un resumen
   * "normalizado" de algo que nadie normalizó.
   */
  const manualMode =
    !collapsible ||
    manualChosen ||
    searchFellBack ||
    (!georefApplied && !addressEmpty);

  const showDetail = manualMode || detailOpen;
  const detailReadOnly = !manualMode && !detailEditable;
  const showCandidates =
    search.kind === 'done' &&
    search.status === 'ok' &&
    search.results.length > 1;

  const primaryLine = addressPrimaryLine(value);
  const summaryDetail = addressSummaryDetail(value);
  const sourceLabel = describeGeocodingSource(value.geocodingSource);

  return (
    <div
      data-testid="address-picker"
      style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
    >
      {/* ── 1. Un solo input, en lenguaje natural ────────────────────── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Input
            id={`${uid}-query`}
            label="Dirección del estacionamiento"
            value={query}
            placeholder="Av. Corrientes 1234, CABA"
            autoComplete="off"
            disabled={disabled}
            required={required}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // Enter busca. `preventDefault` porque adentro de un <form> el
              // Enter dispararía el submit del formulario entero.
              if (e.key !== 'Enter') return;
              e.preventDefault();
              void runSearch();
            }}
          />
        </div>
        <Button
          variant="secondary"
          data-testid="address-search"
          loading={search.kind === 'searching'}
          disabled={disabled || query.trim().length === 0}
          onClick={() => void runSearch()}
        >
          Buscar
        </Button>
      </div>

      {search.kind === 'done' && search.status === 'empty' ? (
        <p data-testid="address-search-empty" style={hintStyle}>
          No encontramos esa dirección. Revisá el texto o completá el detalle a
          mano, acá abajo.
        </p>
      ) : null}

      {search.kind === 'done' && search.status === 'unavailable' ? (
        <p
          data-testid="address-search-unavailable"
          style={{ ...hintStyle, color: 'var(--err-text, #b42318)' }}
        >
          No pudimos contactar al servicio de direcciones (Georef). Completá el
          detalle a mano acá abajo y marcá la ubicación en el mapa: se guarda
          igual.
        </p>
      ) : null}

      {showCandidates ? (
        <div data-testid="address-candidates" style={candidatesStyle}>
          <p style={{ ...hintStyle, margin: '2px 6px 4px' }}>
            Encontramos {search.results.length} direcciones. Elegí la correcta:
          </p>
          {search.results.map((candidate, index) => (
            <button
              key={`${candidate.formatted}-${index}`}
              type="button"
              onClick={() => pickCandidate(candidate)}
              disabled={disabled}
              style={candidateStyle}
            >
              {candidate.formatted}
            </button>
          ))}
        </div>
      ) : null}

      {/* ── 2. El mapa ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="pk-label">Ubicación en el mapa</span>
        <AddressMap
          latitude={value.latitude}
          longitude={value.longitude}
          onPinMove={handlePinMove}
          disabled={disabled}
        />
        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <p style={{ ...hintStyle, margin: 0 }}>
            {hasCoordinates(value)
              ? 'Arrastrá el pin para corregir la ubicación exacta.'
              : 'Hacé click en el mapa para marcar dónde está el estacionamiento.'}
          </p>
          {hasCoordinates(value) ? (
            <>
              <code data-testid="address-coords" style={coordsStyle}>
                {value.latitude?.toFixed(6)}, {value.longitude?.toFixed(6)}
              </code>
              <Button
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={clearCoordinates}
              >
                Quitar ubicación
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {/* ── 3. Debajo del mapa: línea resuelta + detalle ─────────────── */}
      {primaryLine ? (
        <div data-testid="address-summary" style={summaryStyle}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <strong
              data-testid="address-summary-line"
              style={{ fontSize: 14, color: 'var(--text-1, #101828)' }}
            >
              {primaryLine}
            </strong>
            {summaryDetail ? (
              <span style={{ fontSize: 12, color: 'var(--text-3, #667085)' }}>
                {summaryDetail}
              </span>
            ) : null}
          </div>
          {sourceLabel ? (
            <span data-testid="address-source" style={badgeStyle}>
              {sourceLabel}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Estado A: el detalle vive detrás de un desplegable apagado. */}
      {!manualMode ? (
        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          {addressEmpty ? (
            <button
              type="button"
              data-testid="address-manual-entry"
              onClick={startManualEntry}
              disabled={disabled}
              style={mutedToggleStyle}
            >
              Cargar la dirección a mano
            </button>
          ) : (
            <>
              <button
                type="button"
                data-testid="address-detail-toggle"
                aria-expanded={detailOpen}
                aria-controls={`${uid}-detail`}
                onClick={() => setDetailOpen((open) => !open)}
                disabled={disabled}
                style={mutedToggleStyle}
              >
                {detailOpen ? '▾' : '▸'} Ver detalle
              </button>
              {detailOpen && detailReadOnly ? (
                // Griseado NO puede leerse como "no toques": Georef acierta
                // casi siempre, pero cuando erra esta es la única salida. Va
                // en color de marca y subrayado para que se vea accionable, no
                // como el texto apagado del desplegable.
                <button
                  type="button"
                  data-testid="address-detail-edit"
                  disabled={disabled}
                  onClick={() => setDetailEditable(true)}
                  style={linkActionStyle}
                >
                  ✎ No es esta: corregirla a mano
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {showDetail ? (
        <div
          id={`${uid}-detail`}
          data-testid="address-detail"
          data-readonly={detailReadOnly ? 'true' : 'false'}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 12,
            // Griseado = "ya está resuelto, no te preocupes". NO es "no
            // toques": el botón "editar a mano" de arriba lo habilita.
            opacity: detailReadOnly ? 0.72 : 1,
          }}
        >
          {TEXT_FIELDS.map(({ field, label, placeholder }) => (
            <Input
              key={field}
              id={`${uid}-${field}`}
              data-testid={`address-field-${field}`}
              label={label}
              value={value[field]}
              placeholder={detailReadOnly ? undefined : placeholder}
              disabled={disabled}
              // `readOnly` y NO `disabled`: un input deshabilitado se saltea
              // en la navegación por teclado y los lectores de pantalla no lo
              // anuncian. El dato tiene que poder leerse y copiarse aunque no
              // se pueda editar.
              readOnly={detailReadOnly}
              // El asterisco cuelga de `required`, NO sólo de `manualMode`:
              // con `collapsible={false}` (ConfigPerfil) `manualMode` es
              // siempre true, y ahí el domicilio NO es obligatorio — hay
              // tenants viejos con la dirección en `null`. Marcarlos sería
              // mentirle al dueño sobre algo que el formulario no exige.
              required={
                required && manualMode && REQUIRED_FIELDS.includes(field)
              }
              style={
                detailReadOnly
                  ? { background: 'var(--surface-2, #f2f5fa)', cursor: 'text' }
                  : undefined
              }
              onChange={(e) => updateField(field, e.target.value)}
            />
          ))}
        </div>
      ) : null}

      {manualMode && required ? (
        <p style={hintStyle}>
          Los campos con <RequiredMark /> son obligatorios. Podés enviar la
          solicitud aunque el servicio de direcciones no esté disponible.
        </p>
      ) : null}
    </div>
  );
}

const hintStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: 'var(--text-3, #667085)',
};

const candidatesStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  border: '1px solid var(--border-soft, #d0d9e6)',
  borderRadius: 'var(--r-md, 10px)',
  padding: 6,
  maxHeight: 200,
  overflowY: 'auto',
};

const candidateStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '7px 8px',
  borderRadius: 'var(--r-sm, 8px)',
  border: '1px solid transparent',
  background: 'transparent',
  color: 'var(--text-1, #101828)',
  fontSize: 13,
  fontFamily: 'inherit',
  cursor: 'pointer',
};

const summaryStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  border: '1px solid var(--border-soft, #d0d9e6)',
  borderRadius: 'var(--r-md, 10px)',
  background: 'var(--surface-2, #f2f5fa)',
  padding: '10px 12px',
};

/** Desplegable apagado: gris, chico, sin peso visual. */
const mutedToggleStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  padding: 0,
  fontSize: 12,
  fontFamily: 'inherit',
  fontWeight: 600,
  color: 'var(--text-3, #667085)',
  cursor: 'pointer',
  textDecoration: 'underline',
  textUnderlineOffset: 3,
};

/** Acción real, en color de marca: la salida de emergencia del caso feliz. */
const linkActionStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  padding: 0,
  fontSize: 12,
  fontFamily: 'inherit',
  fontWeight: 600,
  color: 'var(--brand, #0e5fd8)',
  cursor: 'pointer',
  textDecoration: 'underline',
  textUnderlineOffset: 3,
};

const coordsStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-2, #475467)',
  background: 'var(--surface-2, #f2f5fa)',
  borderRadius: 6,
  padding: '2px 6px',
};

const badgeStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--brand, #0e5fd8)',
  background: 'rgba(14, 95, 216, 0.1)',
  borderRadius: 999,
  padding: '3px 8px',
};

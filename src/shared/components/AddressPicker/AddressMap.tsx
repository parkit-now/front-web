import { useEffect, useMemo } from 'react';
import {
  Icon,
  type LeafletMouseEvent,
  type Marker as LeafletMarker,
} from 'leaflet';
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';

// Trampa 1 de Leaflet con un bundler: el CSS no viene con el JS. Sin este
// import el mapa se dibuja como un collage de tiles apiladas, sin panes ni
// controles. Va acá (y no en `main.tsx`) para que el CSS viaje con el único
// componente que lo necesita y Vite lo meta en el chunk del mapa.
import 'leaflet/dist/leaflet.css';

// Trampa 2: los íconos del marcador. Leaflet arma las URLs de sus PNG en
// runtime, leyendo el `src` de su propio `<script>`. Con un bundler ese truco
// no aplica y el marcador queda invisible (pide `/marker-icon.png`, que no
// existe) — es el bug clásico "el mapa anda pero no se ve el pin".
//
// De las formas de resolverlo elegimos la EXPLÍCITA: importar los tres PNG
// (Vite los resuelve a URLs con hash y los copia al build) y construir un
// `L.Icon` propio que se le pasa al `<Marker>`.
//
// La alternativa popular es `delete L.Icon.Default.prototype._getIconUrl` +
// `L.Icon.Default.mergeOptions(...)`. Se descartó porque borra una propiedad
// privada del prototipo de una librería de terceros (rompible en cualquier
// upgrade) y porque es un efecto global al importar el módulo: un `<Marker>`
// en otra pantalla dependería en silencio de que este archivo se haya
// importado antes. Un ícono explícito no tiene ninguno de los dos problemas.
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const pinIcon = new Icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  // Medidas del sprite original de Leaflet: sin esto el pin queda descentrado
  // respecto de la coordenada que representa.
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

/** Obelisco. Sólo se usa como encuadre inicial cuando todavía no hay coordenadas. */
const DEFAULT_CENTER: [number, number] = [-34.6037, -58.3816];
const DEFAULT_ZOOM = 12;
const PIN_ZOOM = 17;

interface Props {
  latitude: number | null;
  longitude: number | null;
  /** Se dispara al arrastrar el pin o al hacer click en el mapa. */
  onPinMove: (latitude: number, longitude: number) => void;
  disabled?: boolean;
  height?: number;
}

/**
 * Recentra el mapa cuando las coordenadas cambian desde AFUERA (elegir un
 * candidato de Georef), y arregla el tamaño al montar.
 *
 * Lo del tamaño no es paranoia: `MapContainer` mide el contenedor una sola vez
 * y este mapa vive adentro de una pestaña, así que la primera medición puede
 * pasar mientras el panel todavía está oculto y el mapa queda de 0px de alto.
 */
function MapSync({
  latitude,
  longitude,
}: {
  latitude: number | null;
  longitude: number | null;
}) {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();
  }, [map]);

  useEffect(() => {
    if (latitude === null || longitude === null) return;
    map.setView([latitude, longitude], Math.max(map.getZoom(), PIN_ZOOM));
  }, [map, latitude, longitude]);

  return null;
}

/** Click en el mapa: coloca (o mueve) el pin. */
function MapClickHandler({
  disabled,
  onPinMove,
}: {
  disabled: boolean;
  onPinMove: Props['onPinMove'];
}) {
  useMapEvents({
    click(event: LeafletMouseEvent) {
      if (disabled) return;
      onPinMove(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

/**
 * Mapa con OpenStreetMap y un pin arrastrable.
 *
 * Es el paso que corrige la aproximación de Georef: geocodifica interpolando
 * sobre el segmento de calle, así que el pin cae "por ahí cerca" y no en el
 * portal. Mover el pin marca la dirección como `manual`.
 */
export function AddressMap({
  latitude,
  longitude,
  onPinMove,
  disabled = false,
  height = 260,
}: Props) {
  const center = useMemo<[number, number]>(
    () =>
      latitude !== null && longitude !== null
        ? [latitude, longitude]
        : DEFAULT_CENTER,
    [latitude, longitude],
  );

  const hasPin = latitude !== null && longitude !== null;

  return (
    <div
      data-testid="address-map"
      style={{
        height,
        borderRadius: 'var(--r-md, 10px)',
        overflow: 'hidden',
        border: '1px solid var(--border-soft, #d0d9e6)',
        // Leaflet pinta sus panes en z-index 400+: sin un contexto de apilado
        // propio se le monta a cualquier dropdown o modal de la página.
        position: 'relative',
        isolation: 'isolate',
      }}
    >
      <MapContainer
        center={center}
        zoom={hasPin ? PIN_ZOOM : DEFAULT_ZOOM}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapSync latitude={latitude} longitude={longitude} />
        <MapClickHandler disabled={disabled} onPinMove={onPinMove} />
        {hasPin ? (
          <Marker
            position={[latitude, longitude]}
            icon={pinIcon}
            draggable={!disabled}
            alt="Ubicación del estacionamiento"
            eventHandlers={{
              dragend(event) {
                const marker = event.target as LeafletMarker;
                const { lat, lng } = marker.getLatLng();
                onPinMove(lat, lng);
              },
            }}
          />
        ) : null}
      </MapContainer>
    </div>
  );
}

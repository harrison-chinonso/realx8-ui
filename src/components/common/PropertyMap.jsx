import { useEffect } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Leaflet resolves its default marker images by relative path, which breaks under
// a bundler. Point it at the hashed asset URLs Vite gives us instead.
//
// Deleting _getIconUrl first is essential, not cosmetic: Icon.Default overrides
// it to PREPEND an auto-detected imagePath to whatever URL you configure
// (leaflet-src.js: `return (this.options.imagePath || IconDefault.imagePath) + ...`).
// Without this the bundled URL gets a prefix glued onto it and the marker image
// 404s, leaving the marker invisible. Removing the override falls back to
// Icon.prototype._getIconUrl, which returns the option verbatim.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

/** Parses a lat/lng pair that may arrive as string, number, null or ''. */
export const toCoords = (latitude, longitude) => {
  if (latitude === null || latitude === undefined || latitude === '') return null;
  if (longitude === null || longitude === undefined || longitude === '') return null;
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return [lat, lng];
};

/**
 * Leaflet caches the container size at init. Inside a modal or a tab the
 * container is often 0-height at that moment, which leaves tiles grey and the
 * marker offset from its real position. Re-measure once mounted and on resize.
 */
function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const refresh = () => map.invalidateSize();
    // After first paint, once the container has its real dimensions.
    const raf = requestAnimationFrame(refresh);
    const observer = new ResizeObserver(refresh);
    observer.observe(map.getContainer());
    return () => { cancelAnimationFrame(raf); observer.disconnect(); };
  }, [map]);
  return null;
}

/** Keeps the viewport in sync when coordinates change from outside the map. */
function Recenter({ coords, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (coords) map.setView(coords, zoom ?? map.getZoom());
  }, [coords?.[0], coords?.[1]]);
  return null;
}

/** Turns a map click into a coordinate update when the map is in picker mode. */
function ClickToPlace({ onPick }) {
  useMapEvents({
    click: (event) => onPick(event.latlng.lat, event.latlng.lng),
  });
  return null;
}

/**
 * Renders an OpenStreetMap view with a marker at the given coordinates.
 * Pass `onPick` to let the user click (or drag the marker) to set the location.
 */
export default function PropertyMap({
  latitude,
  longitude,
  label,
  zoom = 15,
  height = 320,
  onPick,
  className = '',
}) {
  const coords = toCoords(latitude, longitude);
  const interactive = typeof onPick === 'function';
  // Picker mode still needs a viewport before a location is chosen — centre on
  // Nigeria, which is where the country list in this app defaults.
  const center = coords ?? [9.082, 8.6753];

  if (!coords && !interactive) {
    return (
      <div className={`flex items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500 ${className}`} style={{ height }}>
        No coordinates set for this property.
      </div>
    );
  }

  return (
    <div className={`overflow-hidden rounded-lg border border-slate-200 ${className}`} style={{ height }}>
      <MapContainer
        center={center}
        zoom={coords ? zoom : 6}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <InvalidateOnResize />
        <Recenter coords={coords} zoom={coords ? zoom : 6} />
        {interactive && <ClickToPlace onPick={onPick} />}
        {coords && (
          <Marker
            position={coords}
            draggable={interactive}
            eventHandlers={interactive ? {
              dragend: (event) => {
                const { lat, lng } = event.target.getLatLng();
                onPick(lat, lng);
              },
            } : undefined}
          >
            {label && <Popup>{label}</Popup>}
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}

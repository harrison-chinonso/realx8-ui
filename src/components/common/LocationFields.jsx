import PropertyMap from './PropertyMap';
import FieldMark from '../ui/FieldMark';

const INPUT_CLASS = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

/**
 * Latitude/longitude inputs with a live picker map. Typing updates the map and
 * clicking or dragging on the map updates the inputs.
 */
export default function LocationFields({ latitude, longitude, onChange, label, height = 260 }) {
  const handlePick = (lat, lng) => {
    onChange('latitude', lat.toFixed(6));
    onChange('longitude', lng.toFixed(6));
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Latitude<FieldMark /></span>
          <input
            type="number"
            step="any"
            min="-90"
            max="90"
            value={latitude ?? ''}
            onChange={(event) => onChange('latitude', event.target.value)}
            className={INPUT_CLASS}
            placeholder="6.524379"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Longitude<FieldMark /></span>
          <input
            type="number"
            step="any"
            min="-180"
            max="180"
            value={longitude ?? ''}
            onChange={(event) => onChange('longitude', event.target.value)}
            className={INPUT_CLASS}
            placeholder="3.379206"
          />
        </label>
      </div>
      <p className="text-xs text-slate-500">Click the map or drag the marker to set the location.</p>
      <PropertyMap
        latitude={latitude}
        longitude={longitude}
        label={label}
        height={height}
        onPick={handlePick}
      />
    </div>
  );
}

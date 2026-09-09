import { Share2 } from 'lucide-react';
import Badge from './Badge';
import Button from '../ui/Button';
import ActionsMenu from './ActionsMenu';
import { describeUnits, describeUnitConfig } from './PropertyUnitFields';
import { firstImageUrl } from '../../utils/parseImages';

/** Total units across every configuration, e.g. "30 units". */
const describeUnitTotal = (configs, property) => {
  const total = configs.length
    ? configs.reduce((sum, u) => sum + (Number(u.quantity) || 0), 0)
    : Number(property.unit_quantity) || 0;
  if (!total) return null;
  return `${total.toLocaleString()} ${total === 1 ? 'unit' : 'units'}`;
};

/**
 * Single property tile used by the grid views.
 *
 * `summaryMode` controls the line under the location:
 *   'full'  — staff catalogue: the configuration breakdown.
 *   'units' — realtor/client catalogue: the unit count only. How stock is
 *             carved into configurations is internal, but buyers still need to
 *             know how much is available.
 *   'none'  — no summary line.
 * `onShare` adds a share affordance.
 */
export default function PropertyCard({ property, onOpen, onEdit, onDelete, onShare, summaryMode = 'full' }) {
  const image = firstImageUrl(property.images);
  const location = [property.city, property.state].filter(Boolean).join(', ');
  // Prefer the real configurations; fall back to the mirrored property fields
  // for endpoints that do not include them.
  const configs = property.units || [];
  const summary = summaryMode === 'none' ? null
    : summaryMode === 'units' ? describeUnitTotal(configs, property)
    : (configs.length > 1
      ? `${configs.length} configurations · ${configs.reduce((t, u) => t + (Number(u.quantity) || 0), 0)} units`
      : (configs.length === 1 ? describeUnitConfig(configs[0]) : describeUnits(property)));

  return (
    <div className="flex flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200 transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={onOpen}
        className="block h-40 w-full shrink-0 overflow-hidden bg-slate-100 text-left"
        aria-label={`View ${property.name}`}
      >
        {image ? (
          <img src={image} alt={property.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl text-slate-300">🏠</div>
        )}
      </button>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
            <h3 className="truncate font-semibold text-slate-900 hover:underline">{property.name}</h3>
          </button>
          <Badge value={property.status} />
        </div>

        {property.type && <p className="mt-0.5 truncate text-xs font-medium" style={{ color: 'var(--primary)' }}>{property.type}</p>}
        {location && <p className="mt-1 truncate text-sm text-slate-500">{location}</p>}
        {summary && <p className="mt-1 truncate text-xs text-slate-500" title={summary}>{summary}</p>}

        {/* Omit onEdit/onDelete to render a read-only card (listed-properties view). */}
        {(onEdit || onDelete || onShare || onOpen) && (
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
            {/* An explicit View link: the image and title are clickable too, but
                nothing said so, and this is the route to the purchase button. */}
            {onOpen && (
              <button
                type="button"
                onClick={onOpen}
                className="mr-auto text-xs font-semibold hover:underline"
                style={{ color: 'var(--primary)' }}
              >
                View details →
              </button>
            )}
            {onShare && (
              <Button type="button" variant="secondary" size="sm" onClick={onShare}>
                <Share2 size={14} /> Share
              </Button>
            )}
            {onEdit && <Button type="button" variant="primary" size="sm" onClick={onEdit}>Edit</Button>}
            {/* No "View Details" item here — the link on the left covers it. */}
            {onDelete && <ActionsMenu
              items={[{ label: '🗑 Delete', variant: 'danger', onClick: onDelete }]}
            />}
          </div>
        )}
      </div>
    </div>
  );
}

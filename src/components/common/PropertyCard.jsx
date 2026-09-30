import { Share2, MapPin, Home } from 'lucide-react';
import Badge from './Badge';
import Button from '../ui/Button';
import ActionsMenu from './ActionsMenu';
import { describeUnits, describeUnitConfig } from './PropertyUnitFields';
import { coverImageUrl, parseImages } from '../../utils/parseImages';
import { useCurrency, useAppearance } from '../../context/useAppearance';
import {
  availableOf, stockOf, priceRangeOf, soldPercent, photoCountOf,
} from '../property/propertyFigures';

/** Units still available across every configuration, e.g. "30 units available". */
const describeUnitTotal = (configs, property) => {
  const total = configs.length
    ? configs.reduce((sum, u) => sum + availableOf(u), 0)
    : Number(property.unit_quantity) || 0;
  if (!configs.length && !total) return null;
  if (!total) return 'Sold out';
  return `${total.toLocaleString()} ${total === 1 ? 'unit' : 'units'} available`;
};

const COMPACT = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
/** A compact money figure for a card — ₦4M, ₦690K — with the full figure in its title. */
const shortMoney = (symbol, value) => `${symbol || ''}${COMPACT.format(Number(value) || 0)}`;

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
 *
 * Everything else on the card — the availability bar, the "from" price, the
 * installment figure, amenities, branch, approval — is read from what the list
 * endpoint already sends, so the richer card costs no extra request. Staff see
 * `showApproval` and the branch; buyers see `promo` and the plans.
 */
export default function PropertyCard({
  property, onOpen, onEdit, onDelete, onShare, summaryMode = 'full', promo = null, showApproval = false,
}) {
  const fmt = useCurrency();
  const { currencySymbol } = useAppearance();
  const image = coverImageUrl(property.images);
  const photos = photoCountOf(parseImages(property.images));
  const location = [property.city, property.state].filter(Boolean).join(', ');
  // Prefer the real configurations; fall back to the mirrored property fields
  // for endpoints that do not include them.
  const configs = property.units || [];
  const summary = summaryMode === 'none' ? null
    : summaryMode === 'units' ? describeUnitTotal(configs, property)
    : (configs.length > 1
      ? `${configs.length} configurations · ${configs.reduce((t, u) => t + availableOf(u), 0)} units available`
      : (configs.length === 1
        ? `${describeUnitConfig(configs[0])} · ${availableOf(configs[0])
          ? `${availableOf(configs[0]).toLocaleString()} available` : 'Sold out'}`
        // No configurations: the legacy mirrored fields. Holds are placed on
        // configurations, so nothing has been subtracted from these.
        : describeUnits(property)));
  const stock = stockOf(configs, property);
  const range = priceRangeOf(configs);
  const plans = property.plan_summary;
  const amenities = property.top_amenities || [];

  return (
    <div className="flex flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_10px_28px_-22px_rgba(15,23,42,0.45)] ring-1 ring-slate-200 transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={onOpen}
        className="relative block h-44 w-full shrink-0 overflow-hidden bg-slate-100 text-left"
        aria-label={`View ${property.name}`}
      >
        {image ? (
          <img src={image} alt={property.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,rgba(var(--primary-rgb),0.18),rgba(var(--primary-rgb),0.05))] text-slate-400">
            <Home size={40} aria-hidden="true" />
          </div>
        )}
        <span className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <Badge value={property.status} />
          {showApproval && property.approval_status && <Badge value={property.approval_status} />}
        </span>
        {promo && (
          <span className="absolute right-3 top-3 max-w-[60%] truncate rounded-full bg-pink-700 px-2.5 py-1 text-xs font-extrabold text-white" title={promo}>
            {promo}
          </span>
        )}
        {photos > 0 && (
          <span className="absolute bottom-2.5 left-3 rounded-full bg-slate-900/60 px-2.5 py-1 text-[11px] font-bold text-white">
            {photos} photo{photos === 1 ? '' : 's'}
          </span>
        )}
      </button>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <button type="button" onClick={onOpen} className="block min-w-0 max-w-full text-left">
            <h3 className="truncate font-heading text-lg font-extrabold text-slate-900 hover:underline">{property.name}</h3>
          </button>
          {property.type && <p className="truncate text-xs font-bold" style={{ color: 'var(--secondary-read, var(--primary))' }}>{property.type}</p>}
          {location && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-slate-600">
              <MapPin size={13} className="shrink-0" aria-hidden="true" /> {location}
            </p>
          )}
          {summary && <p className="mt-1 truncate text-xs text-slate-600" title={summary}>{summary}</p>}
        </div>

        {stock.total > 0 && (
          <div className="space-y-1">
            <div role="img" aria-label={`${stock.available} of ${stock.total} units available`} className="h-2 overflow-hidden rounded-full bg-slate-100">
              <span className="block h-full rounded-full bg-primary" style={{ width: `${soldPercent(stock)}%` }} />
            </div>
            <p className="flex justify-between text-xs text-slate-600">
              <span><strong className="text-slate-900">{stock.available.toLocaleString()}</strong> available of {stock.total.toLocaleString()}</span>
              {stock.held > 0 && <span>{stock.held.toLocaleString()} held</span>}
            </p>
          </div>
        )}

        {(range || plans) && (
          <div className="grid grid-cols-2 gap-2">
            {range && (
              <span className="rounded-xl bg-slate-50 px-3 py-2">
                <span className="block text-[11px] font-semibold text-slate-600">From</span>
                <strong className="font-heading text-base tabular-nums text-slate-900" title={fmt(range.min)}>{shortMoney(currencySymbol, range.min)}</strong>
              </span>
            )}
            {plans && (
              <span className="rounded-xl bg-slate-50 px-3 py-2">
                <span className="block text-[11px] font-semibold text-slate-600">Installments</span>
                <strong className="font-heading text-base tabular-nums text-slate-900">
                  {plans.min_monthly ? `${shortMoney(currencySymbol, plans.min_monthly)} / mo` : 'Outright only'}
                </strong>
              </span>
            )}
          </div>
        )}

        {plans?.plans > 0 && (
          <p className="text-xs text-slate-600">
            {plans.plans} installment plan{plans.plans === 1 ? '' : 's'}{plans.max_months ? ` · up to ${plans.max_months} months` : ''}
          </p>
        )}
        {amenities.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {amenities.map((name) => <span key={name} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">{name}</span>)}
          </div>
        )}
        {property.branch?.name && <p className="text-xs font-semibold text-slate-600">{property.branch.name} branch</p>}
        {showApproval && property.submitted_by?.name && (
          <p className="truncate text-xs text-slate-600">Submitted by <strong className="text-slate-800">{property.submitted_by.name}</strong></p>
        )}
        {/* A realtor's own link to this property — how many people opened it. */}
        {property.my_share_views?.views > 0 && (
          <p className="text-xs text-slate-600">
            Your link opened <strong className="text-slate-900">{property.my_share_views.views.toLocaleString()}</strong> time{property.my_share_views.views === 1 ? '' : 's'}
          </p>
        )}

        {/* Omit onEdit/onDelete to render a read-only card (listed-properties view). */}
        {(onEdit || onDelete || onShare || onOpen) && (
          <div className="mt-auto flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
            {/* An explicit View link: the image and title are clickable too, but
                nothing said so, and this is the route to the purchase button. */}
            {onOpen && (
              <button
                type="button"
                onClick={onOpen}
                className="mr-auto text-sm font-bold hover:underline"
                style={{ color: 'var(--secondary-read, var(--primary))' }}
              >
                View details →
              </button>
            )}
            {onShare && (
              <Button type="button" size="sm" onClick={onShare}>
                <Share2 size={14} /> Share
              </Button>
            )}
            {onEdit && <Button type="button" variant="secondary" size="sm" onClick={onEdit}>Edit</Button>}
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

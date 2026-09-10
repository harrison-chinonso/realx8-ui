import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getListedProperty } from '../../api/propertyApi';
import Badge from '../../components/common/Badge';
import Button from '../../components/ui/Button';
import PurchaseModal from '../../components/common/PurchaseModal';
import useAuthStore from '../../store/authStore';
import PropertyMap, { toCoords } from '../../components/common/PropertyMap';
import PropertyMediaPanel from '../../components/common/PropertyMediaPanel';
import { parseImages } from '../../utils/parseImages';
import { useCurrency } from '../../context/useAppearance';

/**
 * Read-only property detail for realtors and clients. Mirrors the information
 * on the public share page, but inside the app shell. No editing controls:
 * media is rendered with readonly, and there are no approval/share panels.
 */
export default function ListedPropertyDetailPage() {
  const fmt = useCurrency();
  const { id } = useParams();
  const navigate = useNavigate();
  const [property, setProperty] = useState(null);
  const [state, setState] = useState('loading');
  const [showPurchase, setShowPurchase] = useState(false);
  // Purchasing is for clients only. Uses the ACTIVE profile, so a realtor who
  // switches to their client profile can buy.
  const canPurchase = useAuthStore((s) => s.effectiveType()) === 'client';

  useEffect(() => {
    let cancelled = false;
    getListedProperty(id)
      .then((response) => {
        if (cancelled) return;
        setProperty(response?.data ?? response);
        setState('ready');
      })
      .catch(() => { if (!cancelled) setState('missing'); });
    return () => { cancelled = true; };
  }, [id]);

  if (state === 'loading') return <div className="rounded-xl bg-white p-6 text-slate-500">Loading property...</div>;
  if (state === 'missing') {
    return (
      <div className="space-y-4">
        <Link to="/properties/listed"><Button variant="secondary" size="sm">← Back to Listed Properties</Button></Link>
        <div className="rounded-xl bg-white p-8 text-center text-slate-500 shadow-sm ring-1 ring-slate-200">
          This property is not available.
        </div>
      </div>
    );
  }

  const coords = toCoords(property.latitude, property.longitude);
  const images = parseImages(property.images);
  const unitConfigs = property.units || [];
  const location = [property.address, property.city, property.state, property.country].filter(Boolean).join(', ');

  return (
    <div className="space-y-6">
      <Link to="/properties/listed"><Button variant="secondary" size="sm">← Back to Listed Properties</Button></Link>

      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-2xl font-bold text-slate-900">{property.name}</h1>
            {property.type && <p className="mt-1 text-sm font-medium" style={{ color: 'var(--primary)' }}>{property.type}</p>}
            <p className="mt-1 text-sm text-slate-500">{location || 'No address provided.'}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge value={property.status} />
            {canPurchase && <Button type="button" onClick={() => setShowPurchase(true)}>Purchase Now</Button>}
          </div>
        </div>
        {property.description && (
          <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-700">{property.description}</p>
        )}
      </div>

      {images.length > 0 && (
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Media</h2>
          <PropertyMediaPanel images={images} readonly />
        </div>
      )}

      <PurchaseModal
        open={showPurchase && canPurchase}
        property={property}
        onClose={() => setShowPurchase(false)}
        /**
         * Both branches have already created the same invoice; `intent` only
         * decides where the buyer goes next.
         *
         * "Proceed to Payment" goes straight to the invoice's payment page —
         * bank details, online payment where configured, and receipt upload are
         * all on it, so there is no trip back through a list to find the
         * invoice that was just raised. `payment_url` comes from the server so
         * the two repos cannot disagree about where that page lives.
         */
        onInvoice={(result, intent) => {
          setShowPurchase(false);
          if (intent === 'pay') {
            navigate(`/${result.payment_url || `finance/invoices/${result.invoice_id}`}`);
          } else {
            navigate('/finance/my-payments', {
              state: { notice: `Invoice ${result.invoice_ref} created. You can pay it whenever you are ready.` },
            });
          }
        }}
      />

      {unitConfigs.length > 0 && (
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">
              Unit Configurations{unitConfigs.length > 1 ? ` (${unitConfigs.length})` : ''}
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-slate-600">Unit Name</th>
                    <th className="px-4 py-2 text-right font-semibold text-slate-600">Quantity</th>
                    <th className="px-4 py-2 text-right font-semibold text-slate-600">Property Size</th>
                    <th className="px-4 py-2 text-left font-semibold text-slate-600">Measured In</th>
                    <th className="px-4 py-2 text-right font-semibold text-slate-600">Price</th>
                    <th className="px-4 py-2 text-right font-semibold text-slate-600">Available</th>
                    <th className="px-4 py-2 text-left font-semibold text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {unitConfigs.map((unit, index) => (
                    <tr key={unit.id ?? index}>
                      <td className="px-4 py-2 font-medium text-slate-900">{unit.name || '—'}</td>
                      <td className="px-4 py-2 text-right text-slate-700">{unit.quantity ?? '—'}</td>
                      <td className="px-4 py-2 text-right text-slate-700">{unit.size ? Number(unit.size).toLocaleString() : '—'}</td>
                      <td className="px-4 py-2 text-slate-700">{unit.unit || 'sqm'}</td>
                      <td className="px-4 py-2 text-right font-medium text-slate-900">{fmt(unit.price || 0)}</td>
                      <td className="px-4 py-2 text-right text-slate-700">{unit.quantity_available ?? unit.quantity ?? '—'}</td>
                      <td className="px-4 py-2 capitalize text-slate-500">{unit.status || 'available'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      {coords && (
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Location</h2>
            <span className="font-mono text-xs text-slate-500">{coords[0].toFixed(6)}, {coords[1].toFixed(6)}</span>
          </div>
          <PropertyMap latitude={property.latitude} longitude={property.longitude} label={property.name} height={360} />
          <a
            className="mt-3 inline-block text-sm font-medium hover:underline"
            style={{ color: 'var(--primary)' }}
            href={`https://www.google.com/maps/search/?api=1&query=${coords[0]},${coords[1]}`}
            target="_blank"
            rel="noreferrer"
          >
            Open in Google Maps ↗
          </a>
        </div>
      )}


      {property.amenities?.length > 0 && (
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Amenities</h2>
          <div className="flex flex-wrap gap-2">
            {property.amenities.map((amenity) => (
              <span key={amenity.id} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700" title={amenity.description || ''}>
                {amenity.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

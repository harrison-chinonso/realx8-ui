import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getPublicProperty, createPurchaseRequest } from '../../api/propertyApi';
import useAuthStore from '../../store/authStore';
import useSharedBrand from '../../hooks/useSharedBrand';
import Button from '../../components/ui/Button';
import PropertyMap, { toCoords } from '../../components/common/PropertyMap';
import { parseImages } from '../../utils/parseImages';
import { resolveMedia } from '../../utils/mediaUrl';

const imageUrl = (image) => (typeof image === 'string' ? image : image?.url);

const formatPrice = (value) => {
  const price = Number(value);
  if (!Number.isFinite(price) || price <= 0) return null;
  return price.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

function Message({ title, body }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">{body}</p>
      </div>
    </div>
  );
}

/**
 * Standalone, unauthenticated property view served at /p/:token.
 * Renders outside AppLayout — no sidebar, no auth required.
 */
export default function PublicPropertyPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  // Brands this page for the company that shared the link, before the prospect
  // has any account to derive a theme from.
  useSharedBrand();
  const sealedRef = params.get('ref');
  const accessToken = useAuthStore((s) => s.accessToken);
  // Signed-in realtors browsing a shared link do not get a purchase action;
  // anonymous visitors do, since they register as clients.
  const isRealtor = useAuthStore((s) => s.effectiveType()) === 'realtor';
  const [property, setProperty] = useState(null);
  const [state, setState] = useState('loading');
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [buying, setBuying] = useState(false);
  const [purchase, setPurchase] = useState(null);
  const [purchaseError, setPurchaseError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getPublicProperty(token)
      .then((response) => {
        if (cancelled) return;
        setProperty(response?.data ?? response);
        setState('ready');
      })
      .catch((error) => {
        if (cancelled) return;
        setState(error?.response?.status === 410 ? 'expired' : 'missing');
      });
    return () => { cancelled = true; };
  }, [token]);

  // Returning from registration: finish the purchase the visitor started.
  useEffect(() => {
    if (state !== 'ready' || !accessToken || params.get('purchase') !== '1' || purchase) return;
    const unit = params.get('unit');
    submitPurchase(unit ? Number(unit) : null);
    const next = new URLSearchParams(params);
    next.delete('purchase');
    next.delete('unit');
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, accessToken]);

  const submitPurchase = async (unitId) => {
    setBuying(true);
    setPurchaseError('');
    try {
      const response = await createPurchaseRequest({ token, unit_id: unitId ?? undefined });
      setPurchase(response?.data ?? response);
    } catch (error) {
      setPurchaseError(error?.response?.data?.message || error?.userMessage || 'Could not submit your request.');
    } finally {
      setBuying(false);
    }
  };

  const handlePurchase = (unitId) => {
    if (!accessToken) {
      // Send them to register, remembering where to come back to and what they
      // were buying, so the purchase resumes automatically afterwards.
      // Carry ?ref= through so the visitor keeps the same branding and the same
      // company/realtor attribution across the hop, and lands back here after.
      const back = `/p/${token}?purchase=1${unitId ? `&unit=${unitId}` : ''}${sealedRef ? `&ref=${encodeURIComponent(sealedRef)}` : ''}`;
      let attribution;
      if (sealedRef) {
        // Sealed: the codes travel inside the token, where they cannot be edited.
        attribution = `&ref=${encodeURIComponent(sealedRef)}`;
      } else {
        // The company code comes from the server payload, not the URL, so an
        // edited ?c= cannot bind the new account to the wrong company.
        const company = property.company_code ? `&company_code=${encodeURIComponent(property.company_code)}` : '';
        // The realtor code identifies WHO shared the link, so unlike the company
        // code it can only come from the URL. The server still validates it
        // against the resolved company before attaching the account.
        const referrer = params.get('r');
        const realtor = referrer ? `&realtor_code=${encodeURIComponent(referrer)}` : '';
        attribution = `${company}${realtor}`;
      }
      navigate(`/register?redirect=${encodeURIComponent(back)}${attribution}`);
      return;
    }
    submitPurchase(unitId);
  };

  if (state === 'loading') return <Message title="Loading" body="Fetching property details..." />;
  if (state === 'expired') return <Message title="Link expired" body="This share link is no longer active. Please ask the sender for a new one." />;
  if (state === 'missing') return <Message title="Link not found" body="This share link is invalid or has been revoked." />;

  const coords = toCoords(property.latitude, property.longitude);
  const images = parseImages(property.images);
  const unitConfigs = property.units || [];
  const location = [property.address, property.city, property.state, property.country].filter(Boolean).join(', ');

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <header className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="break-words text-2xl font-bold text-slate-900">{property.name}</h1>
              {property.type && <p className="mt-1 text-sm font-medium text-slate-600">{property.type}</p>}
              {location && <p className="mt-1 text-sm text-slate-500">{location}</p>}
            </div>
            {property.status && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">
                {property.status}
              </span>
            )}
          </div>
          {property.description && (
            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-700">{property.description}</p>
          )}
        </header>

        <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          {purchase ? (
            <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
              Your purchase request has been sent. The team will contact you shortly.
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-slate-900">Interested in this property?</h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  {unitConfigs.length > 0
                    ? 'Pick a unit option below, or send a general request.'
                    : 'Send a purchase request and the team will get in touch.'}
                  {!accessToken && ' You will be asked to create an account first.'}
                  {isRealtor && ' Purchasing is available to client accounts — switch to your client profile to buy.'}
                </p>
              </div>
              {!isRealtor && (
                <Button type="button" disabled={buying} onClick={() => { setSelectedUnit(null); handlePurchase(null); }}>
                  {buying && selectedUnit === null ? 'Sending…' : 'Purchase'}
                </Button>
              )}
            </div>
          )}
          {purchaseError && (
            <div className="mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{purchaseError}</div>
          )}
        </section>

        {images.length > 0 && (
          <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Media</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {images.map((image, index) => {
                const url = imageUrl(image);
                if (!url) return null;
                const media = resolveMedia(url, typeof image === 'string' ? undefined : image?.type);

                if (media.kind === 'embed') {
                  return (
                    <iframe
                      key={`${url}-${index}`}
                      src={media.src}
                      title={image?.name || `${property.name} video ${index + 1}`}
                      className="h-40 w-full rounded-lg bg-black"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                      allowFullScreen
                    />
                  );
                }

                if (media.kind === 'video') {
                  return (
                    <video
                      key={`${url}-${index}`}
                      src={media.src}
                      controls
                      playsInline
                      preload="metadata"
                      className="h-40 w-full rounded-lg bg-black object-cover"
                    />
                  );
                }

                return (
                  <a key={`${url}-${index}`} href={media.src} target="_blank" rel="noreferrer">
                    <img src={media.src} alt={`${property.name} ${index + 1}`} className="h-40 w-full rounded-lg object-cover" loading="lazy" />
                  </a>
                );
              })}
            </div>
          </section>
        )}

        {unitConfigs.length > 0 && (
          <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
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
                    <th className="px-4 py-2 text-left font-semibold text-slate-600">Status</th>
                    <th className="px-4 py-2 text-right font-semibold text-slate-600"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {unitConfigs.map((unit, index) => (
                    <tr key={unit.id ?? index}>
                      <td className="px-4 py-2 font-medium text-slate-900">{unit.name || '—'}</td>
                      <td className="px-4 py-2 text-right text-slate-700">{unit.quantity ?? '—'}</td>
                      <td className="px-4 py-2 text-right text-slate-700">{unit.size ? Number(unit.size).toLocaleString() : '—'}</td>
                      <td className="px-4 py-2 text-slate-700">{unit.unit || 'sqm'}</td>
                      <td className="px-4 py-2 text-right font-medium text-slate-900">{formatPrice(unit.price) || "—"}</td>
                      <td className="px-4 py-2 capitalize text-slate-500">{unit.status || 'available'}</td>
                      <td className="px-4 py-2 text-right">
                        {!isRealtor && (
                          <Button
                            type="button"
                            size="sm"
                            disabled={buying || !!purchase}
                            onClick={() => { setSelectedUnit(unit.id); handlePurchase(unit.id); }}
                          >
                            {buying && selectedUnit === unit.id ? 'Sending…' : 'Purchase'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {coords && (
          <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-slate-900">Location</h2>
              <span className="font-mono text-xs text-slate-500">{coords[0].toFixed(6)}, {coords[1].toFixed(6)}</span>
            </div>
            <PropertyMap latitude={property.latitude} longitude={property.longitude} label={property.name} height={360} />
            <a
              className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline"
              href={`https://www.google.com/maps/search/?api=1&query=${coords[0]},${coords[1]}`}
              target="_blank"
              rel="noreferrer"
            >
              Open in Google Maps ↗
            </a>
          </section>
        )}


        {property.amenities?.length > 0 && (
          <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Amenities</h2>
            <div className="flex flex-wrap gap-2">
              {property.amenities.map((amenity) => (
                <span key={amenity.id} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700" title={amenity.description || ''}>
                  {amenity.name}
                </span>
              ))}
            </div>
          </section>
        )}

        <p className="pb-4 text-center text-xs text-slate-400">
          Shared property listing — details are subject to change.
        </p>
      </div>
    </div>
  );
}

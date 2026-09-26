import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getPublicProperty, createPurchaseRequest } from '../../api/propertyApi';
import useAuthStore from '../../store/authStore';
import useSharedBrand from '../../hooks/useSharedBrand';
import { looksLikeShareCode } from '../../utils/shareCode';
import Button from '../../components/ui/Button';
import PropertyMap, { toCoords } from '../../components/common/PropertyMap';
import { parseImages } from '../../utils/parseImages';
import { resolveMedia } from '../../utils/mediaUrl';
import MediaLightbox from '../../components/common/MediaLightbox';
import { enumLabel } from '../../utils/enumLabel';

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
  /**
   * Brands this page for the company that shared the link, before the prospect
   * has any account to derive a theme from.
   *
   * A short link is `/p/K7M2QXV` with no query string at all, so the code in
   * the path is what has to be resolved — there is no `?ref=` beside it any
   * more. A legacy `/p/<long token>?ref=…` link still brands from the query.
   */
  const pathCode = looksLikeShareCode(token) ? token : null;
  useSharedBrand(pathCode);
  // What to carry forward to the sign-up page so it brands itself the same way
  // and attributes the new account to the same people.
  const sealedRef = params.get('ref') || pathCode;
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
  // Which media item the viewer is showing; null means closed. Declared up here
  // with the other hooks because the loading/expired/missing branches below
  // return early.
  const [viewerIndex, setViewerIndex] = useState(null);

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

  /**
   * Where a visitor with no account goes when they press Purchase.
   *
   * The sign-up form, with the company and the realtor already filled in — not
   * the application's front door. Somebody who has just chosen a plot should be
   * asked for their name and email, not shown a login screen for a product they
   * have no account with and left to work out which company it belongs to.
   *
   * Three things travel with them, and each is separate:
   *
   *   redirect      back to this property, with the unit they picked, so the
   *                 purchase completes by itself once they have an account.
   *   ref           the share code, which brands the sign-up page as this
   *                 company and carries the attribution in a form the visitor
   *                 cannot edit.
   *   company_code  the same binding in plain form.
   *   realtor_code
   *
   * The plain codes are sent ALONGSIDE `ref` rather than instead of it. `ref`
   * is the authority and the server re-resolves it; the plain pair is what
   * fills the form's fields in immediately, so the company box is populated on
   * first paint instead of a moment later when the resolve returns — and is
   * what still works if the code has since been revoked.
   *
   * Both plain codes come from the SERVER's payload, never from this page's own
   * query string. That is the difference that matters: `?c=` and `?r=` in a URL
   * can be edited by whoever received the link, and were, which is how a
   * referral could be re-attributed by hand.
   */
  const registrationUrl = (unitId) => {
    const back = `/p/${token}?purchase=1${unitId ? `&unit=${unitId}` : ''}`
      + `${params.get('ref') ? `&ref=${encodeURIComponent(params.get('ref'))}` : ''}`;

    const query = new URLSearchParams({ redirect: back });
    if (sealedRef) query.set('ref', sealedRef);
    if (property?.company_code) query.set('company_code', property.company_code);
    /**
     * Who shared this link. Resolved server-side from the share code, and
     * absent on a legacy link, which carried it as an editable `?r=` instead —
     * honoured here as the fallback it is, and validated against the resolved
     * company by the server before any account is attached to it.
     */
    const realtorCode = property?.realtor_code || params.get('r');
    if (realtorCode) query.set('realtor_code', realtorCode);

    return `/register?${query.toString()}`;
  };

  const handlePurchase = (unitId) => {
    if (!accessToken) {
      navigate(registrationUrl(unitId));
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
          {/*
            * Stacked on a phone, side by side from `sm` up — the same shape as
            * the signed-in property page, and for the same reason: `flex-1`
            * plus `min-w-0` means the title SHRINKS instead of wrapping, since
            * flex items give up width before a wrap is considered. The status
            * pill then sat beside a name broken down a narrow column.
            *
            * `self-start` keeps the pill hugging its own text once it is on its
            * own row; stretched, it would run the full width of the card.
            */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 sm:flex-1">
              <h1 className="break-words text-2xl font-bold text-slate-900">{property.name}</h1>
              {property.type && <p className="mt-1 text-sm font-medium text-slate-600">{property.type}</p>}
              {location && <p className="mt-1 text-sm text-slate-500">{location}</p>}
            </div>
            {property.status && (
              <span className="self-start rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">
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
            {/*
              Every tile opens the viewer at its own position rather than
              rendering in place or linking out: videos used to play inside a
              160px grid cell, and a photograph opened a new browser tab with
              no way back and nothing to move on to.
            */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {images.map((image, index) => {
                const url = imageUrl(image);
                if (!url) return null;
                const media = resolveMedia(url, typeof image === 'string' ? undefined : image?.type);
                const isVideo = media.kind !== 'image';
                const preview = isVideo ? media.poster : media.src;

                return (
                  <button
                    type="button"
                    key={`${url}-${index}`}
                    onClick={() => setViewerIndex(index)}
                    aria-label={`View ${image?.name || `media ${index + 1}`}`}
                    className="group relative h-40 w-full overflow-hidden rounded-lg bg-slate-900 ring-1 ring-slate-200"
                  >
                    {preview ? (
                      <img
                        src={preview}
                        alt={`${property.name} ${index + 1}`}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                      />
                    ) : (
                      <span className="block h-full w-full bg-slate-800" />
                    )}
                    {isVideo && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <span className="rounded-full bg-black/60 p-3 ring-1 ring-white/30">
                          <svg className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <MediaLightbox
              items={images}
              index={viewerIndex}
              onIndex={setViewerIndex}
              onClose={() => setViewerIndex(null)}
            />
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
                      <td className="px-4 py-2 text-slate-500">{enumLabel(unit.status || 'available')}</td>
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

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getPublicProperty } from '../../api/propertyApi';
import useAuthStore from '../../store/authStore';
import useSharedBrand from '../../hooks/useSharedBrand';
import { looksLikeShareCode } from '../../utils/shareCode';
import Button from '../../components/ui/Button';
import PropertyMap, { toCoords } from '../../components/common/PropertyMap';
import { parseImages } from '../../utils/parseImages';
import { resolveMedia } from '../../utils/mediaUrl';
import MediaLightbox from '../../components/common/MediaLightbox';
import { enumLabel } from '../../utils/enumLabel';
import { stockOf, priceRangeOf, soldPercent } from '../../components/property/propertyFigures';
import { useAppearance } from '../../context/useAppearance';

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
  const [params] = useSearchParams();
  /**
   * Brands this page for the company that shared the link, before the prospect
   * has any account to derive a theme from.
   *
   * A short link is `/p/K7M2QXV` with no query string at all, so the code in
   * the path is what has to be resolved — there is no `?ref=` beside it any
   * more. A legacy `/p/<long token>?ref=…` link still brands from the query.
   */
  const pathCode = looksLikeShareCode(token) ? token : null;
  const brand = useSharedBrand(pathCode);
  // The sharing company's logo, applied by useSharedBrand from the link's branding.
  const { app_logo: companyLogo } = useAppearance();
  const [logoFailed, setLogoFailed] = useState(false);
  // What to carry forward to the sign-up page so it brands itself the same way
  // and attributes the new account to the same people.
  const sealedRef = params.get('ref') || pathCode;
  const accessToken = useAuthStore((s) => s.accessToken);
  // Signed-in realtors browsing a shared link do not get a purchase action;
  // anonymous visitors do, since they register as clients.
  const isRealtor = useAuthStore((s) => s.effectiveType()) === 'realtor';
  // The company the signed-in account belongs to, when the session said so.
  const myCompanyCode = useAuthStore((s) => s.company?.code ?? null);
  const [property, setProperty] = useState(null);
  const [state, setState] = useState('loading');
  // Set when a signed-in client belongs to a different company than this listing.
  const [wrongCompany, setWrongCompany] = useState(false);
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

  /**
   * Where buying actually happens: the property's page inside the app, with
   * the purchase dialog open (`buy=1`) and, when a unit's own button was
   * pressed, that unit already picked (`unit`). Unit, quantity and payment
   * plan are chosen there and the invoice is raised straight away — this page
   * no longer files a "purchase request" for somebody to follow up.
   */
  const purchasePath = (unitId) => `/properties/listed/${property?.id}?buy=1${unitId ? `&unit=${unitId}` : ''}`;

  /*
   * Links from before this change sent a new account back HERE with
   * `?purchase=1` to finish. Honour them by forwarding to the purchase page.
   */
  useEffect(() => {
    if (state !== 'ready' || !accessToken || params.get('purchase') !== '1' || isRealtor) return;
    const unit = params.get('unit');
    navigate(purchasePath(unit ? Number(unit) : null), { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, accessToken]);

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
   *   redirect      the purchase page for this property, with the unit they
   *                 picked — the sign-up signs them in and lands them there,
   *                 so buying is three clicks: Purchase, Create account,
   *                 choose the unit.
   *   intent        `purchase`, which tells the sign-up page this is a buyer
   *                 mid-purchase: it skips straight to their details, as a
   *                 client, since the company and the reason are both known.
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
    const query = new URLSearchParams({ redirect: purchasePath(unitId), intent: 'purchase' });
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

  /** An existing customer's way in: their company's sign-in page, returning to the purchase. */
  const signInUrl = (unitId = null) => {
    const code = property?.company_code;
    return `${code ? `/login/${encodeURIComponent(code)}` : '/login'}?redirect=${encodeURIComponent(purchasePath(unitId))}`;
  };

  const handlePurchase = (unitId) => {
    if (!accessToken) {
      navigate(registrationUrl(unitId));
      return;
    }
    /*
     * Signed in already. A client of THIS company goes straight to the
     * purchase; one whose account is with another company cannot buy here
     * (every listing belongs to its own company), and is told so rather than
     * sent to a page that would only say "not available".
     */
    if (myCompanyCode && property?.company_code && myCompanyCode !== property.company_code) {
      setWrongCompany(true);
      return;
    }
    navigate(purchasePath(unitId));
  };

  if (state === 'loading') return <Message title="Loading" body="Fetching property details..." />;
  if (state === 'expired') return <Message title="Link expired" body="This share link is no longer active. Please ask the sender for a new one." />;
  if (state === 'missing') return <Message title="Link not found" body="This share link is invalid or has been revoked." />;

  const coords = toCoords(property.latitude, property.longitude);
  const images = parseImages(property.images);
  const unitConfigs = property.units || [];
  const location = [property.address, property.city, property.state, property.country].filter(Boolean).join(', ');
  const stock = stockOf(unitConfigs, property);
  const range = priceRangeOf(unitConfigs);
  const plans = property.plan_summary;
  // The first photograph (not a video) for the banner — the grid below still shows them all.
  const cover = images
    .map((image) => {
      const url = imageUrl(image);
      return url ? resolveMedia(url, typeof image === 'string' ? undefined : image?.type) : null;
    })
    .find((media) => media?.kind === 'image')?.src;
  const coverIndex = cover ? images.findIndex((image) => {
    const url = imageUrl(image);
    return url && resolveMedia(url, typeof image === 'string' ? undefined : image?.type)?.src === cover;
  }) : -1;
  const facts = [
    stock.total > 0 && { label: 'Units available', value: `${stock.available.toLocaleString()} of ${stock.total.toLocaleString()}` },
    range && { label: 'Prices from', value: formatPrice(range.min) },
    { label: 'Payment plans', value: plans?.plans ? `${plans.plans} plan${plans.plans === 1 ? '' : 's'}${plans.max_months ? ` · up to ${plans.max_months} mo` : ''}` : 'Outright' },
    plans?.min_monthly && { label: 'Installments from', value: `${formatPrice(plans.min_monthly)} / mo` },
  ].filter(Boolean);
  const companyName = brand.company;

  return (
    <div className="min-h-screen bg-slate-50">
      {/*
        Whose listing this is, before anything else. The company comes from the
        share code the link already carries (useSharedBrand); the realtor line
        only appears when the link names one — never guessed.
      */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {companyLogo && !logoFailed ? (
              <img
                src={companyLogo}
                alt=""
                onError={() => setLogoFailed(true)}
                className="h-9 w-9 shrink-0 rounded-xl bg-white object-contain p-0.5 ring-1 ring-slate-200"
              />
            ) : companyName && (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white" aria-hidden="true">
                {companyName.trim().charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">{companyName || 'Property listing'}</p>
              {(brand.realtorName || property.realtor_code) && (
                <p className="truncate text-xs text-slate-500">
                  Shared with you by {brand.realtorName || 'a realtor'}{companyName ? ` at ${companyName}` : ''}
                </p>
              )}
            </div>
          </div>
          {!accessToken && (
            <Link to={signInUrl()} className="shrink-0 text-sm font-semibold hover:underline" style={{ color: 'var(--primary)' }}>
              Sign in
            </Link>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        {cover && (
          <button
            type="button"
            onClick={() => setViewerIndex(coverIndex)}
            aria-label={`View photos of ${property.name}`}
            className="relative block h-56 w-full overflow-hidden rounded-2xl bg-slate-900 sm:h-80"
          >
            <img src={cover} alt={property.name} className="h-full w-full object-cover" />
            <span className="absolute bottom-3 left-3 rounded-full bg-slate-900/60 px-3 py-1 text-xs font-bold text-white">
              {images.length} {images.length === 1 ? 'item' : 'items'} · tap to view
            </span>
          </button>
        )}

        {/*
          What the company is running on this property right now — the same
          live campaigns its dashboards advertise, tested against their dates
          on the server. The price itself is still worked out at checkout.
        */}
        {(property.promotions || []).map((promo) => (
          <section key={promo.id} className="flex flex-col gap-1 rounded-2xl bg-pink-50 px-5 py-4 ring-1 ring-pink-200 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-pink-700 px-2.5 py-0.5 text-xs font-bold text-white">{promo.benefit_label || 'Offer'}</span>
                <span className="text-base font-bold text-slate-900">{promo.name}</span>
              </p>
              {promo.customer_message && <p className="mt-1 text-sm text-slate-700">{promo.customer_message}</p>}
              {promo.terms && <p className="mt-1 text-xs text-slate-500">{promo.terms}</p>}
            </div>
            {promo.ends_at && (
              <p className="shrink-0 text-xs font-semibold text-pink-800">
                Ends {new Date(promo.ends_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            )}
          </section>
        ))}

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
          {facts.length > 0 && (
            <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {facts.map((f) => (
                <div key={f.label} className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                  <dt className="text-[11px] font-semibold text-slate-500">{f.label}</dt>
                  <dd className="text-base font-bold tabular-nums text-slate-900">{f.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {stock.total > 0 && (
            <div role="img" aria-label={`${stock.available} of ${stock.total} units available`} className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <span className="block h-full rounded-full bg-primary" style={{ width: `${soldPercent(stock)}%` }} />
            </div>
          )}
        </header>

        <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-slate-900">Interested in this property?</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {accessToken
                  ? 'Choose your unit and how to pay on the next screen.'
                  : 'Create a free account and you go straight to choosing your unit.'}
                {!accessToken && (
                  <>
                    {' '}Already a customer?{' '}
                    <Link to={signInUrl()} className="font-semibold hover:underline" style={{ color: 'var(--primary)' }}>Sign in to buy</Link>
                  </>
                )}
                {isRealtor && ' Purchasing is available to client accounts — switch to your client profile to buy.'}
              </p>
            </div>
            {!isRealtor && (
              <Button type="button" onClick={() => handlePurchase(null)}>Purchase</Button>
            )}
          </div>
          {wrongCompany && (
            <div className="mt-3 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
              This property is sold by {companyName || 'another company'}, and your account is with a different company.{' '}
              <Link to={registrationUrl(null)} className="font-semibold underline">Create a {companyName || 'new'} account to buy it</Link>.
            </div>
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
                    <th className="px-4 py-2 text-right font-semibold text-slate-600">Available</th>
                    <th className="px-4 py-2 text-right font-semibold text-slate-600">Property Size</th>
                    <th className="px-4 py-2 text-left font-semibold text-slate-600">Measured In</th>
                    <th className="px-4 py-2 text-right font-semibold text-slate-600">Price</th>
                    <th className="px-4 py-2 text-left font-semibold text-slate-600">Status</th>
                    <th className="px-4 py-2 text-left font-semibold text-slate-600">Payment</th>
                    <th className="px-4 py-2 text-right font-semibold text-slate-600"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {unitConfigs.map((unit, index) => (
                    <tr key={unit.id ?? index}>
                      <td className="px-4 py-2 font-medium text-slate-900">{unit.name || '—'}</td>
                      {/* Units already secured by other buyers' payments are not on offer. */}
                      <td className="px-4 py-2 text-right text-slate-700">{unit.quantity_available ?? unit.quantity ?? '—'}</td>
                      <td className="px-4 py-2 text-right text-slate-700">{unit.size ? Number(unit.size).toLocaleString() : '—'}</td>
                      <td className="px-4 py-2 text-slate-700">{unit.unit || 'sqm'}</td>
                      <td className="px-4 py-2 text-right font-medium text-slate-900">{formatPrice(unit.price) || "—"}</td>
                      <td className="px-4 py-2 text-slate-500">{enumLabel(unit.status || 'available')}</td>
                      <td className="px-4 py-2 text-slate-600">
                        {unit.plans > 0 ? (
                          <>
                            Outright or {unit.plans} plan{unit.plans === 1 ? '' : 's'}
                            {unit.min_monthly && <span className="block text-xs text-slate-500">from {formatPrice(unit.min_monthly)} / mo</span>}
                          </>
                        ) : 'Outright'}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {!isRealtor && (
                          <Button type="button" size="sm" onClick={() => handlePurchase(unit.id)}>
                            Purchase
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

        {/* What happens after "Purchase", so pressing it is not a leap in the dark. */}
        {!isRealtor && (
          <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">How buying works</h2>
            <ol className="grid gap-3 sm:grid-cols-3">
              {[
                ['Press Purchase', accessToken ? 'You go straight to the purchase screen.' : 'Create a free account — you are signed in straight away.'],
                ['Choose your unit', plans?.plans ? 'Pick the unit and quantity, and pay outright or over an installment plan.' : 'Pick the unit and quantity; your invoice is raised at once.'],
                ['Pay and upload proof', 'Your payment is reviewed, and your receipt and documents appear in your account.'],
              ].map(([title, body], index) => (
                <li key={title} className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">{index + 1}</span>
                  <p className="mt-2 text-sm font-bold text-slate-900">{title}</p>
                  <p className="mt-0.5 text-xs text-slate-600">{body}</p>
                </li>
              ))}
            </ol>
          </section>
        )}

        <p className="pb-4 text-center text-xs text-slate-400">
          Shared property listing — details are subject to change. ·{' '}
          <Link to={property.company_code ? `/help?c=${encodeURIComponent(property.company_code)}` : '/help'} className="font-semibold hover:underline">
            Help &amp; FAQ
          </Link>
        </p>
      </div>
    </div>
  );
}

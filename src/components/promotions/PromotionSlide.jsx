import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Tag } from 'lucide-react';
import Button from '../ui/Button';
import useAuthStore from '../../store/authStore';
import useMyVerification from '../../hooks/useMyVerification';
import useShareToken from '../../hooks/useShareToken';
import { getPropertyShareLink } from '../../api/propertyApi';
import { publicUrlFor } from '../common/PublicLinkPanel';

/**
 * One advertised property: the photograph, the offer underneath, and the one
 * thing this person would do about it.
 *
 * ── The action differs by who is looking ────────────────────────────────────
 *
 *   client  → Buy now, straight into the purchase flow with this property
 *             already chosen. A buyer who has just been shown a specific offer
 *             on a specific property should not land on a list and search for
 *             it again.
 *   realtor → Share link, the same referral-carrying property link the Listed
 *             Properties screen mints, because a realtor's response to an offer
 *             is to put it in front of a client rather than to buy it.
 *
 * Shared by the carousel and the modal so the two can never drift into saying
 * different things about the same campaign.
 */
export default function PromotionSlide({ slide, onActioned }) {
  const navigate = useNavigate();
  const effectiveType = useAuthStore((state) => state.effectiveType());
  const isRealtor = effectiveType === 'realtor';
  const verification = useMyVerification();
  const { token: sealedToken, code: shortCode } = useShareToken();

  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const property = slide.property || {};
  const place = [property.city, property.state].filter(Boolean).join(', ');

  const buyNow = () => {
    onActioned?.();
    /*
     * `buy=1` is what makes "already selected" true: the detail page opens its
     * purchase modal on arrival, so the advert's promise is kept in one step
     * rather than landing the buyer on a page with a button still to find.
     */
    navigate(`/properties/listed/${property.id}?buy=1`);
  };

  const share = async () => {
    if (sharing) return;
    setSharing(true);
    setError('');
    try {
      const data = (await getPropertyShareLink(property.id))?.data ?? {};
      if (!data.public_token) throw new Error('No share link was returned.');
      // Same argument order as the Listed Properties screen: data.code is this
      // realtor's own short code for this property and already names them.
      const url = publicUrlFor(
        data.public_token, data.company_code, data.realtor_code,
        shortCode || sealedToken, data.code,
      );
      if (navigator.share) {
        try {
          await navigator.share({ title: property.name, url });
          onActioned?.();
          return;
        } catch { /* dismissed — fall through to the copy box */ }
      }
      setShareUrl(url);
    } catch (err) {
      setError(err?.userMessage || 'Could not create a share link for this property.');
    } finally {
      setSharing(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { setCopied(false); }
  };

  return (
    <div className="flex h-full flex-col">
      {/* ── The photograph ── */}
      <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-slate-100 sm:aspect-[21/9]">
        <img src={slide.image} alt={property.name || 'Promoted property'} className="h-full w-full object-cover" />
        {slide.benefit_label && (
          <span className="absolute left-3 top-3 rounded-full bg-rose-600 px-3 py-1 text-xs font-bold text-white shadow-lg">
            {slide.benefit_label}
          </span>
        )}
      </div>

      {/* ── The offer ── */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-4">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-slate-900">{property.name}</h3>
          {place && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
              <MapPin size={12} className="shrink-0" /> {place}
            </p>
          )}
        </div>

        <div className="min-w-0 rounded-lg bg-amber-50 px-3 py-2 ring-1 ring-amber-200">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-900">
            <Tag size={13} className="shrink-0" /> {slide.name}
          </p>
          {(slide.customer_message || slide.description) && (
            <p className="mt-1 text-xs leading-relaxed text-amber-800">
              {slide.customer_message || slide.description}
            </p>
          )}
          {slide.ends_at && (
            <p className="mt-1 text-[11px] font-medium text-amber-700">
              Ends {new Date(slide.ends_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}
        </div>

        {slide.terms && <p className="text-[11px] leading-snug text-slate-400">{slide.terms}</p>}

        {error && <p className="text-xs text-rose-600">{error}</p>}

        {/* An unverified realtor cannot mint a share link at all, so the button
            is replaced by the reason rather than failing when pressed. */}
        {isRealtor && verification.blocked ? (
          <p className="mt-auto rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 ring-1 ring-slate-200">
            Verify your identity to share properties with clients.
          </p>
        ) : shareUrl ? (
          <div className="mt-auto flex items-center gap-2">
            <input
              readOnly
              value={shareUrl}
              onFocus={(e) => e.target.select()}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-50 px-2 py-1.5 font-mono text-[11px]"
            />
            <Button type="button" size="sm" onClick={copy}>{copied ? 'Copied ✓' : 'Copy'}</Button>
          </div>
        ) : (
          <div className="mt-auto pt-1">
            {isRealtor ? (
              <Button type="button" onClick={share} disabled={sharing} className="w-full sm:w-auto">
                {sharing ? 'Creating link…' : 'Share link'}
              </Button>
            ) : (
              <Button type="button" onClick={buyNow} className="w-full sm:w-auto">Buy now</Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

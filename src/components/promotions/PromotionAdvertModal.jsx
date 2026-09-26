import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import PromotionSlide from './PromotionSlide';
import { ADVERT_SURFACES, dismissAdvert, isAdvertDismissed } from '../../lib/advertDismissal';

/**
 * The offer that greets a client or realtor on arrival, centred on the screen.
 *
 * ── Why it shows once per sign-in ───────────────────────────────────────────
 *
 * Dismissal is stored per session and cleared when a session begins, so this
 * appears after signing in and then not again until the next sign-in — not on
 * every dashboard visit, and not once and never more. A modal that returns on
 * each navigation would make the app unusable; one dismissed for ever could
 * never mention the next campaign.
 *
 * ── Why it is one slide and not the carousel ────────────────────────────────
 *
 * This interrupts somebody, so it earns the interruption with the single
 * highest-priority offer (the server orders by the administrator's own
 * priority) and gets out of the way. Browsing the rest is what the carousel on
 * the page behind it is for, and "Show me everything" leads straight to it.
 */
export default function PromotionAdvertModal({ slides = [] }) {
  const [closed, setClosed] = useState(() => isAdvertDismissed(ADVERT_SURFACES.MODAL));

  const open = !closed && slides.length > 0;
  const slide = slides[0];

  const close = () => {
    dismissAdvert(ADVERT_SURFACES.MODAL);
    setClosed(true);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Special offer"
      onClick={close}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close offer"
          className="absolute right-2 top-2 z-20 rounded-full bg-black/55 p-1.5 text-white transition hover:bg-black/75"
        >
          <X size={16} />
        </button>

        {/* Acting on the offer closes the advert too — following Buy now and
            then finding it still waiting on the way back reads as a bug. */}
        <PromotionSlide slide={slide} onActioned={close} />

        {slides.length > 1 && (
          <p className="border-t border-slate-100 px-4 py-2.5 text-center text-xs text-slate-500">
            {slides.length - 1} more offer{slides.length - 1 === 1 ? '' : 's'} below on your dashboard
          </p>
        )}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import PromotionSlide from './PromotionSlide';
import { ADVERT_SURFACES, dismissAdvert, isAdvertDismissed } from '../../lib/advertDismissal';

/** How long a slide holds before advancing, when nobody is interacting. */
const DWELL_MS = 6000;

/**
 * The promoted-properties carousel that sits at the top of a client's or
 * realtor's dashboard.
 *
 * ── Closing it means closing it ─────────────────────────────────────────────
 *
 * The close button is always visible, never on hover, and dismissal lasts the
 * whole session — see lib/advertDismissal. An advert that reappears on the next
 * navigation is one people learn to scroll past.
 *
 * ── It advances on its own, but not while you are reading ───────────────────
 *
 * Auto-advance pauses on hover, on focus, and once somebody has used the dots
 * or arrows: taking over the controls is a clear statement that the timer is no
 * longer welcome. It also stops entirely with a single slide, where rotating
 * would only redraw the same picture.
 */
export default function PromotionAdvertCarousel({ slides = [] }) {
  const [closed, setClosed] = useState(() => isAdvertDismissed(ADVERT_SURFACES.CAROUSEL));
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const takenOver = useRef(false);

  const count = slides.length;
  const go = useCallback((next) => setIndex(((next % count) + count) % count), [count]);

  useEffect(() => {
    if (closed || paused || takenOver.current || count < 2) return undefined;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), DWELL_MS);
    return () => clearInterval(id);
  }, [closed, paused, count]);

  // A campaign ending while the page is open must not leave the view on a slide
  // that no longer exists.
  useEffect(() => { if (index >= count && count) setIndex(0); }, [count, index]);

  if (closed || !count) return null;

  const close = () => {
    dismissAdvert(ADVERT_SURFACES.CAROUSEL);
    setClosed(true);
  };

  const step = (delta) => { takenOver.current = true; go(index + delta); };

  return (
    <section
      aria-label="Current property offers"
      className="relative overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <button
        type="button"
        onClick={close}
        aria-label="Close offers"
        className="absolute right-2 top-2 z-20 rounded-full bg-black/55 p-1.5 text-white transition hover:bg-black/75"
      >
        <X size={15} />
      </button>

      <PromotionSlide key={`${slides[index].promotion_id}-${slides[index].property?.id}`} slide={slides[index]} />

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Previous offer"
            className="absolute left-2 top-[28%] z-10 rounded-full bg-black/45 p-2 text-white transition hover:bg-black/70"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Next offer"
            className="absolute right-2 top-[28%] z-10 rounded-full bg-black/45 p-2 text-white transition hover:bg-black/70"
          >
            ›
          </button>
          <div className="flex justify-center gap-1.5 pb-3">
            {slides.map((slide, i) => (
              <button
                key={`${slide.promotion_id}-${slide.property?.id}`}
                type="button"
                onClick={() => { takenOver.current = true; setIndex(i); }}
                aria-label={`Offer ${i + 1} of ${count}`}
                aria-current={i === index}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? 'w-5 bg-slate-800' : 'w-1.5 bg-slate-300 hover:bg-slate-400'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

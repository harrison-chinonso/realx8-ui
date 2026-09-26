import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveMedia } from '../../utils/mediaUrl';
import { safeHref } from '../../utils/safeHref';

/**
 * Full-screen viewer for a property's media, in the app rather than a new tab.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * Photos and videos used to be plain links with target="_blank". On a desktop
 * that is merely abrupt; on a phone it drops the person into a separate browser
 * tab showing one bare image, with no way back but the OS back gesture — and
 * nothing to move to the next picture, so viewing eight photographs meant eight
 * round trips out of the app and back.
 *
 * So: one modal, opened on the item that was tapped, holding the WHOLE set.
 * Once open, next/previous move through the set without closing, which is the
 * behaviour the gallery always implied.
 *
 * ── Getting back to the app ─────────────────────────────────────────────────
 *
 * Deliberately easy, because that was the complaint. Escape, the close button,
 * a tap on the backdrop, and the hardware/browser Back button all dismiss it —
 * Back is wired through a history entry so the phone gesture people reach for
 * first closes the viewer instead of leaving the page. Focus returns to
 * whatever opened it, and the page behind never scrolls while it is up.
 *
 * Props:
 *   items    — [{ url, type, name }] (a plain URL string also works)
 *   index    — index of the item to show; null/undefined means closed
 *   onIndex  — called with the new index when the viewer moves
 *   onClose  — called when the viewer is dismissed
 */
export default function MediaLightbox({ items = [], index, onIndex, onClose }) {
  const open = index !== null && index !== undefined && items.length > 0;
  const openerRef = useRef(null);
  const touchStartRef = useRef(null);
  const [zoomed, setZoomed] = useState(false);

  const count = items.length;
  const safeIndex = open ? Math.min(Math.max(index, 0), count - 1) : 0;
  const item = open ? items[safeIndex] : null;
  const normalised = typeof item === 'string' ? { url: item } : (item || {});
  const media = open ? resolveMedia(normalised.url, normalised.type) : null;

  const go = useCallback((delta) => {
    if (count < 2) return;
    setZoomed(false);
    // Wraps, so the last "next" returns to the first rather than dead-ending.
    onIndex?.((safeIndex + delta + count) % count);
  }, [count, onIndex, safeIndex]);

  // Remember what had focus so it can be handed back on close.
  useEffect(() => {
    if (open) openerRef.current = document.activeElement;
  }, [open]);

  /*
   * A phone's back gesture is the most natural "get me out of here", and
   * without this it would leave the property page altogether. Pushing one
   * history entry while the viewer is open turns that gesture into a close.
   *
   * onClose is read through a ref so this effect depends on `open` ALONE.
   * Callers pass it as an inline arrow, which is a new function on every
   * render, so depending on it directly would tear down and re-run this on
   * every re-render — pushing a fresh history entry each time the carousel
   * advanced, and burying the page under one Back press per photo viewed.
   */
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    window.history.pushState({ lightbox: true }, '');
    const onPop = () => closeRef.current?.();
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      // Only unwind the entry we added. If a pop is what closed us it is
      // already gone, and if a route change unmounted us the top of the stack
      // belongs to the router — going back either time would navigate the app.
      if (window.history.state?.lightbox) window.history.back();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose?.(); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); go(1); }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); go(-1); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, go, onClose]);

  // Freeze the page behind, so a swipe on the photo does not scroll the
  // property page underneath it.
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
      const opener = openerRef.current;
      if (opener && typeof opener.focus === 'function') opener.focus();
    };
  }, [open]);

  if (!open) return null;

  const onTouchStart = (event) => {
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const onTouchEnd = (event) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || zoomed) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    // Horizontal intent only: a mostly-vertical drag is a scroll or a dismiss
    // attempt, not a request for the next photograph.
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
    go(dx < 0 ? 1 : -1);
  };

  const label = normalised.name || media.provider || `Item ${safeIndex + 1}`;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Media viewer, ${safeIndex + 1} of ${count}`}
      onClick={onClose}
    >
      {/* ── Top bar: what you are looking at, and the way out ── */}
      <div
        className="flex shrink-0 items-center justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{label}</p>
          {count > 1 && <p className="text-xs text-white/50">{safeIndex + 1} of {count}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close viewer"
          className="-mr-1 shrink-0 rounded-full bg-white/10 p-2.5 text-white transition-colors hover:bg-white/25 active:bg-white/30"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* ── Stage ── */}
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-4"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {count > 1 && (
          <NavButton side="left" onClick={(e) => { e.stopPropagation(); go(-1); }} />
        )}

        <div
          className="flex max-h-full w-full max-w-5xl items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          {media.kind === 'embed' ? (
            <div className="relative w-full overflow-hidden rounded-xl bg-black" style={{ aspectRatio: '16 / 9' }}>
              <iframe
                // Keyed on src so moving to another video tears the old iframe
                // down; without it the previous one keeps playing behind.
                key={media.src}
                src={media.src}
                title={label}
                className="absolute inset-0 h-full w-full"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
              />
            </div>
          ) : media.kind === 'video' ? (
            <video
              key={media.src}
              src={media.src}
              controls
              autoPlay
              playsInline
              className="max-h-[70vh] w-full rounded-xl bg-black"
            />
          ) : (
            <img
              key={media.src}
              src={media.src}
              alt={label}
              onClick={() => setZoomed((z) => !z)}
              className={`max-h-[70vh] w-auto max-w-full select-none rounded-xl object-contain transition-transform duration-200 ${
                zoomed ? 'scale-150 cursor-zoom-out' : 'cursor-zoom-in'
              }`}
              draggable={false}
            />
          )}
        </div>

        {count > 1 && (
          <NavButton side="right" onClick={(e) => { e.stopPropagation(); go(1); }} />
        )}
      </div>

      {/* ── Filmstrip: jump straight to any item without closing ── */}
      <div
        className="shrink-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3"
        onClick={(e) => e.stopPropagation()}
      >
        {count > 1 && (
          <div className="mx-auto mb-3 flex max-w-full gap-2 overflow-x-auto pb-1">
            {items.map((entry, i) => {
              const thumbSource = typeof entry === 'string' ? { url: entry } : entry;
              const thumb = resolveMedia(thumbSource.url, thumbSource.type);
              const preview = thumb.kind === 'image' ? thumb.src : thumb.poster;
              return (
                <button
                  key={`${thumbSource.url}-${i}`}
                  type="button"
                  onClick={() => { setZoomed(false); onIndex?.(i); }}
                  aria-label={`View item ${i + 1}`}
                  aria-current={i === safeIndex}
                  className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg ring-2 transition ${
                    i === safeIndex ? 'ring-white' : 'ring-transparent opacity-50 hover:opacity-90'
                  }`}
                >
                  {preview ? (
                    <img src={preview} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-slate-700 text-white/70">
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
        <div className="text-center">
          {/*
            media.page, not media.src and not the stored url. For a provider
            video src is the iframe address, which YouTube will not serve as a
            page (error 153) — and the stored url is whatever somebody pasted,
            which may be that same embed address.
          */}
          <a
            href={safeHref(media.page || normalised.url) ?? undefined}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-white/40 underline transition-colors hover:text-white/80"
          >
            Open original ↗
          </a>
        </div>
      </div>
    </div>
  );
}

/** Big enough to hit with a thumb, and out of the way of the picture. */
function NavButton({ side, onClick }) {
  const isLeft = side === 'left';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isLeft ? 'Previous' : 'Next'}
      className={`absolute top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-3 text-white ring-1 ring-white/20 transition hover:bg-black/70 active:scale-95 ${
        isLeft ? 'left-2 sm:left-4' : 'right-2 sm:right-4'
      }`}
    >
      <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d={isLeft ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} />
      </svg>
    </button>
  );
}

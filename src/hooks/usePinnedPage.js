import { useEffect } from 'react';

const isEditable = (el) => !!el && (
  el.isContentEditable
  || el.tagName === 'TEXTAREA'
  || el.tagName === 'SELECT'
  || (el.tagName === 'INPUT' && !['button', 'checkbox', 'radio', 'submit', 'reset', 'file', 'range', 'color'].includes(el.type))
);

/**
 * Keeps the page itself at the top while a signed-in layout is on screen.
 *
 * The layouts are exactly as tall as the visible screen and scroll inside
 * their own content area, so the page under them should never move. On a
 * phone it still can: the keyboard opening for a field (a payment form, say)
 * scrolls the page to keep the field in view and leaves it there when the
 * keyboard closes, and the header goes with it — with no gesture that brings
 * it back, because every drag lands on the content area instead.
 *
 * While someone is typing the page is left alone (the field has to stay
 * visible above the keyboard); the moment they are not, it goes back to 0.
 */
export default function usePinnedPage() {
  useEffect(() => {
    let frame = 0;
    const settle = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (isEditable(document.activeElement)) return;
        if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0);
      });
    };
    // focusout fires before the next element takes focus; wait a tick so
    // moving between two fields does not snap the page in between.
    const onFocusOut = () => setTimeout(settle, 50);

    settle();
    window.addEventListener('scroll', settle, { passive: true });
    window.addEventListener('focusout', onFocusOut);
    window.addEventListener('pageshow', settle);
    window.visualViewport?.addEventListener('resize', settle);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', settle);
      window.removeEventListener('focusout', onFocusOut);
      window.removeEventListener('pageshow', settle);
      window.visualViewport?.removeEventListener('resize', settle);
    };
  }, []);
}

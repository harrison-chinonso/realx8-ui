import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Makes a fixed-position element draggable, and remembers where it was put.
 *
 * Written for the assistant widget, which floats above everything at the
 * bottom-right and therefore sometimes sits on top of the thing somebody is
 * trying to click. Letting them move it is the direct answer; widening the
 * targets underneath is the other half, and both are worth having.
 *
 * ── Pointer events, not mouse events ────────────────────────────────────────
 *
 * One set of handlers covers mouse, touch and pen. `setPointerCapture` is what
 * makes a drag survive the pointer leaving the element — without it, moving
 * faster than React re-renders drops the drag, which feels like the widget
 * sticking.
 *
 * ── Why a drag is distinguished from a click ────────────────────────────────
 *
 * The launcher is a button: it must still open the assistant when tapped. So
 * movement is measured, and only past a few pixels does it become a drag —
 * below that it is a click and the handler runs as normal. Without that
 * threshold every open would also nudge the widget a pixel, and every tap on a
 * touchscreen would be a tiny drag.
 */

/** Movement, in pixels, before a press counts as a drag rather than a click. */
const DRAG_THRESHOLD = 4;

/** Keeps the element on screen when the window is smaller than it was. */
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export default function useDraggable({ storageKey, size = { width: 56, height: 56 }, margin = 20 }) {
  const ref = useRef(null);
  const [position, setPosition] = useState(null);   // null = wherever CSS puts it
  const [dragging, setDragging] = useState(false);
  const origin = useRef(null);
  const moved = useRef(false);

  // Restore a remembered position, clamped to the CURRENT viewport — a window
  // that has since been made narrower must not strand the widget off-screen.
  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) || 'null');
      if (!saved || typeof saved.left !== 'number') return;
      setPosition({
        left: clamp(saved.left, margin, Math.max(window.innerWidth - size.width - margin, margin)),
        top: clamp(saved.top, margin, Math.max(window.innerHeight - size.height - margin, margin)),
      });
    } catch {
      // A corrupt entry just means the default corner.
    }
  }, [storageKey, size.width, size.height, margin]);

  // And again whenever the window changes, for the same reason.
  useEffect(() => {
    if (!position) return undefined;
    const onResize = () => setPosition((current) => (current ? {
      left: clamp(current.left, margin, Math.max(window.innerWidth - size.width - margin, margin)),
      top: clamp(current.top, margin, Math.max(window.innerHeight - size.height - margin, margin)),
    } : current));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [position, size.width, size.height, margin]);

  const onPointerDown = useCallback((event) => {
    // Primary button only; a right-click should open the context menu.
    if (event.button !== undefined && event.button !== 0) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;

    origin.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      left: rect.left,
      top: rect.top,
    };
    moved.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, []);

  const onPointerMove = useCallback((event) => {
    if (!origin.current) return;
    const dx = event.clientX - origin.current.pointerX;
    const dy = event.clientY - origin.current.pointerY;

    if (!moved.current && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    moved.current = true;
    setDragging(true);

    const width = ref.current?.offsetWidth || size.width;
    const height = ref.current?.offsetHeight || size.height;

    setPosition({
      left: clamp(origin.current.left + dx, margin, Math.max(window.innerWidth - width - margin, margin)),
      top: clamp(origin.current.top + dy, margin, Math.max(window.innerHeight - height - margin, margin)),
    });
  }, [margin, size.width, size.height]);

  const onPointerUp = useCallback((event) => {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    origin.current = null;

    if (moved.current && storageKey && position) {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(position));
      } catch {
        // Private browsing, a full quota — the widget simply forgets.
      }
    }
    // Cleared on the next tick so the click handler that fires immediately
    // after pointerup can still see that this was a drag and ignore itself.
    setTimeout(() => { moved.current = false; setDragging(false); }, 0);
  }, [position, storageKey]);

  /** True while the press that is ending was a drag, so a click can bow out. */
  const wasDragged = useCallback(() => moved.current, []);

  /** Back to the corner CSS puts it in. */
  const reset = useCallback(() => {
    setPosition(null);
    try {
      if (storageKey) window.localStorage.removeItem(storageKey);
    } catch { /* nothing to undo */ }
  }, [storageKey]);

  return {
    ref,
    dragging,
    wasDragged,
    reset,
    /** Spread onto the draggable element. */
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
    /**
     * Spread onto `style`. Empty until the thing has been moved, so the
     * element keeps whatever corner its classes give it — a widget that jumped
     * to a computed position on first paint would flicker for every user who
     * has never dragged it.
     */
    style: position ? { left: position.left, top: position.top, right: 'auto', bottom: 'auto' } : {},
    moved: position !== null,
  };
}

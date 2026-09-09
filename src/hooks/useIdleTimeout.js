import { useEffect, useRef, useCallback } from 'react';

const IDLE_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

/**
 * Calls `onIdle` after `idleMs` of inactivity.
 * Calls `onWarning` at `(idleMs - warningMs)` to allow a pre-logout warning.
 * Only runs when `enabled` is true (i.e. user is logged in).
 *
 * Callbacks are stored in refs so they never appear as deps of resetTimers —
 * this prevents every re-render from restarting the countdown.
 */
export default function useIdleTimeout({
  onIdle,
  onWarning,
  onActivity,
  idleMs = 10 * 60 * 1000,
  warningMs = 60 * 1000,
  enabled = true,
}) {
  const idleTimer = useRef(null);
  const warnTimer = useRef(null);

  // Keep latest callbacks in refs — updating them never triggers re-renders or effect re-runs
  const onIdleRef = useRef(onIdle);
  const onWarningRef = useRef(onWarning);
  const onActivityRef = useRef(onActivity);
  useEffect(() => { onIdleRef.current = onIdle; });
  useEffect(() => { onWarningRef.current = onWarning; });
  useEffect(() => { onActivityRef.current = onActivity; });

  const clearTimers = useCallback(() => {
    clearTimeout(idleTimer.current);
    clearTimeout(warnTimer.current);
  }, []);

  // resetTimers only depends on stable values — NOT on the callbacks
  const resetTimers = useCallback(() => {
    clearTimers();
    if (!enabled) return;
    onActivityRef.current?.();
    warnTimer.current = setTimeout(() => onWarningRef.current?.(), idleMs - warningMs);
    idleTimer.current = setTimeout(() => onIdleRef.current?.(), idleMs);
  }, [clearTimers, enabled, idleMs, warningMs]);

  useEffect(() => {
    if (!enabled) {
      clearTimers();
      return;
    }

    resetTimers();
    IDLE_EVENTS.forEach((evt) => window.addEventListener(evt, resetTimers, { passive: true }));

    return () => {
      clearTimers();
      IDLE_EVENTS.forEach((evt) => window.removeEventListener(evt, resetTimers));
    };
  }, [enabled, resetTimers, clearTimers]);
}

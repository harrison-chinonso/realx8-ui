import { useEffect } from 'react';
import client from '../api/client';
import useAuthStore from '../store/authStore';

/**
 * Phone notifications inside the native app (Realx8-Mobile).
 *
 * The app's shell can get the phone's push token but has no session to send
 * it with; this page has the session but no way to get the token. So the page
 * asks the shell (`push.register`), the shell answers with a
 * `realx8native:push-token` window event, and the page registers it with
 * Realx8-Core under the person signed in now.
 *
 * Kept in memory only: the session's storage is wiped on every sign-in
 * (clearBrowserState), and the shell hands the token over again on each load.
 */
let current = null;

const shell = () => (typeof window !== 'undefined' ? window.Realx8Native : null);

export function registerNativeDevice() {
  const native = shell();
  if (!native || !(native.bridgeVersion >= 1)) return;

  const onToken = (event) => {
    window.removeEventListener('realx8native:push-token', onToken);
    const device = event.detail;
    // Null when the person declined notifications, or on a simulator.
    if (!device?.token) return;
    current = device;
    client.post('/notifications/devices', device).catch(() => {
      // Not worth interrupting anybody over: the next launch registers again.
    });
  };
  window.addEventListener('realx8native:push-token', onToken);
  native.postMessage({ type: 'push.register' });
}

/**
 * Called on sign-out, BEFORE the session is cleared, so the next person to use
 * this phone does not receive this one's notifications. The bearer token is
 * passed explicitly: by the time the request is sent the store is empty.
 */
export function forgetNativeDevice(accessToken) {
  if (!current?.token || !accessToken) return;
  const { token } = current;
  current = null;
  client.delete('/notifications/devices', {
    data: { token },
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch(() => {});
}

/** Registers once per signed-in account, and again when the account changes. */
export function useNativeDeviceRegistration() {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const companyId = useAuthStore((state) => state.company_id ?? null);
  useEffect(() => {
    if (userId) registerNativeDevice();
  }, [userId, companyId]);
}

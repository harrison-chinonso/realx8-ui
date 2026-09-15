import { useCallback, useEffect, useState } from 'react';
import { enablePush, disablePush, isSubscribedHere, pushPermission } from '../../utils/browserPush';
import { pushTest } from '../../api/pushApi';
import Button from '../ui/Button';

/**
 * Turning browser notifications on for THIS browser.
 *
 * ── Why it is per browser, and says so ──────────────────────────────────────
 *
 * A push subscription belongs to a browser on a device, so somebody with a
 * laptop and a phone has to turn it on twice. That surprises people — they
 * expect an account setting — so the card states it rather than leaving them
 * to work out why their phone stayed quiet.
 *
 * ── "Blocked" is not "off" ──────────────────────────────────────────────────
 *
 * A browser told to block this site will never show the prompt again, however
 * many times we ask. Offering "turn on" there is a button that cannot work, so
 * the card explains where the setting actually lives instead.
 */

const STATE_COPY = {
  unsupported: {
    title: 'Not available in this browser',
    detail: 'This browser cannot show push notifications. Try a recent Chrome, Edge, Firefox or Safari.',
  },
  insecure: {
    title: 'Needs a secure connection',
    // The fix is a certificate, not a browser — named separately from
    // "unsupported", which would send somebody looking in the wrong place.
    detail: 'Browser notifications only work over https. On localhost they work as they are.',
  },
  denied: {
    title: 'Blocked for this site',
    detail: 'You have blocked notifications here. Allow them in your browser’s site settings — usually the icon at the left of the address bar — and then come back.',
  },
  unavailable: {
    title: 'Not set up on this server',
    detail: 'The platform has no notification keys yet. An administrator can fix this by restarting the notification service.',
  },
};

export default function BrowserNotificationsCard() {
  const [state, setState] = useState(() => pushPermission());
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const refresh = useCallback(async () => {
    setState(pushPermission());
    setSubscribed(await isSubscribedHere());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const turnOn = async () => {
    setBusy(true);
    setMessage(null);
    const result = await enablePush();
    setMessage({ tone: result.ok ? 'success' : 'error', text: result.message });
    if (result.state) setState(result.state);
    await refresh();
    setBusy(false);
  };

  const turnOff = async () => {
    setBusy(true);
    setMessage(null);
    const result = await disablePush();
    setMessage({ tone: result.ok ? 'success' : 'error', text: result.message });
    await refresh();
    setBusy(false);
  };

  const test = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await pushTest();
      setMessage({
        tone: 'success',
        text: result.sent
          ? `Sent to ${result.sent} ${result.sent === 1 ? 'browser' : 'browsers'}. It should appear in a moment.`
          : 'Nothing was sent — this browser may no longer be registered.',
      });
    } catch (error) {
      setMessage({
        tone: 'error',
        text: error?.response?.data?.message || 'The test could not be sent.',
      });
    } finally {
      setBusy(false);
    }
  };

  const blocked = STATE_COPY[state];

  return (
    <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div>
        <h2 className="text-base font-semibold text-slate-800">Browser notifications</h2>
        <p className="mt-1 text-sm text-slate-500">
          Alerts that reach you when the application is closed.{' '}
          {/*
            Said plainly, because people expect an account setting and are then
            puzzled that their phone stayed silent.
          */}
          This is per browser — turn it on again on any other device you use.
        </p>
      </div>

      {blocked ? (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
          <span className="font-semibold">{blocked.title}.</span> {blocked.detail}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {subscribed ? (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
                On for this browser
              </span>
              <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={test}>
                Send a test
              </Button>
              <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={turnOff}>
                Turn off
              </Button>
            </>
          ) : (
            <Button type="button" disabled={busy} onClick={turnOn}>
              {busy ? 'Working…' : 'Turn on for this browser'}
            </Button>
          )}
        </div>
      )}

      {message && (
        <p className={`rounded-lg px-3 py-2 text-sm ${
          message.tone === 'success'
            ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
            : 'bg-rose-50 text-rose-800 ring-1 ring-rose-200'
        }`}>
          {message.text}
        </p>
      )}
    </section>
  );
}

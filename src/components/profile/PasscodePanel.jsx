import { useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { getPasscodeStatus, removePasscode, setPasscode } from '../../api/authApi';
import useAuthStore from '../../store/authStore';
import { updateKnownAccount } from '../../lib/knownAccount';
import Button from '../ui/Button';
import Input from '../ui/Input';
import FieldMark from '../ui/FieldMark';

/**
 * Setting up the 6-digit passcode — the quick way back in.
 *
 * The passcode only works for two hours after a full sign-in (password, and
 * two-factor where it is on), and never replaces either: it is for coming
 * back to the app shortly after, on a device you have already signed in on.
 * Setting or changing it needs the current password, so a session left open
 * on somebody's desk cannot be given a passcode by whoever finds it.
 */

const DIGITS = /^\d{6}$/;
const sixDigits = (value) => value.replace(/\D/g, '').slice(0, 6);

export default function PasscodePanel() {
  const user = useAuthStore((state) => state.user);
  const setSession = useAuthStore((state) => state.setSession);
  const accessToken = useAuthStore((state) => state.accessToken);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const permissions = useAuthStore((state) => state.permissions);

  const [status, setStatus] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ passcode: '', confirm: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const load = () => getPasscodeStatus().then(setStatus).catch(() => setStatus(null));
  useEffect(() => { load(); }, []);

  // The server's answer carries the refreshed user; keep the session and this
  // device's remembered account in step with it.
  const applyUser = (nextUser, isSet) => {
    if (nextUser) setSession({ user: { ...nextUser, permissions }, accessToken, refreshToken });
    updateKnownAccount(user?.email, { passcode_set: isSet });
  };

  const save = async (event) => {
    event.preventDefault();
    setMessage(null);
    if (!DIGITS.test(form.passcode)) { setMessage({ type: 'error', text: 'Your passcode must be exactly 6 digits.' }); return; }
    if (form.passcode !== form.confirm) { setMessage({ type: 'error', text: 'The two passcodes do not match.' }); return; }
    if (!form.password) { setMessage({ type: 'error', text: 'Enter your current password to confirm it is you.' }); return; }
    setBusy(true);
    try {
      const res = await setPasscode({ passcode: form.passcode, password: form.password });
      applyUser(res.user, true);
      setForm({ passcode: '', confirm: '', password: '' });
      setEditing(false);
      setMessage({ type: 'success', text: res.message || 'Passcode set.' });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || err.userMessage || 'Could not set your passcode.' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
     
    if (!window.confirm('Remove your passcode? You will sign in with your password every time.')) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await removePasscode();
      applyUser(res.user, false);
      setMessage({ type: 'success', text: res.message || 'Passcode removed.' });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || err.userMessage || 'Could not remove your passcode.' });
    } finally {
      setBusy(false);
    }
  };

  const isSet = Boolean(status?.passcode_set);
  const hours = status?.window_hours || 2;

  return (
    <section className="space-y-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <KeyRound size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-slate-900">Passcode</h2>
          <p className="mt-1 text-sm text-slate-600">
            A 6-digit code to get back in quickly on a device you have already signed in on — for {hours} hours
            after you sign in with your password. Your password still works at any time.
          </p>
          {status && (
            <p className="mt-2 text-sm">
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${isSet ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                {isSet ? 'On' : 'Not set'}
              </span>
              {isSet && (
                <span className="ml-2 text-slate-600">
                  {status.usable_now
                    ? 'You can use it on this sign-in.'
                    : status.locked_until && new Date(status.locked_until) > new Date()
                      ? 'Locked for a few minutes after too many wrong attempts.'
                      : `It starts working again for ${hours} hours after your next password sign-in.`}
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {message && (
        <div className={`rounded-lg p-3 text-sm ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`} role="status">
          {message.text}
        </div>
      )}

      {editing ? (
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="new-passcode" className="mb-1 block text-sm font-medium">New passcode<FieldMark required /></label>
              <Input
                id="new-passcode"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                value={form.passcode}
                onChange={(e) => setForm({ ...form, passcode: sixDigits(e.target.value) })}
                placeholder="6 digits"
                className="font-mono tracking-[0.4em]"
              />
            </div>
            <div>
              <label htmlFor="confirm-passcode" className="mb-1 block text-sm font-medium">Confirm passcode<FieldMark required /></label>
              <Input
                id="confirm-passcode"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: sixDigits(e.target.value) })}
                placeholder="6 digits"
                className="font-mono tracking-[0.4em]"
              />
            </div>
          </div>
          <p className="text-xs text-slate-500">Avoid repeated digits and simple sequences such as 123456 — they are refused.</p>
          <div>
            <label htmlFor="passcode-password" className="mb-1 block text-sm font-medium">Current password<FieldMark required /></label>
            <Input
              id="passcode-password"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}>{busy ? 'Saving…' : (isSet ? 'Change passcode' : 'Set passcode')}</Button>
            <Button type="button" variant="secondary" disabled={busy} onClick={() => { setEditing(false); setMessage(null); setForm({ passcode: '', confirm: '', password: '' }); }}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => { setEditing(true); setMessage(null); }}>{isSet ? 'Change passcode' : 'Set up a passcode'}</Button>
          {isSet && <Button type="button" variant="secondary" disabled={busy} onClick={remove}>Remove</Button>}
        </div>
      )}
    </section>
  );
}

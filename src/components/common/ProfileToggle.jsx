import { useState } from 'react';
import { Repeat, UserPlus } from 'lucide-react';
import Modal from './Modal';
import Button from '../ui/Button';
import useAuthStore from '../../store/authStore';
import { useOnPrimary } from '../../context/useAppearance';

const PAIR = ['realtor', 'client'];
const TITLE = { realtor: 'Realtor', client: 'Client' };
const DESCRIPTION = {
  realtor: 'As a realtor you can refer clients, earn commission, run inspections and manage your own downline.',
  client: 'As a client you can browse listed properties, buy, and track your invoices and payments.',
};

/**
 * The single profile control in the app: one filled pill in the header.
 *
 * Holding both profiles it offers the counterpart ("Switch to Client"); holding
 * only one it offers to create the other ("Create Realtor Profile"). It renders
 * nothing for anyone outside the realtor/client pair — an admin has no second
 * profile to switch into and must not be invited to create one.
 *
 * The label is never hidden responsively. An icon-only pill reads as a mystery
 * button, and this action is destructive enough to a user's context (it reloads
 * the app into a different profile) that it has to say what it does.
 *
 * It does TRUNCATE under pressure, which is a different thing: the text is
 * still there and still says what the control does, it simply gives up
 * characters when the bar is full rather than forcing the bar wider than the
 * screen. That mattered once a second pill joined it — a header that cannot
 * fit makes the document wider than the viewport, and mobile browsers answer
 * that by scaling the whole page down, so the app rendered smaller on a bigger
 * phone. The full text stays in `title` and `aria-label` throughout.
 */
export default function ProfileToggle({ className = '' }) {
  const roles = useAuthStore((s) => s.roles) || [];
  const activeRole = useAuthStore((s) => s.activeRole);
  const user = useAuthStore((s) => s.user);
  const switchRole = useAuthStore((s) => s.switchRole);
  const enableProfile = useAuthStore((s) => s.enableProfile);
  const onPrimary = useOnPrimary();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const held = roles.filter((r) => PAIR.includes(r.name));
  const heldNames = held.map((r) => r.name);
  const withinPair = PAIR.includes(user?.type) || heldNames.length > 0;
  if (!withinPair) return null;

  // The profile being acted as — activeRole when it is one of the pair, else
  // the account type, so a user whose active role is not switchable still gets
  // a sensible counterpart offered.
  const current = PAIR.includes(activeRole?.name) ? activeRole.name : user?.type;
  const other = PAIR.find((name) => name !== current);
  if (!other) return null;

  const otherRole = held.find((r) => r.name === other);
  const label = otherRole ? `Switch to ${TITLE[other]}` : `Create ${TITLE[other]} Profile`;
  const Icon = otherRole ? Repeat : UserPlus;

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      // enableProfile also switches into the new profile, so both paths land
      // the user in `other`.
      await (otherRole ? switchRole(otherRole.id) : enableProfile(other));
      // Full reload so every cached view re-fetches under the new profile.
      window.location.reload();
    } catch (err) {
      setError(err?.response?.data?.message || err?.userMessage || 'Could not change profile.');
      setBusy(false);
      setConfirming(false);
    }
  };

  const handleClick = () => {
    // Switching between profiles you already hold is reversible in one click,
    // so it happens immediately. CREATING a profile is not — it adds a role to
    // the account permanently — so that one asks first.
    if (otherRole) return run();
    setConfirming(true);
  };

  return (
    <div className={`relative min-w-0 ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        title={label}
        aria-label={label}
        style={{ backgroundColor: 'var(--primary, #2563eb)', color: onPrimary }}
        /*
         * Sizes are exact px at each breakpoint rather than rem-based h-8/h-9/h-10,
         * so the desktop pill stays precisely 40px regardless of root font size
         * while phones get a lighter 32px. Weight drops to medium on small
         * screens too — at 11px, semibold is what reads as "too bold".
         */
        className="inline-flex w-full min-w-[2.6rem] max-w-full items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium leading-none shadow-sm transition h-[32px] sm:h-[36px] sm:gap-2 sm:px-3 sm:text-xs sm:font-semibold lg:h-[40px] lg:px-4 lg:text-sm hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Icon className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5 lg:h-4 lg:w-4" aria-hidden="true" />
        {/* Ellipsis on a very narrow phone rather than shoving the bell out of
            the header; the full label stays in title/aria-label. */}
        <span className="min-w-0 truncate">
          {busy ? (otherRole ? 'Switching…' : 'Setting up…') : label}
        </span>
      </button>

      {error && (
        <div
          role="alert"
          className="absolute right-0 top-full z-50 mt-1 w-48 max-w-[80vw] rounded-lg bg-rose-50 px-3 py-2 text-[11px] text-rose-700 shadow ring-1 ring-rose-200 sm:w-56 sm:text-xs"
        >
          {error}
        </div>
      )}

      <Modal
        open={confirming}
        onClose={() => !busy && setConfirming(false)}
        title={`Create your ${TITLE[other]} profile?`}
        size="sm"
      >
        <div className="space-y-4 text-sm text-slate-600">
          <p>
            This adds a <strong>{TITLE[other]}</strong> profile to your account. You keep your
            existing {TITLE[current] || 'current'} profile and can switch between the two at any
            time from this button — you will not need to sign in again.
          </p>
          <p>{DESCRIPTION[other]}</p>
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            You will be switched into the new profile straight away, and the page will reload.
          </p>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" onClick={run} disabled={busy}>
              {busy ? 'Setting up…' : `Create ${TITLE[other]} Profile`}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

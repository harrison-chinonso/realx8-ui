import { useEffect, useRef, useState } from 'react';
import { Building2, Check, ChevronDown } from 'lucide-react';

import Modal from './Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import useAuthStore from '../../store/authStore';

/**
 * Move between the companies one person holds accounts with.
 *
 * ── When it appears ─────────────────────────────────────────────────────────
 *
 * Only for somebody who CAN hold more than one. The server decides that: an
 * empty list means staff, who belong to a single company, and it is the signal
 * to draw nothing at all.
 *
 * One entry still draws the control, which looks like a menu with a single
 * choice and is not. Joining a second company is done from inside the first,
 * so the person with one company is exactly who needs to reach this — hiding
 * it from them would leave the only route to a second company being to already
 * have one.
 *
 * ── Why it reloads ──────────────────────────────────────────────────────────
 *
 * A switch is not a filter. It signs in as a DIFFERENT account, with its own
 * permissions, its own realtor level, its own invoices and its own branding —
 * so every list, count and badge already on screen belongs to the company being
 * left. Reloading is the honest way to get rid of them; leaving them would show
 * one company's figures under another company's name, which is the one mistake
 * a switcher must never make.
 *
 * ProfileToggle beside it reloads for the same reason, and the two read as one
 * kind of action because they are.
 */
export default function CompanySwitcher({ className = '' }) {
  const companies = useAuthStore((state) => state.companies) || [];
  const switchCompany = useAuthStore((state) => state.switchCompany);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  /**
   * The company a switch stopped on because it wants its own password.
   *
   * Company accounts carry separate passwords now, and a session may only move
   * into one it has actually been shown. Asked for here rather than by sending
   * somebody to the sign-in screen, which is the thing this control exists to
   * avoid.
   */
  const [challenge, setChallenge] = useState(null);
  const [challengePassword, setChallengePassword] = useState('');
  const [challengeError, setChallengeError] = useState('');
  const wrapper = useRef(null);

  /*
   * Hooks run before the early return below, because they must: a component
   * cannot call fewer of them on one render than on another, and this one
   * disappears the moment somebody switches into a company where they hold
   * only one account.
   */
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!wrapper.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  /**
   * Nothing at all unless there is something to switch BETWEEN.
   *
   * It rendered at one company for a while, so that the Join entry inside it
   * could be reached. That put a pill which cannot shrink into every realtor's
   * and client's top bar: at 430px the bar then needed 453px, and mobile
   * Chrome answers that by scaling the whole page down to fit — the app
   * rendering smaller on a bigger phone, from one control in a header.
   *
   * Joining lives on the Companies tab of the profile now, which is where a
   * once-per-company action belongs and costs the header nothing.
   */
  if (companies.length < 2) return null;

  const current = companies.find((entry) => entry.current);

  const choose = async (entry, password) => {
    if (busy || entry.current) return;
    setBusy(true);
    setError('');
    setChallengeError('');
    try {
      await switchCompany(entry.company_id, password);
      window.location.reload();
    } catch (err) {
      const reason = err?.response?.data?.reason;
      const message = err?.response?.data?.message || err?.userMessage || 'Could not switch company.';
      /*
       * Not a failure — a question. The company is reachable, it simply wants
       * the password that belongs to it, so the menu closes and a prompt opens
       * rather than an error appearing under a button.
       */
      if (reason === 'password_required' || reason === 'password_incorrect') {
        setOpen(false);
        setChallenge(entry);
        setChallengePassword('');
        setChallengeError(reason === 'password_incorrect' ? message : '');
      } else {
        setError(message);
        setOpen(false);
      }
      setBusy(false);
    }
  };

  return (
    /*
     * Allowed to SHRINK, and that is the whole point.
     *
     * A pill that cannot give way is a pill the top bar has to find room for,
     * and when it cannot the document ends up wider than the screen — which
     * mobile browsers answer by scaling the entire page down. The app renders
     * smaller on a bigger phone, from one control in a header.
     *
     * On a phone it is the icon and the chevron, full stop — no name, no
     * truncation. Letting it compete for leftover width was worse than either
     * extreme: at 393 the bar came out as a logo reading "R", a company reading
     * "|" and a button reading "Creat…", which overflows nothing and says
     * nothing. A building icon beside a chevron is a legible affordance, and
     * the menu it opens names every company with the current one ticked.
     *
     * The name returns at sm, where there is room for it to mean something.
     */
    <div ref={wrapper} className={`relative shrink-0 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        disabled={busy}
        title={`Signed in to ${current?.company_name || 'your company'} — switch company`}
        aria-haspopup="listbox"
        aria-expanded={open}
        /*
         * Sized to sit beside ProfileToggle at every breakpoint. Outlined
         * rather than filled, because two filled pills side by side read as
         * two primary actions and this one is navigation.
         */
        className="inline-flex h-[32px] shrink-0 items-center gap-1.5 rounded-full border border-slate-300 bg-white px-2.5 text-[11px] font-medium leading-none text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60 sm:h-[36px] sm:gap-2 sm:px-3 sm:text-xs lg:h-[40px] lg:px-4 lg:text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
      >
        <Building2 className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5 lg:h-4 lg:w-4" aria-hidden="true" />
        <span className="hidden truncate sm:inline sm:max-w-[160px]">
          {busy ? 'Switching…' : (current?.company_name || 'Company')}
        </span>
        <ChevronDown className="h-3 w-3 shrink-0 opacity-60 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 top-full z-50 mt-1 w-56 max-w-[80vw] overflow-hidden rounded-lg bg-white py-1 shadow-lg ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-600"
        >
          {companies.map((entry) => {
            /*
             * Shown and disabled rather than hidden. Somebody looking for an
             * agency they know they belong to has to see that it is there and
             * why it will not open — an entry that is simply missing reads as a
             * lost account.
             */
            const blocked = !entry.is_active
              ? 'Your account here is not active'
              : entry.company_status === 'suspended' ? 'This company is suspended' : null;
            return (
              <li key={entry.account_id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={Boolean(entry.current)}
                  disabled={busy || Boolean(blocked) || entry.current}
                  onClick={() => choose(entry)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-100 dark:hover:bg-slate-700"
                >
                  <Check
                    className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${entry.current ? 'opacity-100' : 'opacity-0'}`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{entry.company_name}</span>
                    <span className="block truncate text-[11px] text-slate-400">
                      {blocked || (entry.current ? 'Current company' : `Your ${entry.type} account`)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <div
          role="alert"
          className="absolute right-0 top-full z-50 mt-1 w-56 max-w-[80vw] rounded-lg bg-rose-50 px-3 py-2 text-[11px] text-rose-700 shadow ring-1 ring-rose-200"
        >
          {error}
        </div>
      )}

      <Modal
        open={Boolean(challenge)}
        onClose={() => !busy && setChallenge(null)}
        title={`Sign in to ${challenge?.company_name || 'that company'}`}
        size="sm"
      >
        <form
          onSubmit={(event) => { event.preventDefault(); choose(challenge, challengePassword); }}
          className="space-y-4"
        >
          <p className="text-sm text-slate-600">
            Your account with <strong>{challenge?.company_name}</strong> uses a different
            password from the one you signed in with. Enter it to move there — you will not
            be asked again for the rest of this session.
          </p>
          <Input
            label="Password"
            type="password"
            value={challengePassword}
            onChange={(e) => setChallengePassword(e.target.value)}
            autoComplete="current-password"
            autoFocus
            required
          />
          {challengeError && <p className="text-sm text-rose-600">{challengeError}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="secondary" onClick={() => setChallenge(null)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !challengePassword}>
              {busy ? 'Switching…' : 'Switch company'}
            </Button>
          </div>
        </form>
      </Modal>

    </div>
  );
}

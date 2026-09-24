import { useEffect, useRef, useState } from 'react';
import { Building2, Check, ChevronDown } from 'lucide-react';

import useAuthStore from '../../store/authStore';

/**
 * Move between the companies one person holds accounts with.
 *
 * ── When it appears ─────────────────────────────────────────────────────────
 *
 * Only for somebody who actually has more than one. The server decides that —
 * it sends an empty list for anyone who cannot hold a second account, which is
 * every kind of staff, and for anyone who simply has not joined a second
 * company yet. A control offering one choice is a control that does nothing,
 * and the sidebar has no room for furniture.
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

  if (companies.length < 2) return null;

  const current = companies.find((entry) => entry.current);

  const choose = async (entry) => {
    if (busy || entry.current) return;
    setBusy(true);
    setError('');
    try {
      await switchCompany(entry.company_id);
      window.location.reload();
    } catch (err) {
      setError(err?.response?.data?.message || err?.userMessage || 'Could not switch company.');
      setBusy(false);
      setOpen(false);
    }
  };

  return (
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
        className="inline-flex h-[32px] min-w-0 items-center gap-1.5 rounded-full border border-slate-300 bg-white px-2.5 text-[11px] font-medium leading-none text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60 sm:h-[36px] sm:gap-2 sm:px-3 sm:text-xs lg:h-[40px] lg:px-4 lg:text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
      >
        <Building2 className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5 lg:h-4 lg:w-4" aria-hidden="true" />
        <span className="truncate max-w-[32vw] sm:max-w-[160px]">
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
    </div>
  );
}

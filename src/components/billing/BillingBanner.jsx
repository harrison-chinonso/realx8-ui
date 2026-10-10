import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import Alert from '../ui/Alert';
import useBillingStatus from '../../hooks/useBillingStatus';
import { atUserLimit, daysUntil, formatBillingDate } from '../../utils/billing';
import { plural } from '../../utils/plural';

/** Trial reminders start this many days before the end, not for the whole week. */
const TRIAL_WARNING_DAYS = 3;

const dismissKey = (kind) => `billing-banner-dismissed:${kind}`;

// sessionStorage can throw (private windows, blocked storage); a banner that
// cannot remember being dismissed just shows again, which is harmless.
const wasDismissed = (kind) => {
  try { return sessionStorage.getItem(dismissKey(kind)) === '1'; } catch { return false; }
};
const rememberDismissed = (kind) => {
  try { sessionStorage.setItem(dismissKey(kind), '1'); } catch { /* shown again next page */ }
};

/**
 * One line about the company's subscription, above every signed-in page.
 *
 * ── One notice at a time ────────────────────────────────────────────────────
 *
 * Read-only outranks payment due, which outranks a trial ending, which
 * outranks a full plan. Two banners stacked say the same thing twice — "pay"
 * — and the most urgent reason is the one that should do the saying.
 *
 * ── Who is told what ────────────────────────────────────────────────────────
 *
 * Only an administrator can pay, so only they get the call to action. Other
 * staff are told only when it changes what they can do (read-only), and then
 * in words that do not ask them to do something they cannot.
 *
 * ── Dismissal ───────────────────────────────────────────────────────────────
 *
 * Per session and per kind, so dismissing the trial reminder does not also
 * silence the grace notice that follows it. Read-only cannot be dismissed:
 * it explains every refused action on every screen, and without it the app
 * simply looks broken.
 */
export default function BillingBanner() {
  const billing = useBillingStatus();
  const { pathname } = useLocation();
  const [dismissed, setDismissed] = useState({});

  if (!billing.isCompanyUser) return null;

  const admin = billing.isBillingAdmin;
  // The link would point at the page it is already on.
  const onBillingPage = pathname === '/billing';
  const action = (label) => (admin && !onBillingPage ? (
    <Link to="/billing" className="font-semibold underline underline-offset-2">{label}</Link>
  ) : null);

  let notice = null;
  if (billing.status === 'lapsed') {
    notice = admin
      ? { kind: 'lapsed', tone: 'danger', text: 'Your company is read-only.', link: action('Renew') }
      : { kind: 'lapsed', tone: 'danger', text: 'Your company’s subscription is inactive, so some actions are unavailable.' };
  } else if (billing.status === 'grace') {
    const by = formatBillingDate(billing.graceEndsAt);
    notice = admin
      ? { kind: 'grace', tone: 'warning', text: `Your subscription has ended — renew by ${by} to avoid read-only.`, link: action('Renew') }
      : { kind: 'grace', tone: 'warning', text: `Your company’s subscription has ended. Some actions will become unavailable after ${by} unless it is renewed.` };
  } else if (admin && billing.status === 'trialing') {
    const days = daysUntil(billing.endsAt);
    if (days !== null && days <= TRIAL_WARNING_DAYS) {
      notice = {
        kind: 'trial',
        tone: 'info',
        text: days === 0 ? 'Your free trial ends today.' : `Your free trial ends in ${plural(days, 'day')}.`,
        link: action('Choose a plan'),
      };
    }
  }
  if (!notice && admin && atUserLimit(billing.users)) {
    notice = {
      kind: 'limit',
      tone: 'warning',
      text: 'You’ve reached your plan’s user limit — new sign-ups are waiting.',
      link: action('Upgrade'),
    };
  }

  if (!notice) return null;
  const dismissible = notice.kind !== 'lapsed';
  if (dismissible && (dismissed[notice.kind] || wasDismissed(notice.kind))) return null;

  const dismiss = () => {
    rememberDismissed(notice.kind);
    setDismissed((d) => ({ ...d, [notice.kind]: true }));
  };

  return (
    // role="status" even for read-only: it is standing information, not an
    // interruption, and "alert" would be re-announced on every page.
    <Alert tone={notice.tone} role="status" className="mb-4 items-center py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex-1">
          {notice.text}
          {notice.link && <> {notice.link}</>}
        </span>
        {dismissible && (
          <button
            type="button"
            onClick={dismiss}
            className="flex h-7 w-7 min-h-0 items-center justify-center rounded-full opacity-70 hover:opacity-100"
            aria-label="Dismiss this notice"
          >
            <X size={15} aria-hidden="true" />
          </button>
        )}
      </div>
    </Alert>
  );
}

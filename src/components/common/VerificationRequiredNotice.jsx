import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowRight } from 'lucide-react';

/**
 * Why something a realtor expected to be able to do is not available.
 *
 * ── One component, because the three screens must not disagree ──────────────
 *
 * Payouts, referral links and property sharing are all gated on the same
 * verification, and each screen writing its own sentence is how three slightly
 * different accounts of one rule end up in front of the same person.
 *
 * ── Three statuses, three different things to do ────────────────────────────
 *
 * Somebody who has never submitted has to go and submit. Somebody waiting has
 * to wait — telling them to "complete verification" would send them to a form
 * they already filled in. Somebody rejected has to read why and correct it.
 * "You are not verified" covers all three and helps none of them.
 */

const COPY = {
  none: {
    title: 'Verify your identity first',
    body: 'Submit your ID and proof of address. It usually takes a day or two to review.',
    cta: 'Start verification',
  },
  pending: {
    title: 'Your verification is being reviewed',
    body: 'Nothing more is needed from you. This unlocks as soon as an administrator approves it.',
    cta: 'View your submission',
  },
  rejected: {
    title: 'Your verification was not accepted',
    body: 'Check the reason on your submission, update the documents and send them again.',
    cta: 'Fix and resubmit',
  },
};

/**
 * @param {string}  status   'none' | 'pending' | 'rejected'
 * @param {string}  activity what is unavailable, in the person's own terms
 */
export default function VerificationRequiredNotice({ status = 'none', activity }) {
  const copy = COPY[status] || COPY.none;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-start">
      <ShieldAlert aria-hidden="true" className="h-5 w-5 shrink-0 text-amber-600" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-semibold text-amber-900">{copy.title}</p>
        <p className="text-sm text-amber-800">
          {activity && <>{activity} </>}
          {copy.body}
        </p>
        {/*
          Said on every one of them. The first thought on finding a payout
          button gone is that the money has gone with it.
        */}
        <p className="text-xs text-amber-700">
          Your commission keeps accruing in the meantime — nothing you have earned is affected.
        </p>
      </div>
      <Link
        to="/profile?tab=verification"
        className="inline-flex shrink-0 items-center gap-1 self-start rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
      >
        {copy.cta} <ArrowRight aria-hidden="true" className="h-3 w-3" />
      </Link>
    </div>
  );
}

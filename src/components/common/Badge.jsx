import { enumLabel } from '../../utils/enumLabel';

/**
 * Status pill.
 *
 * Proportions follow the reference (full radius, 10px horizontal, xs semibold).
 * Colours map onto the semantic surface tokens rather than arbitrary Tailwind
 * shades, so success/warning/danger read the same here as everywhere else.
 */
const TONES = {
  positive: 'bg-success-surface text-success',
  caution:  'bg-warning-surface text-warning',
  negative: 'bg-danger-surface text-danger',
  /* The only tone that can carry brand. success/warning/danger mean
     something, and repainting those in a tenant colour would say a thing
     about the record that is not true. Neutral means nothing in
     particular, so it is free to be the company's. */
  neutral:  'badge-secondary',
  info:     'bg-primary-soft text-primary',
};

const colors = {
  paid: TONES.positive,
  sent: TONES.info,
  overdue: TONES.caution,
  open: TONES.info,
  resolved: TONES.positive,
  active: TONES.positive,
  passed: TONES.positive,
  failed: TONES.negative,
  cancelled: TONES.negative,
  rejected: TONES.negative,
  declined: TONES.negative,
  verified: TONES.positive,
  approved: TONES.positive,
  completed: TONES.positive,
  draft: TONES.neutral,
  training: TONES.info,
  applied: TONES.info,
  inactive: TONES.neutral,
  in_progress: TONES.caution,
  payment_under_review: TONES.caution,
  pending: TONES.caution,

  // The purchase journey's schedule statuses. Timing and settlement are two
  // independent dimensions, so both sets live here and a schedule renders one
  // badge from each — merging them would lose the fact that a schedule can be
  // overdue and part paid at the same time.
  upcoming: TONES.neutral,
  due: TONES.info,
  in_grace: TONES.caution,
  unpaid: TONES.neutral,
  partially_paid: TONES.caution,
  // A plan with an overdue installment. Recoverable — settling it returns the
  // plan to active — but it reads as a problem until then.
  in_default: TONES.negative,
  expired: TONES.neutral,

  /**
   * The commission engine's entitlement and payout statuses.
   *
   * ACCRUED is deliberately NEUTRAL rather than cautionary. It is the ordinary
   * state of money earned on a sale the buyer is still paying for — the
   * overwhelmingly common case — and colouring it as a warning would tell every
   * realtor that most of what they have earned is in trouble.
   */
  accrued: TONES.neutral,
  partially_released: TONES.caution,
  released: TONES.info,
  forfeited: TONES.negative,
  held: TONES.caution,
  reversed: TONES.negative,
  recovered: TONES.positive,
  written_off: TONES.neutral,

  // Screening severities.
  high: TONES.negative,
  medium: TONES.caution,
  low: TONES.neutral,

  default: TONES.neutral,
};

export default function Badge({ value }) {
  const key = String(value || 'default').toLowerCase();
  // Upper case, underscores gone: the column holds `payment_requested`, the
  // screen shows PAYMENT REQUESTED. `capitalize` is dropped from the classes
  // because it would fight the transform.
  const label = enumLabel(value);
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide ${colors[key] || colors.default}`}>
      {label}
    </span>
  );
}

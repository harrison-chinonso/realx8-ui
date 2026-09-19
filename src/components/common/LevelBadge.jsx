import { Award } from 'lucide-react';
import { useOnPrimary } from '../../context/useAppearance';

/**
 * A realtor's level, styled to sit alongside VerificationBadge.
 *
 * Renders nothing without a level name: clients have no level, and an
 * unassigned realtor should show no badge rather than an empty one.
 */
export default function LevelBadge({ level, size = 'sm' }) {
  const onPrimary = useOnPrimary();
  const name = typeof level === 'string' ? level : level?.name;
  if (!name) return null;

  const text = size === 'lg' ? 'text-sm px-3 py-1' : 'text-[11px] px-2 py-0.5';
  /*
   * The rate is quoted only when it actually decides what the realtor is paid.
   *
   * A level's percentage is read by an activated commission plan, and on the
   * flat-rate path only if the company has opted into paying its level rates.
   * Where neither holds, commission_rules decides and this number decides
   * nothing — so quoting it would be telling a realtor they earn a rate
   * nobody will pay them. The API sends `rate_in_force` beside it; an older
   * payload without the field is treated as not in force, which errs towards
   * saying nothing rather than towards saying something wrong.
   */
  const commission = typeof level === 'object' ? Number(level?.commission_percentage) : NaN;
  const rateApplies = typeof level === 'object' && level?.rate_in_force === true;
  const title = rateApplies && Number.isFinite(commission) && commission > 0
    ? `Level: ${name} — ${commission}% commission`
    : `Level: ${name}`;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${text}`}
      style={{ backgroundColor: 'var(--primary, #2563eb)', color: onPrimary }}
      title={title}
    >
      <Award size={size === 'lg' ? 15 : 12} />
      {name}
    </span>
  );
}

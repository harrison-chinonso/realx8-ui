import { BadgeCheck, Clock, ShieldAlert, ShieldOff } from 'lucide-react';

const STATES = {
  approved:      { label: 'Verified',     cls: 'bg-emerald-100 text-emerald-700', Icon: BadgeCheck },
  pending:       { label: 'Pending',      cls: 'bg-amber-100 text-amber-700',     Icon: Clock },
  rejected:      { label: 'Rejected',     cls: 'bg-rose-100 text-rose-700',       Icon: ShieldAlert },
  not_submitted: { label: 'Unverified',   cls: 'bg-slate-100 text-slate-500',     Icon: ShieldOff },
};

/**
 * Realtor verification state. Renders nothing when status is null — clients
 * have no verification, and a badge there would be misleading.
 */
export default function VerificationBadge({ status, size = 'sm' }) {
  if (!status) return null;
  const state = STATES[status] || STATES.not_submitted;
  const { Icon } = state;
  const text = size === 'lg' ? 'text-sm px-3 py-1' : 'text-[11px] px-2 py-0.5';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold ${state.cls} ${text}`} title={`Verification: ${state.label}`}>
      <Icon size={size === 'lg' ? 15 : 12} />
      {state.label}
    </span>
  );
}

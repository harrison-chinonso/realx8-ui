import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import Badge from './Badge';
import ProfileBadges from './ProfileBadges';
import VerificationBadge from './VerificationBadge';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
};

function Node({ person, depth, onSelect }) {
  const [open, setOpen] = useState(depth < 2);   // deep branches start collapsed
  const children = person.children || [];

  return (
    <li>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-2.5">
        {children.length > 0 ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label={open ? 'Collapse' : 'Expand'}
          >
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="w-[22px] shrink-0" />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(person)}
                className="font-medium hover:underline"
                style={{ color: 'var(--primary)' }}
                title="View commissions and purchases"
              >
                {person.name}
              </button>
            ) : (
              <span className="font-medium text-slate-900">{person.name}</span>
            )}
            <ProfileBadges profiles={person.profiles} hasBoth={person.has_both} />
            {person.level_name && <Badge value={person.level_name} />}
            <VerificationBadge status={person.kyc_status} />
          </div>
          <p className="truncate text-xs text-slate-500">
            {person.email || '—'}
            {person.realtor_code ? ` · ${person.realtor_code}` : ''} · joined {formatDate(person.created_at)}
          </p>
        </div>

        {children.length > 0 && (
          <span className="shrink-0 text-[11px] text-slate-400">
            {person.downline_count} in their downline
          </span>
        )}
      </div>

      {open && children.length > 0 && (
        <ul className="mt-2 space-y-2 border-l border-slate-200 pl-4">
          {children.map((child) => <Node key={child.id} person={child} depth={depth + 1} onSelect={onSelect} />)}
        </ul>
      )}
    </li>
  );
}

/** Nested referral downline. `nodes` are the direct children of the root. */
export default function ReferralTree({ nodes = [], emptyText = 'No referrals yet.', truncated = false, onSelect }) {
  if (!nodes.length) {
    return <p className="rounded-lg border border-dashed border-slate-200 p-3 text-sm text-slate-500">{emptyText}</p>;
  }
  return (
    <>
      <ul className="space-y-2">
        {nodes.map((person) => <Node key={person.id} person={person} depth={0} onSelect={onSelect} />)}
      </ul>
      {truncated && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          This network is large — only part of the tree is shown.
        </p>
      )}
    </>
  );
}

import { useEffect, useState } from 'react';
import { getRealtorReferrals } from '../../api/userApi';
import Modal from './Modal';
import Badge from './Badge';
import ProfileBadges from './ProfileBadges';
import VerificationBadge from './VerificationBadge';
import ReferralTree from './ReferralTree';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
};

function Person({ person, note }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-slate-900">{person.name}</span>
          <ProfileBadges profiles={person.profiles} hasBoth={person.has_both} />
          {person.level_name && <Badge value={person.level_name} />}
          <VerificationBadge status={person.kyc_status} />
        </div>
        <p className="truncate text-xs text-slate-500">
          {person.email || '—'}{person.realtor_code ? ` · ${person.realtor_code}` : ''} · joined {formatDate(person.created_at)}
        </p>
      </div>
      {note && <span className="shrink-0 text-[11px] text-slate-400">{note}</span>}
    </div>
  );
}

/** A realtor's referral chain: who referred them, and who they referred. */
export default function RealtorReferralsModal({ open, realtor, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !realtor?.id) return undefined;
    let cancelled = false;
    setData(null);
    setError('');
    getRealtorReferrals(realtor.id)
      .then((r) => { if (!cancelled) setData(r?.data ?? r); })
      .catch((err) => { if (!cancelled) setError(err?.response?.data?.message || err?.userMessage || 'Could not load referrals.'); });
    return () => { cancelled = true; };
  }, [open, realtor?.id]);

  return (
    <Modal open={open} onClose={onClose} title={`Referrals — ${realtor?.name ?? ''}`} size="lg">
      {error && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
      {!data && !error && <p className="text-sm text-slate-500">Loading...</p>}

      {data && (
        <div className="space-y-5">
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Upline — who referred them
            </h3>
            {data.upline.length ? (
              <div className="space-y-2">
                {data.upline.map((person, index) => (
                  <Person
                    key={person.id}
                    person={person}
                    note={index === 0 ? 'Direct referrer' : `${index + 1} levels up`}
                  />
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-slate-200 p-3 text-sm text-slate-500">
                Not referred by anyone — they are at the top of their chain.
              </p>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Downline — their full referral network ({data.downlineTotal ?? 0})
            </h3>
            <ReferralTree nodes={data.downline} truncated={data.truncated} />
          </section>
        </div>
      )}
    </Modal>
  );
}

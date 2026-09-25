import { useEffect, useMemo, useState } from 'react';
import { plural } from '../../utils/plural';
import { Link } from 'react-router-dom';
import { listMyReferrals } from '../../api/userApi';
import useAuthStore from '../../store/authStore';
import Badge from '../../components/common/Badge';
import ProfileBadges from '../../components/common/ProfileBadges';
import VerificationBadge from '../../components/common/VerificationBadge';
import ReferralTree from '../../components/common/ReferralTree';
import ReferralLinkPanel from '../../components/common/ReferralLinkPanel';
import UserSummaryModal from '../../components/common/UserSummaryModal';
import ReferralEarningsModal from '../../components/common/ReferralEarningsModal';
import ActionsMenu from '../../components/common/ActionsMenu';
import PaymentAnalysisModal from '../../components/common/PaymentAnalysisModal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
};

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'client', label: 'Clients' },
  { key: 'realtor', label: 'Realtors' },
];

/** People this realtor referred — clients and realtors alike. */
/**
 * The rungs, in the order an introduction climbs them.
 *
 * Kept in step with STATUS in shared/src/referralRecord.js. Counted by CURRENT
 * position rather than cumulatively, so the columns sum to the total and a
 * realtor can see where people stop — which is the only thing a funnel is for.
 */
const FUNNEL_STAGES = [
  { key: 'invited', label: 'Opened your link' },
  { key: 'registered', label: 'Registered' },
  { key: 'interested', label: 'Interested' },
  { key: 'reserved', label: 'Reserved a unit' },
  { key: 'commission_generated', label: 'Earned you commission' },
];

export default function MyReferralsPage() {
  const [tree, setTree] = useState([]);
  const [summaryFor, setSummaryFor] = useState(null);
  const [paymentsFor, setPaymentsFor] = useState(null);
  const [earningsFor, setEarningsFor] = useState(null);
  // The list is the default: it carries the per-referral actions. The tree was
  // previously shown unless you happened to search or switch tab, which left no
  // way to select anyone.
  const [view, setView] = useState('list');
  const [meta, setMeta] = useState({ total: 0, truncated: false });
  const realtorName = useAuthStore((state) => state.user?.name);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    listMyReferrals()
      .then((r) => {
        if (cancelled) return;
        setTree(r?.data ?? []);
        setMeta(r?.meta ?? { total: 0, truncated: false });
      })
      .catch((err) => { if (!cancelled) setError(err?.response?.data?.message || err?.userMessage || 'Could not load your referrals.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // The tree is the default view; searching or filtering flattens it, since a
  // filtered tree with missing parents would misrepresent the hierarchy.
  const rows = useMemo(() => {
    const out = [];
    const walk = (nodes, depth) => nodes.forEach((n) => {
      out.push({ ...n, depth });
      if (n.children?.length) walk(n.children, depth + 1);
    });
    walk(tree, 0);
    return out;
  }, [tree]);

  const filtering = tab !== 'all' || query.trim() !== '';
  // Searching or filtering only makes sense against the flat list.
  const showList = view === 'list' || filtering;

  const counts = useMemo(() => ({
    all: rows.length,
    client: rows.filter((r) => (r.profiles || [r.type]).includes('client')).length,
    realtor: rows.filter((r) => (r.profiles || [r.type]).includes('realtor')).length,
  }), [rows]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return rows
      .filter((r) => tab === 'all' || (r.profiles || [r.type]).includes(tab))
      .filter((r) => !term
        || String(r.name || '').toLowerCase().includes(term)
        || String(r.email || '').toLowerCase().includes(term));
  }, [rows, tab, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">My Referrals</h1>
          <p className="text-sm text-slate-500">
            Your full referral network — {meta.total} {meta.total === 1 ? 'person' : 'people'}, including indirect referrals.
          </p>
        </div>
        <Link to="/"><Button variant="secondary" size="sm">← Back to Dashboard</Button></Link>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      <ReferralLinkPanel realtorCode={meta.realtor_code} companyCode={meta.company_code} realtorName={realtorName} />

      {/*
        The funnel, which is not the network above it.

        The network is accounts that exist under you. This counts
        INTRODUCTIONS by how far each one got — including the ones that
        registered and went no further, which the network cannot show because
        there is nothing about an account that says it stalled.
      */}
      {meta.funnel?.total > 0 && (
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">
            How your introductions are doing
            <span className="ml-2 font-normal text-slate-400">{plural(meta.funnel.total, 'introduction')}</span>
          </h2>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {FUNNEL_STAGES.map((stage) => (
              <div key={stage.key} className="rounded-lg bg-slate-50 px-3 py-2.5 ring-1 ring-slate-100">
                <p className="text-lg font-semibold tabular-nums text-slate-800">
                  {meta.funnel.by_status?.[stage.key] ?? 0}
                </p>
                <p className="text-xs text-slate-500">{stage.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 md:flex-row md:items-end md:justify-between">
        <div className="flex-1">
          <Input label="Search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or email..." />
        </div>
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <Button key={t.key} type="button" size="sm" variant={tab === t.key ? 'primary' : 'secondary'} onClick={() => setTab(t.key)}>
              {t.label} ({counts[t.key]})
            </Button>
          ))}
          <span className="mx-1 w-px self-stretch bg-slate-200" />
          <Button type="button" size="sm" variant={showList ? 'primary' : 'secondary'} onClick={() => setView('list')}>List</Button>
          <Button
            type="button"
            size="sm"
            variant={!showList ? 'primary' : 'secondary'}
            onClick={() => { setView('tree'); setTab('all'); setQuery(''); }}
            title="Nested downline"
          >
            Tree
          </Button>
        </div>
      </div>

      {showList ? (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Account Type</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Email</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Phone</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Level</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Verification</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Joined</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {row.depth > 0 && <span className="mr-1 text-slate-300">{'—'.repeat(row.depth)}</span>}
                      <button
                        type="button"
                        onClick={() => setSummaryFor(row)}
                        className="text-left hover:underline"
                        style={{ color: 'var(--primary)' }}
                        title="View business summary"
                      >
                        {row.name}
                      </button>
                    </td>
                    <td className="px-4 py-3"><ProfileBadges profiles={row.profiles} hasBoth={row.has_both} /></td>
                    <td className="px-4 py-3 text-slate-600">{row.email || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{row.phone || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{row.level_name || '—'}</td>
                    <td className="px-4 py-3"><VerificationBadge status={row.kyc_status} /></td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(row.created_at)}</td>
                    <td className="px-4 py-3"><Badge value={row.is_active ? 'active' : 'inactive'} /></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <ActionsMenu
                          items={[
                            { label: '📊 Business Analysis', onClick: () => setSummaryFor(row) },
                            { label: '💰 Commissions & Purchases', onClick: () => setEarningsFor(row) },
                            // Only billable accounts have invoices — a
                            // realtor-only downline has none.
                            ...((row.has_both || (row.profiles || [row.type]).includes('client'))
                              ? [{ label: '💳 Payment Analysis', onClick: () => setPaymentsFor(row) }]
                              : []),
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                {!visible.length && (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">No referrals match your search.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          {loading
            ? <p className="text-sm text-slate-500">Loading...</p>
            : (
              <ReferralTree
                nodes={tree}
                onSelect={setEarningsFor}
                truncated={meta.truncated}
                emptyText="No referrals yet. Share your referral code to get started."
              />
            )}
        </div>
      )}

      <UserSummaryModal user={summaryFor} open={!!summaryFor} onClose={() => setSummaryFor(null)} />

      <PaymentAnalysisModal user={paymentsFor} open={!!paymentsFor} onClose={() => setPaymentsFor(null)} />

      <ReferralEarningsModal user={earningsFor} open={!!earningsFor} onClose={() => setEarningsFor(null)} />
    </div>
  );
}

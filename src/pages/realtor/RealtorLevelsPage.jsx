import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import {
  approveLevelRequest, assignRealtorLevel, createRealtorLevel, deleteRealtorLevel,
  listLevelRequests, listRealtorLevels, rejectLevelRequest, reorderRealtorLevels, updateRealtorLevel,
} from '../../api/realtorLevelApi';
import { listRealtors } from '../../api/userApi';
import { listCompanies } from '../../api/companyApi';
import useAuthStore from '../../store/authStore';
import Badge from '../../components/common/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/common/Modal';
import VerificationBadge from '../../components/common/VerificationBadge';
import Select from '../../components/ui/Select';

const asList = (response) => (Array.isArray(response) ? response : (response?.data ?? []));

/**
 * Admin management for realtor levels: define the ladder, reorder it, place
 * realtors on a level, and review upgrade requests.
 */
export default function RealtorLevelsPage() {
  const isSuperiorAdmin = useAuthStore((state) => state.isSuperiorAdmin);
  const [companies, setCompanies] = useState([]);
  // Superior admins browse one company's levels at a time; '' means global only.
  const [companyFilter, setCompanyFilter] = useState('');
  const [levels, setLevels] = useState([]);
  const [realtors, setRealtors] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', description: '', commission_percentage: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [review, setReview] = useState(null);   // { request, decision }
  const [notes, setNotes] = useState('');

  const say = (type, text) => setMessage({ type, text });

  const load = async () => {
    setLoading(true);
    const [levelRes, realtorRes, requestRes] = await Promise.allSettled([
      listRealtorLevels(companyFilter ? { company_id: companyFilter } : undefined),
      listRealtors({ limit: 200 }),
      listLevelRequests(),
    ]);
    const items = (r) => (r.status === 'fulfilled' ? asList(r.value) : []);
    setLevels(items(levelRes));
    setRealtors(items(realtorRes));
    setRequests(items(requestRes));
    setLoading(false);
  };

  useEffect(() => { load(); }, [companyFilter]);

  useEffect(() => {
    if (!isSuperiorAdmin) return;
    listCompanies({ limit: 200 })
      .then((r) => setCompanies(Array.isArray(r) ? r : (r?.data ?? [])))
      .catch(() => setCompanies([]));
  }, [isSuperiorAdmin]);

  const guard = async (action, success) => {
    setSaving(true);
    setMessage(null);
    try {
      await action();
      await load();
      if (success) say('success', success);
    } catch (err) {
      say('error', err?.response?.data?.message || err?.userMessage || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  const addLevel = (event) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    guard(
      () => createRealtorLevel({
        name: form.name.trim(),
        description: form.description.trim() || null,
        commission_percentage: form.commission_percentage === '' ? 0 : Number(form.commission_percentage),
      }),
      'Level added.',
    ).then(() => setForm({ name: '', description: '', commission_percentage: '' }));
  };

  const ownIndex = (level) => ownLevels.findIndex((l) => l.id === level.id);

  // Reordering applies only to levels you own — the API rejects a list that
  // includes someone else's — so the swap happens within that subset.
  const move = (level, delta) => {
    const next = [...ownLevels];
    const from = ownIndex(level);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= next.length) return;
    [next[from], next[to]] = [next[to], next[from]];
    guard(() => reorderRealtorLevels(next.map((l) => l.id)));
  };

  const submitReview = () => {
    const action = review.decision === 'approved' ? approveLevelRequest : rejectLevelRequest;
    guard(
      () => action(review.request.id, { notes: notes.trim() || null }),
      review.decision === 'approved' ? 'Upgrade approved.' : 'Request declined.',
    ).then(() => { setReview(null); setNotes(''); });
  };

  const levelName = (id) => levels.find((l) => l.id === id)?.name || '—';
  // A level with no company is part of the shared global ladder, which only a
  // platform administrator may change.
  const isGlobal = (level) => !level.company_id;
  const companyName = (id) => companies.find((c) => c.id === id)?.name || `Company #${id}`;
  const canEdit = (level) => (isSuperiorAdmin ? isGlobal(level) : !isGlobal(level));
  const ownLevels = levels.filter((l) => canEdit(l));
  const pending = requests.filter((r) => r.status === 'pending');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Realtor Levels</h1>
        <p className="text-sm text-slate-500">Define the level ladder, place realtors on a level, and review upgrade requests.</p>
      </div>

      {message && (
        <div className={`rounded-lg px-4 py-2 text-sm ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message.text}
        </div>
      )}

      <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900">Level Ladder</h2>
            <p className="text-xs text-slate-500">
              Ordered lowest to highest. Realtors may only request a level above their current one.
            </p>
          </div>
          {isSuperiorAdmin && (
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600">Show levels for</span>
              <Select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">Global ladder only</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </label>
          )}
        </div>

        {loading ? <p className="text-sm text-slate-500">Loading...</p> : (
          <div className="space-y-2">
            {levels.map((level, index) => (
              <div key={level.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 p-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: 'var(--primary)' }}>
                  {level.position}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{level.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${isGlobal(level) ? 'bg-slate-100 text-slate-600' : 'bg-indigo-100 text-indigo-700'}`}>
                      {isGlobal(level)
                        ? 'Global'
                        : (isSuperiorAdmin ? companyName(level.company_id) : 'Your company')}
                    </span>
                    {level.is_active === false && <Badge value="inactive" />}
                  </div>
                  {level.description && <p className="truncate text-xs text-slate-500">{level.description}</p>}
                  <p className="text-[11px] text-slate-400">
                    {Number(level.commission_percentage || 0)}% commission ·{' '}
                    {realtors.filter((r) => r.realtor_level_id === level.id).length} realtor(s)
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {canEdit(level) ? (
                    <>
                      <Button type="button" variant="secondary" size="sm" disabled={saving || ownIndex(level) === 0} onClick={() => move(level, -1)} title="Move down the ladder">
                        <ArrowUp size={14} />
                      </Button>
                      <Button type="button" variant="secondary" size="sm" disabled={saving || ownIndex(level) === ownLevels.length - 1} onClick={() => move(level, 1)} title="Move up the ladder">
                        <ArrowDown size={14} />
                      </Button>
                      <input
                        type="number" min="0" max="100" step="0.01"
                        defaultValue={Number(level.commission_percentage || 0)}
                        disabled={saving}
                        title="Commission %"
                        onBlur={(e) => {
                          const next = Number(e.target.value);
                          if (next === Number(level.commission_percentage || 0)) return;
                          guard(() => updateRealtorLevel(level.id, { commission_percentage: next }), 'Commission updated.');
                        }}
                        className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                      />
                      <Button
                        type="button" variant="secondary" size="sm" disabled={saving}
                        onClick={() => guard(() => updateRealtorLevel(level.id, { is_active: level.is_active === false }), 'Level updated.')}
                      >
                        {level.is_active === false ? 'Activate' : 'Deactivate'}
                      </Button>
                      <Button
                        type="button" variant="danger" size="sm" disabled={saving}
                        onClick={() => window.confirm(`Delete the "${level.name}" level?`) && guard(() => deleteRealtorLevel(level.id), 'Level deleted.')}
                      >
                        Delete
                      </Button>
                    </>
                  ) : (
                    <span className="text-[11px] text-slate-400">
                      {isGlobal(level) ? 'Managed by the platform' : `Managed by ${companyName(level.company_id)}`}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {!levels.length && (
              <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                No levels to show. Level ladders are managed per company, so ask a platform
                administrator to link your account to one.
              </p>
            )}
          </div>
        )}

        <form onSubmit={addLevel} className="mt-4 grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-[1fr_2fr_auto_auto] md:items-end">
          <Input label="New level name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Elite" />
          <Input label="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional" />
          <Input
            label="Commission %" type="number" min="0" max="100" step="0.01"
            value={form.commission_percentage}
            onChange={(e) => setForm((f) => ({ ...f, commission_percentage: e.target.value }))}
            placeholder="0"
          />
          <Button type="submit" disabled={saving || !form.name.trim()}>Add Level</Button>
        </form>
      </section>

      {isSuperiorAdmin ? (
        <section className="rounded-xl bg-slate-50 p-5 ring-1 ring-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">Upgrade Requests &amp; Realtor Placement</h2>
          <p className="mt-1 text-sm text-slate-500">
            These are handled by each company&apos;s administrator. You manage the global level ladder,
            and can inspect a company&apos;s levels using the filter above.
          </p>
        </section>
      ) : (
        <>
      <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">
          Upgrade Requests{pending.length ? ` (${pending.length} pending)` : ''}
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Realtor</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">From</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Requested</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Reason</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.map((request) => (
                <tr key={request.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{request.realtor?.name || `#${request.user_id}`}</td>
                  <td className="px-4 py-3 text-slate-600">{request.current_level_name || '—'}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{request.requested_level_name}</td>
                  <td className="px-4 py-3 max-w-xs truncate text-slate-500" title={request.reason || ''}>{request.reason || '—'}</td>
                  <td className="px-4 py-3"><Badge value={request.status} /></td>
                  <td className="px-4 py-3 text-right">
                    {request.status === 'pending' ? (
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="success" size="sm" onClick={() => { setReview({ request, decision: 'approved' }); setNotes(''); }}>Approve</Button>
                        <Button type="button" variant="danger" size="sm" onClick={() => { setReview({ request, decision: 'rejected' }); setNotes(''); }}>Decline</Button>
                      </div>
                    ) : <span className="text-xs text-slate-400">{request.review_notes || 'Reviewed'}</span>}
                  </td>
                </tr>
              ))}
              {!requests.length && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No upgrade requests yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Realtor Placement</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Realtor</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Code</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Verification</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Current Level</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Assign</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {realtors.map((realtor) => (
                <tr key={realtor.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{realtor.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{realtor.realtor_code || '—'}</td>
                  <td className="px-4 py-3"><VerificationBadge status={realtor.kyc?.status || 'not_submitted'} /></td>
                  <td className="px-4 py-3 text-slate-700">{realtor.realtor_level_id ? levelName(realtor.realtor_level_id) : <span className="text-slate-400">Unassigned</span>}</td>
                  <td className="px-4 py-3">
                    <Select
                      value={realtor.realtor_level_id ?? ''}
                      disabled={saving}
                      onChange={(e) => guard(() => assignRealtorLevel(realtor.id, e.target.value ? Number(e.target.value) : null), 'Level assigned.')}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Unassigned</option>
                      {levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </Select>
                  </td>
                </tr>
              ))}
              {!realtors.length && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No realtors found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

        </>
      )}

      <Modal
        open={!!review}
        onClose={() => !saving && setReview(null)}
        title={review?.decision === 'approved' ? 'Approve Upgrade' : 'Decline Upgrade'}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            <strong>{review?.request?.realtor?.name}</strong> requested{' '}
            <strong>{review?.request?.requested_level_name}</strong>
            {review?.request?.current_level_name ? ` (currently ${review.request.current_level_name})` : ''}.
          </p>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">
              {review?.decision === 'rejected' ? 'Reason for declining' : 'Note to the realtor'}
              {review?.decision === 'rejected'
                ? <span className="text-red-500"> *</span>
                : <span className="ml-1 font-normal text-slate-400">(optional)</span>}
            </span>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="secondary" onClick={() => setReview(null)} disabled={saving}>Cancel</Button>
            <Button
              type="button"
              variant={review?.decision === 'approved' ? 'success' : 'danger'}
              onClick={submitReview}
              disabled={saving || (review?.decision === 'rejected' && !notes.trim())}
            >
              {saving ? 'Saving…' : review?.decision === 'approved' ? 'Approve' : 'Decline'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

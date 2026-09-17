import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import {
  approveLevelRequest, assignRealtorLevel,
  listLevelRequests, listRealtorLevels, rejectLevelRequest, saveRealtorLadder,
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
import FieldMark from '../../components/ui/FieldMark';
import { useCurrency } from '../../context/useAppearance';

const asList = (response) => (Array.isArray(response) ? response : (response?.data ?? []));

/**
 * Admin management for realtor levels: define the ladder, reorder it, place
 * realtors on a level, and review upgrade requests.
 *
 * ── The ladder is edited as one thing ──────────────────────────────────────
 *
 * Every field below is a draft until Save. It used to write on every
 * keystroke's blur — one request per cell, each landing on its own — which
 * meant an admin reorganising a ladder produced a stream of saves, and a
 * failure halfway through left the ladder as neither the old one nor the new.
 * Now the whole ladder goes up together and either replaces what was there or
 * changes nothing.
 *
 * ── The platform ladder, and making it yours ───────────────────────────────
 *
 * A company starts on the four rungs the platform ships, which it does not
 * own. Before, that meant every control was disabled and the page read as
 * though somebody had deleted the levels. Now the fields are editable and
 * saving adopts them: the rungs become the company's own copies, and the
 * banner says so before they press it, because it is not reversible from
 * here.
 */
export default function RealtorLevelsPage() {
  const isSuperiorAdmin = useAuthStore((state) => state.isSuperiorAdmin);
  const [companies, setCompanies] = useState([]);
  // Superior admins browse one company's levels at a time; '' means global only.
  const [companyFilter, setCompanyFilter] = useState('');
  const [levels, setLevels] = useState([]);
  // The editable copy. `levels` stays as the server last returned it, so the
  // page can tell whether anything has actually changed.
  const [draft, setDraft] = useState([]);
  const [ladder, setLadder] = useState({ editable: true, source: 'platform' });
  const [realtors, setRealtors] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const fmt = useCurrency();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [review, setReview] = useState(null);   // { request, decision }
  const [notes, setNotes] = useState('');

  const say = (type, text) => setMessage({ type, text });

  /*
   * A row as the editor holds it. Fees are naira here and kobo on the wire —
   * nobody prices a level in kobo — and `key` exists because a brand-new row
   * has no id yet and React still needs to tell two of them apart.
   */
  const toRow = (level) => ({
    key: `saved-${level.id}`,
    id: level.id,
    name: level.name || '',
    description: level.description || '',
    commission_percentage: String(Number(level.commission_percentage || 0)),
    levelup_fee: String(Number(level.levelup_fee_minor || 0) / 100),
    is_active: level.is_active !== false,
  });

  const load = async () => {
    setLoading(true);
    const [levelRes, realtorRes, requestRes] = await Promise.allSettled([
      listRealtorLevels(companyFilter ? { company_id: companyFilter } : undefined),
      listRealtors({ limit: 200 }),
      listLevelRequests(),
    ]);
    const items = (r) => (r.status === 'fulfilled' ? asList(r.value) : []);
    const rows = items(levelRes);
    setLevels(rows);
    setDraft(rows.map(toRow));
    const body = levelRes.status === 'fulfilled' ? levelRes.value : null;
    setLadder({
      editable: body?.editable !== false,
      source: body?.source || (rows[0]?.company_id ? 'company' : 'platform'),
    });
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

  // ── The ladder draft ──────────────────────────────────────────────────────

  const editRow = (index, patch) => setDraft((rows) => rows.map(
    (row, i) => (i === index ? { ...row, ...patch } : row),
  ));

  const addRow = () => setDraft((rows) => [...rows, {
    // No id: the server reads that as a new rung rather than an edit.
    key: `new-${rows.length}-${rows.reduce((n, r) => n + r.key.length, 0)}`,
    id: null,
    name: '',
    description: '',
    commission_percentage: '0',
    levelup_fee: '0',
    is_active: true,
  }]);

  const removeRow = (index) => setDraft((rows) => rows.filter((_, i) => i !== index));

  const move = (index, delta) => setDraft((rows) => {
    const to = index + delta;
    if (to < 0 || to >= rows.length) return rows;
    const next = [...rows];
    [next[index], next[to]] = [next[to], next[index]];
    return next;
  });

  const saveLadder = () => guard(
    // Kobo on the wire; the field asks for naira.
    () => saveRealtorLadder(draft.map((row) => ({
      id: row.id ?? undefined,
      name: row.name.trim(),
      description: row.description.trim() || null,
      commission_percentage: row.commission_percentage === '' ? 0 : Number(row.commission_percentage),
      levelup_fee_minor: row.levelup_fee === '' ? 0 : Math.round(Number(row.levelup_fee) * 100),
      is_active: row.is_active,
    }))),
    ladder.source === 'platform' ? 'The ladder is now yours to manage.' : 'Ladder saved.',
  );

  const resetDraft = () => setDraft(levels.map(toRow));

  const submitReview = () => {
    const action = review.decision === 'approved' ? approveLevelRequest : rejectLevelRequest;
    guard(
      () => action(review.request.id, { notes: notes.trim() || null }),
      review.decision === 'approved' ? 'Upgrade approved.' : 'Request declined.',
    ).then(() => { setReview(null); setNotes(''); });
  };

  const levelName = (id) => levels.find((l) => l.id === id)?.name || '—';
  const pending = requests.filter((r) => r.status === 'pending');

  /*
   * Who may edit what.
   *
   * A company admin may always edit the ladder in front of them: their own if
   * they have one, and the platform's if they have not — editing the latter is
   * how they come to have one. The single case that is genuinely read-only is
   * a superior admin looking at a company's own ladder through the filter,
   * which belongs to that company's administrator.
   */
  const canEditLadder = ladder.editable;
  const companyName = (id) => companies.find((c) => c.id === id)?.name || `Company #${id}`;

  /*
   * Compared field by field against what the server returned, not tracked by a
   * flag. A flag set on every keystroke calls typing a character and deleting
   * it a change, and then offers to save nothing.
   */
  const dirty = JSON.stringify(draft) !== JSON.stringify(levels.map(toRow));
  const draftIsValid = draft.length > 0
    && draft.every((row) => row.name.trim())
    && new Set(draft.map((row) => row.name.trim().toLowerCase())).size === draft.length;

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
            {/*
              Whose ladder this is. Two companies' ladders look identical on
              screen, and a superior admin switching between them with the
              filter needs the answer in words rather than by remembering what
              they last selected.
            */}
            <p className="mt-0.5 text-xs font-medium text-slate-600">
              {ladder.source === 'company'
                ? (isSuperiorAdmin && companyFilter
                  ? `${companyName(Number(companyFilter))}\u2019s own ladder`
                  : 'Your company\u2019s own ladder')
                : 'The ladder the platform ships'}
            </p>
          </div>
          {isSuperiorAdmin && (
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600">Show levels for<FieldMark /></span>
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

        {/*
          Said BEFORE they type, not after they press Save.

          Adopting the platform ladder is a one-way door — from then on the
          company has its own rungs and a later platform change does not reach
          them. Somebody who only wanted to correct a typo is entitled to know
          that before they make it.
        */}
        {!loading && ladder.source === 'platform' && !isSuperiorAdmin && (
          <div className="mb-4 rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-900 ring-1 ring-sky-200">
            <p className="font-medium">You are using the ladder the platform ships.</p>
            <p className="mt-0.5">
              Rename a rung, price it, reorder it or add your own, and saving makes the whole
              ladder yours. Your realtors keep their standing. After that, changes the platform
              makes to its ladder no longer reach you.
            </p>
          </div>
        )}

        {loading ? <p className="text-sm text-slate-500">Loading...</p> : (
          <div className="space-y-2">
            {draft.map((row, index) => {
              const saved = row.id ? levels.find((l) => l.id === row.id) : null;
              const standing = saved
                ? realtors.filter((r) => r.realtor_level_id === saved.id).length
                : 0;
              return (
                <div key={row.key} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex flex-wrap items-start gap-3">
                    {/* The rung number is the ROW's place in the list, not a
                        stored position — reordering renumbers as you drag. */}
                    <span
                      className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: 'var(--primary)' }}
                    >
                      {index + 1}
                    </span>

                    <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <Input
                        label="Name"
                        required
                        value={row.name}
                        disabled={!canEditLadder}
                        onChange={(e) => editRow(index, { name: e.target.value })}
                        placeholder="e.g. Gold"
                      />
                      <Input
                        label="Description"
                        value={row.description}
                        disabled={!canEditLadder}
                        onChange={(e) => editRow(index, { description: e.target.value })}
                        placeholder="Optional"
                      />
                      <Input
                        label="Commission %" type="number" min="0" max="100" step="0.01"
                        value={row.commission_percentage}
                        disabled={!canEditLadder}
                        onChange={(e) => editRow(index, { commission_percentage: e.target.value })}
                      />
                      {/* Blank or zero means free, which is the right default:
                          a company that has not thought about charging should
                          not start charging by accident. */}
                      <Input
                        label="Level-up fee" type="number" min="0" step="0.01"
                        value={row.levelup_fee}
                        disabled={!canEditLadder}
                        onChange={(e) => editRow(index, { levelup_fee: e.target.value })}
                        placeholder="0 — free"
                      />
                    </div>

                    <div className="flex shrink-0 items-center gap-1 pt-6">
                      <Button type="button" variant="secondary" size="sm" disabled={!canEditLadder || index === 0} onClick={() => move(index, -1)} title="Move down the ladder">
                        <ArrowUp size={14} />
                      </Button>
                      <Button type="button" variant="secondary" size="sm" disabled={!canEditLadder || index === draft.length - 1} onClick={() => move(index, 1)} title="Move up the ladder">
                        <ArrowDown size={14} />
                      </Button>
                      <Button
                        type="button" variant="secondary" size="sm" disabled={!canEditLadder}
                        onClick={() => editRow(index, { is_active: !row.is_active })}
                      >
                        {row.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                      {/*
                        Refused on the page rather than by the server, because
                        the server can only refuse the whole save — and an
                        admin who has spent two minutes rearranging a ladder
                        should not lose it to a rule they could have been told
                        about at the moment they broke it.
                      */}
                      <Button
                        type="button" variant="danger" size="sm"
                        disabled={!canEditLadder || draft.length === 1 || standing > 0}
                        title={standing > 0
                          ? `${standing} realtor${standing === 1 ? ' is' : 's are'} on this level — move them first`
                          : (draft.length === 1 ? 'A ladder needs at least one level' : 'Remove this level')}
                        onClick={() => removeRow(index)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>

                  <p className="mt-2 pl-10 text-[11px] text-slate-400">
                    {row.is_active ? '' : 'Inactive · '}
                    {Number(row.levelup_fee || 0) > 0
                      ? `${fmt(Number(row.levelup_fee))} to reach`
                      : 'free to reach'}
                    {saved ? ` · ${standing} realtor(s)` : ' · new'}
                  </p>
                </div>
              );
            })}

            {!draft.length && (
              <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                There are no levels yet. Add one to start the ladder.
              </p>
            )}
          </div>
        )}

        {canEditLadder && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="secondary" onClick={addRow} disabled={saving}>
              <span className="inline-flex items-center gap-1.5"><Plus size={14} /> Add a level</span>
            </Button>
            <div className="flex-1" />
            {dirty && (
              <Button type="button" variant="secondary" onClick={resetDraft} disabled={saving}>
                Discard changes
              </Button>
            )}
            <Button type="button" onClick={saveLadder} disabled={saving || !dirty || !draftIsValid}>
              {saving ? 'Saving…' : 'Save ladder'}
            </Button>
          </div>
        )}
        {!canEditLadder && !loading && (
          <p className="mt-4 border-t border-slate-100 pt-4 text-xs text-slate-400">
            {isSuperiorAdmin
              ? 'This is the company\u2019s own ladder. Their administrator manages it.'
              : 'Managed by the platform.'}
          </p>
        )}
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
              {/* Required only when declining: a rejection has to say why, and a
                  promotion does not. */}
              <FieldMark required={review?.decision === 'rejected'} />
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

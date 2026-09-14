import { useEffect, useState } from 'react';
import { Award } from 'lucide-react';
import { listRealtorLevels, listLevelRequests, requestLevelUpgrade } from '../../api/realtorLevelApi';
import { getUser } from '../../api/userApi';
import Button from '../ui/Button';
import useAuthStore from '../../store/authStore';
import Select from '../ui/Select';

/**
 * The realtor's place on the level ladder and the upgrade request flow.
 *
 * This is the only place an upgrade can be requested — the dashboard shows the
 * level as a read-only badge and links here.
 */
export default function LevelPanel() {
  const user = useAuthStore((state) => state.user);

  const [levels, setLevels] = useState([]);
  const [levelId, setLevelId] = useState(null);
  const [pending, setPending] = useState(null);
  const [target, setTarget] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    // allSettled: listLevelRequests is admin-scoped for some accounts, and a
    // rejection there must not blank out the level ladder.
    const [levelRes, requestRes, meRes] = await Promise.allSettled([
      listRealtorLevels(),
      listLevelRequests({ status: 'pending' }),
      user?.id ? getUser(user.id) : Promise.resolve(null),
    ]);
    const items = (r) => (r.status === 'fulfilled' ? (r.value?.data ?? r.value ?? []) : []);
    setLevels(items(levelRes));
    setPending(items(requestRes)[0] || null);
    const me = meRes.status === 'fulfilled' ? (meRes.value?.data ?? meRes.value) : null;
    if (me) setLevelId(me.realtor_level_id ?? null);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const active = levels.filter((l) => l.is_active !== false);
  const current = active.find((l) => l.id === levelId) || null;
  // Only levels above the current rank count as an upgrade.
  const upgrades = active.filter((l) => !current || l.position > current.position);

  useEffect(() => {
    if (!target && upgrades.length) setTarget(String(upgrades[0].id));
  }, [upgrades.length, target]);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await requestLevelUpgrade({ level_id: Number(target), reason: reason.trim() || null });
      setReason('');
      setNotice('Upgrade request submitted. An administrator will review it.');
      load();
    } catch (err) {
      setError(err?.response?.data?.message || err?.userMessage || 'Could not submit the request.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="rounded-xl bg-white p-6 text-slate-500">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: 'var(--primary)' }}>
            <Award size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your current level</p>
            <p className="break-words text-xl font-bold leading-tight text-slate-900">
              {current ? current.name : 'Not assigned yet'}
            </p>
            {current && Number(current.commission_percentage) > 0 && (
              <p className="mt-0.5 text-xs font-medium text-emerald-600">
                {Number(current.commission_percentage)}% commission rate
              </p>
            )}
            {current?.description && <p className="mt-0.5 text-xs text-slate-400">{current.description}</p>}
          </div>
        </div>

        {active.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {active.map((level) => {
              const reached = current && level.position <= current.position;
              return (
                <span
                  key={level.id}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${reached ? 'text-white' : 'bg-slate-100 text-slate-500'}`}
                  style={reached ? { backgroundColor: 'var(--primary)' } : undefined}
                >
                  {level.name}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {notice && <div className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">{notice}</div>}
      {error && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      {pending ? (
        <div className="rounded-xl bg-amber-50 p-6 ring-1 ring-amber-200">
          <p className="text-sm font-semibold text-amber-800">
            {pending.requested_level_name} upgrade pending review
          </p>
          <p className="mt-1 text-sm text-amber-700">
            An administrator is reviewing your request. You will be notified once it is decided.
          </p>
        </div>
      ) : upgrades.length === 0 ? (
        <div className="rounded-xl bg-white p-6 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
          {current
            ? 'You are on the highest level available. There is nothing to request.'
            : 'No levels are available to request yet.'}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Request an upgrade</h2>
            <p className="mt-1 text-sm text-slate-500">
              You are currently on <strong>{current?.name || 'no level'}</strong>. An administrator reviews every request.
            </p>
          </div>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Level to request</span>
            <Select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              {upgrades.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Why should you be upgraded? <span className="font-normal text-slate-400">(optional)</span>
            </span>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              placeholder="e.g. Closed 12 deals this quarter."
              className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>

          <div className="flex justify-end border-t border-slate-100 pt-4">
            <Button type="submit" disabled={busy || !target}>
              {busy ? 'Submitting…' : 'Submit Request'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

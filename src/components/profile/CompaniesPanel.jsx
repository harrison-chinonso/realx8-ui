import { useState } from 'react';
import { Building2, Check, Plus } from 'lucide-react';

import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import useAuthStore from '../../store/authStore';

/**
 * The companies this person deals with, and the way to add another.
 *
 * ── Why this is here and not in the top bar ─────────────────────────────────
 *
 * Joining a company is a rare, deliberate act — you do it once per company,
 * holding a code somebody gave you. The top bar is for the thing you do
 * repeatedly, which is SWITCHING, and that only exists once there is more than
 * one company to switch between.
 *
 * Putting the join entry in the bar meant the switcher had to render for people
 * with a single company too, which put a 113px pill that cannot shrink into
 * every realtor's and client's header. On a 430px phone the bar then needed
 * 453px, and mobile Chrome responds to that by scaling the whole page down to
 * fit — so the app rendered small on a LARGER screen, which is a strange enough
 * symptom to be hard to trace back to one control.
 *
 * So the two live where they belong: switching in the bar, joining here.
 */
export default function CompaniesPanel() {
  const companies = useAuthStore((state) => state.companies) || [];
  const canJoin = useAuthStore((state) => state.multiCompanySignups) !== false;
  const joinCompany = useAuthStore((state) => state.joinCompany);
  const switchCompany = useAuthStore((state) => state.switchCompany);
  const user = useAuthStore((state) => state.user);

  const [form, setForm] = useState({ code: '', role: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [joined, setJoined] = useState(null);

  const current = companies.find((entry) => entry.current);

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await joinCompany({
        companyCode: form.code.trim().toUpperCase(),
        role: form.role || current?.type || user?.type || 'client',
        password: form.password || undefined,
      });
      setJoined(result || null);
      setForm({ code: '', role: '', password: '' });
    } catch (err) {
      setError(err?.response?.data?.message || err?.userMessage || 'Could not join that company.');
    } finally {
      setBusy(false);
    }
  };

  const goTo = async (entry) => {
    if (busy || entry.current) return;
    setBusy(true);
    setError('');
    try {
      await switchCompany(entry.company_id);
      window.location.reload();
    } catch (err) {
      const reason = err?.response?.data?.reason;
      setError(reason === 'password_required' || reason === 'password_incorrect'
        ? `${err.response.data.message} Use the company menu in the header to enter it.`
        : (err?.response?.data?.message || err?.userMessage || 'Could not switch company.'));
      setBusy(false);
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      <section className="space-y-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Your companies</h2>
          <p className="mt-1 text-sm text-slate-500">
            Each one is a separate account with its own records — and its own password, if you
            chose to give it one.
          </p>
        </div>

        <ul className="divide-y divide-slate-100">
          {(companies.length ? companies : [{
            account_id: 'current',
            company_id: user?.company_id ?? null,
            company_name: current?.company_name || 'Your company',
            type: user?.type,
            current: true,
          }]).map((entry) => (
            <li key={entry.account_id} className="flex items-center gap-3 py-3">
              <Building2 aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-800">
                  {entry.company_name}
                </span>
                <span className="block truncate text-xs text-slate-400">
                  {entry.current ? `Signed in · your ${entry.type} account` : `Your ${entry.type} account`}
                </span>
              </span>
              {entry.current ? (
                <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => goTo(entry)}>
                  Switch
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {canJoin && (
        <section className="space-y-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Plus aria-hidden="true" className="h-4 w-4" /> Join another company
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Enter the code the company gave you. You keep this account exactly as it is.
            </p>
          </div>

          {joined ? (
            <div className="space-y-3">
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200">
                Your account with <strong>{joined.company?.name}</strong> is open.
                {joined.switch_needs_password
                  ? ' It has the password you chose for it, so switching there will ask for it.'
                  : ' It uses the password you already sign in with.'}
              </p>
              <Button type="button" variant="secondary" onClick={() => setJoined(null)}>
                Join another
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <Input
                label="Company code"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="e.g. AB12C"
                required
              />
              {/*
                Asked rather than assumed: somebody who sells for one agency may
                simply be buying from another, and the two are separate accounts.
              */}
              <Select
                label="Join as"
                value={form.role || current?.type || user?.type || 'client'}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                options={[
                  { value: 'client', label: 'Client — buying property' },
                  { value: 'realtor', label: 'Realtor — selling for them' },
                ]}
              />
              <Input
                label="Password for this company"
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Leave blank to use your current password"
                autoComplete="new-password"
              />
              {error && <p className="text-sm text-rose-600">{error}</p>}
              <Button type="submit" disabled={busy || !form.code.trim()}>
                {busy ? 'Joining…' : 'Join company'}
              </Button>
            </form>
          )}
        </section>
      )}

      {error && !canJoin && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}

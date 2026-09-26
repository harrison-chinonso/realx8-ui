import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { User, Lock, ShieldCheck, Award, Building2 } from 'lucide-react';
import { getUser, updateUser } from '../../api/userApi';
import useAuthStore from '../../store/authStore';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import VerificationPanel from '../../components/profile/VerificationPanel';
import LevelPanel from '../../components/profile/LevelPanel';
import CompaniesPanel from '../../components/profile/CompaniesPanel';
import DeleteAccountPanel from '../../components/profile/DeleteAccountPanel';
import ProfileToggle from '../../components/common/ProfileToggle';
import FieldMark from '../../components/ui/FieldMark';

function PersonalDetailsTab() {
  const user = useAuthStore((state) => state.user);
  const setSession = useAuthStore((state) => state.setSession);
  const accessToken = useAuthStore((state) => state.accessToken);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const permissions = useAuthStore((state) => state.permissions);

  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (user?.id) {
      getUser(user.id).then((res) => {
        const u = res.data || res;
        setForm({ name: u.name || '', email: u.email || '', phone: u.phone || '' });
      });
    }
  }, [user?.id]);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await updateUser(user.id, form);
      const updated = res.data || res;
      setSession({ user: { ...updated, permissions }, accessToken, refreshToken });
      setMessage({ type: 'success', text: 'Profile updated successfully.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.userMessage });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      {message && (
        <div className={`rounded-lg p-3 text-sm ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message.text}
        </div>
      )}
      <div>
        <label className="mb-1 block text-sm font-medium">Full name<FieldMark required /></label>
        <Input name="name" value={form.name} onChange={handleChange} required />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Email<FieldMark required /></label>
        <Input type="email" name="email" value={form.email} onChange={handleChange} required />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Phone<FieldMark /></label>
        <Input name="phone" value={form.phone} onChange={handleChange} />
      </div>
      <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
    </form>
  );
}

function SecurityTab() {
  const user = useAuthStore((state) => state.user);
  const effectiveType = useAuthStore((state) => state.effectiveType());
  /*
   * Only a realtor or a client may delete their own account.
   *
   * Same line the Companies tab draws, for the same reason: those two are the
   * only types that hold an account PER COMPANY, which is the unit this deletes.
   * A staff account is the company — an administrator removing themselves is an
   * administrative act with consequences for everyone else's access, and it
   * belongs on the Users screen where somebody else performs it, not on a self
   * -service tab. It would also let the last administrator lock the company out
   * of its own account, since no guard stops that.
   */
  const canDeleteOwnAccount = effectiveType === 'realtor' || effectiveType === 'client';
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);

    if (!form.password) {
      setMessage({ type: 'error', text: 'Enter a new password.' });
      return;
    }
    if (form.password !== form.confirm) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setSaving(true);
    try {
      await updateUser(user.id, { password: form.password });
      setMessage({ type: 'success', text: 'Password changed successfully.' });
      setForm({ password: '', confirm: '' });
    } catch (err) {
      setMessage({ type: 'error', text: err.userMessage });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Change password</h2>
        <p className="mt-1 text-sm text-slate-500">Choose a password you do not use anywhere else.</p>
      </div>
      {message && (
        <div className={`rounded-lg p-3 text-sm ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message.text}
        </div>
      )}
      <div>
        <label className="mb-1 block text-sm font-medium">New password<FieldMark /></label>
        <Input type="password" name="password" value={form.password} onChange={handleChange} autoComplete="new-password" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Confirm password<FieldMark /></label>
        <Input type="password" name="confirm" value={form.confirm} onChange={handleChange} autoComplete="new-password" />
      </div>
      <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Change password'}</Button>
      </form>

      {/* Last thing on the tab, and visibly separated — it is the one action
          here that cannot be undone. Realtors and clients only. */}
      {canDeleteOwnAccount && <DeleteAccountPanel />}
    </div>
  );
}

export default function ProfilePage() {
  const effectiveType = useAuthStore((state) => state.effectiveType());
  const [searchParams, setSearchParams] = useSearchParams();

  // Realtor-only tabs: a client has no verification and no level ladder.
  const tabs = useMemo(() => {
    const base = [
      { key: 'details', label: 'Personal Details', Icon: User, render: () => <PersonalDetailsTab /> },
      { key: 'security', label: 'Security', Icon: Lock, render: () => <SecurityTab /> },
    ];
    /*
     * Realtors and clients are the only ones who can hold accounts at more than
     * one company, so they are the only ones this tab means anything to.
     */
    if (effectiveType === 'realtor' || effectiveType === 'client') {
      base.push({
        key: 'companies', label: 'Companies', Icon: Building2, render: () => <CompaniesPanel />,
      });
    }
    if (effectiveType === 'realtor') {
      base.push(
        { key: 'verification', label: 'Verification', Icon: ShieldCheck, render: () => <VerificationPanel /> },
        { key: 'level', label: 'Level Upgrade', Icon: Award, render: () => <LevelPanel /> },
      );
    }
    return base;
  }, [effectiveType]);

  // The tab lives in the URL so links can deep-link into it and a reload keeps
  // the user where they were. An unknown or realtor-only key for a client falls
  // back to the first tab rather than rendering nothing.
  const requested = searchParams.get('tab');
  const active = tabs.find((t) => t.key === requested) || tabs[0];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">My Profile</h1>

      {/*
        The realtor/client switch, on phones only.
        The top bar carries it from `sm` up, and cannot below that — two pills
        plus three icon buttons do not fit a 360px header, and a bar wider than
        the screen makes mobile browsers scale the whole page down. Shown here
        instead, so there is exactly one of it at any screen size.
      */}
      <div className="sm:hidden">
        <ProfileToggle />
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {tabs.map((tab) => {
          const isActive = tab.key === active.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSearchParams(tab.key === tabs[0].key ? {} : { tab: tab.key })}
              className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? 'text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
              style={isActive ? { borderColor: 'var(--primary, #2563eb)' } : undefined}
            >
              <tab.Icon className="h-4 w-4 shrink-0" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div>{active.render()}</div>
    </div>
  );
}

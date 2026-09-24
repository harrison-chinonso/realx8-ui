import { useEffect, useMemo, useState } from 'react';
import { listRealtors, createUser, updateUser, deleteUser } from '../../api/userApi';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import DetailsModal from '../../components/common/DetailsModal';
import ActionsMenu from '../../components/common/ActionsMenu';
import RealtorReferralsModal from '../../components/common/RealtorReferralsModal';
import UserSummaryModal from '../../components/common/UserSummaryModal';
import VerificationBadge from '../../components/common/VerificationBadge';
import Button from '../../components/ui/Button';
import ReferralCodeCard from '../../components/common/ReferralCodeCard';
import Modal from '../../components/common/Modal';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { useCurrency } from '../../context/useAppearance';
import FieldMark from '../../components/ui/FieldMark';
import { MIN_PASSWORD_LENGTH, PASSWORD_HINT } from '../../constants/password';
import CompanyField from '../../components/common/CompanyField';

const EMPTY_CREATE = { name: '', email: '', password: '', phone: '', category: 'basic', realtor_id: '', company_id: '' };

export default function RealtorsPage() {
  const fmt = useCurrency();
  const [realtors, setRealtors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_CREATE);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  /*
   * Said out loud when the server added this person to an account they
   * already had. The password typed on this form was not applied — they
   * sign in with the one they already use — and an administrator who is not
   * told that will pass on a password that does not work.
   */
  const [createNotice, setCreateNotice] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');
  const [detailRow, setDetailRow] = useState(null);
  const [summaryFor, setSummaryFor] = useState(null);
  const [referralsFor, setReferralsFor] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', is_active: true, category: 'basic' });

  /*
   * Only realtors from the company being created into.
   *
   * A platform admin sees every company's realtors in `realtors`, and the
   * server refuses a cross-company attribution — so without this the list
   * offers choices that can only come back as an error. For everybody else the
   * list is already their own company and the filter is a no-op.
   */
  const referralOptions = useMemo(() => (
    form.company_id
      ? realtors.filter((r) => String(r.company_id) === String(form.company_id))
      : realtors
  ), [realtors, form.company_id]);

  const load = () => {
    setLoading(true);
    listRealtors()
      .then((realtorsResponse) => setRealtors(realtorsResponse.data || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  /*
   * No role is asked for. The screen is Add Realtor; the dropdown it replaces
   * offered Realtor and nothing else.
   *
   * What takes its place is the referring realtor — who recruited this one —
   * which is the same `realtor_id` a realtor picks up when they sign up through
   * a colleague's link, and the same field the Clients screen now sets.
   */
  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    setCreateNotice('');
    try {
      const created = await createUser({
        name: form.name,
        email: form.email,
        password: form.password,
        phone: form.phone,
        category: form.category,
        type: 'realtor',
        role: 'realtor',
        ...(form.company_id ? { company_id: Number(form.company_id) } : {}),
        realtor_id: form.realtor_id ? Number(form.realtor_id) : null,
      });
      // Reset through the constant — the old inline reset dropped `category`,
      // leaving the tier control with no value on the next open.
      setForm(EMPTY_CREATE);
      load();
      // The modal stays open when there is something to read; closing it would
      // take the only copy of that sentence with it.
      if (created?.notice) setCreateNotice(created.notice);
      else setShowCreate(false);
    } catch (err) {
      setCreateError(err?.userMessage || 'Could not add the realtor.');
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = (user) => {
    setEditError('');
    setEditingUser(user);
    setEditForm({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      is_active: Boolean(user.is_active),
      category: user.category || 'basic',
    });
  };

  const handleUpdate = async () => {
    if (!editingUser) return;
    setSavingEdit(true);
    setEditError('');
    try {
      await updateUser(editingUser.id, editForm);
      setEditingUser(null);
      load();
    } catch (err) {
      // Without this the dialog simply refused to close, saying nothing — the
      // same silence that made a rejected create look like a broken button.
      setEditError(err?.userMessage || 'Could not save the changes.');
    } finally {
      setSavingEdit(false);
    }
  };

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'realtor_level_id', label: 'Level', render: (u) => (
      u.realtorLevel?.name
        ? <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">{u.realtorLevel.name}</span>
        : <span className="text-slate-400">Unassigned</span>
    ) },
    { key: 'kyc', label: 'Verification', render: (u) => <VerificationBadge status={u.kyc?.status || 'not_submitted'} /> },
    { key: 'realtor_code', label: 'Code', render: (u) => u.realtor_code ? <span className="font-mono text-xs">{u.realtor_code}</span> : '—' },
    { key: 'is_active', label: 'Status', render: (u) => <Badge value={u.is_active ? 'active' : 'inactive'} /> },
  ];

  const detailFields = [
    { label: 'Name', key: 'name' },
    { label: 'Email', key: 'email' },
    { label: 'Phone', key: 'phone' },
    { label: 'Tier', render: (u) => u.category || 'basic' },
    { label: 'Realtor Code', key: 'realtor_code' },
    { label: 'Role', render: (u) => u.roles?.[0]?.display_name || u.roles?.[0]?.name || 'realtor' },
    { label: 'Commission', render: (u) => fmt(u.commission_amount || 0) },
    { label: 'Level', render: (u) => u.realtorLevel?.name || 'Unassigned' },
    { label: 'Verification', render: (u) => <VerificationBadge status={u.kyc?.status || 'not_submitted'} /> },
    { label: 'Status', render: (u) => <Badge value={u.is_active ? 'active' : 'inactive'} /> },
    { label: 'Created', render: (u) => u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Realtors</h1>
        <Button onClick={() => { setCreateError(''); setShowCreate(true); }}>+ Add Realtor</Button>
      </div>

      <ReferralCodeCard audience="realtors" />

      {loading ? <p className="text-slate-500">Loading...</p> : (
        <Table
          columns={columns}
          rows={realtors}
          renderActions={(u) => (
            <div className="flex items-center justify-end gap-3">
              <Button onClick={() => handleEdit(u)} variant="primary" size="sm">Edit</Button>
              <ActionsMenu
                items={[
                  { label: '👁 View Details', onClick: () => setDetailRow(u) },
                  { label: '📊 Business Summary', onClick: () => setSummaryFor(u) },
                  { label: '🔗 View Referrals', onClick: () => setReferralsFor(u) },
                  { label: '🗑 Remove', variant: 'danger', onClick: () => { if (window.confirm('Remove realtor?')) deleteUser(u.id).then(load); } },
                ]}
              />
            </div>
          )}
        />
      )}
      <UserSummaryModal user={summaryFor} open={!!summaryFor} onClose={() => setSummaryFor(null)} />

      <RealtorReferralsModal
        open={!!referralsFor}
        realtor={referralsFor}
        onClose={() => setReferralsFor(null)}
      />


      <DetailsModal
        open={!!detailRow}
        onClose={() => setDetailRow(null)}
        title={detailRow?.name || 'Realtor Details'}
        record={detailRow}
        fields={detailFields}
      />

      <Modal open={showCreate} onClose={() => !creating && setShowCreate(false)} title="Add Realtor">
        <form onSubmit={handleCreate} className="space-y-3">
          <CompanyField value={form.company_id} onChange={(e) => setForm({ ...form, company_id: e.target.value })} disabled={creating} />
          <Input label="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <div>
            <Input
              label="Password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              minLength={MIN_PASSWORD_LENGTH}
              required
            />
            <p className="mt-1 text-xs text-content-subtle">{PASSWORD_HINT}</p>
          </div>
          <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Tier / Category<FieldMark /></label>
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
              <option value="basic">Basic</option>
              <option value="professional">Professional</option>
              <option value="premium">Premium</option>
            </Select>
          </div>
          <div>
            <Select
              label="Referring realtor"
              value={form.realtor_id}
              onChange={(e) => setForm({ ...form, realtor_id: e.target.value })}
              placeholder="Nobody — direct sign-up"
            >
              <option value="">Nobody — direct sign-up</option>
              {referralOptions.map((r) => (
                <option key={r.id} value={r.id}>{r.name}{r.realtor_code ? ` — ${r.realtor_code}` : ''}</option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-content-subtle">
              Optional. The realtor who recruited this one, credited with the introduction.
            </p>
          </div>
          {createError && <p className="text-sm text-danger">{createError}</p>}
          {createNotice && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
              {createNotice}
            </p>
          )}
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={creating}>{creating ? 'Adding…' : 'Add Realtor'}</Button>
            <Button type="button" variant="secondary" onClick={() => setShowCreate(false)} disabled={creating}>Cancel</Button>
          </div>
        </form>
      </Modal>

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-slate-900">Edit Realtor</h2>
            <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="Phone" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <Select value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="basic">Basic</option>
              <option value="professional">Professional</option>
              <option value="premium">Premium</option>
            </Select>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={editForm.is_active} onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })} className="h-4 w-4" />
              Active
            </label>
            {editError && <p className="text-sm text-danger">{editError}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" onClick={() => setEditingUser(null)} variant="secondary" disabled={savingEdit}>Cancel</Button>
              <Button type="button" onClick={handleUpdate} disabled={savingEdit}>{savingEdit ? 'Saving…' : 'Save'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

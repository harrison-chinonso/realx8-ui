import { useEffect, useMemo, useState } from 'react';
import { listClients, createUser, updateUser, deleteUser, listRealtors } from '../../api/userApi';
import { listRoles } from '../../api/rolesApi';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import DetailsModal from '../../components/common/DetailsModal';
import UserSummaryModal from '../../components/common/UserSummaryModal';
import PaymentAnalysisModal from '../../components/common/PaymentAnalysisModal';
import ActionsMenu from '../../components/common/ActionsMenu';
import Button from '../../components/ui/Button';
import ReferralCodeCard from '../../components/common/ReferralCodeCard';
import Modal from '../../components/common/Modal';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { useCurrency } from '../../context/useAppearance';

export default function ClientsPage() {
  const fmt = useCurrency();
  const [clients, setClients] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', role: 'client' });
  const [editingUser, setEditingUser] = useState(null);
  const [detailRow, setDetailRow] = useState(null);
  const [summaryFor, setSummaryFor] = useState(null);
  const [paymentsFor, setPaymentsFor] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', is_active: true });
  const [realtors, setRealtors] = useState([]);
  const [assigning, setAssigning] = useState(null);   // the client being assigned
  const [savingAssign, setSavingAssign] = useState(false);

  const roleOptions = useMemo(
    () => roles.filter((role) => role.name === 'client').map((role) => ({ value: role.name, label: role.display_name || role.name })),
    [roles]
  );

  const load = () => {
    setLoading(true);
    Promise.all([listClients(), listRoles()])
      .then(([clientsResponse, rolesResponse]) => {
        setClients(clientsResponse.data || []);
        setRoles(rolesResponse.data || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    // Needed to render and change each client's realtor.
    listRealtors({ limit: 200 })
      .then((r) => setRealtors(Array.isArray(r) ? r : (r?.data ?? [])))
      .catch(() => setRealtors([]));
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    await createUser({ ...form, type: 'client', role: form.role || 'client' });
    setShowCreate(false);
    setForm({ name: '', email: '', password: '', phone: '', role: 'client' });
    load();
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setEditForm({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      is_active: Boolean(user.is_active),
    });
  };

  const handleUpdate = async () => {
    if (!editingUser) return;
    await updateUser(editingUser.id, editForm);
    setEditingUser(null);
    load();
  };

  const realtorName = (u) => {
    const realtor = realtors.find((r) => String(r.id) === String(u.realtor_id));
    return realtor ? `${realtor.name}${realtor.realtor_code ? ` (${realtor.realtor_code})` : ''}` : null;
  };

  const handleAssignRealtor = async (realtorId) => {
    if (!assigning) return;
    setSavingAssign(true);
    try {
      // null clears the assignment
      await updateUser(assigning.id, { realtor_id: realtorId ? Number(realtorId) : null });
      setAssigning(null);
      load();
    } catch (err) {
      alert(err?.userMessage || 'Could not update the assignment.');
    } finally {
      setSavingAssign(false);
    }
  };

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'realtor_id', label: 'Realtor', render: (u) => realtorName(u) || <span className="text-slate-400">Unassigned</span> },
    { key: 'is_active', label: 'Status', render: (u) => <Badge value={u.is_active ? 'active' : 'inactive'} /> },
    { key: 'createdAt', label: 'Joined', render: (u) => new Date(u.createdAt).toLocaleDateString() },
  ];

  const detailFields = [
    { label: 'Name', key: 'name' },
    { label: 'Email', key: 'email' },
    { label: 'Phone', key: 'phone' },
    { label: 'Role', render: (u) => <Badge value={u.roles?.[0]?.display_name || u.roles?.[0]?.name || 'client'} /> },
    { label: 'Realtor', render: (u) => realtorName(u) || 'Unassigned' },
    { label: 'Wallet', render: (u) => fmt(u.profile?.wallet_balance || 0) },
    { label: 'Status', render: (u) => <Badge value={u.is_active ? 'active' : 'inactive'} /> },
    { label: 'Joined', render: (u) => u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Clients</h1>
        <Button onClick={() => setShowCreate(true)}>+ Add Client</Button>
      </div>

      <ReferralCodeCard audience="clients" />

      {loading ? <p className="text-slate-500">Loading...</p> : (
        <Table
          columns={columns}
          rows={clients}
          renderActions={(u) => (
            <div className="flex items-center justify-end gap-3">
              <Button onClick={() => handleEdit(u)} variant="primary" size="sm">Edit</Button>
              <ActionsMenu
                items={[
                  { label: '👁 View Details', onClick: () => setDetailRow(u) },
                  { label: '📊 Business Summary', onClick: () => setSummaryFor(u) },
                  { label: '💳 Payment Analysis', onClick: () => setPaymentsFor(u) },
                  { label: '🤝 Assign Realtor', onClick: () => setAssigning(u) },
                  { label: '🗑 Remove', variant: 'danger', onClick: () => { if (window.confirm('Remove client?')) deleteUser(u.id).then(load); } },
                ]}
              />
            </div>
          )}
        />
      )}

      <Modal open={!!assigning} onClose={() => !savingAssign && setAssigning(null)} title={`Assign Realtor — ${assigning?.name ?? ''}`} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            The assigned realtor is notified when this client purchases or pays, and can
            schedule inspections for them.
          </p>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Realtor</span>
            <Select
              defaultValue={assigning?.realtor_id ?? ''}
              onChange={(e) => handleAssignRealtor(e.target.value)}
              disabled={savingAssign}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">Unassigned</option>
              {realtors.map((r) => (
                <option key={r.id} value={r.id}>{r.name}{r.realtor_code ? ` — ${r.realtor_code}` : ''}</option>
              ))}
            </Select>
          </label>
          {!realtors.length && <p className="text-xs text-amber-600">No realtors found. Add realtors under Users first.</p>}
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={() => setAssigning(null)} disabled={savingAssign}>
              {savingAssign ? 'Saving…' : 'Close'}
            </Button>
          </div>
        </div>
      </Modal>

      <UserSummaryModal user={summaryFor} open={!!summaryFor} onClose={() => setSummaryFor(null)} />

      <PaymentAnalysisModal user={paymentsFor} open={!!paymentsFor} onClose={() => setPaymentsFor(null)} />

      <DetailsModal
        open={!!detailRow}
        onClose={() => setDetailRow(null)}
        title={detailRow?.name || 'Client Details'}
        record={detailRow}
        fields={detailFields}
      />

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add Client">
        <form onSubmit={handleCreate} className="space-y-3">
          <Input label="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <Input label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Select label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} options={roleOptions} />
          <div className="flex gap-2 pt-2">
            <Button type="submit">Add Client</Button>
            <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-slate-900">Edit Client</h2>
            <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={editForm.is_active} onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })} className="h-4 w-4" />
              Active
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" onClick={() => setEditingUser(null)} variant="secondary">Cancel</Button>
              <Button type="button" onClick={handleUpdate} >Save</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

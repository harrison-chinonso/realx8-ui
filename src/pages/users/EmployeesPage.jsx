import { useEffect, useMemo, useState } from 'react';
import { listUsers, createUser, updateUser, deleteUser } from '../../api/userApi';
import { listRoles } from '../../api/rolesApi';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import DetailsModal from '../../components/common/DetailsModal';
import ActionsMenu from '../../components/common/ActionsMenu';
import Button from '../../components/ui/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';

// Any user type that is NOT one of these is considered staff
const NON_STAFF_TYPES = ['client', 'realtor'];

const norm = (v) => String(v || '').trim().toLowerCase();

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', role: 'employee' });
  const [editingUser, setEditingUser] = useState(null);
  const [detailRow, setDetailRow] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', is_active: true });

  const roleOptions = useMemo(
    () => roles.map((role) => ({ value: role.name, label: role.display_name || role.name })),
    [roles]
  );

  const load = () => {
    setLoading(true);
    Promise.all([listUsers({ limit: 2000 }), listRoles()])
      .then(([usersResponse, rolesResponse]) => {
        const all = usersResponse.data || usersResponse || [];
        const staff = all.filter((u) => !NON_STAFF_TYPES.includes(norm(u.type || u.role || '')));
        setEmployees(staff);
        setRoles(rolesResponse.data || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    await createUser({ ...form, type: form.role, role: form.role });
    setShowCreate(false);
    setForm({ name: '', email: '', password: '', phone: '', role: 'employee' });
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

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role', render: (u) => <Badge value={u.roles?.[0]?.display_name || u.roles?.[0]?.name || u.type} /> },
    { key: 'is_active', label: 'Status', render: (u) => <Badge value={u.is_active ? 'active' : 'inactive'} /> },
    { key: 'createdAt', label: 'Joined', render: (u) => new Date(u.createdAt).toLocaleDateString() },
  ];

  const detailFields = [
    { label: 'Name', key: 'name' },
    { label: 'Email', key: 'email' },
    { label: 'Phone', key: 'phone' },
    { label: 'Role', render: (u) => <Badge value={u.roles?.[0]?.display_name || u.roles?.[0]?.name || u.type} /> },
    { label: 'Status', render: (u) => <Badge value={u.is_active ? 'active' : 'inactive'} /> },
    { label: 'Joined', render: (u) => u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Employees</h1>
        <Button onClick={() => setShowCreate(true)}>+ Add Employee</Button>
      </div>

      {loading ? <p className="text-slate-500">Loading...</p> : (
        <Table
          columns={columns}
          rows={employees}
          renderActions={(u) => (
            <div className="flex items-center justify-end gap-3">
              <Button onClick={() => handleEdit(u)} variant="primary" size="sm">Edit</Button>
              <ActionsMenu
                items={[
                  { label: '👁 View Details', onClick: () => setDetailRow(u) },
                  { label: '🗑 Remove', variant: 'danger', onClick: () => { if (window.confirm('Remove employee?')) deleteUser(u.id).then(load); } },
                ]}
              />
            </div>
          )}
        />
      )}

      <DetailsModal
        open={!!detailRow}
        onClose={() => setDetailRow(null)}
        title={detailRow?.name || 'Employee Details'}
        record={detailRow}
        fields={detailFields}
      />

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add Employee">
        <form onSubmit={handleCreate} className="space-y-3">
          <Input label="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <Input label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Select label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} options={roleOptions} />
          <div className="flex gap-2 pt-2">
            <Button type="submit">Add Employee</Button>
            <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Edit Employee</h2>
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

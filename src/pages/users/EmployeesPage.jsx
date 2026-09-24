import { useEffect, useMemo, useState } from 'react';
import { listUsers, createUser, updateUser, deleteUser } from '../../api/userApi';
import { listRoles } from '../../api/rolesApi';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import DetailsModal from '../../components/common/DetailsModal';
import ActionsMenu from '../../components/common/ActionsMenu';
import Button from '../../components/ui/Button';
import Modal from '../../components/common/Modal';
import { useAssistantHandoff } from '../../assistant/useAssistantHandoff';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { userTypeForRole } from '../../constants/userTypes';
import { MIN_PASSWORD_LENGTH, PASSWORD_HINT } from '../../constants/password';
import CompanyField from '../../components/common/CompanyField';

// Any user type that is NOT one of these is considered staff
const NON_STAFF_TYPES = ['client', 'realtor'];

const norm = (v) => String(v || '').trim().toLowerCase();

const EMPTY_CREATE = { name: '', email: '', password: '', phone: '', role: 'employee', company_id: '' };

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_CREATE);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');
  const [detailRow, setDetailRow] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', is_active: true });

  /**
   * Arriving from the assistant: open the form with what it collected.
   *
   * The role and the password are deliberately NOT accepted from the link. A
   * role is a permission grant — an Administrator can approve money — and a
   * password set by anything other than the person creating the account is not
   * a password. Both stay where they were: chosen here, by a human, before save.
   */
  const handoff = useAssistantHandoff('create-user');
  useEffect(() => {
    if (!handoff) return;
    setForm((prev) => ({
      ...prev,
      name: handoff.name || prev.name,
      email: handoff.email || prev.email,
      phone: handoff.phone || prev.phone,
    }));
    setShowCreate(true);
  }, [handoff]);

  /*
   * Staff roles only.
   *
   * The list was every role the company has, Client and Realtor included — and
   * an account created under either lands on a different screen than the one
   * that made it, because this page shows what is NOT a client or a realtor.
   * Those two have their own pages, with the fields they need.
   */
  const roleOptions = useMemo(
    () => roles
      .filter((role) => !NON_STAFF_TYPES.includes(norm(role.name)))
      .map((role) => ({ value: role.name, label: role.display_name || role.name })),
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

  /*
   * The ROLE is what was chosen; the TYPE is what the column can hold.
   *
   * These were sent as the same string, which works only while every role
   * happens to share a name with an account type. The moment somebody adds
   * "Accountant" on the Roles screen, creation failed with "Data truncated for
   * column 'type'" — and the form, which swallowed the error, simply did not
   * close. A custom role's holder is an employee carrying that role; see
   * src/constants/userTypes.js.
   */
  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    try {
      await createUser({
        ...form,
        type: userTypeForRole(form.role),
        role: form.role,
        ...(form.company_id ? { company_id: Number(form.company_id) } : {}),
      });
      setShowCreate(false);
      setForm(EMPTY_CREATE);
      load();
    } catch (err) {
      setCreateError(err?.userMessage || 'Could not add the employee.');
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
        <Button onClick={() => { setCreateError(''); setShowCreate(true); }}>+ Add Employee</Button>
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

      <Modal open={showCreate} onClose={() => !creating && setShowCreate(false)} title="Add Employee">
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
          <Select label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} options={roleOptions} />
          {createError && <p className="text-sm text-danger">{createError}</p>}
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={creating}>{creating ? 'Adding…' : 'Add Employee'}</Button>
            <Button type="button" variant="secondary" onClick={() => setShowCreate(false)} disabled={creating}>Cancel</Button>
          </div>
        </form>
      </Modal>

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-slate-900">Edit Employee</h2>
            <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
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

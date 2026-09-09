import { useEffect, useMemo, useState } from 'react';
import client from '../../api/client';
import { listUsers, createUser, updateUser, deleteUser, assignRole } from '../../api/userApi';
import { listRoles, updateUserRoles } from '../../api/rolesApi';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import DetailsModal from '../../components/common/DetailsModal';
import ActionsMenu from '../../components/common/ActionsMenu';
import Button from '../../components/ui/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import useAuthStore from '../../store/authStore';

const INPUT_CLASS = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

const emptyCreate = { name: '', email: '', password: '', phone: '', role: 'employee' };
const emptyEdit = { name: '', email: '', phone: '', role: '', is_active: true };

export default function UsersPage() {
  const authUser = useAuthStore((s) => s.user);
  const isSuperiorAdmin = useAuthStore((s) => s.isSuperiorAdmin);

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyCreate);
  const [editingUser, setEditingUser] = useState(null);
  const [detailRow, setDetailRow] = useState(null);
  const [editForm, setEditForm] = useState(emptyEdit);
  const [selectedAdditionalRoleId, setSelectedAdditionalRoleId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [roleActionMessage, setRoleActionMessage] = useState('');

  const roleOptions = useMemo(
    () => roles
      .filter((r) => !['superior_admin'].includes(r.name))
      .map((r) => ({ value: r.name, label: r.display_name || r.name })),
    [roles]
  );

  const additionalRoleOptions = useMemo(
    () => roles
      .filter((r) => !['superior_admin'].includes(r.name))
      .map((r) => ({ value: String(r.id), label: r.display_name || r.name })),
    [roles]
  );

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        limit: 1000,
        ...(search ? { search } : {}),
        ...(roleFilter ? { type: roleFilter } : {}),
        ...(isSuperiorAdmin && companyFilter ? { company_id: companyFilter } : {}),
      };
      const [usersRes, rolesRes] = await Promise.all([
        listUsers(params),
        listRoles(),
      ]);
      setUsers(Array.isArray(usersRes?.data) ? usersRes.data : []);
      setRoles(Array.isArray(rolesRes?.data) ? rolesRes.data : []);
    } catch (e) {
      console.error(e);
      setError('Failed to load users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isSuperiorAdmin) return;
    client.get('/companies').then((r) => {
      const list = Array.isArray(r.data?.data) ? r.data.data : Array.isArray(r.data) ? r.data : [];
      setCompanies(list);
    }).catch(() => {});
  }, [isSuperiorAdmin]);

  useEffect(() => { load(); }, [search, roleFilter, companyFilter]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await createUser({ ...form, type: form.role });
      setShowCreate(false);
      setForm(emptyCreate);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to create user.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u) => {
    if (!window.confirm(`Delete user "${u.name || u.email}"?`)) return;
    try {
      await deleteUser(u.id);
      await load();
    } catch {
      setError('Failed to delete user.');
    }
  };

  const openEdit = (u) => {
    setEditingUser(u);
    setEditForm({
      name: u.name || '',
      email: u.email || '',
      phone: u.phone || '',
      role: u.roles?.[0]?.name || u.type || '',
      is_active: Boolean(u.is_active),
    });
    setSelectedAdditionalRoleId('');
    setRoleActionMessage('');
  };

  const closeEdit = () => {
    if (saving) return;
    setEditingUser(null);
    setEditForm(emptyEdit);
    setSelectedAdditionalRoleId('');
    setRoleActionMessage('');
  };

  const handleUpdate = async () => {
    if (!editingUser) return;
    setSaving(true);
    setError('');
    try {
      await updateUser(editingUser.id, { ...editForm, type: editForm.role });
      setEditingUser(null);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to update user.');
    } finally {
      setSaving(false);
    }
  };

  const refreshEditingUser = async () => {
    const usersRes = await listUsers({ limit: 1000 });
    const updatedUsers = Array.isArray(usersRes?.data) ? usersRes.data : [];
    setUsers(updatedUsers);
    setEditingUser((current) => current ? updatedUsers.find((user) => String(user.id) === String(current.id)) || current : current);
  };

  const handleAssignRole = async () => {
    if (!editingUser || !selectedAdditionalRoleId) return;
    setSaving(true);
    setRoleActionMessage('');
    setError('');
    try {
      await assignRole(editingUser.id, Number(selectedAdditionalRoleId));
      await refreshEditingUser();
      setSelectedAdditionalRoleId('');
      setRoleActionMessage('Role assigned successfully.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to assign role.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveRole = async (roleName) => {
    if (!editingUser) return;
    const nextRoles = (editingUser.roles || []).map((role) => role.name).filter((name) => name !== roleName);
    setSaving(true);
    setRoleActionMessage('');
    setError('');
    try {
      await updateUserRoles(editingUser.id, nextRoles);
      await refreshEditingUser();
      setRoleActionMessage('Role removed successfully.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to remove role.');
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo(() => {
    return [
      { key: 'name', label: 'Name', render: (u) => u.name || '—' },
      { key: 'email', label: 'Email', render: (u) => u.email || '—' },
      {
        key: 'roles',
        label: 'Role',
        render: (u) => <Badge value={u.roles?.[0]?.display_name || u.roles?.[0]?.name || u.type || '—'} />,
      },
      {
        key: 'is_active',
        label: 'Status',
        render: (u) => <Badge value={u.is_active ? 'active' : 'inactive'} />,
      },
      {
        key: 'createdAt',
        label: 'Joined',
        render: (u) => u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—',
      },
    ];
  }, []);

  const detailFields = useMemo(() => [
    { label: 'Name', key: 'name' },
    { label: 'Email', key: 'email' },
    { label: 'Phone', key: 'phone' },
    { label: 'Primary Role', render: (u) => <Badge value={u.roles?.[0]?.display_name || u.roles?.[0]?.name || u.type || '—'} /> },
    {
      label: 'All Roles',
      render: (u) => (u.roles?.length
        ? u.roles.map((role) => role.display_name || role.name).join(', ')
        : (u.type || '—')),
    },
    { label: 'Status', render: (u) => <Badge value={u.is_active ? 'active' : 'inactive'} /> },
    { label: 'Joined', render: (u) => u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—' },
    { label: 'Company', render: (u) => u.company?.name || u.company_name || '—' },
  ], []);

  const availableAdditionalRoles = useMemo(() => {
    const assignedNames = new Set((editingUser?.roles || []).map((role) => role.name));
    return additionalRoleOptions.filter((option) => {
      const role = roles.find((item) => String(item.id) === option.value);
      return role && !assignedNames.has(role.name);
    });
  }, [additionalRoleOptions, editingUser, roles]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {isSuperiorAdmin ? 'All Users' : 'Users'}
          </h1>
          {!isSuperiorAdmin && authUser?.company_name && (
            <p className="text-sm text-slate-500">{authUser.company_name}</p>
          )}
        </div>
        <Button onClick={() => setShowCreate(true)}>+ New User</Button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      )}

      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, phone..."
          className={`${INPUT_CLASS} max-w-xs flex-1`}
        />
        <Select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All roles</option>
          {roleOptions.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </Select>

        {isSuperiorAdmin && (
          <Select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">All companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        )}
      </div>

      {loading ? (
        <div className="rounded-xl bg-white p-6 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">Loading users...</div>
      ) : (
        <Table
          columns={columns}
          rows={users}
          renderActions={(u) => (
            <div className="flex items-center justify-end gap-2">
              <Button onClick={() => openEdit(u)} variant="primary" size="sm">Edit</Button>
              <ActionsMenu
                items={[
                  { label: '👁 View Details', onClick: () => setDetailRow(u) },
                  { label: '🗑 Delete', variant: 'danger', onClick: () => handleDelete(u) },
                ]}
              />
            </div>
          )}
        />
      )}

      <DetailsModal
        open={!!detailRow}
        onClose={() => setDetailRow(null)}
        title={detailRow?.name || 'User Details'}
        record={detailRow}
        fields={detailFields}
      />

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create User">
        <form onSubmit={handleCreate} className="space-y-3">
          <Input label="Full Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
          <Input label="Password" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          <Select
            label="Role"
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            options={roleOptions}
            className={INPUT_CLASS}
          />
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create User'}</Button>
            <Button type="button" variant="secondary" onClick={() => setShowCreate(false)} disabled={saving}>Cancel</Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(editingUser)} onClose={closeEdit} title="Edit User" size="lg">
        {editingUser && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Update details for {editingUser.name || editingUser.email}.</p>

            <Input label="Full Name" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
            <Input label="Email" type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
            <Input label="Phone" value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />

            <Select
              label="Role"
              value={editForm.role}
              onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
              options={roleOptions}
              className={INPUT_CLASS}
            />

            <div className="rounded-xl border border-slate-200 p-4 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Assign Additional Role</h3>
                <p className="text-sm text-slate-500">Assign extra roles without replacing the primary role.</p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Select
                    label="Available Roles"
                    value={selectedAdditionalRoleId}
                    onChange={(e) => setSelectedAdditionalRoleId(e.target.value)}
                    className={INPUT_CLASS}
                  >
                    <option value="">Select a role</option>
                    {availableAdditionalRoles.map((role) => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </Select>
                </div>
                <Button type="button" onClick={handleAssignRole} disabled={saving || !selectedAdditionalRoleId}>Assign</Button>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Current Roles</span>
                <div className="flex flex-wrap gap-2">
                  {(editingUser.roles || []).length ? (editingUser.roles || []).map((role) => (
                    <span key={role.id || role.name} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                      {role.display_name || role.name}
                      <Button type="button" variant="secondary" size="sm" className="rounded-full px-2 py-0.5" onClick={() => handleRemoveRole(role.name)} disabled={saving}>
                        ×
                      </Button>
                    </span>
                  )) : (
                    <span className="text-sm text-slate-500">No additional roles assigned.</span>
                  )}
                </div>
              </div>

              {roleActionMessage && <p className="text-sm text-green-700">{roleActionMessage}</p>}
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={editForm.is_active}
                onChange={(e) => setEditForm((f) => ({ ...f, is_active: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300"
              />
              Active account
            </label>

            {error && (
              <p className="text-xs text-rose-600">{error}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={closeEdit} disabled={saving}>Cancel</Button>
              <Button type="button" onClick={handleUpdate} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

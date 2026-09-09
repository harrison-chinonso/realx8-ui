import { useEffect, useMemo, useState } from 'react';
import { listUsers } from '../../api/userApi';
import {
  listRoles,
  createRole,
  updateRole,
  deleteRole,
  updateRolePermissions,
  listPermissions,
  createPermission,
  updatePermission,
  deletePermission,
  getUserRoles,
  updateUserRoles,
} from '../../api/rolesApi';
import Table from '../../components/common/Table';
import Button from '../../components/ui/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';

const ROLE_FORM = { name: '', display_name: '', description: '' };
const PERMISSION_FORM = { name: '', display_name: '', module: '', description: '' };
const TABS = ['Roles', 'Permissions', 'User Role Assignment'];

const slugify = (value) => value.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9._-]/g, '');

export default function RolesPage() {
  const [tab, setTab] = useState(TABS[0]);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [permissionModalOpen, setPermissionModalOpen] = useState(false);
  const [permissionManagerOpen, setPermissionManagerOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [editingPermission, setEditingPermission] = useState(null);
  const [roleForm, setRoleForm] = useState(ROLE_FORM);
  const [permissionForm, setPermissionForm] = useState(PERMISSION_FORM);
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedPermissionNames, setSelectedPermissionNames] = useState([]);
  const [moduleFilter, setModuleFilter] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [userOptions, setUserOptions] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedUserRoles, setSelectedUserRoles] = useState([]);
  const [savingUserRoles, setSavingUserRoles] = useState(false);

  const modules = useMemo(() => [...new Set(permissions.map((item) => item.module).filter(Boolean))].sort(), [permissions]);
  const groupedPermissions = useMemo(() => permissions.reduce((acc, permission) => {
    const key = permission.module || 'general';
    acc[key] = acc[key] || [];
    acc[key].push(permission);
    return acc;
  }, {}), [permissions]);
  const filteredPermissions = useMemo(
    () => (moduleFilter ? permissions.filter((permission) => permission.module === moduleFilter) : permissions),
    [moduleFilter, permissions]
  );

  const loadAll = async () => {
    setLoading(true);
    try {
      const [rolesResponse, permissionsResponse] = await Promise.all([listRoles(), listPermissions()]);
      setRoles(rolesResponse.data || []);
      setPermissions(permissionsResponse.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (tab !== 'User Role Assignment') return;
    listUsers({ search: userSearch || undefined, limit: 20 })
      .then((response) => setUserOptions(response.data || []))
      .catch(() => setUserOptions([]));
  }, [tab, userSearch]);

  useEffect(() => {
    if (!selectedUserId) {
      setSelectedUserRoles([]);
      return;
    }

    getUserRoles(selectedUserId)
      .then((response) => setSelectedUserRoles((response.data || []).map((role) => role.name)))
      .catch(() => setSelectedUserRoles([]));
  }, [selectedUserId]);

  const resetRoleForm = () => {
    setRoleForm(ROLE_FORM);
    setEditingRole(null);
    setRoleModalOpen(false);
  };

  const resetPermissionForm = () => {
    setPermissionForm(PERMISSION_FORM);
    setEditingPermission(null);
    setPermissionModalOpen(false);
  };

  const submitRole = async (event) => {
    event.preventDefault();
    const payload = { ...roleForm, name: slugify(roleForm.name) };
    if (editingRole) await updateRole(editingRole.id, payload);
    else await createRole(payload);
    setMessage(`Role ${editingRole ? 'updated' : 'created'} successfully.`);
    resetRoleForm();
    loadAll();
  };

  const submitPermission = async (event) => {
    event.preventDefault();
    const payload = { ...permissionForm, name: slugify(permissionForm.name) };
    if (editingPermission) await updatePermission(editingPermission.id, payload);
    else await createPermission(payload);
    setMessage(`Permission ${editingPermission ? 'updated' : 'created'} successfully.`);
    resetPermissionForm();
    loadAll();
  };

  const handleDeleteRole = async (role) => {
    if (!window.confirm(`Delete role "${role.display_name || role.name}"?`)) return;
    await deleteRole(role.id);
    setMessage('Role deleted successfully.');
    loadAll();
  };

  const handleDeletePermission = async (permission) => {
    if (!window.confirm(`Delete permission "${permission.display_name || permission.name}"?`)) return;
    await deletePermission(permission.id);
    setMessage('Permission deleted successfully.');
    loadAll();
  };

  const openPermissionManager = (role) => {
    setSelectedRole(role);
    setSelectedPermissionNames((role.permissions || []).map((permission) => permission.name));
    setPermissionManagerOpen(true);
  };

  const saveRolePermissions = async () => {
    if (!selectedRole) return;
    await updateRolePermissions(selectedRole.id, selectedPermissionNames);
    setMessage('Role permissions updated successfully.');
    setPermissionManagerOpen(false);
    setSelectedRole(null);
    loadAll();
  };

  const toggleSelectedPermission = (name) => {
    setSelectedPermissionNames((current) => current.includes(name)
      ? current.filter((value) => value !== name)
      : [...current, name]);
  };

  const saveUserRoleAssignments = async () => {
    if (!selectedUserId) return;
    setSavingUserRoles(true);
    try {
      await updateUserRoles(selectedUserId, selectedUserRoles);
      setMessage('User roles updated successfully.');
      loadAll();
    } finally {
      setSavingUserRoles(false);
    }
  };

  const roleColumns = [
    { key: 'id', label: 'ID' },
    { key: 'display_name', label: 'Display Name', render: (role) => role.display_name || '—' },
    { key: 'name', label: 'Role Name' },
    { key: 'description', label: 'Description', render: (role) => role.description || '—' },
    { key: 'permissions_count', label: '# Permissions', render: (role) => role.permissions?.length || 0 },
    { key: 'users_count', label: '# Users', render: (role) => role.users?.length || 0 },
  ];

  const permissionColumns = [
    { key: 'display_name', label: 'Display Name', render: (permission) => permission.display_name || '—' },
    { key: 'name', label: 'Name' },
    { key: 'module', label: 'Module', render: (permission) => permission.module || '—' },
    { key: 'description', label: 'Description', render: (permission) => permission.description || '—' },
    { key: 'roles_count', label: '# Roles', render: (permission) => permission.roles?.length || 0 },
  ];

  const selectedUser = userOptions.find((user) => String(user.id) === String(selectedUserId));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Roles & Permissions</h1>
          <p className="text-sm text-slate-500">Manage database-driven RBAC across roles, permissions, and user assignments.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <Button key={item} type="button" onClick={() => setTab(item)} variant={tab === item ? 'primary' : 'secondary'} size="sm">
            {item}
          </Button>
        ))}
      </div>

      {message && <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}

      {loading ? <p className="text-slate-500">Loading...</p> : (
        <>
          {tab === 'Roles' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => setRoleModalOpen(true)}>+ New Role</Button>
              </div>
              <Table
                columns={roleColumns}
                rows={roles}
                renderActions={(role) => (
                  <div className="flex items-center justify-end gap-3 text-xs">
                    <Button
                      type="button"
                      onClick={() => {
                        setEditingRole(role);
                        setRoleForm({
                          name: role.name || '',
                          display_name: role.display_name || '',
                          description: role.description || '',
                        });
                        setRoleModalOpen(true);
                      }}
                      variant="primary" size="sm"
                    >Edit</Button>
                    <Button type="button" onClick={() => openPermissionManager(role)} variant="secondary" size="sm">Manage Permissions</Button>
                    <Button type="button" onClick={() => handleDeleteRole(role)} variant="danger" size="sm">Delete</Button>
                  </div>
                )}
              />
            </div>
          )}

          {tab === 'Permissions' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Select
                  value={moduleFilter}
                  onChange={(event) => setModuleFilter(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">All modules</option>
                  {modules.map((module) => <option key={module} value={module}>{module}</option>)}
                </Select>
                <Button onClick={() => setPermissionModalOpen(true)}>+ New Permission</Button>
              </div>
              <Table
                columns={permissionColumns}
                rows={filteredPermissions}
                renderActions={(permission) => (
                  <div className="flex items-center justify-end gap-3 text-xs">
                    <Button
                      type="button"
                      onClick={() => {
                        setEditingPermission(permission);
                        setPermissionForm({
                          name: permission.name || '',
                          display_name: permission.display_name || '',
                          module: permission.module || '',
                          description: permission.description || '',
                        });
                        setPermissionModalOpen(true);
                      }}
                      variant="primary" size="sm"
                    >Edit</Button>
                    <Button type="button" onClick={() => handleDeletePermission(permission)} variant="danger" size="sm">Delete</Button>
                  </div>
                )}
              />
            </div>
          )}

          {tab === 'User Role Assignment' && (
            <div className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="grid gap-4 md:grid-cols-2">
                <Input label="Search users" value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Type name or email" />
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">Select user</span>
                  <Select
                    value={selectedUserId}
                    onChange={(event) => setSelectedUserId(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">Choose a user</option>
                    {userOptions.map((user) => (
                      <option key={user.id} value={user.id}>{user.name} — {user.email}</option>
                    ))}
                  </Select>
                </label>
              </div>

              {selectedUser && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">Profiles for {selectedUser.name}</h2>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedUserRoles.length > 0
                        ? selectedUserRoles.map((r) => (
                            <span key={r} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">{r}</span>
                          ))
                        : <span className="text-sm text-slate-500">No profiles assigned.</span>}
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {roles.map((role) => (
                      <label key={role.id} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm cursor-pointer hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={selectedUserRoles.includes(role.name)}
                          onChange={() => {
                            setSelectedUserRoles((current) =>
                              current.includes(role.name)
                                ? current.filter((n) => n !== role.name)
                                : [...current, role.name]
                            );
                          }}
                          className="mt-1 h-4 w-4 rounded"
                        />
                        <span>
                          <span className="block font-medium text-slate-900">{role.display_name || role.name}</span>
                          <span className="block text-slate-500">{role.description || role.name}</span>
                        </span>
                      </label>
                    ))}
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={saveUserRoleAssignments} disabled={savingUserRoles || selectedUserRoles.length === 0}>{savingUserRoles ? 'Saving...' : 'Save'}</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <Modal open={roleModalOpen} onClose={resetRoleForm} title={editingRole ? 'Edit Role' : 'New Role'}>
        <form onSubmit={submitRole} className="space-y-3">
          <Input
            label="Role Name"
            value={roleForm.name}
            onChange={(event) => setRoleForm((current) => ({ ...current, name: slugify(event.target.value) }))}
            required
          />
          <Input
            label="Display Name"
            value={roleForm.display_name}
            onChange={(event) => setRoleForm((current) => ({ ...current, display_name: event.target.value }))}
          />
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Description</span>
            <textarea
              value={roleForm.description}
              onChange={(event) => setRoleForm((current) => ({ ...current, description: event.target.value }))}
              className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="flex gap-2 pt-2">
            <Button type="submit">{editingRole ? 'Save Changes' : 'Create Role'}</Button>
            <Button type="button" variant="secondary" onClick={resetRoleForm}>Cancel</Button>
          </div>
        </form>
      </Modal>

      <Modal open={permissionModalOpen} onClose={resetPermissionForm} title={editingPermission ? 'Edit Permission' : 'New Permission'}>
        <form onSubmit={submitPermission} className="space-y-3">
          <Input
            label="Permission Name"
            value={permissionForm.name}
            onChange={(event) => setPermissionForm((current) => ({ ...current, name: slugify(event.target.value) }))}
            required
          />
          <Input
            label="Display Name"
            value={permissionForm.display_name}
            onChange={(event) => setPermissionForm((current) => ({ ...current, display_name: event.target.value }))}
          />
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Module</span>
            <input
              list="permission-modules"
              value={permissionForm.module}
              onChange={(event) => setPermissionForm((current) => ({ ...current, module: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <datalist id="permission-modules">
              {modules.map((module) => <option key={module} value={module} />)}
            </datalist>
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Description</span>
            <textarea
              value={permissionForm.description}
              onChange={(event) => setPermissionForm((current) => ({ ...current, description: event.target.value }))}
              className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="flex gap-2 pt-2">
            <Button type="submit">{editingPermission ? 'Save Changes' : 'Create Permission'}</Button>
            <Button type="button" variant="secondary" onClick={resetPermissionForm}>Cancel</Button>
          </div>
        </form>
      </Modal>

      <Modal open={permissionManagerOpen} onClose={() => setPermissionManagerOpen(false)} title={`Manage Permissions${selectedRole ? ` — ${selectedRole.display_name || selectedRole.name}` : ''}`}>
        <div className="space-y-4">
          <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
            {Object.entries(groupedPermissions).map(([module, modulePermissions]) => (
              <div key={module} className="rounded-lg border border-slate-200 p-3">
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600">{module}</h3>
                <div className="space-y-2">
                  {modulePermissions.map((permission) => (
                    <label key={permission.id} className="flex items-start gap-3 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={selectedPermissionNames.includes(permission.name)}
                        onChange={() => toggleSelectedPermission(permission.name)}
                        className="mt-1 h-4 w-4"
                      />
                      <span>
                        <span className="block font-medium">{permission.display_name || permission.name}</span>
                        <span className="block text-xs text-slate-500">{permission.name}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={saveRolePermissions}>Save</Button>
            <Button type="button" variant="secondary" onClick={() => setPermissionManagerOpen(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

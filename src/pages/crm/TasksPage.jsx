import { useEffect, useMemo, useState } from 'react';
import { listTasks, createTask, updateTask, deleteTask, listDeals, listLeads } from '../../api/crmApi';
import { listUsers } from '../../api/userApi';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import DetailsModal from '../../components/common/DetailsModal';
import ActionsMenu from '../../components/common/ActionsMenu';
import Button from '../../components/ui/Button';
import CompanySelect from '../../components/common/CompanySelect';
import useAuthStore from '../../store/authStore';
import Select from '../../components/ui/Select';

const INPUT_CLASS = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';
const TEXTAREA_CLASS = `${INPUT_CLASS} resize-none`;

const ASSIGNABLE_ROLES = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Administrator' },
  { value: 'product_manager', label: 'Product Manager' },
  { value: 'branch_manager', label: 'Branch Manager' },
  { value: 'realtor', label: 'Realtor' },
  { value: 'employee', label: 'Employee' },
];

const emptyForm = () => ({
  title: '',
  due_date: '',
  priority: 'medium',
  status: 'pending',
  deal_id: '',
  lead_id: '',
  description: '',
  assigned_role: '',
  assigned_to: '',
  company_id: '',
});

const getItems = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  return [];
};
const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : '—');

export default function TasksPage() {
  const isSuperiorAdmin = useAuthStore((state) => state.isSuperiorAdmin);
  const [tasks, setTasks] = useState([]);
  const [companyUsers, setCompanyUsers] = useState([]);
  const [deals, setDeals] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [detailRow, setDetailRow] = useState(null);
  const [form, setForm] = useState(emptyForm());

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [tasksRes, usersRes, dealsRes, leadsRes] = await Promise.all([
        listTasks(),
        listUsers({ limit: 1000 }).catch(() => ({ data: [] })),
        listDeals({ limit: 1000 }).catch(() => ({ data: [] })),
        listLeads({ limit: 1000 }).catch(() => ({ data: [] })),
      ]);
      setTasks(getItems(tasksRes));
      setCompanyUsers(getItems(usersRes));
      setDeals(getItems(dealsRes));
      setLeads(getItems(leadsRes));
    } catch (loadError) {
      console.error(loadError);
      setError('Failed to load tasks.');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const usersForRole = useMemo(() => {
    if (!form.assigned_role) return [];
    return companyUsers.filter((u) => {
      const roles = Array.isArray(u.roles)
        ? u.roles.map((r) => (typeof r === 'string' ? r : r.name))
        : [u.role].filter(Boolean);
      return roles.includes(form.assigned_role);
    });
  }, [companyUsers, form.assigned_role]);

  const userMap = useMemo(
    () => Object.fromEntries(companyUsers.map((u) => [String(u.id), u])),
    [companyUsers]
  );
  const dealMap = useMemo(
    () => Object.fromEntries(deals.map((deal) => [String(deal.id), deal])),
    [deals]
  );
  const leadMap = useMemo(
    () => Object.fromEntries(leads.map((lead) => [String(lead.id), lead])),
    [leads]
  );

  const openCreate = () => {
    setEditingTask(null);
    setForm(emptyForm());
    setShowModal(true);
  };

  const openEdit = (task) => {
    setEditingTask(task);
    const assignedUser = task.assigned_to ? userMap[String(task.assigned_to)] : null;
    const assignedRole = assignedUser
      ? (Array.isArray(assignedUser.roles)
          ? (assignedUser.roles[0]?.name ?? assignedUser.roles[0] ?? '')
          : (assignedUser.role ?? ''))
      : '';
    setForm({
      title: task.title || '',
      due_date: task.due_date ? String(task.due_date).slice(0, 10) : '',
      priority: task.priority || 'medium',
      status: task.status || 'pending',
      deal_id: task.deal_id ?? '',
      lead_id: task.lead_id ?? '',
      description: task.description || '',
      assigned_role: assignedRole,
      assigned_to: task.assigned_to ? String(task.assigned_to) : '',
      company_id: task.company_id ? String(task.company_id) : '',
    });
    setShowModal(true);
  };

  const closeModal = (force = false) => {
    if (saving && !force) return;
    setShowModal(false);
    setEditingTask(null);
    setForm(emptyForm());
  };

  const handleRoleChange = (e) => {
    setForm((f) => ({ ...f, assigned_role: e.target.value, assigned_to: '' }));
  };

  const columns = useMemo(() => [
    { key: 'title', label: 'Title', render: (row) => row.title || '—' },
    { key: 'due_date', label: 'Due Date', render: (row) => formatDate(row.due_date) },
    { key: 'priority', label: 'Priority', render: (row) => <Badge value={row.priority || 'medium'} /> },
    { key: 'status', label: 'Status', render: (row) => <Badge value={row.status || 'pending'} /> },
    {
      key: 'assigned_to',
      label: 'Assigned To',
      render: (row) => {
        if (!row.assigned_to) return '—';
        const u = userMap[String(row.assigned_to)];
        return u ? (u.name ?? u.email) : `User #${row.assigned_to}`;
      },
    },
  ], [userMap]);

  const detailFields = useMemo(() => [
    { label: 'Title', key: 'title' },
    { label: 'Due Date', render: (row) => formatDate(row.due_date) },
    { label: 'Priority', render: (row) => <Badge value={row.priority || 'medium'} /> },
    { label: 'Status', render: (row) => <Badge value={row.status || 'pending'} /> },
    {
      label: 'Assigned To',
      render: (row) => {
        if (!row.assigned_to) return '—';
        const user = userMap[String(row.assigned_to)];
        return user ? (user.name ?? user.email) : `User #${row.assigned_to}`;
      },
    },
    {
      label: 'Deal',
      render: (row) => row.deal?.name ?? dealMap[String(row.deal_id)]?.name ?? (row.deal_id ? `#${row.deal_id}` : '—'),
    },
    {
      label: 'Lead',
      render: (row) => row.lead?.name ?? leadMap[String(row.lead_id)]?.name ?? (row.lead_id ? `#${row.lead_id}` : '—'),
    },
    { label: 'Description', key: 'description' },
    { label: 'Company ID', render: (row) => row.company_id ?? '—' },
  ], [dealMap, leadMap, userMap]);

  const buildPayload = () => ({
    title: form.title.trim(),
    due_date: form.due_date || null,
    priority: form.priority,
    status: form.status,
    deal_id: form.deal_id === '' ? null : Number(form.deal_id),
    lead_id: form.lead_id === '' ? null : Number(form.lead_id),
    description: form.description.trim() || null,
    assigned_to: form.assigned_to ? Number(form.assigned_to) : null,
    ...(form.company_id ? { company_id: Number(form.company_id) } : {}),
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    setError('');
    try {
      const payload = buildPayload();
      if (editingTask) await updateTask(editingTask.id, payload);
      else await createTask(payload);
      await loadData();
      closeModal(true);
    } catch (submitError) {
      console.error(submitError);
      setError(`Failed to ${editingTask ? 'update' : 'create'} task. Please try again.`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (task) => {
    if (!window.confirm(`Delete task "${task.title || 'this task'}"?`)) return;
    try {
      await deleteTask(task.id);
      await loadData();
    } catch (deleteError) {
      console.error(deleteError);
      setError('Failed to delete task.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Tasks</h1>
        <Button onClick={openCreate}>Add Task</Button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      )}

      {loading ? (
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200 text-sm text-slate-500">Loading tasks...</div>
      ) : (
        <Table
          columns={columns}
          rows={tasks}
          renderActions={(row) => (
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="primary" size="sm" onClick={() => openEdit(row)}>Edit</Button>
              <ActionsMenu
                items={[
                  { label: '👁 View Details', onClick: () => setDetailRow(row) },
                  { label: '🗑 Delete', variant: 'danger', onClick: () => handleDelete(row) },
                ]}
              />
            </div>
          )}
        />
      )}

      <DetailsModal
        open={!!detailRow}
        onClose={() => setDetailRow(null)}
        title={detailRow?.title || 'Task Details'}
        record={detailRow}
        fields={detailFields}
      />

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">{editingTask ? 'Edit Task' : 'Create Task'}</h2>
              <p className="text-sm text-slate-500">Fill in the task details and assign it to a team member.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingTask && isSuperiorAdmin && (
                <CompanySelect value={form.company_id} onChange={(e) => setForm((f) => ({ ...f, company_id: e.target.value }))} />
              )}

              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Title <span className="text-red-500">*</span></span>
                <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={INPUT_CLASS} required />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">Due Date</span>
                  <input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} className={INPUT_CLASS} />
                </label>

                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">Priority</span>
                  <Select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} className={INPUT_CLASS}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </Select>
                </label>

                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">Status</span>
                  <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className={INPUT_CLASS}>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                  </Select>
                </label>

                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">Deal <span className="text-slate-400 font-normal">(optional)</span></span>
                  <Select value={form.deal_id} onChange={(e) => setForm((f) => ({ ...f, deal_id: e.target.value }))} className={INPUT_CLASS}>
                    <option value="">— No deal —</option>
                    {deals.map((d) => (
                      <option key={d.id} value={d.id}>{d.name ?? `Deal #${d.id}`}</option>
                    ))}
                  </Select>
                </label>

                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">Lead <span className="text-slate-400 font-normal">(optional)</span></span>
                  <Select value={form.lead_id} onChange={(e) => setForm((f) => ({ ...f, lead_id: e.target.value }))} className={INPUT_CLASS}>
                    <option value="">— No lead —</option>
                    {leads.map((l) => (
                      <option key={l.id} value={l.id}>{l.name ?? l.email ?? `Lead #${l.id}`}</option>
                    ))}
                  </Select>
                </label>
              </div>

              <div className="rounded-lg border border-slate-200 p-4 space-y-3">
                <p className="text-sm font-semibold text-slate-700">Assign Task</p>

                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-600">1. Select Role Type</span>
                  <Select value={form.assigned_role} onChange={handleRoleChange} className={INPUT_CLASS}>
                    <option value="">— Choose a role —</option>
                    {ASSIGNABLE_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </Select>
                </label>

                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-600">2. Select User</span>
                  <Select
                    value={form.assigned_to}
                    onChange={(e) => setForm((f) => ({ ...f, assigned_to: e.target.value }))}
                    className={INPUT_CLASS}
                    disabled={!form.assigned_role}
                  >
                    <option value="">
                      {!form.assigned_role
                        ? '— Select a role first —'
                        : usersForRole.length === 0
                        ? '— No users with this role —'
                        : '— Choose a user —'}
                    </option>
                    {usersForRole.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name ?? u.email}
                        {u.email && u.name ? ` (${u.email})` : ''}
                      </option>
                    ))}
                  </Select>
                  {form.assigned_role && usersForRole.length === 0 && (
                    <p className="text-xs text-amber-600">No users found with the selected role.</p>
                  )}
                </label>
              </div>

              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Description</span>
                <textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={TEXTAREA_CLASS} />
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={closeModal} disabled={saving}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Saving…' : editingTask ? 'Save Changes' : 'Create Task'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import useNavBadgeStore from '../../store/navBadgeStore';
import {
  listNotifications,
  markRead,
  markAllRead,
  sendBulkNotification,
  sendNotification,
  listSentNotifications,
  sendEmail,
  listNotificationTemplates,
  createNotificationTemplate,
  updateNotificationTemplate,
  deleteNotificationTemplate,
} from '../../api/notificationApi';
import { listUsers, listEmployees, listClients, listRealtors } from '../../api/userApi';
import { listCompanies } from '../../api/companyApi';
import Badge from '../../components/common/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/ui/Input';
import Table from '../../components/common/Table';
import useAuthStore from '../../store/authStore';
import BrowserNotificationsCard from '../../components/settings/BrowserNotificationsCard';
import Select from '../../components/ui/Select';
import FieldMark from '../../components/ui/FieldMark';

const TYPE_OPTIONS = ['info', 'warning', 'success', 'alert'];
const EMAIL_TYPES = ['email', 'push', 'sms'];
const TARGET_OPTIONS_NORMAL = [
  { value: 'all', label: 'All Users (My Company)' },
  { value: 'employees', label: 'Employees' },
  { value: 'clients', label: 'Clients' },
  { value: 'realtors', label: 'Realtors' },
  { value: 'specific', label: 'Select Specific Users' },
];
const TARGET_OPTIONS_SUPERIOR = [
  { value: 'all_global', label: 'All Users (All Companies)' },
  { value: 'all', label: 'All Users (My Company)' },
  { value: 'company', label: 'A Specific Company' },
  { value: 'role', label: 'By Role' },
  { value: 'specific', label: 'Select Specific Users' },
];
const ROLE_OPTIONS = ['super_admin', 'admin', 'realtor', 'branch_manager', 'product_manager', 'employee', 'client'];

const EMPTY_FORM = { title: '', body: '', type: 'info', target: 'all', user_ids: [], company_id: '', role: '', template_id: '' };
const EMPTY_SINGLE_FORM = { mode: 'in_app', user_id: '', title: '', message: '', type: 'info', to: '', subject: '', body: '' };
const EMPTY_TEMPLATE_FORM = { name: '', type: 'email', subject: '', body: '' };

const getItems = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  return [];
};

const userMatchesRole = (user, role) => {
  if (!role) return true;
  if (user?.type === role) return true;
  return Array.isArray(user?.roles) && user.roles.some((item) => item?.name === role);
};

// ── Multi-user picker with search ─────────────────────────────────────────────
function MultiUserPicker({ users, selectedIds, onChange }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return users;
    return users.filter((u) =>
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.type || '').toLowerCase().includes(q)
    );
  }, [users, search]);

  const toggle = (id) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  };

  const selectAll = () => onChange(filtered.map((u) => u.id));
  const clearAll = () => onChange([]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700">
          Select Recipients
          {/* This picker only renders for the "Select Specific Users" target,
              and in that mode the send is refused without one — by the page,
              and by the API, which answers 400 to an empty list. */}
          <FieldMark required />
          {selectedIds.length > 0 && (
            <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
              {selectedIds.length} selected
            </span>
          )}
        </label>
        <div className="flex gap-2 text-xs">
          <button type="button" onClick={selectAll} className="text-blue-600 hover:underline">
            Select all{search ? ' filtered' : ''}
          </button>
          {selectedIds.length > 0 && (
            <button type="button" onClick={clearAll} className="text-slate-400 hover:underline">Clear</button>
          )}
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search by name, email or role…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
      />

      {/*
        The requirement, before it becomes an error.
        A disabled Send button with nothing explaining it is its own problem,
        so the reason sits with the field it belongs to.
      */}
      {selectedIds.length === 0 && (
        <p className="text-xs text-slate-500">
          Choose at least one person to send this to.
        </p>
      )}

      {/* Selected chips */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
          {selectedIds.map((id) => {
            const u = users.find((x) => x.id === id);
            if (!u) return null;
            return (
              <span key={id} className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800">
                {u.name}
                <button type="button" onClick={() => toggle(id)} className="ml-0.5 text-blue-500 hover:text-blue-800">×</button>
              </span>
            );
          })}
        </div>
      )}

      {/* Scrollable user list */}
      <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
        {filtered.length === 0 && (
          <p className="px-3 py-4 text-center text-sm text-slate-400">No users found</p>
        )}
        {filtered.map((u) => {
          const selected = selectedIds.includes(u.id);
          return (
            <label key={u.id} className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-slate-50 ${selected ? 'bg-blue-50' : ''}`}>
              <input
                type="checkbox"
                checked={selected}
                onChange={() => toggle(u.id)}
                className="h-4 w-4 rounded border-slate-300 accent-blue-600"
              />
              <div className="flex flex-1 items-center justify-between gap-2 min-w-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{u.name}</p>
                  <p className="truncate text-xs text-slate-400">{u.email}</p>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 capitalize">{u.type}</span>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function ComposePanel({ onSent, isSuperiorAdmin, companies = [], templates = [] }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [users, setUsers] = useState([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [showSingleModal, setShowSingleModal] = useState(false);
  const [singleForm, setSingleForm] = useState(EMPTY_SINGLE_FORM);
  const [singleSending, setSingleSending] = useState(false);
  const [singleError, setSingleError] = useState('');

  useEffect(() => {
    if (form.target === 'specific') {
      listUsers({ limit: 5000 }).then((response) => setUsers(getItems(response))).catch(() => setUsers([]));
    } else {
      // Clear selected users when switching away
      setForm((c) => ({ ...c, user_ids: [] }));
    }
  }, [form.target]);

  const handleSend = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      setResult({ type: 'error', text: 'Title and message are required.' });
      return;
    }

    setSending(true);
    setResult(null);
    try {
      let userIds = [];
      if (form.target === 'all_global') {
        const response = await listUsers({ limit: 5000 });
        userIds = getItems(response).map((user) => user.id);
      } else if (form.target === 'all') {
        const response = await listUsers({ limit: 5000 });
        userIds = getItems(response).map((user) => user.id);
      } else if (form.target === 'company') {
        if (!form.company_id) {
          setResult({ type: 'error', text: 'Please select a company.' });
          return;
        }
        const response = await listUsers({ company_id: form.company_id, limit: 5000 });
        userIds = getItems(response).map((user) => user.id);
      } else if (form.target === 'role') {
        if (!form.role) {
          setResult({ type: 'error', text: 'Please select a role.' });
          return;
        }
        const response = await listUsers({ role: form.role, limit: 5000 });
        userIds = getItems(response)
          .filter((user) => userMatchesRole(user, form.role))
          .map((user) => user.id);
      } else if (form.target === 'employees') {
        const response = await listEmployees();
        userIds = getItems(response).map((user) => user.id);
      } else if (form.target === 'clients') {
        const response = await listClients();
        userIds = getItems(response).map((user) => user.id);
      } else if (form.target === 'realtors') {
        const response = await listRealtors();
        userIds = getItems(response).map((user) => user.id);
      } else if (form.target === 'specific') {
        if (!form.user_ids || form.user_ids.length === 0) {
          setResult({ type: 'error', text: 'Please select at least one user.' });
          setSending(false);
          return;
        }
        userIds = form.user_ids.map(Number);
      }

      userIds = [...new Set(userIds.filter(Boolean))];
      if (userIds.length === 0) {
        setResult({ type: 'error', text: 'No users found for the selected target.' });
        return;
      }

      const response = await sendBulkNotification({ user_ids: userIds, title: form.title, body: form.body, type: form.type });
      const emailInfo = response.email ? ` (${response.email.sent} email${response.email.sent !== 1 ? 's' : ''} sent${response.email.failed ? `, ${response.email.failed} failed` : ''})` : '';
      setResult({ type: 'success', text: `Notification sent to ${response.count} user(s).${emailInfo}` });
      setForm(EMPTY_FORM);
      onSent();
    } catch {
      setResult({ type: 'error', text: 'Failed to send notification.' });
    } finally {
      setSending(false);
    }
  };

  const closeSingleModal = () => {
    setShowSingleModal(false);
    setSingleForm(EMPTY_SINGLE_FORM);
    setSingleError('');
  };

  const handleSendSingle = async (event) => {
    event.preventDefault();
    setSingleError('');

    if (singleForm.mode === 'email') {
      if (!singleForm.to.trim() || !singleForm.subject.trim() || !singleForm.body.trim()) {
        setSingleError('Recipient email, subject, and body are required.');
        return;
      }
    } else if (!singleForm.user_id || !singleForm.title.trim() || !singleForm.message.trim()) {
      setSingleError('Recipient, title, and message are required.');
      return;
    }

    setSingleSending(true);
    try {
      if (singleForm.mode === 'email') {
        await sendEmail({
          to: singleForm.to.trim(),
          subject: singleForm.subject.trim(),
          body: singleForm.body.trim(),
        });
        setResult({ type: 'success', text: 'Email sent successfully.' });
      } else {
        await sendNotification({
          user_id: Number(singleForm.user_id),
          title: singleForm.title,
          message: singleForm.message,
          type: singleForm.type,
        });
        setResult({ type: 'success', text: 'Single notification sent successfully.' });
      }
      closeSingleModal();
      onSent();
    } catch {
      setSingleError(`Failed to send ${singleForm.mode === 'email' ? 'email' : 'single notification'}.`);
    } finally {
      setSingleSending(false);
    }
  };

  return (
    <>
      <div className="space-y-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-slate-800">Compose Notification</h2>
          <Button type="button" variant="secondary" onClick={() => setShowSingleModal(true)}>Send Single</Button>
        </div>

        {result && (
          <div className={`rounded-lg px-4 py-2 text-sm ${result.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {result.text}
          </div>
        )}

        {templates.length > 0 && (
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Use Template<FieldMark /></label>
            <Select
              value={form.template_id}
              onChange={(event) => {
                const template = templates.find((item) => String(item.id) === event.target.value);
                if (template) {
                  setForm((current) => ({
                    ...current,
                    template_id: event.target.value,
                    title: template.subject || template.name || current.title,
                    body: template.body || current.body,
                  }));
                } else {
                  setForm((current) => ({ ...current, template_id: '' }));
                }
              }}
              className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2 pr-8 text-sm focus:outline-none"
            >
              <option value="">No template</option>
              {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
            </Select>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Title<FieldMark required /></label>
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Notification title"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Type<FieldMark /></label>
              <Select
                value={form.type}
                onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                {TYPE_OPTIONS.map((type) => <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>)}
              </Select>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Send To<FieldMark /></label>
              <Select
                value={form.target}
                onChange={(event) => setForm((current) => ({ ...current, target: event.target.value, user_ids: [], company_id: '', role: '' }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                {(isSuperiorAdmin ? TARGET_OPTIONS_SUPERIOR : TARGET_OPTIONS_NORMAL).map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        {isSuperiorAdmin && form.target === 'company' && (
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Company<FieldMark /></label>
            <Select
              value={form.company_id}
              onChange={(event) => setForm((current) => ({ ...current, company_id: event.target.value }))}
              className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2 pr-8 text-sm focus:outline-none"
            >
              <option value="">Select company...</option>
              {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </Select>
          </div>
        )}

        {form.target === 'role' && (
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Role<FieldMark /></label>
            <Select
              value={form.role}
              onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
              className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2 pr-8 text-sm focus:outline-none"
            >
              <option value="">Select role...</option>
              {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role.replace(/_/g, ' ')}</option>)}
            </Select>
          </div>
        )}

        {form.target === 'specific' && (
          <MultiUserPicker
            users={users}
            selectedIds={form.user_ids}
            onChange={(ids) => setForm((c) => ({ ...c, user_ids: ids }))}
          />
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Message<FieldMark required /></label>
          <textarea
            rows={3}
            value={form.body}
            onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
            placeholder="Write your notification message..."
            required
            className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/*
          Disabled rather than validated on click, for the one target where the
          answer is already on screen. The other targets resolve their audience
          server-side, so whether they are empty is not knowable here — those
          still report after the press.
        */}
        <Button
          onClick={handleSend}
          disabled={sending || (form.target === 'specific' && form.user_ids.length === 0)}
        >
          {sending ? 'Sending…' : 'Send Notification'}
        </Button>
      </div>

      <Modal open={showSingleModal} onClose={closeSingleModal} title="Send Single Notification" size="sm">
        <form onSubmit={handleSendSingle} className="space-y-3">
          {singleError && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{singleError}</div>}

          <div className="flex rounded-lg border border-slate-200 p-1">
            <Button
              type="button"
              variant={singleForm.mode === 'in_app' ? 'primary' : 'secondary'}
              size="sm"
              className="flex-1"
              onClick={() => setSingleForm((current) => ({ ...current, mode: 'in_app' }))}
            >
              In-App
            </Button>
            <Button
              type="button"
              variant={singleForm.mode === 'email' ? 'primary' : 'secondary'}
              size="sm"
              className="flex-1"
              onClick={() => setSingleForm((current) => ({ ...current, mode: 'email' }))}
            >
              Email
            </Button>
          </div>

          {singleForm.mode === 'email' ? (
            <>
              <Input
                label="To"
                type="email"
                value={singleForm.to}
                onChange={(event) => setSingleForm((current) => ({ ...current, to: event.target.value }))}
                required
              />
              <Input
                label="Subject"
                value={singleForm.subject}
                onChange={(event) => setSingleForm((current) => ({ ...current, subject: event.target.value }))}
                required
              />
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Body<FieldMark required /></span>
                <textarea
                  rows={5}
                  value={singleForm.body}
                  onChange={(event) => setSingleForm((current) => ({ ...current, body: event.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  required
                />
              </label>
            </>
          ) : (
            <>
              <Input
                label="Recipient User ID"
                type="number"
                min="1"
                value={singleForm.user_id}
                onChange={(event) => setSingleForm((current) => ({ ...current, user_id: event.target.value }))}
                required
              />
              <Input
                label="Title"
                value={singleForm.title}
                onChange={(event) => setSingleForm((current) => ({ ...current, title: event.target.value }))}
                required
              />
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Type<FieldMark /></span>
                <Select
                  value={singleForm.type}
                  onChange={(event) => setSingleForm((current) => ({ ...current, type: event.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  {['info', 'warning', 'alert'].map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </Select>
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Message<FieldMark required /></span>
                <textarea
                  rows={4}
                  value={singleForm.message}
                  onChange={(event) => setSingleForm((current) => ({ ...current, message: event.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  required
                />
              </label>
            </>
          )}
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={singleSending}>{singleSending ? 'Sending…' : singleForm.mode === 'email' ? 'Send Email' : 'Send Single'}</Button>
            <Button type="button" variant="secondary" onClick={closeSingleModal} disabled={singleSending}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function TemplatesPanel() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [form, setForm] = useState(EMPTY_TEMPLATE_FORM);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await listNotificationTemplates();
      setTemplates(getItems(response));
    } catch {
      setTemplates([]);
      setMessage({ type: 'error', text: 'Failed to load templates.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const closeModal = (force = false) => {
    if (saving && !force) return;
    setShowModal(false);
    setEditingTemplate(null);
    setForm(EMPTY_TEMPLATE_FORM);
  };

  const openCreate = () => {
    setEditingTemplate(null);
    setForm(EMPTY_TEMPLATE_FORM);
    setShowModal(true);
  };

  const openEdit = (template) => {
    setEditingTemplate(template);
    setForm({
      name: template.name || '',
      type: template.type || 'email',
      subject: template.subject || '',
      body: template.body || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.body.trim()) return;

    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        subject: form.subject.trim(),
        body: form.body.trim(),
      };
      if (editingTemplate) {
        await updateNotificationTemplate(editingTemplate.id, payload);
      } else {
        await createNotificationTemplate(payload);
      }
      closeModal(true);
      await loadTemplates();
      setMessage({ type: 'success', text: `Template ${editingTemplate ? 'updated' : 'created'} successfully.` });
    } catch {
      setMessage({ type: 'error', text: `Failed to ${editingTemplate ? 'update' : 'create'} template.` });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (template) => {
    if (!window.confirm(`Delete template "${template.name}"?`)) return;
    setMessage(null);
    try {
      await deleteNotificationTemplate(template.id);
      await loadTemplates();
      setMessage({ type: 'success', text: 'Template deleted successfully.' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to delete template.' });
    }
  };

  const columns = useMemo(() => [
    { key: 'name', label: 'Name', render: (row) => row.name || '—' },
    { key: 'type', label: 'Type', render: (row) => <Badge value={row.type || '—'} /> },
    { key: 'subject', label: 'Subject', render: (row) => row.subject || '—' },
    {
      key: 'createdAt',
      label: 'Created',
      render: (row) => {
        const value = row.createdAt || row.created_at;
        return value ? new Date(value).toLocaleString() : '—';
      },
    },
  ], []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Notification Templates</h2>
          <p className="text-sm text-slate-500">Create reusable templates for email, push, and SMS messages.</p>
        </div>
        <Button onClick={openCreate}>New Template</Button>
      </div>

      {message && (
        <div className={`rounded-lg px-4 py-2 text-sm ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl bg-white p-6 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">Loading templates...</div>
      ) : (
        <Table
        /*
          This page has its own search box, which filters on the SERVER and
          therefore searches every row rather than the page in view. The
          table's built-in search would sit beside it searching only the
          loaded rows — two boxes, different answers.
        */
        searchable={false}
          columns={columns}
          rows={templates}
          renderActions={(template) => (
            <div className="flex justify-end gap-2">
              <Button onClick={() => openEdit(template)} variant="primary" size="sm">Edit</Button>
              <Button onClick={() => handleDelete(template)} variant="danger" size="sm">Delete</Button>
            </div>
          )}
        />
      )}

      <Modal open={showModal} onClose={closeModal} title={editingTemplate ? 'Edit Template' : 'New Template'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            required
          />
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Type<FieldMark /></span>
            <Select
              value={form.type}
              onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              {EMAIL_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </Select>
          </label>
          <Input
            label="Subject"
            value={form.subject}
            onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
          />
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Body<FieldMark required /></span>
            <textarea
              rows={6}
              value={form.body}
              onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              required
            />
          </label>
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : editingTemplate ? 'Save Changes' : 'Create Template'}</Button>
            <Button type="button" variant="secondary" onClick={closeModal}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default function NotificationsPage() {
  const user = useAuthStore((state) => state.user);
  const isSuperiorAdmin = useAuthStore((state) => state.isSuperiorAdmin);
  const refreshNotifications = useNavBadgeStore((state) => state.refreshNotifications);
  const clearBadge = useNavBadgeStore((state) => state.clear);
  const isAdmin = user && ['superior_admin', 'super_admin', 'admin'].includes(user.type);

  const [notifications, setNotifications] = useState([]);
  const [sent, setSent] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(isAdmin ? 'compose' : 'inbox');

  const fetchNotifications = () => {
    setLoading(true);
    listNotifications()
      .then((response) => setNotifications(getItems(response)))
      .finally(() => setLoading(false));
  };

  const fetchSent = () => {
    listSentNotifications().then((response) => setSent(getItems(response))).catch(() => {});
  };

  useEffect(() => {
    fetchNotifications();
    if (isAdmin) {
      fetchSent();
      listNotificationTemplates().then((response) => setTemplates(getItems(response))).catch(() => setTemplates([]));
      listCompanies().then((response) => setCompanies(getItems(response))).catch(() => setCompanies([]));
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin && tab === 'sent') fetchSent();
  }, [isAdmin, tab]);

  /*
   * The bell has to move with the list.
   *
   * The count behind it is shared - one store read by every layout - and
   * marking things read here is the only place it changes without a page load.
   * Without these two lines the badge kept its old number until a full reload,
   * which read as the mark-as-read having silently failed.
   */
  const handleMarkRead = async (id) => {
    await markRead(id);
    setNotifications((prev) => prev.map((notification) => notification.id === id ? { ...notification, is_read: true } : notification));
    refreshNotifications();
  };

  const handleMarkAll = async () => {
    await markAllRead();
    setNotifications((prev) => prev.map((notification) => ({ ...notification, is_read: true })));
    // Zeroed rather than re-fetched: nothing is unread by definition, and the
    // badge should go as the rows do rather than one round trip later.
    clearBadge('unreadNotifications');
  };

  const unreadCount = notifications.filter((notification) => !notification.is_read).length;

  const TABS = isAdmin
    ? [
        { id: 'compose', label: '✉ Compose' },
        { id: 'sent', label: '📤 Sent' },
        { id: 'templates', label: '🧩 Templates' },
        { id: 'inbox', label: `🔔 Inbox${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
      ]
    : [{ id: 'inbox', label: `🔔 Inbox${unreadCount > 0 ? ` (${unreadCount})` : ''}` }];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Notifications</h1>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-slate-200 text-sm">
            {TABS.map((item) => (
              <Button key={item.id} onClick={() => setTab(item.id)} variant={tab === item.id ? 'primary' : 'secondary'} size="sm">
                {item.label}
              </Button>
            ))}
          </div>
          {tab === 'inbox' && unreadCount > 0 && (
            <Button variant="secondary" onClick={handleMarkAll}>Mark all read</Button>
          )}
        </div>
      </div>

      {/*
        Turning notifications on for THIS browser, on the page everybody can
        open. It is a personal, per-device setting — there is nothing about it
        that belongs behind an administrator's permission, which is where it
        used to be — so it sits above the inbox where somebody wondering why
        their laptop is quiet will actually find it.
      */}
      <BrowserNotificationsCard />

      {isAdmin && tab === 'compose' && (
        <ComposePanel
          onSent={() => { fetchNotifications(); fetchSent(); }}
          isSuperiorAdmin={isSuperiorAdmin}
          companies={companies}
          templates={templates}
        />
      )}

      {isAdmin && tab === 'sent' && (
        <div className="space-y-2">
          {sent.length === 0 ? (
            <div className="rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-slate-200">
              <p className="text-slate-500">No notifications sent yet.</p>
            </div>
          ) : (
            sent.map((notification, index) => (
              <div key={notification.id || index} className="flex items-start justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800">{notification.title}</span>
                    <Badge value={notification.type} />
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-400">{notification.recipientCount} recipient{notification.recipientCount !== 1 ? 's' : ''}</span>
                  </div>
                  <p className="text-sm text-slate-600">{notification.body}</p>
                  <p className="text-xs text-slate-400">{new Date(notification.createdAt).toLocaleString()}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {isAdmin && tab === 'templates' && <TemplatesPanel />}

      {tab === 'inbox' && (
        loading ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : notifications.length === 0 ? (
          <div className="rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-slate-200">
            <p className="text-slate-500">No notifications yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`flex items-start justify-between rounded-xl p-4 shadow-sm ring-1 ${notification.is_read ? 'bg-white ring-slate-200' : 'bg-slate-50 ring-slate-300'}`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800">{notification.title}</span>
                    <Badge value={notification.type} />
                    {!notification.is_read && <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--primary)' }} />}
                  </div>
                  <p className="text-sm text-slate-600">{notification.body}</p>
                  <p className="text-xs text-slate-400">{new Date(notification.createdAt).toLocaleString()}</p>
                </div>
                {!notification.is_read && (
                  <Button onClick={() => handleMarkRead(notification.id)} variant="primary" size="sm" className="ml-4 shrink-0">
                    Mark read
                  </Button>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

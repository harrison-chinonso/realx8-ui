import { useEffect, useMemo, useState } from 'react';
import { Bell, CheckCheck, Eye, Inbox, Pencil, Send, Trash2, Upload, X } from 'lucide-react';
import useNavBadgeStore from '../../store/navBadgeStore';
import {
  listNotifications,
  markRead,
  markAllRead,
  sendBulkNotification,
  listSentNotifications,
  listNotificationTemplates,
  createNotificationTemplate,
  updateNotificationTemplate,
  deleteNotificationTemplate,
} from '../../api/notificationApi';
import { listUsers, listEmployees, listClients, listRealtors } from '../../api/userApi';
import { listCompanies } from '../../api/companyApi';
import Button from '../../components/ui/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import FieldMark from '../../components/ui/FieldMark';
import BrowserNotificationsCard from '../../components/settings/BrowserNotificationsCard';
import useAuthStore from '../../store/authStore';
import { extractError } from '../../utils/extractError';
import { enumTitle } from '../../utils/enumLabel';
import { useAppearance } from '../../context/useAppearance';

/**
 * Notifications: what you have received (Inbox), sending a message (Send) and
 * what you have sent (Sent).
 *
 * Sending is one form. Every message lands in the recipients' in-app inbox,
 * and — as the sender chooses — is emailed, sent as a push notification
 * (mobile app and browsers) and/or texted; the same for one person as for a thousand, so "send to one user" is simply "Specific people" with one chosen.
 * A company may upload its own HTML email designs and pick one per message;
 * without one, emails go out in the default design.
 */

const AUDIENCES = [
  { value: 'all', label: 'Everyone' },
  { value: 'clients', label: 'Clients' },
  { value: 'realtors', label: 'Realtors' },
  { value: 'employees', label: 'Employees' },
  { value: 'specific', label: 'Specific people' },
];
const PLATFORM_AUDIENCES = [
  { value: 'all', label: 'Everyone (all companies)' },
  { value: 'company', label: 'One company' },
  { value: 'role', label: 'By role' },
  { value: 'specific', label: 'Specific people' },
];
const ROLE_OPTIONS = ['super_admin', 'admin', 'realtor', 'branch_manager', 'product_manager', 'employee', 'client'];

const EMPTY_FORM = { audience: 'all', company_id: '', role: '', user_ids: [], title: '', body: '' };

const getItems = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  return [];
};
const typeOf = (user) => String(user?.type || '').toLowerCase();
const userMatchesRole = (user, role) => typeOf(user) === role
  || (Array.isArray(user?.roles) && user.roles.some((item) => item?.name === role));
const formatWhen = (value) => (value ? new Date(value).toLocaleString('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
}) : '');

const FIELD = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

// ── Recipient picker: user type, then the people ────────────────────────────
function PeoplePicker({ users, loading, selectedIds, onChange }) {
  const [userType, setUserType] = useState('');
  const [search, setSearch] = useState('');

  const types = useMemo(() => {
    const counts = new Map();
    users.forEach((u) => { const t = typeOf(u); if (t) counts.set(t, (counts.get(t) || 0) + 1); });
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [users]);

  const visible = useMemo(() => {
    const q = search.toLowerCase().trim();
    return users
      .filter((u) => typeOf(u) === userType)
      .filter((u) => !q || (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q));
  }, [users, userType, search]);

  const selected = users.filter((u) => selectedIds.includes(String(u.id)));
  const toggle = (id) => onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);

  return (
    <div className="space-y-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((u) => (
            <span key={u.id} className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
              {u.name}
              <button type="button" onClick={() => toggle(String(u.id))} aria-label={`Remove ${u.name}`} className="min-h-0 text-slate-400 hover:text-slate-700">
                <X size={12} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-[minmax(0,12rem)_1fr]">
        <Select value={userType} onChange={(e) => { setUserType(e.target.value); setSearch(''); }} className={FIELD} disabled={loading} aria-label="User type">
          <option value="">{loading ? 'Loading users…' : 'User type'}</option>
          {types.map(([t, count]) => <option key={t} value={t}>{enumTitle(t)} ({count})</option>)}
        </Select>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email"
          disabled={!userType}
          className={`${FIELD} disabled:bg-slate-100`}
        />
      </div>

      {userType && (
        <div className="max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-lg bg-white ring-1 ring-slate-200">
          {visible.length === 0 && <p className="px-3 py-4 text-center text-sm text-slate-400">No one found</p>}
          {visible.map((u) => (
            <label key={u.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50">
              <input type="checkbox" checked={selectedIds.includes(String(u.id))} onChange={() => toggle(String(u.id))} className="h-4 w-4 accent-blue-600" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-800">{u.name}</span>
                <span className="block truncate text-xs text-slate-400">{u.email || 'No email — in-app only'}</span>
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Email designs ───────────────────────────────────────────────────────────
/**
 * A company's own HTML email designs. Optional: without one, emails go out in
 * the default design. The server cleans each design and insists on
 * {{message}}; this window uploads, previews and names them.
 */
const PLACEHOLDER_HELP = [
  ['{{message}}', 'the message (required)'],
  ['{{title}}', 'the title'],
  ['{{name}}', "recipient's name"],
  ['{{first_name}}', "recipient's first name"],
  ['{{company_name}}', 'your company name'],
  ['{{logo_url}}', 'your logo address'],
  ['{{primary_color}}', 'your brand colour'],
  ['{{support_email}}', 'your contact email'],
  ['{{year}}', 'this year'],
];
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isDesign = (template) => template?.type === 'email' && /\{\{\s*message\s*\}\}/.test(template.body || '');

/** The same fill the server does, for previews only. */
const fillDesign = (html, { title, message, name, brand }) => {
  const values = {
    title: escapeHtml(title),
    message: String(message ?? '').split(/\n{2,}/).map((p) => escapeHtml(p).replace(/\n/g, '<br/>')).join('<br/><br/>'),
    name: escapeHtml(name),
    first_name: escapeHtml(String(name ?? '').split(' ')[0]),
    company_name: escapeHtml(brand.name),
    logo_url: escapeHtml(brand.logo || ''),
    primary_color: escapeHtml(brand.primaryColor || '#2563eb'),
    support_email: escapeHtml(brand.supportEmail || ''),
    year: String(new Date().getFullYear()),
  };
  return Object.entries(values).reduce((out, [key, value]) => out.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), () => value), String(html ?? ''));
};

/** A design rendered in a sandbox: no scripts, no navigation, no access to the app. */
function DesignPreview({ html, sample, className = 'h-80' }) {
  return (
    <iframe
      title="Email preview"
      sandbox=""
      srcDoc={fillDesign(html, sample)}
      className={`w-full rounded-lg bg-white ring-1 ring-slate-200 ${className}`}
    />
  );
}

function DesignsModal({ open, onClose, designs, onChanged, sample }) {
  const [editing, setEditing] = useState(null); // null = list, {} = new, {...} = edit
  const [previewing, setPreviewing] = useState(null);
  const [form, setForm] = useState({ name: '', body: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (!open) { setEditing(null); setPreviewing(null); setError(''); } }, [open]);

  const startEdit = (design) => {
    setEditing(design);
    setPreviewing(null);
    setForm({ name: design.name || '', body: design.body || '' });
    setError('');
  };

  const upload = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 512 * 1024) { setError('That file is larger than 512 KB. Host its images elsewhere and link to them.'); return; }
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({
      ...f,
      body: String(reader.result || ''),
      name: f.name || file.name.replace(/\.html?$/i, ''),
    }));
    reader.readAsText(file);
  };

  const hasMessage = /\{\{\s*message\s*\}\}/.test(form.body);

  const save = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !hasMessage) return;
    setSaving(true);
    setError('');
    try {
      const payload = { name: form.name.trim(), subject: form.name.trim(), body: form.body, type: 'email' };
      if (editing?.id) await updateNotificationTemplate(editing.id, payload);
      else await createNotificationTemplate(payload);
      await onChanged();
      setEditing(null);
    } catch (err) {
      setError(extractError(err, 'Could not save the design.'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (design) => {
    if (!window.confirm(`Delete the "${design.name}" design?`)) return;
    try {
      await deleteNotificationTemplate(design.id);
      await onChanged();
    } catch (err) {
      setError(extractError(err, 'Could not delete the design.'));
    }
  };

  const title = editing ? (editing.id ? `Edit ${editing.name}` : 'New email design') : previewing ? previewing.name : 'Email designs';

  return (
    <Modal open={open} onClose={onClose} title={title} size="xl">
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {editing && (
        <form onSubmit={save} className="space-y-3">
          <Input label="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-slate-700">HTML<FieldMark required /></span>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">
              <Upload size={14} aria-hidden="true" /> Upload .html file
              <input type="file" accept=".html,.htm,text/html" onChange={upload} className="sr-only" />
            </label>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <textarea
              rows={14}
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              placeholder="Paste your email HTML, or upload a file"
              spellCheck={false}
              className={`${FIELD} font-mono text-xs`}
            />
            {form.body.trim()
              ? <DesignPreview html={form.body} sample={sample} className="h-[22rem]" />
              : <div className="flex h-[22rem] items-center justify-center rounded-lg bg-slate-50 text-sm text-slate-400 ring-1 ring-slate-200">Preview appears here</div>}
          </div>
          {form.body.trim() && !hasMessage && (
            <p className="text-sm text-amber-700">Add <code>{'{{message}}'}</code> where the message should appear.</p>
          )}
          <details className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200">
            <summary className="cursor-pointer font-semibold text-slate-700">Placeholders you can use</summary>
            <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
              {PLACEHOLDER_HELP.map(([key, meaning]) => (
                <div key={key} className="flex gap-2"><dt className="font-mono text-slate-800">{key}</dt><dd>{meaning}</dd></div>
              ))}
            </dl>
            <p className="mt-2">Scripts are removed. Images must be links to files hosted online.</p>
          </details>
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={saving || !form.name.trim() || !hasMessage}>{saving ? 'Saving…' : 'Save design'}</Button>
            <Button type="button" variant="secondary" onClick={() => setEditing(null)} disabled={saving}>Back</Button>
          </div>
        </form>
      )}

      {!editing && previewing && (
        <div className="space-y-3">
          <DesignPreview html={previewing.body} sample={sample} className="h-[28rem]" />
          <div className="flex gap-2">
            <Button type="button" onClick={() => startEdit(previewing)}>Edit</Button>
            <Button type="button" variant="secondary" onClick={() => setPreviewing(null)}>Back</Button>
          </div>
        </div>
      )}

      {!editing && !previewing && (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            Optional. Upload your own HTML design to send emails in your brand&apos;s look; without one, emails use the default design.
          </p>
          {designs.length > 0 && (
            <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
              {designs.map((d) => (
                <li key={d.id} className="flex items-center gap-2 px-3 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{d.name}</span>
                  <button type="button" onClick={() => setPreviewing(d)} aria-label={`Preview ${d.name}`} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Eye size={15} aria-hidden="true" /></button>
                  <button type="button" onClick={() => startEdit(d)} aria-label={`Edit ${d.name}`} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Pencil size={15} aria-hidden="true" /></button>
                  <button type="button" onClick={() => remove(d)} aria-label={`Delete ${d.name}`} className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} aria-hidden="true" /></button>
                </li>
              ))}
            </ul>
          )}
          <Button type="button" onClick={() => startEdit({})}><Upload size={15} aria-hidden="true" /> Add a design</Button>
        </div>
      )}
    </Modal>
  );
}

// ── Send ────────────────────────────────────────────────────────────────────
function SendPanel({ isSuperiorAdmin, onSent }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [designs, setDesigns] = useState([]);
  const [designId, setDesignId] = useState('');
  const [showDesigns, setShowDesigns] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const { app_name: appName, app_logo: appLogo } = useAppearance();
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  // How it is delivered besides the in-app inbox, which is always included.
  // SMS starts off: it is the one route the company pays for per message.
  const [delivery, setDelivery] = useState({ email: true, push: true, sms: false });

  const audiences = isSuperiorAdmin ? PLATFORM_AUDIENCES : AUDIENCES;
  const set = (patch) => setForm((current) => ({ ...current, ...patch }));

  const loadDesigns = () => listNotificationTemplates({ limit: 200 })
    .then((response) => setDesigns(getItems(response).filter(isDesign)))
    .catch(() => setDesigns([]));

  useEffect(() => {
    loadDesigns();
    if (isSuperiorAdmin) listCompanies().then((r) => setCompanies(getItems(r))).catch(() => setCompanies([]));
  }, [isSuperiorAdmin]);

  useEffect(() => {
    if (form.audience !== 'specific' || users.length || usersLoading) return;
    setUsersLoading(true);
    listUsers({ limit: 5000 })
      .then((response) => setUsers(getItems(response)))
      .catch(() => setUsers([]))
      .finally(() => setUsersLoading(false));
  }, [form.audience, users.length, usersLoading]);

  // A deleted design must not stay selected.
  useEffect(() => {
    if (designId && !designs.some((d) => String(d.id) === designId)) setDesignId('');
  }, [designs, designId]);

  const chosenDesign = designs.find((d) => String(d.id) === designId) || null;
  const sample = {
    title: form.title || 'Your title',
    message: form.body || 'Your message appears here.',
    name: 'Ada Obi',
    brand: { name: appName || 'Your company', logo: appLogo, primaryColor: getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() },
  };

  const resolveRecipients = async () => {
    switch (form.audience) {
      case 'specific': return form.user_ids.map(Number);
      case 'clients': return getItems(await listClients()).map((u) => u.id);
      case 'realtors': return getItems(await listRealtors()).map((u) => u.id);
      case 'employees': return getItems(await listEmployees()).map((u) => u.id);
      case 'company': return getItems(await listUsers({ company_id: form.company_id, limit: 5000 })).map((u) => u.id);
      case 'role': return getItems(await listUsers({ role: form.role, limit: 5000 })).filter((u) => userMatchesRole(u, form.role)).map((u) => u.id);
      default: return getItems(await listUsers({ limit: 5000 })).map((u) => u.id);
    }
  };

  const missing = !form.title.trim() || !form.body.trim()
    || (form.audience === 'specific' && form.user_ids.length === 0)
    || (form.audience === 'company' && !form.company_id)
    || (form.audience === 'role' && !form.role);

  const handleSend = async (event) => {
    event.preventDefault();
    if (missing) return;
    setSending(true);
    setResult(null);
    try {
      const userIds = [...new Set((await resolveRecipients()).filter(Boolean))];
      if (!userIds.length) {
        setResult({ type: 'error', text: 'No one matches who you chose.' });
        return;
      }
      const response = await sendBulkNotification({
        user_ids: userIds, title: form.title.trim(), body: form.body.trim(), type: 'info',
        channels: Object.keys(delivery).filter((route) => delivery[route]),
        ...(delivery.email && designId ? { template_id: Number(designId) } : {}),
      });
      const mail = delivery.email && response.email
        ? ` ${response.email.sent} email${response.email.sent === 1 ? '' : 's'} sent${response.email.failed ? `, ${response.email.failed} failed` : ''}.`
        : '';
      const push = delivery.push && response.push
        ? ` Push notification reached ${response.push.people} ${response.push.people === 1 ? 'person' : 'people'}${response.push.people < response.count ? ' (the rest have no app or browser alerts turned on)' : ''}.`
        : '';
      const sms = delivery.sms && response.sms
        ? (response.sms.not_configured
          ? ' Text messages were not sent: SMS is not set up for your company (Settings → SMS).'
          : ` ${response.sms.sent} text message${response.sms.sent === 1 ? '' : 's'} sent${response.sms.failed ? `, ${response.sms.failed} failed` : ''}${response.sms.no_phone ? `; ${response.sms.no_phone} without a phone number` : ''}.`)
        : '';
      setResult({ type: 'success', text: `Sent to ${response.count} ${response.count === 1 ? 'person' : 'people'}.${mail}${push}${sms}` });
      setForm((current) => ({ ...EMPTY_FORM, audience: current.audience }));
      onSent();
    } catch (error) {
      setResult({ type: 'error', text: extractError(error, 'Could not send the message.') });
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={handleSend} className="space-y-5 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
      {result && (
        <div className={`rounded-lg px-4 py-2 text-sm ${result.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`} role="status">
          {result.text}
        </div>
      )}

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium text-slate-700">To</legend>
        <div className="flex flex-wrap gap-2">
          {audiences.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => set({ audience: option.value, user_ids: [], company_id: '', role: '' })}
              aria-pressed={form.audience === option.value}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition ${form.audience === option.value ? 'bg-primary text-white ring-transparent' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'}`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {form.audience === 'company' && (
          <Select value={form.company_id} onChange={(e) => set({ company_id: e.target.value })} className={FIELD} aria-label="Company">
            <option value="">Select a company</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        )}
        {form.audience === 'role' && (
          <Select value={form.role} onChange={(e) => set({ role: e.target.value })} className={FIELD} aria-label="Role">
            <option value="">Select a role</option>
            {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{enumTitle(role)}</option>)}
          </Select>
        )}
        {form.audience === 'specific' && (
          <PeoplePicker users={users} loading={usersLoading} selectedIds={form.user_ids} onChange={(ids) => set({ user_ids: ids })} />
        )}
      </fieldset>

      <div className="space-y-3">
        <span className="block text-sm font-medium text-slate-700">Message</span>
        <input value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="Title" aria-label="Title" className={FIELD} required />
        <textarea rows={5} value={form.body} onChange={(e) => set({ body: e.target.value })} placeholder="Write your message…" aria-label="Message" className={`${FIELD} resize-y`} required />
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium text-slate-700">Send as</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-700">
          <label className="inline-flex items-center gap-2 text-slate-500">
            <input type="checkbox" checked disabled className="h-4 w-4 accent-blue-600" /> In-app (always)
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={delivery.email} onChange={(e) => setDelivery((d) => ({ ...d, email: e.target.checked }))} className="h-4 w-4 accent-blue-600" />
            Email
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={delivery.push} onChange={(e) => setDelivery((d) => ({ ...d, push: e.target.checked }))} className="h-4 w-4 accent-blue-600" />
            Push notification
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={delivery.sms} onChange={(e) => setDelivery((d) => ({ ...d, sms: e.target.checked }))} className="h-4 w-4 accent-blue-600" />
            SMS
          </label>
        </div>
        <p className="text-xs text-slate-500">
          Email goes to those with an email address. Push notifications reach the mobile app and any browser where the person turned alerts on.
          SMS goes to those with a phone number, through your company&apos;s SMS provider, and is charged per message.
        </p>
      </fieldset>

      {delivery.email && (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-slate-700">Email design</span>
          <button type="button" onClick={() => setShowDesigns(true)} className="text-xs font-semibold text-primary hover:underline">
            {designs.length ? 'Manage designs' : 'Use your own HTML design'}
          </button>
        </div>
        {designs.length > 0 ? (
          <div className="flex gap-2">
            <Select value={designId} onChange={(e) => setDesignId(e.target.value)} className={FIELD} aria-label="Email design">
              <option value="">Default design</option>
              {designs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
            {chosenDesign && (
              <Button type="button" variant="secondary" onClick={() => setShowPreview(true)}>
                <Eye size={15} aria-hidden="true" /> Preview
              </Button>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-500">Emails use the default design.</p>
        )}
      </div>
      )}

      <Button type="submit" disabled={sending || missing}>
        <Send size={15} aria-hidden="true" /> {sending ? 'Sending…' : 'Send'}
      </Button>

      <DesignsModal open={showDesigns} onClose={() => setShowDesigns(false)} designs={designs} onChanged={loadDesigns} sample={sample} />
      <Modal open={showPreview && !!chosenDesign} onClose={() => setShowPreview(false)} title={chosenDesign ? `Preview: ${chosenDesign.name}` : 'Preview'} size="xl">
        {chosenDesign && <DesignPreview html={chosenDesign.body} sample={sample} className="h-[30rem]" />}
      </Modal>
    </form>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const user = useAuthStore((state) => state.user);
  const isSuperiorAdmin = useAuthStore((state) => state.isSuperiorAdmin);
  const refreshNotifications = useNavBadgeStore((state) => state.refreshNotifications);
  const clearBadge = useNavBadgeStore((state) => state.clear);
  const isAdmin = user && ['superior_admin', 'super_admin', 'admin'].includes(user.type);

  const [notifications, setNotifications] = useState([]);
  const [sent, setSent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(isAdmin ? 'send' : 'inbox');

  const fetchNotifications = () => {
    setLoading(true);
    listNotifications()
      .then((response) => setNotifications(getItems(response)))
      .finally(() => setLoading(false));
  };
  const fetchSent = () => listSentNotifications().then((response) => setSent(getItems(response))).catch(() => {});

  useEffect(() => { fetchNotifications(); }, []);
  useEffect(() => { if (isAdmin && tab === 'sent') fetchSent(); }, [isAdmin, tab]);

  /*
   * The bell has to move with the list: the count behind it is shared, and
   * marking things read here is the only place it changes without a reload.
   */
  const handleMarkRead = async (id) => {
    await markRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    refreshNotifications();
  };
  const handleMarkAll = async () => {
    await markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    clearBadge('unreadNotifications');
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const tabs = [
    { id: 'inbox', label: 'Inbox', icon: Inbox, count: unreadCount },
    ...(isAdmin ? [{ id: 'send', label: 'Send', icon: Send }, { id: 'sent', label: 'Sent', icon: CheckCheck }] : []),
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-800">Notifications</h1>
        {tabs.length > 1 && (
          <div role="tablist" className="inline-flex rounded-lg bg-slate-100 p-1">
            {tabs.map(({ id, label, icon: Icon, count }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`inline-flex min-h-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${tab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                <Icon size={15} aria-hidden="true" />
                {label}
                {count > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-4 text-white">{count}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === 'send' && isAdmin && (
        <SendPanel isSuperiorAdmin={isSuperiorAdmin} onSent={() => { fetchNotifications(); fetchSent(); }} />
      )}

      {tab === 'sent' && isAdmin && (
        sent.length === 0 ? (
          <EmptyState icon={Send} text="Nothing sent yet." />
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
            {sent.map((n, index) => (
              <li key={n.id || index} className="space-y-1 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-slate-800">{n.title}</p>
                  <span className="shrink-0 text-xs text-slate-400">{formatWhen(n.createdAt)}</span>
                </div>
                <p className="line-clamp-2 text-sm text-slate-600">{n.body}</p>
                <p className="text-xs text-slate-400">{n.recipientCount} {n.recipientCount === 1 ? 'person' : 'people'}</p>
              </li>
            ))}
          </ul>
        )
      )}

      {tab === 'inbox' && (
        <>
          {unreadCount > 0 && (
            <div className="flex justify-end">
              <button type="button" onClick={handleMarkAll} className="text-sm font-semibold text-primary hover:underline">Mark all as read</button>
            </div>
          )}
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : notifications.length === 0 ? (
            <EmptyState icon={Bell} text="You're all caught up." />
          ) : (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
              {notifications.map((n) => (
                <li key={n.id}>
                  {/* The row is the action: opening an unread message marks it read. */}
                  <button
                    type="button"
                    onClick={() => !n.is_read && handleMarkRead(n.id)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left ${n.is_read ? 'cursor-default' : 'bg-blue-50/40 hover:bg-blue-50'}`}
                  >
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.is_read ? 'bg-transparent' : 'bg-primary'}`} aria-hidden="true" />
                    <span className="min-w-0 flex-1 space-y-0.5">
                      <span className="flex items-start justify-between gap-3">
                        <span className={`text-sm ${n.is_read ? 'text-slate-700' : 'font-semibold text-slate-900'}`}>{n.title}</span>
                        <span className="shrink-0 text-xs text-slate-400">{formatWhen(n.createdAt)}</span>
                      </span>
                      <span className="block text-sm text-slate-600">{n.body}</span>
                      {!n.is_read && <span className="sr-only">Unread — select to mark as read</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {/* Per-device, and only relevant to what you receive. */}
          <BrowserNotificationsCard />
        </>
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, text }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
      <Icon size={22} className="text-slate-300" aria-hidden="true" />
      <p className="text-sm text-slate-500">{text}</p>
    </div>
  );
}

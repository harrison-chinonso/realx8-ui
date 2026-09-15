import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getNotificationConfig, saveNotificationConfig, resetNotificationConfig,
  previewNotificationRecipients,
} from '../../api/notificationApi';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import Modal from '../../components/common/Modal';

const getData = (response) => response?.data ?? response ?? null;

const CHANNEL_LABELS = {
  in_app: 'In-app only',
  email: 'Email only',
  both: 'In-app and email',
  push: 'Browser only',
  'in_app,push': 'In-app and browser',
  'email,push': 'Email and browser',
  'in_app,email,push': 'In-app, email and browser',
};
const MODULE_LABELS = {
  finance: 'Finance', properties: 'Properties', crm: 'CRM', investments: 'Investments',
  realtors: 'Realtors', training: 'Training', media: 'Media', support: 'Support',
  platform: 'Platform',
};

/**
 * Who is told about each event in the system, and how.
 *
 * Two things about this screen need saying plainly, because they are the two
 * things users get wrong:
 *
 *   A company's configuration REPLACES the platform defaults wholesale rather
 *   than merging into them. Switch one event off and you have taken over all of
 *   them; anything left unticked is off, not inherited. The banner says so, and
 *   "Revert to defaults" is the way back.
 *
 *   The permission columns are not "admins". They are groups defined by what
 *   people can DO. Selecting "View Invoices" means whoever your Roles screen
 *   says can view invoices — which may be an admin, a branch manager, or a role
 *   you invented this morning. Changing that group is a Roles change, not a
 *   change here.
 */
export default function NotificationSettingsPage() {
  const [events, setEvents] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [modules, setModules] = useState([]);
  const [channels, setChannels] = useState(['both', 'in_app', 'email']);
  const [isOverride, setIsOverride] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dirty, setDirty] = useState(false);
  const [openModule, setOpenModule] = useState(null);
  const [picking, setPicking] = useState(null);
  const [preview, setPreview] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    getNotificationConfig()
      .then((response) => {
        const data = getData(response);
        setEvents(data?.events || []);
        setPermissions(data?.available_permissions || []);
        setModules(data?.modules || []);
        if (data?.channels?.length) setChannels(data.channels);
        setIsOverride(Boolean(data?.is_company_override));
        setOpenModule((current) => current || data?.modules?.[0] || null);
        setError('');
        setDirty(false);
      })
      .catch((err) => setError(err?.response?.data?.message || 'Could not load the notification settings.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = (eventKey, changes) => {
    setEvents((current) => current.map((e) => (e.event_key === eventKey ? { ...e, ...changes } : e)));
    setDirty(true);
    setNotice('');
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      // The whole set, always — a partial save would switch off every event it
      // omitted, because there is no per-event fallback.
      await saveNotificationConfig(events.map((e) => ({
        event_key: e.event_key,
        enabled: e.enabled,
        subject: e.subject,
        realtor: e.realtor,
        permissions: e.permissions || [],
        channel: e.channel,
      })));
      setNotice(isOverride
        ? 'Notification settings saved.'
        : 'Saved. Your company now has its own notification settings, and the platform defaults no longer apply.');
      setIsOverride(true);
      setDirty(false);
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not save the notification settings.');
    } finally {
      setSaving(false);
    }
  };

  const revert = async () => {
    if (!window.confirm("Discard your company's notification settings and go back to the platform defaults?")) return;
    setSaving(true);
    try {
      await resetNotificationConfig();
      setNotice('Reverted to the platform defaults.');
      load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not revert the settings.');
    } finally {
      setSaving(false);
    }
  };

  const showRecipients = async (event) => {
    setPreview({ event, loading: true });
    try {
      const response = await previewNotificationRecipients(event.event_key);
      setPreview({ event, data: getData(response) });
    } catch (err) {
      setPreview({ event, error: err?.response?.data?.message || 'Could not resolve the recipients.' });
    }
  };

  const byModule = useMemo(() => events.reduce((map, e) => {
    (map[e.module] = map[e.module] || []).push(e);
    return map;
  }, {}), [events]);

  const permissionLabel = useMemo(() => {
    const map = new Map(permissions.map((p) => [p.name, p.display_name || p.name]));
    return (name) => map.get(name) || name;
  }, [permissions]);

  if (loading) return <p className="text-sm text-slate-500">Loading notification settings...</p>;

  const enabledCount = events.filter((e) => e.enabled).length;

  return (
    <div className="space-y-4">
      {/*
        Above the per-event table, because turning browser notifications on is
        a prerequisite for any of those choices to reach this device — a person
        who sets six events to "browser" and never granted permission would
        otherwise be configuring something switched off.
      */}
      {/*
        The browser toggle used to live here, and only here — behind
        `finance.purchase-notifications.manage`. Which meant the one setting
        that is PERSONAL, per browser and per device, could be reached only by
        somebody who administers the company's notification rules. A client, a
        realtor or an ordinary employee could never turn their own notifications
        on. It now lives on Notifications, which everyone with a role can open,
        and is signposted from here because this is where an administrator
        configuring the event matrix will look for it.
      */}
      <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200">
        Turning browser notifications on for your own device is on the{' '}
        <Link to="/notifications" className="font-medium underline" style={{ color: 'var(--primary)' }}>Notifications</Link>{' '}
        page — it is a per-browser setting, so everyone turns it on for themselves.
      </p>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500">
            Every event in the system that can notify someone — {enabledCount} of {events.length} are on.
          </p>
        </div>
        {isOverride && (
          <Button type="button" variant="secondary" onClick={revert} disabled={saving}>
            Revert to defaults
          </Button>
        )}
      </div>

      <div className={`rounded-lg px-4 py-3 text-sm ${isOverride ? 'bg-amber-50 text-amber-800' : 'bg-blue-50 text-blue-800'}`}>
        {isOverride
          ? 'Your company has its own notification settings. They replace the platform defaults entirely — '
            + 'any event switched off below is off, not inherited.'
          : 'Your company is using the platform defaults. Saving any change here takes over all of them at '
            + 'once, so review the events you care about before you save.'}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
      {notice && <p className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">{notice}</p>}

      {modules.filter((m) => byModule[m]?.length).map((moduleKey) => {
        const list = byModule[moduleKey] || [];
        const on = list.filter((e) => e.enabled).length;
        const isOpen = openModule === moduleKey;
        return (
          <div key={moduleKey} className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
            <button
              type="button"
              onClick={() => setOpenModule(isOpen ? null : moduleKey)}
              className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-slate-50"
            >
              <span className="font-medium text-slate-900">{MODULE_LABELS[moduleKey] || moduleKey}</span>
              <span className="text-xs text-slate-500">
                {on} of {list.length} on {isOpen ? '▲' : '▼'}
              </span>
            </button>

            {isOpen && (
              <div className="overflow-x-auto border-t border-slate-100">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600">Event</th>
                      <th className="px-4 py-3 text-center font-semibold text-slate-600">On</th>
                      <th className="px-4 py-3 text-center font-semibold text-slate-600">Person involved</th>
                      <th className="px-4 py-3 text-center font-semibold text-slate-600">Their realtor</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600">Anyone who can…</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600">Channel</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {list.map((event) => (
                      <tr key={event.event_key} className={event.enabled ? '' : 'text-slate-400'}>
                        <td className="px-4 py-3">
                          <div className="font-medium">{event.label}</div>
                          {event.description && (
                            <div className="mt-0.5 text-xs text-slate-500">{event.description}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={Boolean(event.enabled)}
                            onChange={(e) => update(event.event_key, { enabled: e.target.checked })}
                          />
                        </td>
                        {/* The relational recipients, labelled per event — "Buyer"
                            on an invoice, "Author" on a post. */}
                        <td className="px-4 py-3 text-center">
                          {event.supports?.subject ? (
                            <label className="inline-flex flex-col items-center gap-1">
                              <input
                                type="checkbox"
                                checked={Boolean(event.subject)}
                                disabled={!event.enabled}
                                onChange={(e) => update(event.event_key, { subject: e.target.checked })}
                              />
                              <span className="text-xs text-slate-500">{event.subject_label}</span>
                            </label>
                          ) : <span className="text-xs text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {event.supports?.realtor ? (
                            <input
                              type="checkbox"
                              checked={Boolean(event.realtor)}
                              disabled={!event.enabled}
                              onChange={(e) => update(event.event_key, { realtor: e.target.checked })}
                            />
                          ) : <span className="text-xs text-slate-300">—</span>}
                        </td>
                        {/* Permission-targeted recipients: a group defined by
                            what people can do, not by job title. */}
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-1">
                            {(event.permissions || []).map((name) => (
                              <span key={name} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                                {permissionLabel(name)}
                              </span>
                            ))}
                            {!(event.permissions || []).length && (
                              <span className="text-xs text-slate-400">nobody</span>
                            )}
                            <Button
                              type="button"
                              variant="link"
                              disabled={!event.enabled}
                              onClick={() => setPicking(event)}
                            >
                              Choose
                            </Button>
                            {(event.permissions || []).length > 0 && (
                              <Button type="button" variant="link" onClick={() => showRecipients(event)}>
                                Who?
                              </Button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Select
                            value={event.channel || 'both'}
                            disabled={!event.enabled}
                            onChange={(e) => update(event.event_key, { channel: e.target.value })}
                          >
                            {channels.map((c) => (
                              <option key={c} value={c}>{CHANNEL_LABELS[c] || c}</option>
                            ))}
                          </Select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      <p className="text-xs text-slate-500">
        The person involved and their realtor are resolved from the event itself, so they are one
        specific person. A realtor is only notified where one is assigned — where none is, that
        recipient is left out. The &ldquo;anyone who can…&rdquo; groups come from your Roles screen,
        so changing who is in one is a role change rather than a change here.
      </p>

      <div className="flex justify-end">
        <Button type="button" onClick={save} disabled={saving || !dirty}>
          {saving ? 'Saving…' : 'Save notification settings'}
        </Button>
      </div>

      {picking && (
        <PermissionPicker
          event={picking}
          permissions={permissions}
          onClose={() => setPicking(null)}
          onSave={(selected) => {
            update(picking.event_key, { permissions: selected });
            setPicking(null);
          }}
        />
      )}

      {preview && (
        <Modal open onClose={() => setPreview(null)} title={`Who is notified — ${preview.event.label}`} size="lg">
          <div className="space-y-3 text-sm">
            {preview.loading && <p className="text-slate-500">Resolving...</p>}
            {preview.error && <p className="rounded-lg bg-red-50 px-4 py-2 text-red-700">{preview.error}</p>}
            {preview.data && (
              <>
                {preview.data.relational?.subject && (
                  <p className="text-slate-600">
                    Plus the <strong>{preview.data.relational.subject}</strong> on each one
                    {preview.data.relational.realtor && ', and their assigned realtor'}.
                  </p>
                )}
                {preview.data.permission_recipients?.length ? (
                  <div className="overflow-hidden rounded-lg ring-1 ring-slate-200">
                    {/* Scrolls inside its own box rather than widening the page on a phone. */}
                    <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                      <tbody className="divide-y divide-slate-100">
                        {preview.data.permission_recipients.map((u) => (
                          <tr key={u.id}>
                            <td className="px-4 py-2 font-medium text-slate-900">{u.name}</td>
                            <td className="px-4 py-2 text-slate-600">{u.email}</td>
                            <td className="px-4 py-2 text-xs text-slate-500">{u.type}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </div>
                ) : (
                  <p className="rounded-lg bg-amber-50 px-4 py-2 text-amber-800">
                    No current user holds any of the selected permissions, so nobody would be notified
                    through them. Check the Roles screen, or select a different permission.
                  </p>
                )}
              </>
            )}
            <div className="flex justify-end border-t border-slate-100 pt-3">
              <Button type="button" variant="secondary" onClick={() => setPreview(null)}>Close</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** Multi-select of permissions, grouped by module. */
function PermissionPicker({ event, permissions, onClose, onSave }) {
  const [selected, setSelected] = useState(() => new Set(event.permissions || []));
  const [search, setSearch] = useState('');

  const grouped = useMemo(() => {
    const term = search.trim().toLowerCase();
    return permissions
      .filter((p) => !term || (p.display_name || p.name).toLowerCase().includes(term)
        || p.name.toLowerCase().includes(term))
      .reduce((map, p) => {
        (map[p.module || 'other'] = map[p.module || 'other'] || []).push(p);
        return map;
      }, {});
  }, [permissions, search]);

  const toggle = (name) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(name)) next.delete(name); else next.add(name);
    return next;
  });

  return (
    <Modal open onClose={onClose} title={`Who can receive "${event.label}"`} size="lg">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Select one or more permissions. Anyone in your company holding <strong>any</strong> of them
          is notified — so this targets what people can do rather than their job title.
        </p>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search permissions..."
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />

        <div className="max-h-80 space-y-4 overflow-y-auto">
          {Object.entries(grouped).map(([moduleKey, list]) => (
            <div key={moduleKey}>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {MODULE_LABELS[moduleKey] || moduleKey}
              </div>
              <div className="grid gap-1 sm:grid-cols-2">
                {list.map((p) => (
                  <label key={p.name} className="flex items-start gap-2 rounded px-1 py-0.5 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selected.has(p.name)}
                      onChange={() => toggle(p.name)}
                    />
                    <span className="text-sm text-slate-700">
                      {p.display_name || p.name}
                      <span className="block text-xs text-slate-400">{p.name}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
          {!Object.keys(grouped).length && (
            <p className="text-sm text-slate-500">No permissions match that search.</p>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <span className="text-xs text-slate-500">
            {selected.size} permission{selected.size === 1 ? '' : 's'} selected
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="button" onClick={() => onSave([...selected])}>Apply</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

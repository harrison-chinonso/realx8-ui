import { useCallback, useEffect, useState } from 'react';
import {
  getNotificationConfig, saveNotificationConfig, resetNotificationConfig,
} from '../../api/notificationApi';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';

const getData = (response) => response?.data ?? response ?? null;

/** Readable names for the event keys, in the order the journey runs. */
const EVENT_LABELS = {
  invoice_created: 'Invoice created',
  payment_receipt_submitted: 'Payment receipt submitted',
  payment_approved: 'Payment approved',
  payment_rejected: 'Payment rejected',
  invoice_fully_paid: 'Invoice fully paid',
  schedule_reminder_first: 'Installment reminder — 14 days before due',
  schedule_reminder_second: 'Installment reminder — 3 days before due',
  schedule_due: 'Installment due',
  schedule_in_grace: 'Installment overdue, within grace',
  schedule_overdue: 'Installment overdue, late fee applied',
  availability_reduced: 'Availability reduced below an invoiced quantity',
  invoice_cancelled: 'Invoice cancelled',
  payment_plan_completed: 'Payment plan completed',
};

const CHANNELS = [
  { value: 'both', label: 'In-app and email' },
  { value: 'in_app', label: 'In-app only' },
  { value: 'email', label: 'Email only' },
];

/**
 * Who is told about each purchase-journey event.
 *
 * The behaviour that most needs explaining on this screen is the one users get
 * wrong: a company's configuration REPLACES the platform defaults wholesale
 * rather than being merged into them. Switch one event off and you have taken
 * over all thirteen — anything left unticked is off, not inherited. The banner
 * and the save confirmation both say so, and "Revert to defaults" is the way
 * back.
 */
export default function PurchaseNotificationsPage() {
  const [events, setEvents] = useState([]);
  const [isOverride, setIsOverride] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // Tracked so the save button can be disabled until something actually changes.
  const [dirty, setDirty] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getNotificationConfig()
      .then((response) => {
        const data = getData(response);
        setEvents(data?.events || []);
        setIsOverride(Boolean(data?.is_company_override));
        setError('');
        setDirty(false);
      })
      .catch((err) => setError(err?.response?.data?.message || 'Could not load the notification settings.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = (eventKey, changes) => {
    setEvents((current) => current.map((event) => (
      event.event_key === eventKey ? { ...event, ...changes } : event
    )));
    setDirty(true);
    setNotice('');
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      // The whole set, always — a partial save would switch off every event it
      // omitted, because there is no per-event fallback.
      await saveNotificationConfig(events.map((event) => ({
        event_key: event.event_key,
        enabled: event.enabled,
        client: event.client,
        realtor: event.realtor,
        admin: event.admin,
        channel: event.channel,
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
    if (!window.confirm('Discard your company\'s notification settings and go back to the platform defaults?')) return;
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

  if (loading) return <p className="text-sm text-slate-500">Loading notification settings...</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Purchase Notifications</h1>
          <p className="text-sm text-slate-500">
            Who is told about each step of a property purchase, and how.
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
            + 'once, so review every row before you save.'}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
      {notice && <p className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">{notice}</p>}

      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Event</th>
                <th className="px-4 py-3 text-center font-semibold text-slate-600">On</th>
                <th className="px-4 py-3 text-center font-semibold text-slate-600">Client</th>
                <th className="px-4 py-3 text-center font-semibold text-slate-600">Realtor</th>
                <th className="px-4 py-3 text-center font-semibold text-slate-600">Admin</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Channel</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {events.map((event) => (
                <tr key={event.event_key} className={event.enabled ? '' : 'text-slate-400'}>
                  <td className="px-4 py-3">
                    {EVENT_LABELS[event.event_key] || event.event_key.replace(/_/g, ' ')}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={Boolean(event.enabled)}
                      onChange={(e) => update(event.event_key, { enabled: e.target.checked })}
                    />
                  </td>
                  {['client', 'realtor', 'admin'].map((role) => (
                    <td key={role} className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={Boolean(event[role])}
                        disabled={!event.enabled}
                        onChange={(e) => update(event.event_key, { [role]: e.target.checked })}
                      />
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <Select
                      value={event.channel || 'both'}
                      disabled={!event.enabled}
                      onChange={(e) => update(event.event_key, { channel: e.target.value })}
                    >
                      {CHANNELS.map((channel) => (
                        <option key={channel.value} value={channel.value}>{channel.label}</option>
                      ))}
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        A realtor is notified only where one is assigned to the client — where none is, that recipient
        is simply left out.
      </p>

      <div className="flex justify-end">
        <Button type="button" onClick={save} disabled={saving || !dirty}>
          {saving ? 'Saving...' : 'Save notification settings'}
        </Button>
      </div>
    </div>
  );
}

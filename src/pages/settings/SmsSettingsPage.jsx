import { useEffect, useState } from 'react';
import { MessageSquare, ShieldCheck, Send } from 'lucide-react';
import { getSmsSettings, saveSmsSettings, testSmsCredentials, sendTestSms } from '../../api/userApi';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import FieldMark from '../../components/ui/FieldMark';

/**
 * A company's own SMS account.
 *
 * ── Why a company has its own, rather than sharing the platform's ──────────
 *
 * SMS units are bought per company and a sender name is registered per
 * company. Sharing one account would bill one company for another's messages
 * and put the wrong name on a stranger's phone, so each company saves its own
 * credentials here and they are used for everything it sends.
 *
 * ── The key is write-only ──────────────────────────────────────────────────
 *
 * The server returns whether a key is saved and its last four characters,
 * never the value — a live credential in a browser tab ends up in a
 * screenshot and a support ticket. So the field is left blank on load, and
 * blank on save means "leave it alone" rather than "erase it".
 */

const SOURCE_COPY = {
  company: 'Your company’s own eBulkSMS account.',
  platform: 'The platform’s shared account — messages are billed to it, under its sender name.',
  environment: 'Credentials from the server configuration.',
  none: 'No credentials anywhere yet.',
};

export default function SmsSettingsPage() {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({ username: '', sender: '', api_key: '', enabled: false, dnd: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [testNumber, setTestNumber] = useState('');
  const [message, setMessage] = useState(null);

  const say = (type, text) => setMessage({ type, text });

  const load = () => {
    setLoading(true);
    getSmsSettings()
      .then((res) => {
        const data = res?.data ?? {};
        setSettings(data);
        // api_key stays blank on purpose — see the note above.
        setForm({
          username: data.username || '',
          sender: data.sender || '',
          api_key: '',
          enabled: Boolean(data.enabled),
          dnd: Boolean(data.dnd),
        });
      })
      .catch((error) => say('error', error?.response?.data?.message || error?.userMessage || 'Could not load the SMS settings.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        username: form.username.trim(),
        sender: form.sender.trim(),
        enabled: form.enabled,
        dnd: form.dnd,
      };
      // Only when a new one was actually typed.
      if (form.api_key.trim()) payload.api_key = form.api_key.trim();

      const res = await saveSmsSettings(payload);
      setSettings(res?.data ?? null);
      setForm((f) => ({ ...f, api_key: '' }));
      say('success', 'SMS settings saved.');
    } catch (error) {
      say('error', error?.response?.data?.message || error?.userMessage || 'Could not save the SMS settings.');
    } finally {
      setSaving(false);
    }
  };

  /*
   * Checked against the provider's balance endpoint, which costs nothing.
   * Sending a message to test a key charges for the test and rings a phone.
   */
  const check = async () => {
    setChecking(true);
    setMessage(null);
    try {
      const payload = {};
      if (form.username.trim()) payload.username = form.username.trim();
      if (form.api_key.trim()) payload.api_key = form.api_key.trim();
      const res = await testSmsCredentials(payload);
      say('success', res?.message || 'Credentials accepted.');
    } catch (error) {
      say('error', error?.response?.data?.message || 'eBulkSMS rejected those credentials.');
    } finally {
      setChecking(false);
    }
  };

  const sendTest = async () => {
    if (!testNumber.trim()) return;
    setSending(true);
    setMessage(null);
    try {
      const res = await sendTestSms({ to: testNumber.trim() });
      say('success', res?.message || 'Test message sent.');
    } catch (error) {
      say('error', error?.response?.data?.message || 'Could not send the test message.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="rounded-xl bg-white p-6 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">Loading…</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
          <MessageSquare size={18} /> SMS
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Your company’s eBulkSMS account. Text messages are sent on it and billed to it.
        </p>
      </div>

      {message && (
        <div className={`rounded-lg px-4 py-3 text-sm ${message.type === 'error' ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200' : 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'}`}>
          {message.text}
        </div>
      )}

      {/*
        Whether a message sent right now would actually go out, said before
        anybody wonders why nobody received one.
      */}
      <div className={`rounded-xl px-4 py-3 text-sm ring-1 ${settings?.ready ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-amber-50 text-amber-900 ring-amber-200'}`}>
        <p className="font-medium">{settings?.ready ? 'SMS is ready to send.' : (settings?.reason || 'SMS is not ready.')}</p>
        <p className="mt-0.5 text-xs">{SOURCE_COPY[settings?.source] || SOURCE_COPY.none}</p>
      </div>

      <form onSubmit={save} className="space-y-5 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="eBulkSMS username"
            required
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            placeholder="the email you sign in to eBulkSMS with"
          />
          <div>
            <Input
              label="Sender name"
              required
              value={form.sender}
              onChange={(e) => setForm((f) => ({ ...f, sender: e.target.value }))}
              placeholder="e.g. ACME"
            />
            <p className="mt-1 text-xs text-slate-500">
              Up to 11 letters, or 14 digits if numeric. It must be registered with eBulkSMS
              before the networks will deliver it.
            </p>
          </div>
        </div>

        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">
            API key<FieldMark required={!settings?.api_key_set} />
          </span>
          <Input
            type="password"
            autoComplete="new-password"
            value={form.api_key}
            onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))}
            placeholder={settings?.api_key_set ? `saved — ${settings.api_key_hint}` : 'paste the key from your eBulkSMS dashboard'}
          />
          <p className="mt-1 text-xs text-slate-500">
            {settings?.api_key_set
              ? 'A key is saved. Leave this blank to keep it; type a new one to replace it.'
              : 'Generated in your eBulkSMS dashboard.'}
          </p>
        </div>

        <div className="space-y-3 border-t border-slate-100 pt-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
              className="mt-0.5"
            />
            <span className="text-sm">
              <span className="font-medium text-slate-800">Send text messages</span>
              <span className="block text-xs text-slate-500">
                Off by default. Nothing is sent until this is on, whatever is saved above —
                a text costs money and reaches somebody’s pocket.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={form.dnd}
              onChange={(e) => setForm((f) => ({ ...f, dnd: e.target.checked }))}
              className="mt-0.5"
            />
            <span className="text-sm">
              <span className="font-medium text-slate-800">Deliver to Do-Not-Disturb numbers</span>
              <span className="block text-xs text-slate-500">
                Reaches numbers on the DND register. Usually costs more per message.
              </span>
            </span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          <Button type="button" variant="secondary" onClick={check} disabled={checking}>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck size={14} /> {checking ? 'Checking…' : 'Check credentials'}
            </span>
          </Button>
          <span className="text-xs text-slate-400">Checking asks eBulkSMS for your balance. It costs nothing.</span>
        </div>
      </form>

      {/*
        Separate from the check, and said plainly: this one spends a unit. Worth
        having anyway — a valid key and a saved sender still will not deliver
        until the networks have approved the sender ID, and only a real message
        finds that out.
      */}
      <section className="space-y-3 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Send a test message</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Sends one real text and spends one unit. This is what proves your sender name
            has been approved by the networks.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Input
            label="To"
            value={testNumber}
            onChange={(e) => setTestNumber(e.target.value)}
            placeholder="08031234567"
          />
          <Button type="button" variant="secondary" onClick={sendTest} disabled={sending || !testNumber.trim() || !settings?.ready}>
            <span className="inline-flex items-center gap-1.5">
              <Send size={14} /> {sending ? 'Sending…' : 'Send test'}
            </span>
          </Button>
        </div>
        {!settings?.ready && (
          <p className="text-xs text-amber-700">Save working credentials and switch sending on first.</p>
        )}
      </section>
    </div>
  );
}

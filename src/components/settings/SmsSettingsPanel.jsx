import { useEffect, useState } from 'react';
import { MessageSquare, ShieldCheck, Send, ExternalLink } from 'lucide-react';
import { getSmsSettings, saveSmsSettings, testSmsCredentials, sendTestSms } from '../../api/userApi';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import FieldMark from '../../components/ui/FieldMark';

/**
 * A company's SMS providers, and which one is live.
 *
 * Rendered as the SMS tab in Settings, beside Email — which is where somebody
 * looking for it goes first. It was a screen of its own and nobody found it.
 *
 * ── Why the form is generated rather than written ──────────────────────────
 *
 * The four providers do not want the same things: Termii assigns each account
 * its own base URL, Sendchamp has a route, and only eBulkSMS has a username.
 * The server sends each provider's field list with the settings, and this
 * renders whatever it is given — so adding a fifth provider is a file on the
 * server and no change here at all.
 *
 * ── Several configured, one active ─────────────────────────────────────────
 *
 * Credentials are kept per provider, so a company can fill in two and switch
 * between them. Switching is one setting; nothing else is touched. That is
 * what makes moving provider during an outage possible rather than a re-keying
 * exercise.
 *
 * ── Secrets are write-only ─────────────────────────────────────────────────
 *
 * The server returns whether a key is saved and its last four characters,
 * never the value — a live credential in a browser tab ends up in a
 * screenshot and a support ticket. Blank on save means "leave it alone".
 */

const SOURCE_COPY = {
  company: 'Your company’s own account.',
  platform: 'The platform’s shared account — messages are billed to it, under its sender name.',
  environment: 'Credentials from the server configuration.',
  none: 'No credentials anywhere yet.',
};

export default function SmsSettingsPanel() {
  const [settings, setSettings] = useState(null);
  const [active, setActive] = useState('');
  const [values, setValues] = useState({});     // { provider: { field: value } }
  const [enabled, setEnabled] = useState(false);
  const [dnd, setDnd] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [testNumber, setTestNumber] = useState('');
  const [message, setMessage] = useState(null);

  const say = (type, text) => setMessage({ type, text });

  const apply = (data) => {
    setSettings(data);
    setActive(data.provider);
    setEnabled(Boolean(data.enabled));
    setDnd(Boolean(data.dnd));
    // Secrets are never returned, so their inputs start blank — see above.
    const next = {};
    (data.providers || []).forEach((provider) => {
      next[provider.key] = {};
      provider.fields.forEach((field) => {
        next[provider.key][field.key] = field.secret ? '' : (provider.values[field.key] || '');
      });
    });
    setValues(next);
  };

  const load = () => {
    setLoading(true);
    getSmsSettings()
      .then((res) => apply(res?.data ?? {}))
      .catch((error) => say('error', error?.response?.data?.message || error?.userMessage || 'Could not load the SMS settings.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const chosen = (settings?.providers || []).find((p) => p.key === active);
  const setField = (field, value) => setValues((current) => ({
    ...current,
    [active]: { ...(current[active] || {}), [field]: value },
  }));

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      /*
       * Only the provider on screen is sent. Posting every provider's fields
       * would rewrite credentials the administrator has not looked at.
       */
      const fields = {};
      (chosen?.fields || []).forEach((field) => {
        const value = values[active]?.[field.key] ?? '';
        // A blank secret means "keep what is saved", so it is omitted entirely.
        if (field.secret && !String(value).trim()) return;
        fields[field.key] = value;
      });

      const res = await saveSmsSettings({
        provider: active,
        enabled,
        dnd,
        credentials: { [active]: fields },
      });
      apply(res?.data ?? {});
      say('success', 'SMS settings saved.');
    } catch (error) {
      say('error', error?.response?.data?.message || error?.userMessage || 'Could not save the SMS settings.');
    } finally {
      setSaving(false);
    }
  };

  /*
   * Checked the cheapest way the chosen provider offers — a balance read where
   * there is one. Sending a message to test a key charges for the test and
   * rings a phone.
   */
  const check = async () => {
    setChecking(true);
    setMessage(null);
    try {
      const payload = { provider: active };
      ['username', 'api_key', 'base_url'].forEach((field) => {
        const value = values[active]?.[field];
        if (value && String(value).trim()) payload[field] = String(value).trim();
      });
      const res = await testSmsCredentials(payload);
      say('success', res?.message || 'Credentials accepted.');
    } catch (error) {
      say('error', error?.response?.data?.message || 'Those credentials were rejected.');
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
          <MessageSquare size={18} /> SMS Settings
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Choose a provider and give it your credentials. Text messages are sent on that
          account and billed to it.
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
        <p className="font-medium">
          {settings?.ready
            ? `SMS is ready to send through ${chosen?.label || settings.provider}.`
            : (settings?.reason || 'SMS is not ready.')}
        </p>
        <p className="mt-0.5 text-xs">{SOURCE_COPY[settings?.source] || SOURCE_COPY.none}</p>
      </div>

      <form onSubmit={save} className="space-y-5 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Provider<FieldMark required /></span>
          <Select
            value={active}
            onChange={(e) => setActive(e.target.value)}
            className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            {(settings?.providers || []).map((provider) => (
              <option key={provider.key} value={provider.key}>
                {provider.label}
                {provider.configured ? ' — configured' : ''}
              </option>
            ))}
          </Select>
          <span className="block text-xs text-slate-500">
            Each provider keeps its own credentials, so you can set up more than one and
            switch between them.
          </span>
        </label>

        {chosen && (
          <div className="space-y-4 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">{chosen.label} credentials</h2>
              {chosen.docs && (
                <a href={chosen.docs} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs hover:underline" style={{ color: 'var(--primary)' }}>
                  <ExternalLink size={12} /> API documentation
                </a>
              )}
            </div>

            {/* Whatever this provider declared — see the note at the top. */}
            <div className="grid gap-4 sm:grid-cols-2">
              {chosen.fields.map((field) => {
                const saved = chosen.secrets_set?.[field.key];
                const hint = chosen.values?.[`${field.key}_hint`];
                if (field.options) {
                  return (
                    <label key={field.key} className="block space-y-1">
                      <span className="text-sm font-medium text-slate-700">
                        {field.label}<FieldMark required={field.required} />
                      </span>
                      <Select
                        value={values[active]?.[field.key] || ''}
                        onChange={(e) => setField(field.key, e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      >
                        <option value="">{field.placeholder || 'Default'}</option>
                        {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                      </Select>
                      {field.hint && <span className="block text-xs text-slate-500">{field.hint}</span>}
                    </label>
                  );
                }
                return (
                  <div key={field.key}>
                    <span className="mb-1 block text-sm font-medium text-slate-700">
                      {field.label}<FieldMark required={field.required && !(field.secret && saved)} />
                    </span>
                    <Input
                      type={field.secret ? 'password' : 'text'}
                      autoComplete={field.secret ? 'new-password' : 'off'}
                      value={values[active]?.[field.key] || ''}
                      onChange={(e) => setField(field.key, e.target.value)}
                      placeholder={field.secret && saved ? `saved — ${hint}` : (field.placeholder || '')}
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      {field.secret && saved
                        ? 'A value is saved. Leave blank to keep it; type a new one to replace it.'
                        : field.hint}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-3 border-t border-slate-100 pt-4">
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="mt-0.5" />
            <span className="text-sm">
              <span className="font-medium text-slate-800">Send text messages</span>
              <span className="block text-xs text-slate-500">
                Off by default. Nothing is sent until this is on, whatever is saved above —
                a text costs money and reaches somebody’s pocket.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3">
            <input type="checkbox" checked={dnd} onChange={(e) => setDnd(e.target.checked)} className="mt-0.5" />
            <span className="text-sm">
              <span className="font-medium text-slate-800">Use the transactional route</span>
              <span className="block text-xs text-slate-500">
                On by default, and worth leaving on: this is the route that reaches numbers on
                the Do-Not-Disturb register, which is most of them. Turning it off is cheaper
                per message with some providers, and your alerts will not arrive.
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
          <span className="text-xs text-slate-400">Checking costs nothing.</span>
        </div>
      </form>

      {/*
        Separate from the check, and said plainly: this one spends a unit.
        Worth having anyway — a valid key and a saved sender still will not
        deliver until the networks have approved the sender ID, and only a real
        message finds that out.
      */}
      <section className="space-y-3 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Send a test message</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Sends one real text through {chosen?.label || 'the active provider'} and spends one
            unit. This is what proves your sender name has been approved by the networks.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Input label="To" value={testNumber} onChange={(e) => setTestNumber(e.target.value)} placeholder="08031234567" />
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

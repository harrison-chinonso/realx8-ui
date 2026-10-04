import { useEffect, useRef, useState } from 'react';
import { Copy, Smartphone, Upload } from 'lucide-react';
import { bulkUpdateSettings, getSettings } from '../../api/userApi';
import { uploadMediaFiles } from '../../api/mediaApi';
import useAuthStore from '../../store/authStore';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';

/**
 * Settings → Mobile app: how the Realx8 mobile app looks and behaves for a
 * company — the `mobile` settings group, which Realx8-Core serves to the app
 * at GET /public/app-config/<code> (shared/src/appConfig.js).
 *
 * ── Own values, platform values ─────────────────────────────────────────────
 *
 * The form shows the company's OWN rows; a blank field inherits the platform
 * default, which is shown as the placeholder so "what applies" is never a
 * guess. A platform admin with no company chosen edits those defaults. The
 * minimum app version is a floor either way: a company can raise it, never
 * lower it below the platform's — the server takes the higher.
 *
 * ── Checked here as the server checks it ────────────────────────────────────
 *
 * The server silently drops a malformed value rather than ship it to phones,
 * so a typo would otherwise save "successfully" and do nothing. The same rules
 * run here first and say what is wrong.
 */

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const VERSION = /^\d{1,4}(?:\.\d{1,4}){0,2}$/;
const WEB_ORIGIN = typeof window !== 'undefined' ? window.location.origin : '';

const FIELDS = ['splash_bg', 'splash_logo', 'min_app_version', 'latest_app_version', 'update_message',
  'feature_google_login'];

const FLAG_OPTIONS = [
  { value: '', label: 'Inherit' },
  { value: 'true', label: 'On' },
  { value: 'false', label: 'Off' },
];

const problemsIn = (values) => {
  const problems = {};
  if (values.splash_bg && !HEX.test(values.splash_bg)) problems.splash_bg = 'Use a hex colour such as #16251F.';
  if (values.splash_logo && !/^(https:\/\/|\/uploads\/)/.test(values.splash_logo)) {
    problems.splash_logo = 'Use an https:// address, or upload an image.';
  }
  ['min_app_version', 'latest_app_version'].forEach((key) => {
    if (values[key] && !VERSION.test(values[key])) problems[key] = 'Use a version such as 1.2.0.';
  });
  if ((values.update_message || '').length > 300) problems.update_message = 'Keep it under 300 characters.';
  return problems;
};

function Field({ label, hint, error, children }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      {children}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export default function MobileAppPanel({ companyId = null, companyName = null }) {
  const isSuperiorAdmin = useAuthStore((s) => s.isSuperiorAdmin);
  const ownCompanyCode = useAuthStore((s) => s.company?.code || null);
  const editingPlatform = isSuperiorAdmin && !companyId;

  const [values, setValues] = useState({});
  const [inherited, setInherited] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);
  const [copied, setCopied] = useState(false);
  const fileInput = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMessage(null);
    Promise.all([
      // The rows this company (or the platform) has set itself.
      getSettings('mobile', { companyId }),
      // What a blank field falls back to: the platform's values. Not needed when editing them.
      editingPlatform ? Promise.resolve({ data: {} }) : getSettings('mobile', { effective: true, companyId }),
    ]).then(([own, effective]) => {
      if (cancelled) return;
      const mine = own?.data || {};
      setValues(Object.fromEntries(FIELDS.map((key) => [key, mine[key] || ''])));
      // Effective minus own = inherited from the platform.
      const fallback = {};
      FIELDS.forEach((key) => { if (!mine[key] && effective?.data?.[key]) fallback[key] = effective.data[key]; });
      setInherited(fallback);
    }).catch(() => {
      if (!cancelled) setMessage({ type: 'error', text: 'Could not load the mobile app settings.' });
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [companyId, editingPlatform]);

  const set = (key, value) => setValues((prev) => ({ ...prev, [key]: value }));
  const problems = problemsIn(values);
  const placeholder = (key, fallback) => (inherited[key] ? `${inherited[key]} — platform default` : fallback);

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    setMessage(null);
    try {
      const result = await uploadMediaFiles([file]);
      const url = result?.files?.[0]?.url;
      if (!url) throw new Error('The upload returned no address.');
      set('splash_logo', url);
    } catch (error) {
      setMessage({ type: 'error', text: error?.userMessage || error?.message || 'The image could not be uploaded.' });
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const save = async () => {
    if (Object.keys(problems).length) {
      setMessage({ type: 'error', text: 'Fix the highlighted fields first.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await bulkUpdateSettings(FIELDS.map((key) => ({ key, value: String(values[key] || '').trim() })), 'mobile', companyId);
      setMessage({ type: 'success', text: 'Saved. Phones pick it up the next time the app opens.' });
    } catch (error) {
      setMessage({ type: 'error', text: error?.userMessage || 'Could not save the mobile app settings.' });
    } finally {
      setSaving(false);
    }
  };

  // A company admin's own link; a platform admin acting for a company has no code to hand here.
  const companyLink = !isSuperiorAdmin && ownCompanyCode ? `${WEB_ORIGIN}/c/${ownCompanyCode}` : null;
  const copyLink = () => {
    navigator.clipboard?.writeText(companyLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Smartphone size={20} aria-hidden="true" />
        <h1 className="text-xl font-semibold">Mobile app</h1>
      </div>
      <p className="text-sm text-slate-600">
        {editingPlatform
          ? 'Defaults for every company in the Realx8 mobile app. A company’s own values replace these field by field.'
          : `How the Realx8 mobile app looks and behaves for ${companyName || 'your company'}. Blank fields use the platform default shown in grey.`}
        {' '}The app’s colours, logo and name otherwise follow Appearance.
      </p>

      {companyLink && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm ring-1 ring-slate-200">
          <span className="text-slate-600">Your company link — opens the app when installed, your sign-in page when not:</span>
          <code className="rounded bg-white px-2 py-1 ring-1 ring-slate-200">{companyLink}</code>
          <button type="button" onClick={copyLink} className="inline-flex items-center gap-1 text-blue-600 hover:underline">
            <Copy size={14} aria-hidden="true" /> {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}

      {message && (
        <div className={`rounded-lg p-3 text-sm ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message.text}
        </div>
      )}

      <div className="space-y-5 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-base font-semibold text-slate-900">Opening screen</h2>

        <Field label="Splash background colour" hint="Behind the logo while the app starts." error={problems.splash_bg}>
          <div className="flex items-center gap-3">
            <input
              type="color"
              aria-label="Pick the splash background colour"
              value={HEX.test(values.splash_bg) && values.splash_bg.length === 7 ? values.splash_bg : (inherited.splash_bg?.length === 7 ? inherited.splash_bg : '#16251F')}
              onChange={(e) => set('splash_bg', e.target.value.toUpperCase())}
              className="h-10 w-12 cursor-pointer rounded border border-slate-300"
            />
            <Input value={values.splash_bg} onChange={(e) => set('splash_bg', e.target.value.trim())} placeholder={placeholder('splash_bg', '#16251F')} />
          </div>
        </Field>

        <Field
          label="Splash logo"
          hint="A square PNG or SVG works best. Blank uses the company logo from Appearance."
          error={problems.splash_logo}
        >
          <div className="flex flex-wrap items-center gap-3">
            {(values.splash_logo || inherited.splash_logo) && (
              <span
                className="flex h-14 w-14 items-center justify-center rounded-lg ring-1 ring-slate-200"
                style={{ background: values.splash_bg || inherited.splash_bg || '#16251F' }}
              >
                <img src={values.splash_logo || inherited.splash_logo} alt="" className="max-h-10 max-w-10" />
              </span>
            )}
            <div className="min-w-[16rem] flex-1">
              <Input value={values.splash_logo} onChange={(e) => set('splash_logo', e.target.value.trim())} placeholder={placeholder('splash_logo', 'https://…')} />
            </div>
            <input ref={fileInput} type="file" accept="image/png,image/svg+xml,image/webp,image/jpeg" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
            <Button type="button" variant="secondary" onClick={() => fileInput.current?.click()} disabled={uploading}>
              <Upload size={16} aria-hidden="true" /> {uploading ? 'Uploading…' : 'Upload'}
            </Button>
          </div>
        </Field>

        <h2 className="pt-2 text-base font-semibold text-slate-900">Updates</h2>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Minimum app version"
            hint={editingPlatform
              ? 'Older apps must update before they can be used.'
              : 'Older apps must update first. Cannot go below the platform’s minimum.'}
            error={problems.min_app_version}
          >
            <Input value={values.min_app_version} onChange={(e) => set('min_app_version', e.target.value.trim())} placeholder={placeholder('min_app_version', 'e.g. 1.0.0')} />
          </Field>
          <Field label="Latest app version" hint="The newest release, for reference." error={problems.latest_app_version}>
            <Input value={values.latest_app_version} onChange={(e) => set('latest_app_version', e.target.value.trim())} placeholder={placeholder('latest_app_version', 'e.g. 1.2.0')} />
          </Field>
        </div>

        <Field label="Message on the update screen" error={problems.update_message}>
          <Input value={values.update_message} onChange={(e) => set('update_message', e.target.value)} placeholder={placeholder('update_message', 'A new version is available. Please update to continue.')} />
        </Field>

        <h2 className="pt-2 text-base font-semibold text-slate-900">Features</h2>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Sign in with Google in the app"
            hint={`${inherited.feature_google_login ? `Inherits: ${inherited.feature_google_login === 'true' ? 'On' : 'Off'}.` : 'Inherit means on.'} The website is not affected.`}
          >
            <Select value={values.feature_google_login} onChange={(e) => set('feature_google_login', e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {FLAG_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
        </div>

        <Button onClick={save} disabled={saving || uploading}>{saving ? 'Saving…' : 'Save mobile settings'}</Button>
      </div>
    </div>
  );
}

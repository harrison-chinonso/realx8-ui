import { useEffect, useMemo, useState } from 'react';
import {
  disconnectSocialAccount,
  listSocialAccounts,
  saveSocialAccount,
  testSocialAccount,
} from '../../api/mediaApi';
import Button from '../../components/ui/Button';
import Modal from '../../components/common/Modal';
import FieldMark from '../../components/ui/FieldMark';

const INPUT_CLASS = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';
const PLATFORM_CONFIG = {
  facebook: {
    label: 'Facebook',
    icon: (
      <svg viewBox="0 0 24 24" className="w-7 h-7" fill="#1877F2">
        <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.413c0-3.027 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.514c-1.491 0-1.956.93-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
      </svg>
    ),
    fields: [
      { key: 'display_name', label: 'Display Name' },
      { key: 'page_id', label: 'Page ID' },
      { key: 'page_access_token', label: 'Page Access Token', type: 'password', secret: true },
    ],
  },
  instagram: {
    label: 'Instagram',
    icon: (
      <svg viewBox="0 0 24 24" className="w-7 h-7">
        <defs>
          <radialGradient id="ig-grad" cx="30%" cy="107%" r="150%">
            <stop offset="0%" stopColor="#fdf497"/>
            <stop offset="5%" stopColor="#fdf497"/>
            <stop offset="45%" stopColor="#fd5949"/>
            <stop offset="60%" stopColor="#d6249f"/>
            <stop offset="90%" stopColor="#285AEB"/>
          </radialGradient>
        </defs>
        <path fill="url(#ig-grad)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162S8.597 18.163 12 18.163s6.162-2.759 6.162-6.162S15.403 5.838 12 5.838zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    ),
    fields: [
      { key: 'display_name', label: 'Display Name' },
      { key: 'instagram_account_id', label: 'Instagram Business Account ID' },
      { key: 'page_access_token', label: 'Page Access Token', type: 'password', secret: true },
    ],
  },
  twitter: {
    label: 'Twitter / X',
    icon: (
      <svg viewBox="0 0 24 24" className="w-7 h-7" fill="#000000">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.259 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/>
      </svg>
    ),
    fields: [
      { key: 'display_name', label: 'Display Name' },
      { key: 'twitter_api_key', label: 'API Key', type: 'password', secret: true },
      { key: 'twitter_api_secret', label: 'API Secret', type: 'password', secret: true },
      { key: 'twitter_access_token', label: 'Access Token', type: 'password', secret: true },
      { key: 'twitter_access_secret', label: 'Access Token Secret', type: 'password', secret: true },
    ],
  },
  linkedin: {
    label: 'LinkedIn',
    icon: (
      <svg viewBox="0 0 24 24" className="w-7 h-7" fill="#0A66C2">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
    fields: [
      { key: 'display_name', label: 'Display Name' },
      { key: 'linkedin_org_id', label: 'Organization ID' },
      { key: 'linkedin_access_token', label: 'Access Token', type: 'password', secret: true },
    ],
  },
  tiktok: {
    label: 'TikTok',
    icon: (
      <svg viewBox="0 0 24 24" className="w-7 h-7" fill="#000000">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.75a4.85 4.85 0 01-1.01-.06z"/>
      </svg>
    ),
    note: 'TikTok reviews every app before it allows publishing.',
    fields: [
      { key: 'display_name', label: 'Display Name' },
      { key: 'tiktok_open_id', label: 'Open ID' },
      { key: 'tiktok_access_token', label: 'Access Token', type: 'password', secret: true },
    ],
  },
  youtube: {
    label: 'YouTube',
    icon: (
      <svg viewBox="0 0 24 24" className="w-7 h-7" fill="#FF0000">
        <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    ),
    fields: [
      { key: 'display_name', label: 'Display Name' },
      { key: 'youtube_channel_id', label: 'Channel ID' },
      { key: 'youtube_access_token', label: 'Access Token', type: 'password', secret: true },
      { key: 'youtube_refresh_token', label: 'Refresh Token', type: 'password', secret: true },
    ],
  },
};

const getErrorMessage = (error, fallback) => error?.response?.data?.message || error?.message || fallback;
const normalizeItems = (response) => response?.data ?? response ?? [];

const buildInitialForm = (platform, account = {}) => {
  const config = PLATFORM_CONFIG[platform];
  return config.fields.reduce((acc, field) => {
    acc[field.key] = field.secret ? '' : account[field.key] || '';
    return acc;
  }, {});
};

export default function SocialAccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activePlatform, setActivePlatform] = useState('');
  const [form, setForm] = useState({});

  const accountMap = useMemo(
    () => accounts.reduce((acc, account) => ({ ...acc, [account.platform]: account }), {}),
    [accounts]
  );

  const loadAccounts = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await listSocialAccounts();
      setAccounts(normalizeItems(response));
    } catch (loadError) {
      console.error(loadError);
      setError(loadError.userMessage);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const openEdit = (platform) => {
    setActivePlatform(platform);
    setForm(buildInitialForm(platform, accountMap[platform]));
    setNotice('');
    setError('');
  };

  const closeModal = (force = false) => {
    if (saving && !force) return;
    setActivePlatform('');
    setForm({});
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!activePlatform) return;

    setSaving(true);
    setError('');

    try {
      await saveSocialAccount(activePlatform, form);
      setNotice(`${PLATFORM_CONFIG[activePlatform].label} account saved.`);
      closeModal(true);
      await loadAccounts();
    } catch (saveError) {
      console.error(saveError);
      setError(saveError.userMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async (platform) => {
    if (!window.confirm(`Disconnect ${PLATFORM_CONFIG[platform].label}?`)) return;

    try {
      await disconnectSocialAccount(platform);
      setNotice(`${PLATFORM_CONFIG[platform].label} disconnected.`);
      await loadAccounts();
    } catch (disconnectError) {
      console.error(disconnectError);
      setError(disconnectError.userMessage);
    }
  };

  const handleTest = async (platform) => {
    setTesting(platform);
    setError('');

    try {
      const response = await testSocialAccount(platform);
      if (response?.success === false) {
        setError(`${PLATFORM_CONFIG[platform].label}: ${response.message}`);
      } else {
        setNotice(`${PLATFORM_CONFIG[platform].label}: ${response.name || response.message || 'Connection successful'}`);
      }
    } catch (testError) {
      console.error(testError);
      setError(testError.userMessage);
    } finally {
      setTesting('');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Social Accounts</h1>
        <p className="text-sm text-slate-500">Connect publishing credentials for your social platforms.</p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
        ⚠ Media URLs must be publicly accessible for social platforms to fetch them.
      </div>

      {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div>}
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      {loading ? (
        <p className="text-sm text-slate-500">Loading social accounts...</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {Object.entries(PLATFORM_CONFIG).map(([platform, config]) => {
            const account = accountMap[platform] || { platform, is_connected: false };
            return (
              <div key={platform} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0">{config.icon}</div>
                      <div>
                        <h2 className="font-semibold text-slate-900">{config.label}</h2>
                        <p className={`text-sm ${account.is_connected ? 'text-emerald-600' : 'text-slate-500'}`}>
                          {account.is_connected ? '● Connected' : '○ Not set'}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">Display Name: {account.display_name ? `"${account.display_name}"` : '—'}</p>
                    {account.page_id && <p className="mt-1 text-xs text-slate-500">Page ID: {account.page_id}</p>}
                    {account.instagram_account_id && <p className="mt-1 text-xs text-slate-500">Instagram ID: {account.instagram_account_id}</p>}
                    {account.linkedin_org_id && <p className="mt-1 text-xs text-slate-500">Organization ID: {account.linkedin_org_id}</p>}
                    {account.tiktok_open_id && <p className="mt-1 text-xs text-slate-500">Open ID: {account.tiktok_open_id}</p>}
                    {account.youtube_channel_id && <p className="mt-1 text-xs text-slate-500">Channel ID: {account.youtube_channel_id}</p>}
                    {account.last_publish_error && <p className="mt-2 text-xs text-rose-600">Last publish error: {account.last_publish_error}</p>}
                    {config.note && <p className="mt-2 text-xs text-amber-600">{config.note}</p>}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="button" onClick={() => openEdit(platform)}>Edit Credentials</Button>
                  <Button type="button" variant="secondary" onClick={() => handleTest(platform)} disabled={!account.is_connected || testing === platform}>
                    {testing === platform ? 'Testing…' : 'Test Connection'}
                  </Button>
                  <Button type="button" variant="danger" onClick={() => handleDisconnect(platform)} disabled={!account.is_connected}>
                    Disconnect
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={Boolean(activePlatform)} onClose={closeModal} title={activePlatform ? `Edit ${PLATFORM_CONFIG[activePlatform].label}` : 'Edit Account'}>
        {activePlatform && (
          <form onSubmit={handleSave} className="space-y-4">
            {PLATFORM_CONFIG[activePlatform].fields.map((field) => (
              <div key={field.key}>
                <label className="mb-1 block text-sm font-medium text-slate-700">{field.label}<FieldMark /></label>
                <input
                  type={field.type || 'text'}
                  value={form[field.key] || ''}
                  onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}
                  className={INPUT_CLASS}
                  placeholder={field.secret ? 'Enter new value to update' : ''}
                />
              </div>
            ))}

            {PLATFORM_CONFIG[activePlatform].note && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                {PLATFORM_CONFIG[activePlatform].note}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Credentials'}</Button>
              <Button type="button" variant="secondary" onClick={closeModal} disabled={saving}>Cancel</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

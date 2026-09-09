import { useState } from 'react';
import { createPropertyPublicLink, revokePropertyPublicLink } from '../../api/propertyApi';
import useShareToken from '../../hooks/useShareToken';
import Button from '../ui/Button';

const INPUT_CLASS = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

/**
 * Build the public URL for a property.
 *
 * `shareToken` is the sealed token: it carries the company, the sharing
 * realtor and the company's branding, so the property page opens already
 * themed and the attribution cannot be edited out of the URL.
 *
 * The plain `c` / `r` codes remain as a fallback for when a token could not be
 * minted, and because links shared before this change carry them.
 */
export const publicUrlFor = (token, companyCode, realtorCode, shareToken) => {
  const params = new URLSearchParams();
  if (shareToken) {
    params.set('ref', shareToken);
  } else {
    if (companyCode) params.set('c', companyCode);
    // Present only on a realtor's own share, so the client is mapped to them.
    if (realtorCode) params.set('r', realtorCode);
  }
  const query = params.toString();
  return `${window.location.origin}/p/${token}${query ? `?${query}` : ''}`;
};

/**
 * Generate / copy / revoke the shareable public link for a property.
 * `property` must carry public_token, public_enabled and public_expires_at.
 */
export default function PublicLinkPanel({ property, onChange }) {
  const { token: shareToken } = useShareToken();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const active = Boolean(property?.public_enabled && property?.public_token);
  const url = active ? publicUrlFor(property.public_token, property.company_code, null, shareToken) : '';

  const run = async (action) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err?.userMessage || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleGenerate = () => run(async () => {
    const response = await createPropertyPublicLink(property.id, {});
    const data = response?.data ?? response;
    onChange({
      public_token: data.public_token,
      public_enabled: true,
      public_expires_at: null,
      company_code: data.company_code ?? property.company_code ?? null,
    });
  });

  const handleRevoke = () => run(async () => {
    if (!window.confirm('Revoke this link? Anyone holding the current URL will lose access immediately.')) return;
    await revokePropertyPublicLink(property.id);
    onChange({ public_token: null, public_enabled: false, public_expires_at: null });
  });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy automatically — select the link and copy it manually.');
    }
  };

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">Public Share Link</h2>
        {active && (
          <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">Active</span>
        )}
      </div>
      <p className="mb-4 text-sm text-slate-600">
        A property has a single link that does not expire. Anyone with it can view the property
        without signing in — documents are never included — and accounts created from it are tied
        to this company. Revoking removes the link entirely.
      </p>

      {error && <div className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      {active ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input readOnly value={url} className={`${INPUT_CLASS} flex-1 min-w-0 bg-slate-50 font-mono text-xs`} onFocus={(event) => event.target.select()} />
            <Button type="button" size="sm" onClick={handleCopy}>{copied ? 'Copied ✓' : 'Copy'}</Button>
            <a href={url} target="_blank" rel="noreferrer">
              <Button type="button" variant="secondary" size="sm">Preview</Button>
            </a>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="danger" size="sm" onClick={handleRevoke} disabled={busy}>Revoke Link</Button>
          </div>
        </div>
      ) : (
        <Button type="button" onClick={handleGenerate} disabled={busy}>
          {busy ? 'Generating...' : 'Generate Public Link'}
        </Button>
      )}
    </div>
  );
}

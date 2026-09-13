import { useEffect, useState } from 'react';
import { createPropertyPublicLink, revokePropertyPublicLink } from '../../api/propertyApi';
import useShareToken from '../../hooks/useShareToken';
import Button from '../ui/Button';

const INPUT_CLASS = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

/**
 * Build the public URL for a property.
 *
 * `shareCode` is the property's own seven-character share code — the same kind
 * of code a referral link carries, drawn from the same namespace. It resolves
 * on its own to the property, the company AND the realtor who shared it, so
 * when there is one the URL is nothing but the code:
 *
 *     https://app.example.com/p/K7M2QXV
 *
 * That is the whole point of it. The link it replaces was a forty-eight
 * character token plus a `?ref=` — long enough that people hesitated to paste
 * it into a chat, and long enough to look suspicious when they did.
 *
 * Everything below it is fallback, in descending order of how much it can
 * carry. `shareToken` (the sealed referral token, or the sharer's referral
 * code) still brands the page but cannot name the property's own link.
 * The plain `c` / `r` codes carry attribution and no branding, and are what
 * links shared before any of this was built still contain.
 */
export const publicUrlFor = (token, companyCode, realtorCode, shareToken, shareCode) => {
  if (shareCode) return `${window.location.origin}/p/${shareCode}`;

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
  /**
   * The short code where the server offers one, the sealed token otherwise.
   * Both resolve to the same thing; the code is what keeps the URL short enough
   * to paste into a chat without it looking alarming.
   */
  const { token: sealedToken, code: shortCode } = useShareToken();
  const shareToken = shortCode || sealedToken;
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const active = Boolean(property?.public_enabled && property?.public_token);

  /**
   * Resolve the short code for a link that already exists.
   *
   * A property loaded from the API carries its `public_token` but not its share
   * code — the code lives with the link, not on the property row — so a link
   * generated before this panel was opened would otherwise be shown in its long
   * form until somebody regenerated it, and the long form is the one people
   * would not paste.
   *
   * The endpoint is get-or-create and idempotent: for a link that is already
   * active it mints nothing new and returns the same token and the same code
   * every time. It is a POST because that is the endpoint that owns this
   * question, not because opening the panel changes anything.
   */
  useEffect(() => {
    if (!active || property?.share_code) return undefined;
    let cancelled = false;
    createPropertyPublicLink(property.id, {})
      .then((response) => {
        const data = response?.data ?? response;
        if (!cancelled && data?.code) onChange({ share_code: data.code });
      })
      // The long link still works; there is nothing to tell the user about.
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, property?.id, property?.share_code]);
  const url = active
    ? publicUrlFor(property.public_token, property.company_code, null, shareToken, property.share_code)
    : '';

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
      // The short code the link should be written with. Absent only when it
      // could not be minted, in which case publicUrlFor falls back.
      share_code: data.code ?? null,
    });
  });

  const handleRevoke = () => run(async () => {
    if (!window.confirm('Revoke this link? Anyone holding the current URL will lose access immediately.')) return;
    await revokePropertyPublicLink(property.id);
    onChange({ public_token: null, public_enabled: false, public_expires_at: null, share_code: null });
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

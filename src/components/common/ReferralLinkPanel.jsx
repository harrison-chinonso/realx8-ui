import { useState } from 'react';
import Button from '../ui/Button';
import useShareToken from '../../hooks/useShareToken';

/**
 * The realtor's personal sign-up link. Anyone registering through it is mapped
 * to this realtor as their downline.
 *
 * Both codes are required: registration needs the company code to place the
 * account, and the realtor code to attribute it.
 */
export default function ReferralLinkPanel({ realtorCode, companyCode }) {
  const [copied, setCopied] = useState(null);
  const { token, ready } = useShareToken();

  if (!realtorCode) {
    return (
      <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
        You do not have a referral code yet. Ask an administrator to generate one for your account.
      </div>
    );
  }

  // The sealed token carries the company, this realtor's code and the company's
  // branding, so the prospect lands on a page already themed for the company
  // and nobody can edit the attribution out of the URL. If it could not be
  // minted, fall back to the plain codes — an unbranded link still works.
  const params = new URLSearchParams();
  if (token) {
    params.set('ref', token);
  } else {
    if (companyCode) params.set('company_code', companyCode);
    params.set('realtor_code', realtorCode);
  }
  const link = `${window.location.origin}/register?${params.toString()}`;

  const copy = async (value, which) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied((c) => (c === which ? null : c)), 2000);
    } catch {
      setCopied(null);
    }
  };

  const share = encodeURIComponent(`Join me on the platform: ${link}`);

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">Your Referral Link</p>
          <p className="text-xs text-slate-500">
            Anyone who signs up through this link becomes part of your downline.
          </p>
        </div>
        <button
          type="button"
          onClick={() => copy(realtorCode, 'code')}
          title="Copy your referral code"
          className="rounded-lg border-2 border-dashed px-3 py-1.5 font-mono text-base font-bold tracking-[0.25em]"
          style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
        >
          {copied === 'code' ? 'Copied ✓' : realtorCode}
        </button>
      </div>

      {!companyCode && (
        <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Your company has no registration code, so this link cannot complete a sign-up yet.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          readOnly
          value={link}
          onFocus={(event) => event.target.select()}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs"
        />
        {/* Held until the sealed token is minted, so an impatient click cannot
            copy the unbranded fallback link. */}
        <Button type="button" size="sm" disabled={!ready} onClick={() => copy(link, 'link')}>
          {copied === 'link' ? 'Copied ✓' : ready ? 'Copy Link' : 'Preparing…'}
        </Button>
        <a href={`https://wa.me/?text=${share}`} target="_blank" rel="noreferrer">
          <Button type="button" variant="secondary" size="sm">WhatsApp</Button>
        </a>
        <a href={`mailto:?subject=${encodeURIComponent('Join me')}&body=${share}`}>
          <Button type="button" variant="secondary" size="sm">Email</Button>
        </a>
      </div>
    </div>
  );
}

import { useState } from 'react';
import Button from '../ui/Button';
import useShareToken from '../../hooks/useShareToken';
import useMyVerification from '../../hooks/useMyVerification';
import { useAppearance } from '../../context/useAppearance';
import VerificationRequiredNotice from './VerificationRequiredNotice';

/**
 * The realtor's personal sign-up link. Anyone registering through it is mapped
 * to this realtor as their downline.
 *
 * Both codes are required: registration needs the company code to place the
 * account, and the realtor code to attribute it.
 */
export default function ReferralLinkPanel({ realtorCode, companyCode, companyName }) {
  const [copied, setCopied] = useState(null);
  const { token, code, ready } = useShareToken();
  const { app_name: appName } = useAppearance();
  const verification = useMyVerification();

  /*
   * The link itself is withheld, not merely the button.
   *
   * A referral link works by carrying the realtor's code, and the server will
   * not attribute anybody who arrives on an unverified realtor's code. Showing
   * the link and disabling Copy would leave it on screen to be typed out by
   * hand — and every client who followed it would register attributed to
   * nobody, which the realtor would discover weeks later.
   */
  if (verification.blocked) {
    return (
      <VerificationRequiredNotice
        status={verification.status}
        activity="Your referral link is not active until your identity is verified."
      />
    );
  }

  if (!realtorCode) {
    return (
      <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
        You do not have a referral code yet. Ask an administrator to generate one for your account.
      </div>
    );
  }

  /**
   * The link carries ONLY the short code (or the sealed token) — the whole
   * point of either is that they resolve to the company code, the realtor
   * code and this realtor's name on the server, so none of that has to be
   * spelled out again in the URL. Printing the plain fields alongside it
   * would make the "short" code pointless: the link would be exactly as long
   * as if it had never been minted, defeating the one thing it exists to do.
   *
   * What used to go wrong on a refresh was not the shortness of the link —
   * it was that nothing from a successful resolution was ever kept anywhere,
   * so every single page load repeated the same network round trip from
   * scratch and had nothing to fall back on if that particular load's
   * request was slow or failed. That gap is closed on the sign-up page
   * itself (see src/utils/referralAttribution.js): the first successful
   * resolution is written to browser storage, and a later refresh that
   * cannot resolve the token in time reads it from there instead — the link
   * stays short, and attribution stops depending on that one request every time.
   */
  const params = new URLSearchParams();
  if (code) params.set('ref', code);
  else if (token) params.set('ref', token);
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

  /**
   * Named to the realtor's own company, and pitched at either side of who
   * might click it — a lead as much as a would-be realtor, since the same
   * link doubles as both once opened (see the Role field on the sign-up
   * form). Falls back to the platform's own name if this realtor's company
   * has none on file yet.
   */
  const brandName = companyName || appName || 'us';
  const share = encodeURIComponent(
    `Whether you're looking for your next property investment or ready to grow as a realtor, ${brandName} delivers dependable results. Sign up through my link to get started -> ${link}`,
  );

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
        {/* Held until the sealed token/short code is minted — with the plain
            fields no longer on the link, this is what makes it functional at
            all, so an impatient click cannot copy an empty `?` query string. */}
        <Button type="button" size="sm" disabled={!ready} onClick={() => copy(link, 'link')}>
          {copied === 'link' ? 'Copied ✓' : ready ? 'Copy Link' : 'Preparing…'}
        </Button>
        <a href={`https://wa.me/?text=${share}`} target="_blank" rel="noreferrer">
          <Button type="button" variant="secondary" size="sm">WhatsApp</Button>
        </a>
        <a href={`mailto:?subject=${encodeURIComponent(`Join ${brandName}`)}&body=${share}`}>
          <Button type="button" variant="secondary" size="sm">Email</Button>
        </a>
      </div>
    </div>
  );
}

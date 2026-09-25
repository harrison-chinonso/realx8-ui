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
export default function ReferralLinkPanel({ realtorCode, companyCode, realtorName, companyName }) {
  const [copied, setCopied] = useState(null);
  const { token, code } = useShareToken();
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
   * The link carries a short code, and the server looks the rest up — PLUS
   * the plain company/realtor codes and this realtor's name, always, not
   * only as a fallback of last resort.
   *
   * It used to carry ONLY the short code (or the sealed token, or the plain
   * codes when neither had been minted yet), on the reasoning that the short
   * code resolves to everything else over the network. It does — but that
   * resolution is a request the sign-up page makes after the visitor lands,
   * and a request can be slow, fail, or simply not finish before an
   * impatient visitor hit refresh. Whether the realtor got credited then
   * depended on the fate of that one network call rather than on anything
   * printed on the link itself, which read as the attribution randomly
   * "coming and going" between refreshes. Sending the plain fields too means
   * the sign-up page never has to wait on anything to know who sent this —
   * the short code remains, purely for branding (logo/colours) where it
   * resolves in time, and as a tamper-resistant record of the click.
   */
  const params = new URLSearchParams();
  if (code) params.set('ref', code);
  else if (token) params.set('ref', token);
  if (companyCode) params.set('company_code', companyCode);
  params.set('realtor_code', realtorCode);
  if (realtorName) params.set('realtor_name', realtorName);
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
        {/* No longer gated on the sealed token being ready: the plain codes
            above make the link fully functional for attribution the instant
            it is rendered, so there is nothing left worth waiting for. */}
        <Button type="button" size="sm" onClick={() => copy(link, 'link')}>
          {copied === 'link' ? 'Copied ✓' : 'Copy Link'}
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

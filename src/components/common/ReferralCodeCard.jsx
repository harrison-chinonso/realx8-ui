import { useEffect, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { getMyCompany } from '../../api/companyApi';
import useAuthStore from '../../store/authStore';
import useShareToken from '../../hooks/useShareToken';

/**
 * Shows the signed-in company's self-registration code with one-click copy.
 * Renders nothing for superior admins (who have no single company) or if the
 * company has no code yet, so it can be dropped onto any company-user page.
 */
export default function ReferralCodeCard({ audience = 'clients' }) {
  const isSuperiorAdmin = useAuthStore((state) => state.isSuperiorAdmin);
  const { token: shareToken } = useShareToken();
  const [company, setCompany] = useState(null);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    if (isSuperiorAdmin) return;
    let cancelled = false;
    getMyCompany()
      .then((response) => { if (!cancelled) setCompany(response?.data ?? response ?? null); })
      .catch(() => { if (!cancelled) setCompany(null); });
    return () => { cancelled = true; };
  }, [isSuperiorAdmin]);

  const code = company?.referral_code;
  if (isSuperiorAdmin || !code) return null;

  // A sealed token brands the sign-up page for this company. Falls back to the
  // plain company_code, which RegisterPage still reads (along with the older
  // `code`) so links shared before this change keep working.
  const signupUrl = shareToken
    ? `${window.location.origin}/register?ref=${encodeURIComponent(shareToken)}`
    : `${window.location.origin}/register?company_code=${encodeURIComponent(code)}`;

  const copy = async (value, which) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied((current) => (current === which ? null : current)), 2000);
    } catch {
      setCopied(null);
    }
  };

  const label = audience === 'realtors'
    ? 'Share this code with realtors so they can join your company when they sign up.'
    : 'Share this code with clients so they are linked to your company when they sign up.';

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">
            {company.name ? `${company.name} — ` : ''}Company Referral Code
          </p>
          <p className="mt-0.5 text-xs text-slate-500">{label}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => copy(code, 'code')}
            title="Copy code"
            className="flex items-center gap-2 rounded-lg border-2 border-dashed px-4 py-2 font-mono text-xl font-bold tracking-[0.3em] transition-colors hover:bg-slate-50"
            style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
          >
            {code}
            {copied === 'code'
              ? <Check size={16} className="text-emerald-600" />
              : <Copy size={16} className="opacity-60" />}
          </button>
          <button
            type="button"
            onClick={() => copy(signupUrl, 'link')}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            {copied === 'link' ? 'Link copied ✓' : 'Copy sign-up link'}
          </button>
        </div>
      </div>
    </div>
  );
}

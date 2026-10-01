import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getTerms } from '../../api/legalApi';
import useAuthStore from '../../store/authStore';
import TermsDocument from '../../components/legal/TermsDocument';

/**
 * The current Terms of Use and Privacy Policy, readable by anyone at any time
 * (/legal/terms) — before signing up, from the Help page, or from inside the
 * app. `#part-b` jumps to the Privacy Policy.
 */
export default function TermsPage() {
  const navigate = useNavigate();
  const signedIn = Boolean(useAuthStore((s) => s.accessToken));
  const [terms, setTerms] = useState(undefined);

  useEffect(() => {
    let cancelled = false;
    getTerms().then((t) => { if (!cancelled) setTerms(t); }).catch(() => { if (!cancelled) setTerms(null); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!terms || !window.location.hash) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [terms]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <button type="button" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(signedIn ? '/' : '/login'))} className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            <ArrowLeft size={16} aria-hidden="true" /> Back
          </button>
          <Link to="/help" className="rounded-lg px-2 py-2 text-sm font-semibold text-primary hover:underline">Help &amp; FAQ</Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200 sm:p-8">
          {terms === undefined && <p className="text-sm text-slate-500">Loading…</p>}
          {terms === null && <p className="text-sm text-slate-600">The Terms of Use and Privacy Policy have not been published yet.</p>}
          {terms && <TermsDocument terms={terms} />}
        </div>
        <p className="mt-6 text-center text-xs text-slate-400">© {new Date().getFullYear()} Realx8. All rights reserved.</p>
      </main>
    </div>
  );
}

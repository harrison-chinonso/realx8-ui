import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useAuthStore from '../../store/authStore';

export default function GoogleCallbackPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const setSession = useAuthStore((state) => state.setSession);
  const [message, setMessage] = useState('Signing you in with Google...');

  useEffect(() => {
    const token = params.get('token');
    const refreshToken = params.get('refreshToken');
    const userParam = params.get('user');
    const error = params.get('error');

    if (error) {
      /**
       * Carry the server's own sentence through, not just the code.
       *
       * Every Google failure used to arrive as `google_auth_failed`, whatever
       * had actually gone wrong — a missing company code and a declined consent
       * screen looked identical, and neither told anybody what to do. The
       * server now names the cause and supplies the wording; this passes both
       * to the sign-in page rather than keeping a second copy of every message.
       */
      const detail = params.get('message');
      navigate(
        `/login?error=${encodeURIComponent(error)}${detail ? `&message=${encodeURIComponent(detail)}` : ''}`,
        { replace: true },
      );
      return;
    }

    /**
     * Google proved the address, and the address turned out to belong to
     * somebody with accounts at several companies.
     *
     * Handed back to the sign-in page rather than answered here: that page
     * already draws the company picker for a password sign-in, and a second
     * copy of it here would be the same screen maintained twice. The token is
     * what authorises the choice; the list beside it is only what gets drawn.
     */
    const companyToken = params.get('company_token');
    if (companyToken) {
      const companies = params.get('companies') || '[]';
      setMessage('Choose a company to continue…');
      navigate(
        `/login?company_token=${encodeURIComponent(companyToken)}&companies=${encodeURIComponent(companies)}`,
        { replace: true },
      );
      return;
    }

    if (!token || !refreshToken || !userParam) {
      setMessage('Google sign-in response is incomplete. Redirecting…');
      navigate('/login?error=google_auth_failed', { replace: true });
      return;
    }

    try {
      const user = JSON.parse(userParam);
      setSession(token, refreshToken, user);
      /**
       * Back to where they were, if the server carried it through the state.
       * Somebody who pressed Google from a property page expects to land on
       * that property, not on a dashboard they then have to navigate out of.
       */
      const redirect = params.get('redirect');
      navigate(redirect && redirect.startsWith('/') ? redirect : '/', { replace: true });
    } catch (err) {
      setMessage(`Google sign-in failed: ${err.message}`);
      navigate('/login?error=google_auth_failed', { replace: true });
    }
  }, [navigate, params, setSession]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
      <p className="text-sm text-slate-200">{message}</p>
    </div>
  );
}

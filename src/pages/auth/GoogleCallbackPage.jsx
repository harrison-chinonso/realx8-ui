import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useAuthStore from '../../store/authStore';

export default function GoogleCallbackPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const setSession = useAuthStore((state) => state.setSession);
  const [message, setMessage] = useState('Signing you in with Google...');

  useEffect(() => {
    /*
     * Inside the mobile app, back to the company's own sign-in page — its logo
     * and colours — rather than the platform's. This page serves Google and
     * Sign in with Apple alike.
     */
    const appCompany = typeof window !== 'undefined' ? window.Realx8Native?.tenant : null;
    const loginPath = appCompany ? `/login/${encodeURIComponent(appCompany)}` : '/login';
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
        `${loginPath}?error=${encodeURIComponent(error)}${detail ? `&message=${encodeURIComponent(detail)}` : ''}`,
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
        `${loginPath}?company_token=${encodeURIComponent(companyToken)}&companies=${encodeURIComponent(companies)}`,
        { replace: true },
      );
      return;
    }

    /**
     * Google proved the address, but this account (or its company) also asks
     * for a second factor — Google does not stand in for it. Hand over to the
     * sign-in page's code step, the same one a password sign-in reaches. The
     * short-lived token travels in navigation state, not the URL, so it is not
     * left behind in the browser's history.
     */
    const pendingToken = params.get('temp_token');
    if (pendingToken && (params.get('requires_2fa') || params.get('requires_2fa_setup'))) {
      setMessage('One more step — your authentication code…');
      navigate(loginPath, {
        replace: true,
        state: {
          pendingTwoFactor: {
            [params.get('requires_2fa') ? 'requires_2fa' : 'requires_2fa_setup']: true,
            temp_token: pendingToken,
          },
        },
      });
      return;
    }

    if (!token || !refreshToken || !userParam) {
      setMessage('The sign-in response is incomplete. Redirecting…');
      navigate(`${loginPath}?error=google_auth_failed`, { replace: true });
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
      // A path on this site only: '//host' is another site, not a path.
      navigate(redirect && /^\/(?![/\\])/.test(redirect) ? redirect : '/', { replace: true });
    } catch (err) {
      setMessage(`Sign-in failed: ${err.message}`);
      navigate(`${loginPath}?error=google_auth_failed`, { replace: true });
    }
  }, [navigate, params, setSession]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
      <p className="text-sm text-slate-200">{message}</p>
    </div>
  );
}

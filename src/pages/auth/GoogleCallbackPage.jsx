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
      navigate(`/login?error=${encodeURIComponent(error)}`, { replace: true });
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
      navigate('/', { replace: true });
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

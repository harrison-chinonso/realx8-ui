import { useEffect, useState } from 'react';
import { listNotifications } from '../../api/notificationApi';
import useAuthStore from '../../store/authStore';
import Button from '../ui/Button';

export default function Header() {
  const [count, setCount] = useState(0);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    listNotifications().then((response) => {
      const unread = (response.data || []).filter((item) => !item.is_read).length;
      setCount(unread);
    }).catch(() => setCount(0));
  }, []);

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Modern Realty Workspace</h1>
        <p className="text-sm text-slate-500">Manage sales, investments, finance, and support.</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="rounded-full bg-slate-100 px-3 py-2 text-sm">🔔 {count}</div>
        <div className="text-right text-sm">
          <div className="font-semibold text-slate-800">{user?.name || 'Guest User'}</div>
          <div className="text-slate-500">{user?.type || 'visitor'}</div>
        </div>
        <Button onClick={logout}>Logout</Button>
      </div>
    </header>
  );
}

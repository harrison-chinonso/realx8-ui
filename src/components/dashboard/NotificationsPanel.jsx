import { useState } from 'react';
import { DASHBOARD_ROWS, capRows } from './dashboardRows';
import { useNavigate } from 'react-router-dom';
import { Bell, X } from 'lucide-react';
import { markRead } from '../../api/notificationApi';

export default function NotificationsPanel({ notifications = [], onDismiss, limit = DASHBOARD_ROWS }) {
  const shown = capRows(notifications, limit);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const count = notifications.length;

  const handleDismiss = async (id) => {
    try { await markRead(id); } catch { /* silent */ }
    onDismiss?.(id);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors"
      >
        <Bell size={15} />
        Alerts
        {count > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-40 w-96 rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-900">Notifications & Alerts</h3>
              <button onClick={() => setOpen(false)} className="rounded p-1 hover:bg-slate-100"><X size={14} /></button>
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-slate-50">
              {notifications.length === 0 && (
                <div className="px-4 py-8 text-center text-xs text-slate-400">No new alerts</div>
              )}
              {shown.map((n) => (
                <div key={n.id} className="group flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                  <span className="mt-0.5 text-base shrink-0">
                    {n.type === 'overdue' ? '🔴' : n.type === 'registration' ? '👤' : n.type === 'payment' ? '💳' : '🔔'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-800 line-clamp-2">{n.body || n.message || n.title}</p>
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDismiss(n.id)}
                    className="opacity-0 group-hover:opacity-100 rounded p-0.5 hover:bg-slate-200 transition-all"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100 px-4 py-2.5">
              <button
                onClick={() => { navigate('/notifications'); setOpen(false); }}
                className="text-xs font-medium text-blue-600 hover:underline"
              >
                View all notifications →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

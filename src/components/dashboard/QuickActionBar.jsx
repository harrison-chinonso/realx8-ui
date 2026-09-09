import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus, Home, FileText, CreditCard, Users, Target, Ticket, BarChart2,
  Zap, ChevronDown,
} from 'lucide-react';

const ACTIONS = [
  { label: 'Add Client',        icon: UserPlus,  to: '/users/clients',              desc: 'Register a new client' },
  { label: 'Add Property',      icon: Home,      to: '/properties/create',          desc: 'List a new property' },
  { label: 'Create Invoice',    icon: FileText,  to: '/finance/invoices/create',    desc: 'Generate an invoice' },
  { label: 'Record Payment',    icon: CreditCard,to: '/finance/transactions',       desc: 'Log a payment received' },
  { label: 'Register Realtor',  icon: Users,     to: '/users/realtors',             desc: 'Add a new realtor' },
  { label: 'Create Lead',       icon: Target,    to: '/crm/leads',                  desc: 'Add a CRM lead' },
  { label: 'Support Ticket',    icon: Ticket,    to: '/support',                    desc: 'Raise a support ticket' },
  { label: 'Generate Report',   icon: BarChart2, to: '/finance/reports',            desc: 'View financial reports' },
];

export default function QuickActionBar() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
      >
        <Zap size={13} className="text-amber-500" />
        Actions
        <ChevronDown size={12} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-56 rounded-xl bg-white shadow-xl ring-1 ring-slate-200 overflow-hidden">
          <div className="border-b border-slate-100 px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Quick Actions</span>
          </div>
          <div className="py-1">
            {ACTIONS.map(({ label, icon: Icon, to, desc }) => (
              <button
                key={label}
                onClick={() => { navigate(to); setOpen(false); }}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                  <Icon size={13} className="text-slate-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-800">{label}</p>
                  <p className="text-[10px] text-slate-400">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

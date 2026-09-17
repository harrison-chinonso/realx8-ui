import { useState } from 'react';
import { Landmark, CreditCard, Copy, Check } from 'lucide-react';

/**
 * Where to send the money, and how.
 *
 * ── Why this is its own component ──────────────────────────────────────────
 *
 * Two different bills now ask the same question. A buyer pays an invoice; a
 * realtor pays a verification or upgrade fee, which has no invoice at all — the
 * credit note IS the bill. Both need the company's published accounts, the
 * copy buttons, and the gateway offered only when one is configured.
 *
 * Written twice, the two would drift, and the way they would drift is an
 * account number shown on one screen after it had been retired on the other.
 * The server extracted `paymentChoicesFor` for exactly this reason; this is the
 * same seam on the near side of the wire.
 *
 * Takes the `payment` / `options` shape the server returns:
 *   { bank: { assigned, accounts: [...] }, online: { label, ... } | null }
 */
export default function PaymentChoices({ options, method, onMethod }) {
  const [copied, setCopied] = useState(null);

  const copy = async (value, which) => {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(which);
      setTimeout(() => setCopied((c) => (c === which ? null : c)), 2000);
    } catch { /* clipboard unavailable — the value is on screen anyway */ }
  };

  const accounts = options?.bank?.accounts || [];
  const online = options?.online;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onMethod('bank')}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${method === 'bank' ? 'border-transparent text-white' : 'border-slate-300 text-slate-600'}`}
          style={method === 'bank' ? { backgroundColor: 'var(--primary)' } : undefined}
        >
          <Landmark size={15} /> Bank Deposit
        </button>
        {/* Rendered only when the company actually has a gateway configured. */}
        {online && (
          <button
            type="button"
            onClick={() => onMethod('online')}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${method === 'online' ? 'border-transparent text-white' : 'border-slate-300 text-slate-600'}`}
            style={method === 'online' ? { backgroundColor: 'var(--primary)' } : undefined}
          >
            <CreditCard size={15} /> Pay with {online.label}
          </button>
        )}
      </div>

      {method === 'bank' && (
        <div className="space-y-3">
          {options?.bank?.assigned && (
            <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-700">
              Your account manager has assigned a specific account for this payment.
            </p>
          )}
          {accounts.length ? accounts.map((account) => (
            <div key={account.id} className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-900">{account.bank_name}</p>
              <p className="text-xs text-slate-500">{account.name}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="font-mono text-lg font-bold tracking-wider text-slate-900">{account.account_number}</span>
                <button type="button" onClick={() => copy(account.account_number, account.id)} className="text-slate-400 hover:text-slate-700" title="Copy account number">
                  {copied === account.id ? <Check size={15} /> : <Copy size={15} />}
                </button>
              </div>

              {/* Only rendered when set — a local-only account should not
                  show empty IBAN/SWIFT rows. */}
              {(account.iban || account.swift_code) && (
                <dl className="mt-3 space-y-1 border-t border-slate-100 pt-3">
                  {account.iban && (
                    <div className="flex items-center gap-2">
                      <dt className="w-14 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-400">IBAN</dt>
                      <dd className="min-w-0 flex-1 break-all font-mono text-xs text-slate-700">{account.iban}</dd>
                      <button type="button" onClick={() => copy(account.iban, `${account.id}-iban`)} className="shrink-0 text-slate-400 hover:text-slate-700" title="Copy IBAN">
                        {copied === `${account.id}-iban` ? <Check size={13} /> : <Copy size={13} />}
                      </button>
                    </div>
                  )}
                  {account.swift_code && (
                    <div className="flex items-center gap-2">
                      <dt className="w-14 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-400">SWIFT</dt>
                      <dd className="min-w-0 flex-1 break-all font-mono text-xs text-slate-700">{account.swift_code}</dd>
                      <button type="button" onClick={() => copy(account.swift_code, `${account.id}-swift`)} className="shrink-0 text-slate-400 hover:text-slate-700" title="Copy SWIFT code">
                        {copied === `${account.id}-swift` ? <Check size={13} /> : <Copy size={13} />}
                      </button>
                    </div>
                  )}
                </dl>
              )}
            </div>
          )) : (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              No bank account has been published yet. Please contact your account manager.
            </p>
          )}
        </div>
      )}

      {method === 'online' && online && (
        <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-600">
          <p>You will be routed to <strong>{online.label}</strong> to complete this payment securely.</p>
          <p className="mt-2 text-xs text-slate-400">
            After paying, upload the confirmation below so it can be matched to what you owe.
          </p>
        </div>
      )}
    </>
  );
}

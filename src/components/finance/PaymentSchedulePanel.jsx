import { useCallback, useEffect, useState } from 'react';
import { getPaymentOptions, waiveScheduleFee } from '../../api/financeApi';
import { useCurrency } from '../../context/useAppearance';
import Badge from '../common/Badge';
import Button from '../ui/Button';
import useAuthStore from '../../store/authStore';

const getData = (response) => response?.data ?? response ?? null;
const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : '—');

/**
 * Timing and settlement are shown as two badges, side by side, never merged.
 *
 * A schedule can be overdue AND part paid at the same time, and either label on
 * its own misreports it — "overdue" hides that most of it is settled, "part
 * paid" hides that a late fee is accruing.
 *
 * Both status vocabularies are in Badge's own colour map, so the labelling and
 * the tones stay consistent with every other status pill in the app.
 */

/**
 * The payment plan and its schedule table for one invoice.
 *
 * Reads /invoices/:id/payment-options, which is invoice-scoped — so a client
 * sees their own plan and staff see any in their company, from the same call
 * the payment page already makes.
 *
 * Renders nothing for an invoice with no payment plan, which is every invoice
 * raised before the purchase journey existed.
 */
export default function PaymentSchedulePanel({ invoiceId, onChanged }) {
  const fmt = useCurrency();
  const [plan, setPlan] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [waiving, setWaiving] = useState(null);

  // Waiving a late fee is an admin action.
  const acting = useAuthStore((s) => s.effectiveType());
  const isAdmin = ['admin', 'super_admin', 'superior_admin'].includes(acting);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    getPaymentOptions(invoiceId)
      .then((response) => {
        if (cancelled) return;
        const data = getData(response);
        setPlan(data?.payment_plan ?? null);
        setSchedules(data?.schedules ?? []);
        setError('');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.response?.data?.message || 'Could not load the payment schedule.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [invoiceId]);

  useEffect(() => load(), [load]);

  const waive = async (schedule) => {
    const reason = window.prompt(
      `Waive the ${fmt(schedule.fee_outstanding)} late fee on installment ${schedule.sequence}?\n\n`
      + 'Give a reason — it is recorded against the invoice.',
    );
    if (!reason || !reason.trim()) return;
    setWaiving(schedule.id);
    try {
      await waiveScheduleFee(schedule.id, reason.trim());
      load();
      onChanged?.();
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not waive the fee.');
    } finally {
      setWaiving(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm text-slate-500">Loading payment schedule...</p>
      </div>
    );
  }

  // No plan means a pre-journey invoice — the page's own total and balance
  // already cover it, so adding an empty panel would only be noise.
  if (!plan) return null;

  const feesOutstanding = schedules.reduce((sum, s) => sum + Number(s.fee_outstanding || 0), 0);
  const isInstallment = plan.payment_type === 'installment';

  return (
    <div className="space-y-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {isInstallment ? 'Payment Plan' : 'Payment'}
          </h2>
          <p className="text-sm text-slate-500">
            {isInstallment
              ? `${plan.plan_name || 'Installment plan'} — ${plan.duration_months} monthly payments`
              : 'Outright purchase'}
            {plan.quantity > 1 && ` · ${plan.quantity} units`}
          </p>
        </div>
        <Badge value={plan.status} />
      </div>

      {/* The surcharge stays visible on the invoice, not just at purchase. */}
      <div className="grid gap-3 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Purchase amount</div>
          <div className="mt-1 text-slate-800">{fmt(plan.base)}</div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Plan charge</div>
          <div className="mt-1 text-slate-800">{plan.surcharge > 0 ? fmt(plan.surcharge) : '—'}</div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Total payable</div>
          <div className="mt-1 font-semibold text-slate-900">{fmt(plan.total)}</div>
        </div>
      </div>

      {plan.status === 'in_default' && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
          This plan is in default — an installment is past its grace period.
          {feesOutstanding > 0 && ` ${fmt(feesOutstanding)} in late fees has accrued.`}
          {' '}Settling the overdue installments returns the plan to active.
        </p>
      )}

      {Number(plan.credit_balance) > 0 && (
        <p className="rounded-lg bg-blue-50 px-4 py-2 text-sm text-blue-800">
          {fmt(plan.credit_balance)} was paid beyond the final installment and is held as a credit
          balance. An admin has been notified to allocate or refund it.
        </p>
      )}

      {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      {/* Wide table, scrolling in its own container. */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">#</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">Due date</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-600">Amount</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-600">Discount</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-600">Late fee</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-600">Still payable</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">Timing</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">Settlement</th>
              {isAdmin && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {schedules.map((schedule) => (
              <tr key={schedule.id} className={schedule.settlement_status === 'paid' ? 'text-slate-400' : ''}>
                <td className="px-3 py-2">{schedule.sequence}</td>
                <td className="px-3 py-2">{formatDate(schedule.due_date)}</td>
                <td className="px-3 py-2 text-right">{fmt(schedule.principal)}</td>
                {/*
                  Shown beside the amount rather than folded into it, so the
                  installment still states what it was agreed at. A number that
                  quietly went down is one a buyer has to take on trust.
                */}
                <td className="px-3 py-2 text-right">
                  {Number(schedule.discount) > 0
                    ? <span className="text-emerald-600">−{fmt(schedule.discount)}</span>
                    : '—'}
                </td>
                <td className="px-3 py-2 text-right">
                  {Number(schedule.fee_accrued) > 0 ? (
                    <span className={Number(schedule.fee_outstanding) > 0 ? 'font-medium text-red-600' : ''}>
                      {fmt(schedule.fee_accrued)}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-3 py-2 text-right font-medium">
                  {schedule.settlement_status === 'paid' ? '—' : fmt(schedule.payable)}
                </td>
                <td className="px-3 py-2"><Badge value={schedule.timing_status} /></td>
                <td className="px-3 py-2"><Badge value={schedule.settlement_status} /></td>
                {isAdmin && (
                  <td className="px-3 py-2 text-right">
                    {Number(schedule.fee_outstanding) > 0 && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => waive(schedule)}
                        disabled={waiving === schedule.id}
                      >
                        {waiving === schedule.id ? 'Waiving…' : 'Waive fee'}
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {schedules.length > 1 && (
            <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-medium">
              <tr>
                <td className="px-3 py-2" colSpan={2}>Total</td>
                {/* Sums to the invoice total exactly — the rounding remainder
                    sits on the final installment rather than being spread. */}
                <td className="px-3 py-2 text-right">
                  {fmt(schedules.reduce((sum, s) => sum + Number(s.principal || 0), 0))}
                </td>
                <td className="px-3 py-2 text-right text-emerald-600">
                  {schedules.some((s) => Number(s.discount) > 0)
                    ? `−${fmt(schedules.reduce((sum, s) => sum + Number(s.discount || 0), 0))}`
                    : '—'}
                </td>
                <td className="px-3 py-2 text-right">{feesOutstanding > 0 ? fmt(feesOutstanding) : '—'}</td>
                <td className="px-3 py-2 text-right">
                  {fmt(schedules.reduce((sum, s) => sum + Number(s.payable || 0), 0))}
                </td>
                <td className="px-3 py-2" colSpan={isAdmin ? 3 : 2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

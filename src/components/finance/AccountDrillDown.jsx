import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../common/Modal';
import Badge from '../common/Badge';
import Button from '../ui/Button';
import { useCurrency } from '../../context/useAppearance';
import { extractError } from '../../utils/extractError';
import { listJournal, getJournalEntry } from '../../api/accountingApi';

/**
 * From a figure on a statement to the document that caused it (ACC-5.1).
 *
 * ── Why the PRD calls this the thing that makes a statement trustworthy ─────
 *
 * An accountant does not believe a number because it is printed. They believe
 * it because they can ask where it came from and keep asking until they reach
 * a piece of paper somebody signed. A statement that cannot answer that is a
 * report; one that can is a set of books.
 *
 * Three steps, which is as deep as it needs to go: the figure, the journals
 * behind it, and the document behind each journal.
 *
 * ── The amount shown is the ACCOUNT's share, not the entry's total ──────────
 *
 * A ₦53m payment entry touches the bank and receivables. Drilling into
 * receivables and seeing ₦53m against an entry is right; drilling into a
 * ₦5,000 bank charge and seeing the whole payroll journal it was bundled into
 * is not. The list has to add up to the figure that was clicked, or the
 * drill-through has explained nothing.
 */

/**
 * Where a journal's source document lives.
 *
 * Null for the sources that ARE the document — a manual journal, an import, a
 * year end. Offering a dead link for those would be worse than offering none,
 * because it implies there is something more to see.
 */
const documentFor = (entry) => {
  const id = entry?.source_id;
  switch (entry?.source) {
    case 'invoice':
    case 'fee_invoice':
    case 'invoice_payment':
    case 'credit_note':
      // invoice_payment carries "invoiceId:n", so the invoice is the first part.
      return id ? { to: `/finance/invoices/${String(id).split(':')[0]}`, label: 'the invoice' } : null;
    case 'bill':
    case 'bill_payment':
    case 'supplier_credit_note':
      return { to: '/finance/payables', label: 'payables' };
    case 'refund':
      return { to: '/finance/refunds', label: 'the refund' };
    case 'handover':
      return { to: '/finance/handovers', label: 'the handover' };
    case 'cost_catch_up':
    case 'write_down':
      return { to: '/finance/project-cost', label: 'the project' };
    case 'bank_line':
      return { to: '/finance/bank-reconciliation', label: 'the statement line' };
    case 'commission_ledger':
      return { to: '/finance/commissions', label: 'the commission' };
    default:
      return null;
  }
};

export default function AccountDrillDown({ account, from, to, onClose }) {
  const fmt = useCurrency();
  const show = (minor) => fmt(Number(minor || 0) / 100);

  const [entries, setEntries] = useState(null);
  const [failed, setFailed] = useState('');
  const [entry, setEntry] = useState(null);

  useEffect(() => {
    if (!account) { setEntries(null); setEntry(null); return; }
    setEntries(null);
    setEntry(null);
    setFailed('');
    listJournal({
      account_id: account.account_id, from, to, limit: 200,
    })
      .then(setEntries)
      .catch((error) => setFailed(extractError(error, 'Could not read the journals behind this.')));
  }, [account, from, to]);

  const openEntry = async (id) => {
    setFailed('');
    try {
      setEntry(await getJournalEntry(id));
    } catch (error) {
      setFailed(extractError(error, 'Could not open that journal.'));
    }
  };

  const total = (entries || []).reduce(
    (sum, row) => sum + Number(row.account_debit_minor || 0) - Number(row.account_credit_minor || 0),
    0,
  );

  return (
    <Modal
      open={Boolean(account)}
      onClose={onClose}
      title={account ? `${account.code} — ${account.name}` : ''}
      size="lg"
    >
      {account && (
        <div className="space-y-3 text-sm">
          {failed && <div className="rounded-lg bg-danger-surface px-3 py-2 text-danger">{failed}</div>}

          {!entry && (
            <>
              <p className="text-xs text-slate-500">
                Every journal touching this account
                {from && to ? ` between ${from} and ${to}` : ''}. The amounts are what this
                account took from each one.
              </p>

              {entries === null && !failed && (
                <p className="py-6 text-center text-slate-500">Reading the journal…</p>
              )}

              {entries && entries.length === 0 && (
                <p className="py-6 text-center text-slate-500">
                  Nothing was posted to this account in that period.
                </p>
              )}

              {entries && entries.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Journal</th>
                        <th className="px-3 py-2 text-left">Date</th>
                        <th className="px-3 py-2 text-left">What caused it</th>
                        <th className="px-3 py-2 text-right">Debit</th>
                        <th className="px-3 py-2 text-right">Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((row) => (
                        <tr
                          key={row.id}
                          onClick={() => openEntry(row.id)}
                          className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                        >
                          <td className="px-3 py-1.5 font-medium text-blue-600">{row.reference}</td>
                          <td className="px-3 py-1.5 text-slate-500">{row.entry_date}</td>
                          <td className="px-3 py-1.5">
                            <span className="block max-w-[22rem] truncate">
                              {row.memo || row.source}
                            </span>
                            {row.reverses_entry_id && (
                              <Badge value="a reversal" tone="muted" />
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums">
                            {Number(row.account_debit_minor) ? show(row.account_debit_minor) : ''}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums">
                            {Number(row.account_credit_minor) ? show(row.account_credit_minor) : ''}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t border-slate-300 font-semibold">
                        <td className="px-3 py-1.5" colSpan={3}>
                          {entries.length} journal{entries.length === 1 ? '' : 's'}, net movement
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums" colSpan={2}>
                          {show(Math.abs(total))} {total >= 0 ? 'Dr' : 'Cr'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* ── One journal, and what it was made of ─────────────────────── */}
          {entry && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-semibold text-slate-800">{entry.reference}</span>
                  <span className="ml-2 text-xs text-slate-500">{entry.entry_date}</span>
                </div>
                <Button size="sm" variant="secondary" onClick={() => setEntry(null)}>
                  Back to the list
                </Button>
              </div>

              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                {entry.memo || entry.source}
                {entry.created_by_name && ` · posted by ${entry.created_by_name}`}
                {entry.reversal_reason && ` · reversed: ${entry.reversal_reason}`}
              </p>

              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Account</th>
                      <th className="px-3 py-2 text-left">On</th>
                      <th className="px-3 py-2 text-right">Debit</th>
                      <th className="px-3 py-2 text-right">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(entry.lines || []).map((line) => (
                      <tr
                        key={line.id}
                        className={`border-t border-slate-100 ${
                          Number(line.account_id) === Number(account.account_id) ? 'bg-blue-50' : ''
                        }`}
                      >
                        <td className="px-3 py-1.5">
                          {line.account_code} {line.account_name}
                        </td>
                        <td className="px-3 py-1.5 text-xs text-slate-500">
                          {line.memo || ''}
                          {/* By name — an id here is a thing to go and look up,
                              which is the opposite of what a drill-through is for. */}
                          {line.property_name ? ` · ${line.property_name}` : ''}
                          {line.branch_name ? ` · ${line.branch_name}` : ''}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {Number(line.debit_minor) ? show(line.debit_minor) : ''}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {Number(line.credit_minor) ? show(line.credit_minor) : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/*
                The third step, and the one the whole feature is for: out of the
                ledger and onto the document a person signed.
              */}
              {documentFor(entry)
                ? (
                  <Link
                    to={documentFor(entry).to}
                    className="inline-block text-sm font-medium text-blue-600 hover:underline"
                    onClick={onClose}
                  >
                    Open {documentFor(entry).label} →
                  </Link>
                )
                : (
                  <p className="text-xs text-slate-500">
                    Nothing further behind this one — a journal written by hand, imported, or
                    posted by a year end IS the document.
                  </p>
                )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

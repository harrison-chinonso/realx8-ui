import { useCallback, useEffect, useMemo, useState } from 'react';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import FieldMark from '../../components/ui/FieldMark';
import { useCurrency } from '../../context/useAppearance';
import { extractError } from '../../utils/extractError';
import { plural } from '../../utils/plural';
import {
  listVendors, createVendor, listBills, createBill,
  approveBill, rejectBill, payBill, agedPayables, listLedgerAccounts,
  listCostTypes,
} from '../../api/accountingApi';

/**
 * Money going out: what the company owes, to whom, and how late.
 *
 * ── Three tabs, because they answer three different questions ───────────────
 *
 * Bills is "what has come in and what needs deciding". Ageing is "what is
 * late", which is the question somebody paying suppliers actually asks — not
 * the total but the overdue. Vendors is the reference data behind both.
 *
 * ── What a bill shows that an invoice does not ──────────────────────────────
 *
 * Net, tax and withholding as separate figures, because the vendor is owed the
 * net less what is withheld, the tax is recoverable, and the withholding has
 * to be remitted to somebody else entirely. One "amount" column could not
 * answer any of those, and every one of them is a question at month end.
 */

const TABS = [
  { key: 'bills', label: 'Bills' },
  { key: 'ageing', label: 'Ageing' },
  { key: 'vendors', label: 'Vendors' },
];

const STATUS_TONE = {
  pending_approval: 'warning',
  approved: 'info',
  paid: 'success',
  rejected: 'danger',
  cancelled: 'muted',
};

const EMPTY_BILL = {
  vendor_id: '', net_minor: '', tax_minor: '', withholding_minor: '',
  account_id: '', property_id: '', bill_date: '', due_date: '',
  description: '', vendor_reference: '', expense_type_id: '', type: 'bill',
};

const EMPTY_VENDOR = {
  name: '', category: 'contractor', email: '', phone: '',
  bank_name: '', bank_account_name: '', bank_account_number: '',
  tax_id_number: '', withholding_rate: '',
};

/** Naira in the box, kobo on the wire. The whole platform settles in minor units. */
const toMinor = (value) => Math.round((Number(value) || 0) * 100);

export default function PayablesPage() {
  const fmt = useCurrency();
  const money = (minor) => fmt(Number(minor || 0) / 100);

  const [tab, setTab] = useState('bills');
  const [bills, setBills] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [ageing, setAgeing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const [billForm, setBillForm] = useState(EMPTY_BILL);
  const [costTypes, setCostTypes] = useState([]);
  const [showBill, setShowBill] = useState(false);
  const [vendorForm, setVendorForm] = useState(EMPTY_VENDOR);
  const [showVendor, setShowVendor] = useState(false);
  const [paying, setPaying] = useState(null);
  const [payRef, setPayRef] = useState('');
  const [rejecting, setRejecting] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setFailed('');
    try {
      const [b, v] = await Promise.all([listBills(), listVendors()]);
      setBills(b);
      setVendors(v);
    } catch (error) {
      setFailed(extractError(error, 'Could not load what is owed.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // The chart is only needed by the bill form, so it is fetched when one opens.
  useEffect(() => {
    if (!showBill || accounts.length) return;
    listLedgerAccounts({ active: 'true' }).then(setAccounts).catch(() => setAccounts([]));
  }, [showBill, accounts.length]);

  useEffect(() => {
    if (!showBill || costTypes.length) return;
    listCostTypes({ active: 'true' }).then(setCostTypes).catch(() => setCostTypes([]));
  }, [showBill, costTypes.length]);

  useEffect(() => {
    if (tab !== 'ageing' || ageing) return;
    agedPayables().then(setAgeing).catch(() => setAgeing(null));
  }, [tab, ageing]);

  const act = async (fn, success) => {
    setBusy(true);
    setMessage('');
    setFailed('');
    try {
      await fn();
      setMessage(success);
      setAgeing(null);
      await load();
      return true;
    } catch (error) {
      setFailed(extractError(error, 'That could not be done.'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const chosenType = costTypes.find((t) => String(t.id) === String(billForm.expense_type_id));

  const submitBill = async (event) => {
    event.preventDefault();
    const ok = await act(
      () => createBill({
        ...billForm,
        vendor_id: Number(billForm.vendor_id),
        net_minor: toMinor(billForm.net_minor),
        tax_minor: toMinor(billForm.tax_minor),
        // Left blank, the API applies the vendor's own withholding rate —
        // which is the common case and the reason it is optional here.
        ...(String(billForm.withholding_minor).trim()
          ? { withholding_minor: toMinor(billForm.withholding_minor) }
          : {}),
        account_id: billForm.account_id || null,
        property_id: billForm.property_id || null,
        expense_type_id: billForm.expense_type_id || null,
      }),
      'Bill raised. It now needs approving by somebody else.',
    );
    if (ok) { setShowBill(false); setBillForm(EMPTY_BILL); }
  };

  const submitVendor = async (event) => {
    event.preventDefault();
    const ok = await act(
      () => createVendor({
        ...vendorForm,
        withholding_rate: vendorForm.withholding_rate === '' ? null : Number(vendorForm.withholding_rate),
      }),
      'Vendor added.',
    );
    if (ok) { setShowVendor(false); setVendorForm(EMPTY_VENDOR); }
  };

  const outstandingOf = (bill) => Math.max(
    Number(bill.net_minor || 0) + Number(bill.tax_minor || 0)
      - Number(bill.withholding_minor || 0) - Number(bill.paid_minor || 0),
    0,
  );

  const awaiting = useMemo(() => bills.filter((b) => b.status === 'pending_approval').length, [bills]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Payables</h1>
          <p className="text-sm text-slate-500">
            What the company owes its suppliers. A bill is checked and approved before it is paid —
            approving is what commits the company and puts the cost in the books.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" onClick={() => setShowVendor(true)}>Add vendor</Button>
          <Button onClick={() => setShowBill(true)} disabled={!vendors.length}>Raise a bill</Button>
        </div>
      </div>

      {!vendors.length && !loading && (
        <div className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Add a vendor before raising a bill — a bill has to be owed to somebody.
        </div>
      )}
      {failed && <div className="rounded-lg bg-danger-surface px-4 py-2 text-sm text-danger">{failed}</div>}
      {message && <div className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">{message}</div>}

      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === item.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {item.label}
            {item.key === 'bills' && awaiting > 0 && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                {awaiting}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'bills' && (
        <Table
          columns={[
            { key: 'reference', label: 'Bill' },
            { key: 'vendor_name', label: 'Vendor', render: (row) => row.vendor_name || '—' },
            {
              key: 'description',
              label: 'What for',
              render: (row) => (
                <span className="block max-w-[18rem] truncate" title={row.description || ''}>
                  {row.description || '—'}
                </span>
              ),
            },
            { key: 'net_minor', label: 'Net', render: (row) => money(row.net_minor) },
            { key: 'tax_minor', label: 'VAT', render: (row) => money(row.tax_minor) },
            {
              key: 'withholding_minor',
              label: 'Withheld',
              render: (row) => (Number(row.withholding_minor) > 0
                ? <span title="Kept back to remit, not paid to the vendor">{money(row.withholding_minor)}</span>
                : '—'),
            },
            {
              key: 'outstanding',
              label: 'Outstanding',
              render: (row) => <span className="font-semibold">{money(outstandingOf(row))}</span>,
            },
            { key: 'status', label: 'Status', render: (row) => <Badge value={row.status} tone={STATUS_TONE[row.status]} /> },
            {
              key: 'due_date',
              label: 'Due',
              render: (row) => (row.due_date ? new Date(row.due_date).toLocaleDateString() : '—'),
            },
          ]}
          data={bills}
          loading={loading}
          exportName="payables"
          emptyMessage="No bills yet."
          renderActions={(row) => (
            <div className="flex gap-1.5">
              {row.status === 'pending_approval' && (
                <>
                  <Button size="sm" disabled={busy} onClick={() => act(() => approveBill(row.id), `${row.reference} approved.`)}>
                    Approve
                  </Button>
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => { setRejecting(row); setRejectReason(''); }}>
                    Refuse
                  </Button>
                </>
              )}
              {row.status === 'approved' && outstandingOf(row) > 0 && (
                <Button size="sm" disabled={busy} onClick={() => { setPaying(row); setPayRef(''); }}>
                  Pay {money(outstandingOf(row))}
                </Button>
              )}
            </div>
          )}
        />
      )}

      {tab === 'ageing' && (
        <div className="space-y-3">
          {!ageing && <p className="text-sm text-slate-500">Loading…</p>}
          {ageing && ageing.vendors.length === 0 && (
            <p className="rounded-xl bg-white p-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">
              Nothing outstanding. Every approved bill has been paid.
            </p>
          )}
          {ageing && ageing.vendors.length > 0 && (
            <>
              <p className="text-sm text-slate-500">
                {plural(ageing.vendors.length, 'supplier')} owed {money(ageing.total_minor)} as at{' '}
                {new Date(ageing.as_at).toLocaleDateString()}. Each figure is what is OWED — net of
                anything withheld for remittance, which is not the vendor&apos;s money.
              </p>
              <Table
                columns={[
                  { key: 'vendor_name', label: 'Vendor' },
                  { key: 'not_yet_due', label: 'Not yet due', render: (r) => money(r.not_yet_due) },
                  { key: 'days_1_30', label: '1–30 days', render: (r) => money(r.days_1_30) },
                  { key: 'days_31_60', label: '31–60', render: (r) => money(r.days_31_60) },
                  { key: 'days_61_90', label: '61–90', render: (r) => money(r.days_61_90) },
                  {
                    key: 'days_over_90',
                    label: 'Over 90',
                    render: (r) => (r.days_over_90 > 0
                      ? <span className="font-semibold text-rose-600">{money(r.days_over_90)}</span>
                      : money(0)),
                  },
                  { key: 'total_minor', label: 'Total', render: (r) => <span className="font-semibold">{money(r.total_minor)}</span> },
                ]}
                data={ageing.vendors}
                loading={false}
                exportName="aged-payables"
                emptyMessage="Nothing outstanding."
              />
            </>
          )}
        </div>
      )}

      {tab === 'vendors' && (
        <Table
          columns={[
            { key: 'name', label: 'Vendor' },
            { key: 'category', label: 'Kind', render: (row) => row.category || '—' },
            { key: 'contact', label: 'Contact', render: (row) => row.email || row.phone || '—' },
            {
              key: 'bank',
              label: 'Paid into',
              render: (row) => (row.bank_account_number
                ? `${row.bank_name || ''} ····${String(row.bank_account_number).slice(-4)}`.trim()
                : '—'),
            },
            {
              key: 'withholding_rate',
              label: 'Withholding',
              render: (row) => (Number(row.withholding_rate) > 0 ? `${Number(row.withholding_rate)}%` : 'None'),
            },
            { key: 'tax_id_number', label: 'TIN', render: (row) => row.tax_id_number || '—' },
          ]}
          data={vendors}
          loading={loading}
          exportName="vendors"
          emptyMessage="No vendors yet."
        />
      )}

      {/* ── Raise a bill ─────────────────────────────────────────────────── */}
      <Modal open={showBill} onClose={() => !busy && setShowBill(false)} title="Raise a bill" size="lg">
        <form onSubmit={submitBill} className="space-y-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Vendor<FieldMark required /></span>
            <Select
              value={billForm.vendor_id}
              onChange={(e) => setBillForm((c) => ({ ...c, vendor_id: e.target.value }))}
              required
            >
              <option value="">Choose…</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}{Number(v.withholding_rate) > 0 ? ` (${Number(v.withholding_rate)}% withheld)` : ''}
                </option>
              ))}
            </Select>
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              label="Net amount" type="number" step="0.01" min="0" required
              value={billForm.net_minor}
              onChange={(e) => setBillForm((c) => ({ ...c, net_minor: e.target.value }))}
            />
            <Input
              label="VAT" type="number" step="0.01" min="0"
              value={billForm.tax_minor}
              onChange={(e) => setBillForm((c) => ({ ...c, tax_minor: e.target.value }))}
            />
            <Input
              label="Withholding" type="number" step="0.01" min="0"
              value={billForm.withholding_minor}
              onChange={(e) => setBillForm((c) => ({ ...c, withholding_minor: e.target.value }))}
            />
          </div>
          {/* Under the grid rather than in the label: a three-word label wraps to
              two lines at this width and drags its field out of line with the
              other two. */}
          <p className="-mt-1 text-xs text-slate-500">
            Leave withholding blank to use the vendor&apos;s own rate.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Bill date" type="date" required
              value={billForm.bill_date}
              onChange={(e) => setBillForm((c) => ({ ...c, bill_date: e.target.value }))}
            />
            <Input
              label="Due date" type="date"
              value={billForm.due_date}
              onChange={(e) => setBillForm((c) => ({ ...c, due_date: e.target.value }))}
            />
          </div>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Code it to<FieldMark /></span>
            <Select
              value={billForm.account_id}
              onChange={(e) => setBillForm((c) => ({ ...c, account_id: e.target.value }))}
            >
              <option value="">Cost of sales (the default)</option>
              {accounts.filter((a) => a.type === 'expense' || a.type === 'asset').map((a) => (
                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
              ))}
            </Select>
          </label>

          <Input
            label="What it is for"
            value={billForm.description}
            onChange={(e) => setBillForm((c) => ({ ...c, description: e.target.value }))}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Their invoice number"
              value={billForm.vendor_reference}
              onChange={(e) => setBillForm((c) => ({ ...c, vendor_reference: e.target.value }))}
            />
            <Input
              label="Property (for margin per project)" type="number" min="1"
              value={billForm.property_id}
              onChange={(e) => setBillForm((c) => ({ ...c, property_id: e.target.value }))}
            />
          </div>

          {/*
            What KIND of cost this is, which is what decides whether it goes on
            the balance sheet (ACC-10.2).

            This was a "This is a build cost" checkbox. A checkbox put the
            difference between this month's profit and the balance sheet in the
            hands of whoever was typing, so the same contractor's invoice could
            capitalise or not depending on who raised it. The decision belongs
            to the kind of cost, taken once by somebody with the standing to
            take it — here it is only being named.
          */}
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">What kind of cost<FieldMark /></span>
            <Select
              value={billForm.expense_type_id}
              onChange={(e) => setBillForm((c) => ({ ...c, expense_type_id: e.target.value }))}
            >
              <option value="">Not stated</option>
              {costTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.capitalisable ? ' — build cost' : ''}
                </option>
              ))}
            </Select>
          </label>
          {chosenType && (
            <p className={`rounded-lg px-3 py-2 text-xs ${chosenType.capitalisable ? 'bg-blue-50 text-blue-800' : 'bg-slate-50 text-slate-600'}`}>
              {chosenType.capitalisable
                ? 'This goes onto the balance sheet as work in progress and is charged against the sale when '
                  + 'the unit is handed over. It needs a project to be coded to.'
                : 'This hits this month\u2019s profit.'}
              {chosenType.note ? ` ${chosenType.note}` : ''}
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button type="button" variant="secondary" onClick={() => setShowBill(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Raise it'}</Button>
          </div>
        </form>
      </Modal>

      {/* ── Add a vendor ─────────────────────────────────────────────────── */}
      <Modal open={showVendor} onClose={() => !busy && setShowVendor(false)} title="Add a vendor" size="md">
        <form onSubmit={submitVendor} className="space-y-3">
          <Input
            label="Name" required value={vendorForm.name}
            onChange={(e) => setVendorForm((c) => ({ ...c, name: e.target.value }))}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Kind<FieldMark /></span>
              <Select
                value={vendorForm.category}
                onChange={(e) => setVendorForm((c) => ({ ...c, category: e.target.value }))}
              >
                {['contractor', 'supplier', 'professional', 'statutory'].map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </Select>
            </label>
            <Input
              label="Withholding rate (%)" type="number" step="0.01" min="0" max="100"
              value={vendorForm.withholding_rate}
              onChange={(e) => setVendorForm((c) => ({ ...c, withholding_rate: e.target.value }))}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Email" type="email" value={vendorForm.email}
              onChange={(e) => setVendorForm((c) => ({ ...c, email: e.target.value }))} />
            <Input label="Phone" value={vendorForm.phone}
              onChange={(e) => setVendorForm((c) => ({ ...c, phone: e.target.value }))} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input label="Bank" value={vendorForm.bank_name}
              onChange={(e) => setVendorForm((c) => ({ ...c, bank_name: e.target.value }))} />
            <Input label="Account name" value={vendorForm.bank_account_name}
              onChange={(e) => setVendorForm((c) => ({ ...c, bank_account_name: e.target.value }))} />
            <Input label="Account number" value={vendorForm.bank_account_number}
              onChange={(e) => setVendorForm((c) => ({ ...c, bank_account_number: e.target.value }))} />
          </div>
          <Input
            label="TIN (needed to remit withholding against them)"
            value={vendorForm.tax_id_number}
            onChange={(e) => setVendorForm((c) => ({ ...c, tax_id_number: e.target.value }))}
          />
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button type="button" variant="secondary" onClick={() => setShowVendor(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Add'}</Button>
          </div>
        </form>
      </Modal>

      {/* ── Pay ──────────────────────────────────────────────────────────── */}
      <Modal open={paying !== null} onClose={() => !busy && setPaying(null)} title="Record the payment" size="sm">
        {paying && (
          <div className="space-y-3 text-sm">
            <p>
              Paying <strong>{money(outstandingOf(paying))}</strong> to {paying.vendor_name} for{' '}
              {paying.reference}.
            </p>
            {Number(paying.withholding_minor) > 0 && (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                {money(paying.withholding_minor)} is withheld and stays on the books to remit — it is
                not part of this payment.
              </p>
            )}
            <Input label="Transfer reference" value={payRef} onChange={(e) => setPayRef(e.target.value)} />
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <Button type="button" variant="secondary" onClick={() => setPaying(null)} disabled={busy}>Cancel</Button>
              <Button
                type="button"
                disabled={busy}
                onClick={async () => {
                  const ok = await act(
                    () => payBill(paying.id, { reference: payRef }),
                    `${paying.reference} paid.`,
                  );
                  if (ok) setPaying(null);
                }}
              >
                {busy ? 'Recording…' : 'Record it'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Refuse ───────────────────────────────────────────────────────── */}
      <Modal open={rejecting !== null} onClose={() => !busy && setRejecting(null)} title="Refuse this bill" size="sm">
        {rejecting && (
          <div className="space-y-3 text-sm">
            <p>Refusing {rejecting.reference} from {rejecting.vendor_name}.</p>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Why<FieldMark required /></span>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="The vendor will ask."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </label>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <Button type="button" variant="secondary" onClick={() => setRejecting(null)} disabled={busy}>Cancel</Button>
              <Button
                type="button"
                disabled={busy || !rejectReason.trim()}
                onClick={async () => {
                  const ok = await act(
                    () => rejectBill(rejecting.id, rejectReason.trim()),
                    `${rejecting.reference} refused.`,
                  );
                  if (ok) setRejecting(null);
                }}
              >
                {busy ? 'Saving…' : 'Refuse it'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

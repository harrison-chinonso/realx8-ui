import { useEffect, useState } from 'react';
import { invoiceReport, revenueReport, transactionReport, commissionReport } from '../../api/financeApi';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import StatsCard from '../../components/common/StatsCard';
import Button from '../../components/ui/Button';
import { useCurrency } from '../../context/useAppearance';
import { useAssistantHandoff } from '../../assistant/useAssistantHandoff';
import Select from '../../components/ui/Select';

function exportCSV(filename, columns, rows) {
  const headers = columns.map(c => c.header || c.label || '').join(',');
  const body = rows.map(r =>
    columns.map(c => {
      const val = c.accessor ? r[c.accessor] : '';
      return `"${String(val ?? '').replace(/"/g, '""')}"`;
    }).join(',')
  ).join('\n');
  const blob = new Blob([headers + '\n' + body], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const fmt = useCurrency();
  const [tab, setTab] = useState('invoices');
  const [invoices, setInvoices] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [commissionTotals, setCommissionTotals] = useState(null);
  const [revenue, setRevenue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ start_date: '', end_date: '', status: '' });

  /**
   * Arriving from the assistant with a period and a tab already worked out.
   *
   * It sets the filters and stops. The export itself is still a button press —
   * downloading a file because of a sentence somebody typed into a chat box is
   * not a thing software should do unasked.
   */
  const handoff = useAssistantHandoff('export-report');
  useEffect(() => {
    if (!handoff) return;
    if (handoff.tab) setTab(handoff.tab);
    if (handoff.from || handoff.to) {
      setFilters((prev) => ({ ...prev, start_date: handoff.from || '', end_date: handoff.to || '' }));
    }
  }, [handoff]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [inv, txn, rev, com] = await Promise.all([
        invoiceReport(filters),
        transactionReport(),
        revenueReport(),
        // Both commission systems, totalled on the server — see the note
        // on totalCommissions below.
        commissionReport(filters),
      ]);
      setInvoices(Array.isArray(inv.data) ? inv.data : []);
      setTransactions(Array.isArray(txn.data) ? txn.data : []);
      setRevenue(rev.data?.revenue || 0);
      setCommissions(Array.isArray(com.data) ? com.data : []);
      setCommissionTotals(com.totals || null);
    } catch (e) {
      console.error('Reports load error:', e);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const invoiceColumns = [
    { header: 'Invoice #', accessor: 'invoice_id' },
    { header: 'Client ID', accessor: 'client_id' },
    { header: 'Amount', render: r => fmt(r.amount) },
    { header: 'Due Date', accessor: 'due_date' },
    { header: 'Status', render: r => <Badge value={r.status} /> },
    { header: 'Created', render: r => new Date(r.createdAt).toLocaleDateString() },
  ];

  const txnColumns = [
    { header: 'Type', accessor: 'type' },
    { header: 'Amount', render: r => fmt(r.amount) },
    { header: 'Method', accessor: 'payment_method' },
    { header: 'Status', render: r => <Badge value={r.status} /> },
    { header: 'Reference', accessor: 'reference' },
    { header: 'Date', render: r => new Date(r.createdAt).toLocaleDateString() },
  ];

  const commissionColumns = [
    { header: 'Employee ID', accessor: 'employee_id' },
    { header: 'Title', accessor: 'title' },
    { header: 'Type', accessor: 'type' },
    { header: 'Amount', render: r => fmt(r.amount) },
    { header: 'Status', render: r => <Badge value={r.status} /> },
    { header: 'Date', render: r => new Date(r.createdAt).toLocaleDateString() },
  ];

  /**
   * The server's totals, not a sum of the rows on screen.
   *
   * Summing here could only ever total what was fetched — and the list is
   * capped — so a figure labelled "total" would quietly mean "total of the
   * first few". It also read the older flat-rate table alone, which is empty on
   * any company using the commission engine: the card said 0 while ₦1.1m had
   * been paid. The fallback keeps an older server working.
   */
  const totalCommissions = commissionTotals?.total
    ?? commissions.reduce((s, c) => s + Number(c.amount || 0), 0);
  const paidCommissions = commissionTotals?.paid
    ?? commissions.filter((c) => c.status === 'paid').reduce((s, c) => s + Number(c.amount || 0), 0);

  const currentData = tab === 'invoices' ? invoices : tab === 'transactions' ? transactions : commissions;
  const currentCols = tab === 'invoices' ? invoiceColumns : tab === 'transactions' ? txnColumns : commissionColumns;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Reports</h1>
        <Button variant="secondary" onClick={() => exportCSV(`${tab}-report.csv`, currentCols, currentData)}>
          ↓ Export CSV
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Total Revenue" value={fmt(revenue)} subtitle="Completed payments" />
        <StatsCard title="Total Invoices" value={invoices.length} subtitle="All invoice records" />
        <StatsCard title="Transactions" value={transactions.length} subtitle="All transactions" />
        <StatsCard title="Commissions Paid" value={fmt(paidCommissions)} subtitle={`of ${fmt(totalCommissions)} total`} />
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input type="date" value={filters.start_date} onChange={e => setFilters({...filters, start_date: e.target.value})} className="rounded border border-slate-300 px-3 py-1.5 text-sm" />
          <span className="text-slate-400 text-sm">to</span>
          <input type="date" value={filters.end_date} onChange={e => setFilters({...filters, end_date: e.target.value})} className="rounded border border-slate-300 px-3 py-1.5 text-sm" />
          <Select value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})} className="rounded border border-slate-300 px-3 py-1.5 text-sm">
            <option value="">All Status</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
            <option value="sent">Sent</option>
            <option value="draft">Draft</option>
          </Select>
          <Button onClick={loadData} disabled={loading}>Apply Filter</Button>
        </div>

        <div className="flex gap-2 mb-4 border-b border-slate-200">
          {['invoices', 'transactions', 'commissions'].map((t) => (
            <Button key={t} onClick={() => setTab(t)} variant={tab === t ? 'primary' : 'ghost'} size="sm" className="capitalize">
              {t}
            </Button>
          ))}
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-slate-500">Loading...</p>
        ) : (
          <>
            {tab === 'invoices' && <Table columns={invoiceColumns} data={invoices} />}
            {tab === 'transactions' && <Table columns={txnColumns} data={transactions} />}
            {tab === 'commissions' && <Table columns={commissionColumns} data={commissions} />}
          </>
        )}
      </div>
    </div>
  );
}

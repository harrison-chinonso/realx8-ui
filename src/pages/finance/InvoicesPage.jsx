import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listInvoices } from '../../api/financeApi';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import Button from '../../components/ui/Button';
import useAuthStore from '../../store/authStore';
import { useCurrency } from '../../context/useAppearance';

const getItems = (response) => response?.data ?? response ?? [];

/**
 * `status` comes from the route rather than a query string, so the "All" and
 * "Due" menu entries are distinct paths and highlight independently. It also
 * filters for real now — the old ?status=due link was read by nobody.
 */
export default function InvoicesPage({ status = null }) {
  const isBuyer = ['client', 'realtor'].includes(useAuthStore((state) => state.effectiveType()));
  const fmt = useCurrency();
  const [invoices, setInvoices] = useState([]);

  useEffect(() => {
    listInvoices(status ? { status } : undefined)
      .then((response) => setInvoices(getItems(response)))
      .catch(() => setInvoices([]));
  }, [status]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-slate-900">
          {status === 'due' ? 'Due Invoices' : 'All Invoices'}
        </h1>
        {/* The route already redirects buyers away; this keeps the button from
            appearing during the render before that happens. */}
        {!isBuyer && <Link to="/finance/invoices/create"><Button>Create invoice</Button></Link>}
      </div>
      <Table
        columns={[
          { key: 'invoice_id', label: 'Invoice #', render: (row) => <Link className="text-blue-600 hover:underline" to={`/finance/invoices/${row.id}`}>{row.invoice_id}</Link> },
          { key: 'client_id', label: 'Client' },
          { key: 'amount', label: 'Amount', render: (row) => fmt(row.amount || 0) },
          { key: 'due_date', label: 'Due date', render: (row) => (row.due_date ? new Date(row.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—') },
          { key: 'status', label: 'Status', render: (row) => <Badge value={row.status} /> },
        ]}
        rows={invoices}
        renderActions={(row) => (
          <Link
            to={`/finance/invoices/${row.id}`}
            className="inline-flex rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700"
          >
            View
          </Link>
        )}
      />
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listInvoices } from '../../api/financeApi';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import Button from '../../components/ui/Button';
import useAuthStore from '../../store/authStore';
import { useCurrency, useOnPrimary } from '../../context/useAppearance';

const getItems = (response) => response?.data ?? response ?? [];

/**
 * `status` comes from the route rather than a query string, so the "All" and
 * "Due" menu entries are distinct paths and highlight independently. It also
 * filters for real now — the old ?status=due link was read by nobody.
 */
export default function InvoicesPage({ status = null }) {
  const isBuyer = ['client', 'realtor'].includes(useAuthStore((state) => state.effectiveType()));
  const fmt = useCurrency();
  const onPrimary = useOnPrimary();
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
          { key: 'invoice_id', label: 'Invoice #', render: (row) => <Link className="font-medium hover:underline" style={{ color: 'var(--primary)' }} to={`/finance/invoices/${row.id}`}>{row.invoice_id}</Link> },
          {
            key: 'client_id',
            label: 'Client',
            // The API resolves the id to a name; the id remains as a fallback.
            render: (row) => row.client_name || `#${row.client_id ?? '—'}`,
          },
          { key: 'amount', label: 'Amount', render: (row) => fmt(row.amount || 0) },
          { key: 'due_date', label: 'Due date', render: (row) => (row.due_date ? new Date(row.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—') },
          { key: 'status', label: 'Status', render: (row) => <Badge value={row.status} /> },
        ]}
        rows={invoices}
        /**
         * Brand-coloured rather than a hardcoded blue.
         *
         * This was `bg-blue-600 … hover:bg-blue-700`, which ignored the
         * tenant's configured primary colour — so on any company that is not
         * blue it was the one control on the page off-palette. The colour is a
         * runtime CSS variable, which is why it goes inline rather than through
         * a Tailwind class, and it matches the Button component's own primary
         * styling.
         */
        renderActions={(row) => (
          <Link
            to={`/finance/invoices/${row.id}`}
            className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{ backgroundColor: 'var(--primary)', color: onPrimary }}
          >
            View
          </Link>
        )}
      />
    </div>
  );
}

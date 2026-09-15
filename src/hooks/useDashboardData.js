import { useEffect, useRef, useState, useCallback } from 'react';
import { listProperties } from '../api/propertyApi';
import { listLeads, listDeals } from '../api/crmApi';
import { listInvoices, listTransactions, listPaymentReminders, revenueReport, topPerformersReport } from '../api/financeApi';
import { listTickets } from '../api/supportApi';
import { listClients, listUsers, listRealtors, listReferralTransactions } from '../api/userApi';
import { getAgentPerformance } from '../api/crmApi';
import { listNotifications } from '../api/notificationApi';
import useDashboardStore from '../store/dashboardStore';

const getRows = (res) => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  return [];
};

const norm = (v) => String(v || '').trim().toLowerCase();

const getDate = (item, keys) => {
  for (const k of keys) {
    if (item?.[k]) return new Date(item[k]);
  }
  return null;
};

const inRange = (date, from, to) => {
  if (!date) return false;
  const t = date.getTime();
  return t >= from.getTime() && t <= to.getTime();
};

// Monthly revenue buckets for the last 12 months (or within range)
/** Monday first, because that is where the business week starts. */
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Midnight on the Monday of whatever week a date falls in.
 *
 * Monday rather than Sunday because that is how the business week is reported
 * almost everywhere outside the US, and because a week that straddles the
 * weekend puts two quiet days in the middle of a bucket rather than splitting
 * them across two.
 */
function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // getDay(): 0 is Sunday, so Sunday is six days into the week, not zero.
  const daysSinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - daysSinceMonday);
  return d;
}

/**
 * This week against last week, day for day.
 *
 * ── Why a comparison rather than a history ──────────────────────────────────
 *
 * A run of weekly totals answers "how have we been doing"; this answers "are we
 * ahead or behind", which is the question somebody opens a dashboard on a
 * Wednesday to ask. Monday sits against Monday and Tuesday against Tuesday, so
 * the comparison holds even though the weeks are different lengths so far — the
 * shape of a week is not flat, and comparing three days of this week against a
 * whole week of last week would say nothing.
 *
 * ── This week stops at today ────────────────────────────────────────────────
 *
 * The days that have not happened are not plotted at all. Carrying the line
 * along the bottom to Sunday would draw a cliff every week, and a cliff is what
 * a collapse in sales looks like — the one reading the chart exists to prevent.
 */
function buildWeekComparison(invoices, creditTxns = []) {
  const thisWeekStart = startOfWeek(new Date());
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  /** How far into the week we are: Monday 0 … Sunday 6. */
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayIndex = Math.round((today - thisWeekStart) / 86400000);

  const days = WEEKDAYS.map((label, index) => ({
    label,
    current: 0,
    previous: 0,
    // Nothing has happened yet on these; the current line stops before them.
    future: index > dayIndex,
    today: index === dayIndex,
  }));

  const addTo = (date, amount) => {
    if (!date) return;
    const at = new Date(date);
    at.setHours(0, 0, 0, 0);
    const offsetThis = Math.round((at - thisWeekStart) / 86400000);
    if (offsetThis >= 0 && offsetThis < 7) {
      days[offsetThis].current += Number(amount) || 0;
      return;
    }
    const offsetLast = Math.round((at - lastWeekStart) / 86400000);
    if (offsetLast >= 0 && offsetLast < 7) {
      days[offsetLast].previous += Number(amount) || 0;
    }
  };

  invoices
    .filter((inv) => norm(inv.status) === 'paid')
    .forEach((inv) => {
      addTo(getDate(inv, ['paid_at', 'payment_date', 'updated_at', 'createdAt', 'created_at']), inv.amount);
    });

  creditTxns.forEach((txn) => {
    addTo(getDate(txn, ['transaction_date', 'date', 'createdAt', 'created_at']), txn.amount);
  });

  /**
   * The totals are compared LIKE FOR LIKE — last week only up to the same day.
   * Against last week's full total, this week is behind until Sunday evening,
   * which would make the figure useless on every day but one.
   */
  const currentToDate = days.filter((d) => !d.future).reduce((sum, d) => sum + d.current, 0);
  const previousToDate = days.filter((d) => !d.future).reduce((sum, d) => sum + d.previous, 0);

  return {
    days,
    currentToDate,
    previousToDate,
    previousFull: days.reduce((sum, d) => sum + d.previous, 0),
    /** Null rather than 0% when there is nothing to compare against. */
    changePct: previousToDate > 0
      ? ((currentToDate - previousToDate) / previousToDate) * 100
      : null,
    throughDay: WEEKDAYS[Math.max(Math.min(dayIndex, 6), 0)],
  };
}


export default function useDashboardData() {
  const getDateRange = useDashboardStore((s) => s.getDateRange);
  const preset = useDashboardStore((s) => s.preset);
  const customStart = useDashboardStore((s) => s.customStart);
  const customEnd = useDashboardStore((s) => s.customEnd);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const abortRef = useRef(null);

  const load = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const { from, to } = getDateRange();

      const safe = async (fn) => {
        try { return getRows(await fn()); } catch { return []; }
      };

      const [
        clientsList,
        propertiesList,
        invoicesList,
        dealsList,
        ticketsList,
        allUsersList,
        realtorsList,
        referralsList,
        leadsList,
        transactionsList,
        remindersList,
        notificationsList,
        revenueReportData,
        agentPerformance,
        topPerformersData,
      ] = await Promise.all([
        safe(() => listClients({ limit: 2000 })),
        safe(() => listProperties({ limit: 2000 })),
        safe(() => listInvoices({ limit: 2000 })),
        safe(() => listDeals({ limit: 2000 })),
        safe(() => listTickets({ limit: 2000 })),
        safe(() => listUsers({ limit: 2000 })),
        safe(() => listRealtors({ limit: 2000 })),
        safe(() => listReferralTransactions({ limit: 2000 })),
        safe(() => listLeads({ limit: 2000 })),
        safe(() => listTransactions({ limit: 2000 })),
        safe(() => listPaymentReminders({ limit: 500 })),
        safe(() => listNotifications({ limit: 100 })),
        revenueReport().catch(() => null),
        // The leaderboard is scoped and totalled server-side; it needs the same
        // window the rest of the dashboard is showing.
        getAgentPerformance({ from: from.toISOString(), to: to.toISOString() }).catch(() => null),
        /**
         * Ranked server-side over the same window as everything else.
         *
         * Swallows its own failure: this is one panel, and a report endpoint
         * being unavailable should cost that panel, not the whole dashboard.
         */
        topPerformersReport({
          start_date: from.toISOString(),
          end_date: to.toISOString(),
          limit: 5,
        }).then((r) => r?.data ?? null).catch(() => null),
      ]);

      if (controller.signal.aborted) return;

      // ── Filter by date range ──────────────────────────────────────────
      const dateKeys = ['createdAt', 'created_at', 'date'];

      const invoicesInRange = invoicesList.filter((i) =>
        inRange(getDate(i, [...dateKeys, 'due_date', 'dueDate']), from, to)
      );
      const dealsInRange = dealsList.filter((d) =>
        inRange(getDate(d, dateKeys), from, to)
      );
      const leadsInRange = leadsList.filter((l) =>
        inRange(getDate(l, dateKeys), from, to)
      );
      const ticketsInRange = ticketsList.filter((t) =>
        inRange(getDate(t, dateKeys), from, to)
      );
      const clientsInRange = clientsList.filter((c) =>
        inRange(getDate(c, dateKeys), from, to)
      );
      const transInRange = transactionsList.filter((t) =>
        inRange(getDate(t, [...dateKeys, 'transaction_date']), from, to)
      );

      // ── KPI Summary ───────────────────────────────────────────────────
      const NON_STAFF_TYPES = ['client', 'realtor'];
      // Staff = every active user who is NOT a client or realtor
      const activeStaff = allUsersList.filter(
        (u) => u.is_active !== false && !NON_STAFF_TYPES.includes(norm(u.type || u.role || ''))
      );
      const activeRealtors = realtorsList.filter((r) => r.is_active !== false);

      // ── Invoice financials ────────────────────────────────────────────
      // Money is derived from the PAYMENTS on each invoice, not from its status
      // column. Status alone cannot express a part payment, and a stale status
      // silently misreports the figure — which is how a fully settled invoice
      // kept appearing as outstanding.
      const completedPayments = (invoice) => (invoice.payments || [])
        .filter((p) => norm(p.status) === 'completed');
      const paidOf = (invoice) => completedPayments(invoice)
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const balanceOf = (invoice) => Math.max(Number(invoice.amount || 0) - paidOf(invoice), 0);

      const allInvoices = invoicesList; // totals always over all invoices
      const liveInvoices = allInvoices.filter((i) => norm(i.status) !== 'cancelled');
      const paidInvoices = allInvoices.filter((i) => norm(i.status) === 'paid');
      const unpaidInvoices = allInvoices.filter((i) => !['paid', 'cancelled'].includes(norm(i.status)));
      const overdueInvoices = allInvoices.filter((i) => norm(i.status) === 'overdue');
      const sentInvoices = allInvoices.filter((i) => ['sent', 'open', 'unpaid', 'pending', 'overdue', 'partial'].includes(norm(i.status)));

      // Invoiced total excludes cancelled invoices — a cancelled invoice was
      // never really billed, so counting it here inflated the denominator
      // against which "collected" and "outstanding" are reconciled.
      const totalInvoiceAmount = liveInvoices.reduce((s, i) => s + Number(i.amount || 0), 0);
      // Actual money received across every invoice, part payments included.
      const invPaidAmount = allInvoices.reduce((s, i) => s + paidOf(i), 0);
      // totalRevenue: authoritative from backend report, fallback to client-side paid+credit sum
      const apiRevenue = revenueReportData?.data?.revenue ?? revenueReportData?.revenue ?? null;
      // Sum of BALANCES, so a part-paid invoice contributes only what is left.
      const totalUnpaid = liveInvoices.reduce((s, i) => s + balanceOf(i), 0);
      const totalDue = overdueInvoices.reduce((s, i) => s + Number(i.amount || 0), 0);
      const totalSent = sentInvoices.reduce((s, i) => s + Number(i.amount || 0), 0);

      const outstanding = totalUnpaid;
      // "Collected" for the reconciliation band is derived, never summed
      // separately, so collected + outstanding === totalInvoiceAmount by
      // construction — it can never drift from the other two figures the
      // way an independently-summed "revenue" (which includes non-invoice
      // credit transactions) could.
      const collected = Math.max(totalInvoiceAmount - outstanding, 0);
      const collectionRateBand = totalInvoiceAmount > 0 ? (collected / totalInvoiceAmount) * 100 : null;

      // ── Aging (for the "N overdue · oldest unpaid" line) ───────────────
      const nowForAging = new Date();
      const unpaidWithBalance = liveInvoices.filter((i) => balanceOf(i) > 0);
      const agingDays = unpaidWithBalance
        .map((i) => {
          const due = getDate(i, ['due_date', 'dueDate']);
          return due ? Math.floor((nowForAging.getTime() - due.getTime()) / 86400000) : null;
        })
        .filter((d) => d !== null);
      const oldestUnpaidDays = agingDays.length ? Math.max(...agingDays) : null;
      const overdueCount = agingDays.filter((d) => d > 0).length;

      // ── Revenue (ranged) ──────────────────────────────────────────────
      // Revenue = paid invoices + credit transactions
      const invDateKeys = ['paid_at', 'payment_date', 'updated_at', 'createdAt', 'created_at'];
      const txnDateKeys = ['transaction_date', 'date', 'createdAt', 'created_at'];
      const creditTxns = transactionsList.filter((t) => norm(t.type) === 'credit');

      // Every completed payment, dated when it was received — an installment
      // counts in the period it landed rather than only when an invoice closes.
      const allPayments = allInvoices.flatMap((i) => completedPayments(i));
      const paymentsBetween = (start, end) => allPayments
        .filter((p) => inRange(getDate(p, invDateKeys), start, end))
        .reduce((s, p) => s + Number(p.amount || 0), 0);

      const paidInvRevInRange = paymentsBetween(from, to);
      const creditTxnRevInRange = creditTxns
        .filter((t) => inRange(getDate(t, txnDateKeys), from, to))
        .reduce((s, t) => s + Number(t.amount || 0), 0);
      const rangedRevenue = paidInvRevInRange + creditTxnRevInRange;

      // MoM Growth: compare ranged revenue to same duration prior period
      const durationMs = to.getTime() - from.getTime();
      const prevFrom = new Date(from.getTime() - durationMs);
      const prevTo = new Date(to.getTime() - durationMs);
      const prevRevenue =
        paymentsBetween(prevFrom, prevTo) +
        creditTxns
          .filter((t) => inRange(getDate(t, txnDateKeys), prevFrom, prevTo))
          .reduce((s, t) => s + Number(t.amount || 0), 0);
      // A prior period of exactly ₦0 makes any percentage change meaningless
      // (division by zero, or a "-100%" that misreads as catastrophic when
      // the business is simply new/quiet). Callers should render these two
      // kinds distinctly from a real percentage move.
      const momGrowthKind = prevRevenue > 0 ? 'pct' : (rangedRevenue > 0 ? 'from-zero' : 'no-baseline');
      const momGrowth = momGrowthKind === 'pct' ? (((rangedRevenue - prevRevenue) / prevRevenue) * 100).toFixed(1) : null;

      // YTD Revenue
      const ytdFrom = new Date(new Date().getFullYear(), 0, 1);
      const ytdRevenue =
        paymentsBetween(ytdFrom, new Date()) +
        creditTxns
          .filter((t) => inRange(getDate(t, txnDateKeys), ytdFrom, new Date()))
          .reduce((s, t) => s + Number(t.amount || 0), 0);

      // Credit transactions add to total paid revenue (Invoice vs Sales card)
      const totalCreditTxn = creditTxns.reduce((s, t) => s + Number(t.amount || 0), 0);

      // totalRevenue = backend report value (most accurate) OR client-side fallback
      const clientSideRevenue = invPaidAmount + totalCreditTxn;
      const totalRevenue = apiRevenue !== null ? Number(apiRevenue) + totalCreditTxn : clientSideRevenue;

      const totalPaid = invPaidAmount + totalCreditTxn;
      // Same figure as collectionRateBand: collected ÷ invoiced, so the
      // percentage shown anywhere on the dashboard always reconciles with
      // "collected" and "outstanding" instead of drifting off a total that
      // includes non-invoice credit transactions.
      const collectionRate = collectionRateBand !== null ? collectionRateBand.toFixed(1) : null;

      // Monthly chart data (last 12 months, includes credit transactions)
      const weekComparison = buildWeekComparison(allInvoices, creditTxns);

      // ── Due payments (top 8 sorted by amount desc) ────────────────────
      const duePayments = allInvoices
        .filter((i) => !['paid', 'cancelled'].includes(norm(i.status)))
        .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
        .slice(0, 8);

      // ── Payment Reminders ─────────────────────────────────────────────
      const now = new Date();
      const reminders = remindersList
        .map((r) => {
          const dueDate = getDate(r, ['due_date', 'dueDate', 'reminder_date']);
          const daysLeft = dueDate ? Math.ceil((dueDate.getTime() - now.getTime()) / 86400000) : null;
          return { ...r, dueDate, daysLeft };
        })
        .sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999))
        .slice(0, 8);

      // ── Lead status distribution ──────────────────────────────────────
      const leadStatusMap = { draft: 0, sent: 0, open: 0, declined: 0 };
      leadsInRange.forEach((l) => {
        const s = norm(l.status || '');
        if (Object.prototype.hasOwnProperty.call(leadStatusMap, s)) leadStatusMap[s]++;
      });
      const activeLeads = leadsInRange.filter((l) => !['lost', 'declined', 'closed won', 'closed_won', 'won'].includes(norm(l.status || ''))).length;
      const convertedLeads = leadsInRange.filter((l) => ['closed won', 'closed_won', 'won'].includes(norm(l.status || ''))).length;
      const conversionRate = leadsInRange.length > 0 ? ((convertedLeads / leadsInRange.length) * 100).toFixed(1) : null;
      // "Qualified" pipeline stage = leads actively being worked ("open"),
      // i.e. past the raw-capture stage but not yet a closed sale.
      const qualifiedLeads = leadStatusMap.open;

      // ── Property status ───────────────────────────────────────────────
      const propStatusMap = { Available: 0, Reserved: 0, Sold: 0, 'Under Construction': 0, Rented: 0 };
      propertiesList.forEach((p) => {
        const s = (p.status || p.availability_status || 'Available');
        const key = Object.keys(propStatusMap).find((k) => norm(k) === norm(s)) || 'Available';
        propStatusMap[key]++;
      });

      // ── Realtor leaderboard ───────────────────────────────────────────
      // Served whole by the API. This used to be joined here from three
      // separate lists (realtors x clients x invoices); any row missing from
      // any one of them silently dropped a realtor's sales to zero, and the
      // "Full Leaderboard" page computed its own different answer. One
      // server-side source keeps the widget and that page agreeing.
      const realtorLeaderboard = (agentPerformance?.data || []).map((a) => ({
        id: a.realtor_id,
        name: a.name,
        avatar: null,
        sold: Number(a.sold || 0),
        revenue: Number(a.revenue || 0),
        referrals: Number(a.referrals || 0),
        // null means "no assigned leads", which is not the same as 0%.
        conversionRate: a.close_rate === null || a.close_rate === undefined
          ? null
          : String(a.close_rate).replace('%', ''),
      })).slice(0, 8);

      // ── Sales ─────────────────────────────────────────────────────────
      // A sale is money actually received against an invoice.
      //
      // This used to count CRM deals with a closed status. Nothing in the
      // purchase or payment flow ever closes a deal — the deals table is
      // empty — so Total Sales and Recent Sales read zero on every dashboard
      // no matter how much had been paid. Counting both sources instead would
      // double-count any sale that has a deal *and* an invoice, so invoices
      // alone are the source of truth here, matching revenue and the realtor
      // leaderboard.
      const clientNameById = {};
      clientsList.forEach((c) => { clientNameById[c.id] = c.name || c.full_name || null; });
      const propertyNameById = {};
      propertiesList.forEach((pr) => { propertyNameById[pr.id] = pr.name || pr.title || null; });

      const salesInRange = allInvoices
        .map((invoice) => {
          const paid = completedPayments(invoice)
            .filter((p) => inRange(getDate(p, invDateKeys), from, to));
          if (!paid.length) return null;
          const received = paid.reduce((sum, p) => sum + Number(p.amount || 0), 0);
          if (received <= 0) return null;
          // Dated by the most recent payment, so a sale settled in instalments
          // sits where the money actually landed.
          const at = paid.reduce((newest, p) => {
            const when = getDate(p, invDateKeys);
            return !newest || (when && when > newest) ? when : newest;
          }, null);
          return {
            id: invoice.id,
            name: propertyNameById[invoice.property_id] || invoice.invoice_id || `Invoice #${invoice.id}`,
            client_name: clientNameById[invoice.client_id] || '—',
            amount: received,
            created_at: at ? at.toISOString() : null,
          };
        })
        .filter(Boolean)
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

      const recentSales = salesInRange.slice(0, 6);

      // ── Recent activities (unified feed) ─────────────────────────────
      const activities = [
        ...clientsInRange.slice(0, 4).map((c) => ({
          type: 'client',
          icon: '👤',
          label: `New client registered: ${c.name || c.full_name || 'Unknown'}`,
          date: getDate(c, dateKeys),
        })),
        ...ticketsInRange.slice(0, 4).map((t) => ({
          type: 'ticket',
          icon: '🎫',
          label: `Support ticket created: ${t.subject || t.title || '#' + t.id}`,
          date: getDate(t, dateKeys),
        })),
        ...transInRange.slice(0, 4).map((t) => ({
          type: 'payment',
          icon: '💳',
          label: `Payment received: ${t.reference || t.description || '#' + t.id}`,
          date: getDate(t, dateKeys),
        })),
        ...recentSales.slice(0, 3).map((d) => ({
          type: 'sale',
          icon: '🏠',
          label: `Sale closed: ${d.title || d.property_name || d.name || '#' + d.id}`,
          date: getDate(d, dateKeys),
        })),
      ]
        .filter((a) => a.date)
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, 10);

      // ── Support stats ─────────────────────────────────────────────────
      const openTickets = ticketsList.filter((t) => !['resolved', 'closed'].includes(norm(t.status)));
      const closedTickets = ticketsList.filter((t) => ['resolved', 'closed'].includes(norm(t.status)));
      const escalatedTickets = ticketsList.filter((t) => norm(t.status) === 'escalated');
      const avgResolutionMs = closedTickets.reduce((sum, t) => {
        const created = getDate(t, ['createdAt', 'created_at']);
        const resolved = getDate(t, ['resolvedAt', 'resolved_at', 'updatedAt', 'updated_at']);
        return sum + (created && resolved ? resolved.getTime() - created.getTime() : 0);
      }, 0);
      const avgResolutionHours = closedTickets.length > 0 ? (avgResolutionMs / closedTickets.length / 3600000).toFixed(1) : 'N/A';

      // ── Unread notifications ──────────────────────────────────────────
      const unreadNotifications = notificationsList.filter((n) => !n.is_read);

      setData({
        // Summary counts
        totalClients: clientsList.length,
        totalProperties: propertiesList.length,
        totalInvoices: allInvoices.length,
        totalSales: salesInRange.length,
        totalStaff: activeStaff.length,
        totalRealtors: activeRealtors.length,
        totalReferrals: referralsList.length,

        // Finance
        totalInvoiceAmount,
        totalSent,
        totalPaid: invPaidAmount + totalCreditTxn, // paid invoices + credit transactions
        totalUnpaid,
        totalDue,
        outstanding,
        collectionRate,
        totalRevenue,  // authoritative all-time revenue (backend report + credit txns)
        rangedRevenue, // date-filtered for Period Revenue panel
        momGrowth,
        momGrowthKind, // 'pct' | 'from-zero' | 'no-baseline' — render each distinctly
        ytdRevenue,
        weekComparison,
        totalCreditTxn,

        // Cash position band — collected + outstanding always reconcile to
        // totalInvoiceAmount because collected is derived, not summed.
        collected,
        oldestUnpaidDays,
        overdueCount,

        // Leads
        activeLeads,
        qualifiedLeads,
        convertedLeads,
        conversionRate,
        leadStatusMap,
        totalLeadsInRange: leadsInRange.length,

        // Rankings, computed server-side — see financeApi.topPerformersReport.
        topPerformers: topPerformersData,

        // Tables & feeds
        duePayments,
        reminders,
        propertyStatusMap: propStatusMap,
        realtorLeaderboard,
        recentSales,
        activities,

        // Tickets
        openTickets: openTickets.length,
        closedTickets: closedTickets.length,
        escalatedTickets: escalatedTickets.length,
        avgResolutionHours,
        totalTickets: ticketsList.length,

        // Notifications
        unreadNotifications,
        unreadCount: unreadNotifications.length,
      });
    } catch (err) {
      if (!controller.signal.aborted) setError(err);
    } finally {
      if (!abortRef.current?.signal.aborted) setLoading(false);
    }
  }, [preset, customStart, customEnd]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}

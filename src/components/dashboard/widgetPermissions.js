/**
 * The permission each dashboard card requires.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 *
 * The menu has been permission-driven for a long time; the dashboard was not.
 * Card visibility came from one place only — `DEFAULT_WIDGETS` in
 * dashboardStore, twelve toggles all defaulting to true, persisted in the
 * viewer's own browser as a personal preference. So an administrator with no
 * finance permissions was shown the Revenue Panel, the Revenue Trend and Top
 * Due Payments, exactly like one who had them.
 *
 * What they saw in those cards was worse than nothing. useDashboardData fetches
 * through `safe(fn)`, which turns any failure into an empty array — so the
 * server's 403 arrived as `[]`, became a sum of zero, and rendered as ₦0. A
 * card reading zero is indistinguishable from a company that genuinely earned
 * nothing, and the reader has no way to tell which one they are looking at.
 *
 * ── The rule ───────────────────────────────────────────────────────────────
 *
 * A card takes the permission of the SCREEN it summarises. If you may not open
 * Invoices, you are not shown a card summarising invoices — the same answer the
 * menu gives, from the same permission, so the two cannot drift.
 *
 * A card with no entry here is open to anyone who can see the dashboard at all,
 * which is a deliberate choice and not an omission: `recentActivities` is a
 * feed assembled from records the viewer has already been permitted to load.
 *
 * Shared by the page, the toggle bar and the export so that one card cannot be
 * hidden in one of them and present in another.
 */
export const WIDGET_PERMISSIONS = {
  // Invoiced, collected and outstanding — finance figures throughout.
  kpiSummary: 'finance.invoices.view',
  financeSummary: 'finance.invoices.view',
  topDuePayments: 'finance.invoices.view',
  revenueChart: 'finance.reports.view',
  paymentReminders: 'finance.payment-reminders.manage',
  // Leads captured, qualified and converted.
  operationalSummary: 'crm.leads.view',
  leadStatus: 'crm.leads.view',
  topPerformers: 'crm.analytics.view',
  propertyStatus: 'properties.view',
  realtorLeaderboard: 'realtors.leaderboard.view',
  supportStats: 'support.view',
};

/**
 * Whether this viewer may see a card.
 *
 * Takes `hasPermission` rather than calling a hook, so the same function serves
 * a component, the toggle bar and the export helper — one of which is not a
 * component at all.
 */
export const canSeeWidget = (key, hasPermission) => {
  const needed = WIDGET_PERMISSIONS[key];
  return needed ? hasPermission(needed) : true;
};

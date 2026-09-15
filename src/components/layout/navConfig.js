/**
 * navConfig.js — shared navigation structure used by all layout templates.
 * Each item carries an optional `permission` field (null = always visible).
 * Items with `superiorAdminOnly: true` are only shown to superior_admin users.
 * Items with `hideForTypes: [...]` are hidden from those user types (e.g. realtors).
 * Items with `showForTypes: [...]` are shown ONLY to those user types.
 * An item with `children: [...]` and no `to` is a sub-menu — a third level under
 * its section (Finance → Invoicing → All Invoices). Only one level of nesting is
 * supported; the visibility fields above apply to the child items.
 * Icons are Lucide React components — rendered as <item.icon className="h-5 w-5" />.
 */
import {
  LayoutDashboard,
  Building2, ClipboardList, Tag, Wrench,
  TrendingUp, ListTree, LayoutList, CreditCard,
  Users, UserCheck, Briefcase, UserCog, ShieldCheck,
  Target, Handshake, CheckSquare, GitBranch, BarChart2, Tags,
  FileText, AlertCircle,
  Receipt, FileMinus, FilePlus, Landmark, CalendarDays, FolderOpen,
  DollarSign, Share2,
  FileEdit, Newspaper, Link2, LineChart,
  GraduationCap, Trophy, Megaphone, Award,
  UserRound, MessageSquare, Calendar, ThumbsUp,
  HelpCircle, Bell,
  Globe, Building, ScrollText,
} from 'lucide-react';

export const SUPERIOR_ADMIN_NAV = [
  {
    section: 'Platform Admin',
    items: [
      { to: '/superior/dashboard', label: 'Platform Dashboard', icon: Globe,    permission: null, superiorAdminOnly: true },
      { to: '/superior/companies', label: 'Companies',          icon: Building, permission: null, superiorAdminOnly: true },
      { to: '/superior/users',     label: 'All Users',          icon: Users,    permission: null, superiorAdminOnly: true },
    ],
  },
];

/**
 * `primary: true` puts a section in ModernLayout's top bar; everything else is
 * folded into "More".
 *
 * Declared on the section rather than listed by name in the layout. It used to
 * be a list of names over there, and two of them — 'CRM' and 'Users' — had been
 * renamed here to 'Leads & Deals' and 'User Management'. Nothing failed: the
 * names simply stopped matching, and those two sections quietly dropped out of
 * the top bar on that one template while every other template still showed
 * them. A flag on the section cannot come adrift from the section's name.
 */
export const NAV = [
  // ── Dashboard ──────────────────────────────────────────────────────────────
  {
    section: null,
    items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard.view' }],
  },

  // ── 2. User Management ────────────────────────────────────────────────────
  {
    section: 'User Management',
    primary: true,
    items: [
      { to: '/users/employees', label: 'Staff',               icon: UserCheck,  permission: 'users.manage' },
      { to: '/users/clients',   label: 'Clients',             icon: Briefcase,  permission: 'users.manage' },
      { to: '/users/realtors',  label: 'Realtors',            icon: UserCog,    permission: 'users.manage' },
      { to: '/realtor/levels',  label: 'Realtor Levels',      icon: Trophy,     permission: 'users.manage' },
      { to: '/users/verifications', label: 'Realtor Verifications', icon: ShieldCheck, permission: 'users.manage', hideForSuperior: true },
      { to: '/roles',           label: 'Roles & Permissions', icon: ShieldCheck, permission: 'roles.view' },
      /**
       * Hidden from anyone without `audit.view`, which is nobody by default
       * except the platform administrator — the permission is granted per role
       * on the Roles screen, deliberately, because who may read who-did-what is
       * an owner's decision rather than a default.
       */
      { to: '/audit-logs',      label: 'Audit Trail',         icon: ScrollText,  permission: 'audit.view' },
      // A realtor's own people live here too. Every item above is gated on
      // users.manage, which realtors lack, so they see only these two.
      { to: '/realtor/referrals', label: 'My Referrals', icon: Share2,     permission: null, showForTypes: ['realtor'] },
      { to: '/realtor/clients',   label: 'My Clients',   icon: UserCheck,  permission: null, showForTypes: ['realtor'] },
    ],
  },

  // ── 3. Property ───────────────────────────────────────────────────────────
  {
    section: 'Property',
    primary: true,
    items: [
      { to: '/properties',             label: 'Property Listing',   icon: Building2,     permission: 'properties.view', hideForTypes: ['realtor', 'client'] },
      { to: '/promotions', label: 'Promotions and Offers', icon: Tag, permission: 'promotions.view' },
      { to: '/properties/types',       label: 'Property Setup',     icon: Wrench,        permission: 'properties.manage' },
      { to: '/properties/listed',      label: 'Listed Properties',  icon: LayoutList,    permission: null, showForTypes: ['realtor', 'client'] },
      { to: '/properties/inspections', label: 'Property Inspection',icon: ClipboardList, permission: 'properties.inspections.view' },
    ],
  },
  // ── 4. Finance ────────────────────────────────────────────────────────────
  // Directly after Property: the two are used together all day — you look at a
  // unit, then at what has been invoiced and paid for it — and everything else
  // is visited far less often.
  //
  // Invoicing and Payments used to be top-level sections of their own. They are
  // sub-menus here so everything money-related hangs off a single Finance entry:
  // Finance → Invoicing → All Invoices.
  {
    section: 'Finance',
    primary: true,
    items: [
      {
        label: 'Invoicing', icon: FileText,
        children: [
          { to: '/finance/invoices',     label: 'All Invoices', icon: FileText,    permission: 'finance.invoices.view' },
          { to: '/finance/invoices/due', label: 'Due Invoice',  icon: AlertCircle, permission: 'finance.invoices.view' },
        ],
      },
      {
        label: 'Payments', icon: CreditCard,
        children: [
          /**
           * Two screens, two different things, and the split is the point.
           *
           * "All Payments" is the settled ledger — every row in it is money
           * that has already moved. "Payment Approvals" is the queue of
           * receipts a buyer has submitted and nobody has decided on yet.
           * They read from different tables and neither can show the other's
           * rows, which is why the first has no Pending tab.
           */
          { to: '/finance/transactions',  label: 'All Payments',      icon: CreditCard, permission: 'finance.invoices.view' },
          /**
           * `badge` names a count in navBadgeStore; the pill is drawn only when
           * that count is above zero. `badgeLabel` completes the sentence a
           * screen reader reads — "3 payments awaiting approval" rather than
           * an unexplained "3".
           */
          {
            to: '/receipts', label: 'Payment Approvals', icon: Receipt,
            permission: 'finance.commissions.view',
            badge: 'pendingApprovals', badgeLabel: 'payments awaiting approval',
          },
          // Lives with the payment settings it configures: these are the accounts
          // buyers are shown for a bank deposit.
          { to: '/finance/bank-accounts', label: 'Bank Accounts',     icon: Landmark,   permission: 'finance.bank-accounts.manage' },
          { to: '/finance/payment-plans', label: 'Payment Plans',     icon: CalendarDays, permission: 'finance.invoices.view' },
          { to: '/finance/installment-plans', label: 'Installment Plans',  icon: CalendarDays, permission: 'finance.installment-plans.view' },
          { to: '/finance/payment-reminders', label: 'Payment Reminders',  icon: Bell,         permission: 'finance.payment-reminders.manage' },
        ],
      },
      {
        label: 'Commission', icon: DollarSign,
        children: [
          /**
           * The ENGINE comes first, because it is the system a company
           * configures and the one that decides what a sale pays.
           *
           * Ordering matters more here than it looks. "Commissions" below is
           * the LEGACY flat-rate payable list, and it used to sit at the top of
           * this menu — where, being the first entry and named almost
           * identically to "Commission Plans", it read as though it were the
           * commission feature. It reads an entirely different table
           * (`commissions`) from the engine (`commission_entitlements`), so a
           * company on the engine sees it permanently empty and concludes the
           * engine is not there.
           */
          { to: '/finance/commission-plans', label: 'Plans', icon: DollarSign, permission: 'finance.commissions.manage' },
          /**
           * Running a payout is what moves money, so it is gated on manage.
           * Reading what the engine has cost is not, which is why analytics
           * takes the view permission — an admin reviewing the bill should not
           * need the permission that changes what it will be.
           */
          { to: '/finance/commission-payouts', label: 'Payouts', icon: DollarSign, permission: 'finance.commissions.manage' },
          { to: '/finance/commission-analytics', label: 'Analytics', icon: DollarSign, permission: 'finance.commissions.view' },
          /**
           * The older flat-rate payables are deliberately NOT in this menu.
           *
           * `/commissions` still exists and still works if linked to directly —
           * it is where the flat-rate payables live, and where
           * `commission_rules` is configured. It is out of the menu because a
           * company running the engine never writes to it, so it reads as a
           * permanently empty screen next to the ones that matter.
           *
           * The consequence to know: a company with NO active plan is still
           * paid the flat way, and its admins now have no menu route to
           * approve or pay those commissions, or to configure the rules that
           * set them. Put this entry back if such a company needs it.
           */
          /**
           * ONE entry for the earner, not two.
           *
           * There used to be "My Commissions" (the flat-rate list) and "My
           * Commission Statement" (the engine's). Exactly one system pays a
           * given sale, so whichever menu item a realtor picked, there was a
           * good chance of landing on the empty one and concluding their
           * commission had gone missing — which is exactly what happened.
           *
           * The statement now carries both, including the request-payment
           * action the flat-rate list had. /commissions/mine still works if
           * linked to directly; it simply is not somewhere the menu sends
           * anybody.
           */
          { to: '/finance/my-commission', label: 'My Commissions', icon: DollarSign, permission: null, showForTypes: ['realtor'] },
        ],
      },
      /**
       * Both carry the SAME badge count, because the queue is one queue.
       *
       * A note waiting for approval is waiting whichever kind it is, and an
       * approver who has to remember to check two screens will eventually check
       * neither. The count is the combined figure; the row you open filters it
       * to its own kind.
       */
      {
        to: '/finance/credit-notes', label: 'Credit Note', icon: FileMinus,
        permission: 'finance.credit-notes.manage',
        badge: 'pendingNotes', badgeLabel: 'notes awaiting approval',
      },
      {
        to: '/finance/debit-notes', label: 'Debit Note', icon: FilePlus,
        permission: 'finance.debit-notes.manage',
        badge: 'pendingNotes', badgeLabel: 'notes awaiting approval',
      },
      { to: '/finance/taxes',             label: 'Taxes',             icon: Tag,          permission: 'finance.taxes.manage' },
      { to: '/finance/reports',           label: 'Report',            icon: FolderOpen,   permission: 'finance.reports.view' },
    ],
  },

  // ── 5. Investments ────────────────────────────────────────────────────────
  {
    section: 'Investments',
    items: [
      { to: '/investments/retention-alerts', label: 'Manage Schedule', icon: Calendar,     permission: 'investments.view' },
      // Was two entries on the same route ("Manage Plans" / "All Investments"),
      // both landing on the page's Plans tab. Plans and Investments are tabs there.
      { to: '/investments',                  label: 'Investments',     icon: ListTree,     permission: 'investments.view' },
    ],
  },

  // ── 6. Leads & Deals ──────────────────────────────────────────────────────
  {
    section: 'Leads & Deals',
    primary: true,
    items: [
      { to: '/crm/leads',           label: 'Manage Leads',      icon: Target,     permission: 'crm.leads.view' },
      { to: '/crm/deals',           label: 'Manage Deals',      icon: Handshake,  permission: 'crm.deals.view' },
      { to: '/crm/tasks',           label: 'Tasks',             icon: CheckSquare, permission: 'crm.tasks.view' },
      { to: '/crm/pipelines',       label: 'Pipeline',          icon: GitBranch,  permission: 'crm.pipelines.manage' },
      { to: '/crm/sources-labels',  label: 'Sources & Labels',  icon: Tags,       permission: 'crm.leads.view' },
      { to: '/crm/analytics',       label: 'Analytics/Reports', icon: BarChart2,  permission: 'crm.analytics.view' },
      // Reachable only by clicking through the dashboard widget until now.
      { to: '/crm/agent-performance', label: 'Realtor Leaderboard', icon: Award,    permission: 'crm.analytics.view' },
    ],
  },

  // ── 7. Media ──────────────────────────────────────────────────────────────
  {
    section: 'Media',
    primary: true,
    items: [
      { to: '/media/posts',           label: 'Content Posts',        icon: FileEdit,  permission: 'media.view' },
      { to: '/media/blog',            label: 'Blog',                 icon: Newspaper, permission: 'media.blog.manage' },
      { to: '/media/social-accounts', label: 'Social Media Accounts',icon: Link2,     permission: 'media.schedule' },
      { to: '/media/analytics',       label: 'Analytics',            icon: LineChart, permission: 'media.analytics.view' },
    ],
  },
  
  // ── 9. Realtor Hub ───────────────────────────────────────────────────────
  {
    section: 'Realtor Hub',
    items: [
      { to: '/realtor/training',    label: 'Training & LMS', icon: GraduationCap, permission: 'realtors.training.view' },
      { to: '/realtor/leaderboard', label: 'Leadership',     icon: Trophy,        permission: 'realtors.leaderboard.view' },
      { to: '/realtor/recruitment', label: 'Recruitment',    icon: Megaphone,     permission: 'realtors.recruitment.view' },
      // Scoped server-side to the holder's own investments.
      { to: '/investments/portfolio', label: 'Investments',   icon: TrendingUp,    permission: 'investments.own.view', showForTypes: ['realtor'] },
    ],
  },

  // ── Client portfolio ──────────────────────────────────────────────────────
  {
    section: 'My Portfolio',
    items: [
      // Browse plans, subscribe, and track returns. Own-scoped server-side.
      { to: '/investments/portfolio', label: 'Investments', icon: TrendingUp, permission: 'investments.own.view', showForTypes: ['client'] },
      // Separate paths, not ?status= variants on one path: NavLink matches on
      // pathname, so sibling query-string links would all highlight together.
      // All / Due / Pending are tabs inside the invoices page.
      // First in the client's group: the property is what they think they own;
      // the invoice is how it was billed.
      { to: '/finance/my-properties', label: 'My Properties', icon: Building2, permission: null, showForTypes: ['client'] },
      { to: '/finance/my-invoices',   label: 'My Invoices', icon: FileText,   permission: null, showForTypes: ['client'] },
      { to: '/finance/my-payments',   label: 'My Payments', icon: CreditCard, permission: null, showForTypes: ['client'] },
    ],
  },

  // ── 10. Front Desk ────────────────────────────────────────────────────────
  {
    section: 'Front Desk',
    items: [
      { to: '/front-desk', label: 'Visitor Log & Attendance', icon: UserRound, permission: 'frontdesk.visitors.manage' },
    ],
  },

  // ── 11. Customer Care ─────────────────────────────────────────────────────
  {
    section: 'Customer Care',
    items: [
      // These previously all pointed at /care and landed on the same VIP tab.
      // Each now goes to the section it names; "Feedback/Report" is gone
      // because no such view exists — it was a mislabelled link to VIP Clients.
      { to: '/support',              label: 'Support Centre',    icon: HelpCircle,    permission: 'support.view' },
      { to: '/care',                 label: 'VIP Clients',       icon: ThumbsUp,      permission: 'care.view' },
      { to: '/care/communications',  label: 'Messaging',         icon: MessageSquare, permission: 'care.view' },
      { to: '/care/alerts',          label: 'Scheduled Alerts',  icon: Calendar,      permission: 'care.view' },
    ],
  },

  // ── 12. General ───────────────────────────────────────────────────────────
  {
    section: 'General',
    items: [
      { to: '/notifications', label: 'Notification',  icon: Bell,       permission: 'notifications.view' },
      // System-wide, not finance-specific: it configures every notifiable
      // event across every module, which is why it sits here rather than under
      // Finance where the purchase-journey version of it started.
      { to: '/settings/notifications', label: 'Notification Settings', icon: Bell, permission: 'finance.purchase-notifications.manage' },
    ],
  },

];

/**
 * Single visibility rule for a nav item, shared by every layout so the four
 * templates cannot drift apart.
 */
export const isNavItemVisible = (item, ctx) => {
  const { hasPermission, isSuperiorAdmin = false, userType = null } = ctx;
  if (item.superiorAdminOnly && !isSuperiorAdmin) return false;
  if (item.hideForSuperior && isSuperiorAdmin) return false;
  if (userType && item.hideForTypes?.includes(userType)) return false;
  if (item.showForTypes && !item.showForTypes.includes(userType)) return false;
  // A sub-menu is worth showing only if something inside it is.
  if (item.children) return item.children.some((child) => isNavItemVisible(child, ctx));
  return hasPermission(item.permission);
};

/**
 * Filter one section's items for the current user: prunes hidden entries out of
 * sub-menus and drops sub-menus left with no children. Use this instead of
 * filtering with isNavItemVisible directly, so nested items are handled.
 */
export const filterNavItems = (items, ctx) =>
  items.flatMap((item) => {
    if (!item.children) return isNavItemVisible(item, ctx) ? [item] : [];
    const children = item.children.filter((child) => isNavItemVisible(child, ctx));
    return children.length ? [{ ...item, children }] : [];
  });

/**
 * Collapse sub-menus into a single flat list of links, for the layouts that
 * render nav as one flat column (MinimalLayout's icon rail).
 */
export const flattenNavItems = (items) =>
  items.flatMap((item) => (item.children ? item.children : [item]));

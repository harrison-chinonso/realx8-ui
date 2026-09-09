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
  Globe, Building,
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

export const NAV = [
  // ── Dashboard ──────────────────────────────────────────────────────────────
  {
    section: null,
    items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard.view' }],
  },

  // ── 2. User Management ────────────────────────────────────────────────────
  {
    section: 'User Management',
    items: [
      { to: '/users/employees', label: 'Staff',               icon: UserCheck,  permission: 'users.manage' },
      { to: '/users/clients',   label: 'Clients',             icon: Briefcase,  permission: 'users.manage' },
      { to: '/users/realtors',  label: 'Realtors',            icon: UserCog,    permission: 'users.manage' },
      { to: '/realtor/levels',  label: 'Realtor Levels',      icon: Trophy,     permission: 'users.manage' },
      { to: '/users/verifications', label: 'Realtor Verifications', icon: ShieldCheck, permission: 'users.manage', hideForSuperior: true },
      { to: '/roles',           label: 'Roles & Permissions', icon: ShieldCheck, permission: 'roles.view' },
      // A realtor's own people live here too. Every item above is gated on
      // users.manage, which realtors lack, so they see only these two.
      { to: '/realtor/referrals', label: 'My Referrals', icon: Share2,     permission: null, showForTypes: ['realtor'] },
      { to: '/realtor/clients',   label: 'My Clients',   icon: UserCheck,  permission: null, showForTypes: ['realtor'] },
    ],
  },

  // ── 3. Property ───────────────────────────────────────────────────────────
  {
    section: 'Property',
    items: [
      { to: '/properties',             label: 'Property Listing',   icon: Building2,     permission: 'properties.view', hideForTypes: ['realtor', 'client'] },
      { to: '/properties/types',       label: 'Property Setup',     icon: Wrench,        permission: 'properties.manage' },
      { to: '/properties/listed',      label: 'Listed Properties',  icon: LayoutList,    permission: null, showForTypes: ['realtor', 'client'] },
      { to: '/properties/inspections', label: 'Property Inspection',icon: ClipboardList, permission: 'properties.inspections.view' },
    ],
  },

  // ── 4. Investments ────────────────────────────────────────────────────────
  {
    section: 'Investments',
    items: [
      { to: '/investments/retention-alerts', label: 'Manage Schedule', icon: Calendar,     permission: 'investments.view' },
      // Was two entries on the same route ("Manage Plans" / "All Investments"),
      // both landing on the page's Plans tab. Plans and Investments are tabs there.
      { to: '/investments',                  label: 'Investments',     icon: ListTree,     permission: 'investments.view' },
    ],
  },

  // ── 5. Leads & Deals ──────────────────────────────────────────────────────
  {
    section: 'Leads & Deals',
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

  // ── 6. Finance ────────────────────────────────────────────────────────────
  // Invoicing and Payments used to be top-level sections of their own. They are
  // sub-menus here so everything money-related hangs off a single Finance entry:
  // Finance → Invoicing → All Invoices.
  {
    section: 'Finance',
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
          // One entry — Pending and Completed are tabs on this page. Two entries
          // pointed at the same route and highlighted together.
          { to: '/finance/transactions',  label: 'All Payments',      icon: CreditCard, permission: 'finance.invoices.view' },
          { to: '/receipts',              label: 'Payment Approvals', icon: Receipt,    permission: 'finance.commissions.view' },
          // Lives with the payment settings it configures: these are the accounts
          // buyers are shown for a bank deposit.
          { to: '/finance/bank-accounts', label: 'Bank Accounts',     icon: Landmark,   permission: 'finance.bank-accounts.manage' },
        ],
      },
      { to: '/finance/credit-notes',      label: 'Credit Note',       icon: FileMinus,    permission: 'finance.credit-notes.manage' },
      { to: '/finance/debit-notes',       label: 'Debit Note',        icon: FilePlus,     permission: 'finance.debit-notes.manage' },
      { to: '/finance/payment-reminders', label: 'Payment Reminder',  icon: Bell,         permission: 'finance.payment-reminders.manage' },
      { to: '/finance/taxes',             label: 'Taxes',             icon: Tag,          permission: 'finance.taxes.manage' },
      { to: '/finance/payment-plans',     label: 'Payment Plans',     icon: CalendarDays, permission: 'finance.invoices.view' },
      { to: '/finance/reports',           label: 'Report',            icon: FolderOpen,   permission: 'finance.reports.view' },
    ],
  },

  // ── 7. Media ──────────────────────────────────────────────────────────────
  {
    section: 'Media',
    items: [
      { to: '/media/posts',           label: 'Content Posts',        icon: FileEdit,  permission: 'media.view' },
      { to: '/media/blog',            label: 'Blog',                 icon: Newspaper, permission: 'media.blog.manage' },
      { to: '/media/social-accounts', label: 'Social Media Accounts',icon: Link2,     permission: 'media.schedule' },
      { to: '/media/analytics',       label: 'Analytics',            icon: LineChart, permission: 'media.analytics.view' },
    ],
  },

  // ── 8. Referral System ───────────────────────────────────────────────────
  {
    section: 'Referral System',
    items: [
      { to: '/commissions',  label: 'Commissions',      icon: DollarSign, permission: 'finance.commissions.view' },
      { to: '/referral',     label: 'Referral Program', icon: Share2,     permission: 'finance.commissions.manage' },
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

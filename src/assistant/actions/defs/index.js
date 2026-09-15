import { EXTRACTORS } from '../slots/extract.js';

/**
 * The things the assistant can DO, as opposed to explain.
 *
 * ── read runs; write only pre-fills ─────────────────────────────────────────
 *
 * This is not documentation, it decides behaviour. A `read` action navigates
 * and the screen shows the filtered result — exactly what was asked for, and
 * undone by clearing a filter. A `write` action fills a form in and STOPS,
 * leaving a person to review and submit.
 *
 * The asymmetry is the reason. A mis-parsed date shows the wrong week and gets
 * re-asked. A mis-parsed email creates a real user somebody has to find and
 * delete, or worse, emails a stranger.
 *
 * ── The hand-off is a URL ───────────────────────────────────────────────────
 *
 * Not shared state. A URL is inspectable when something goes wrong, survives a
 * refresh, can be tested without driving the chat panel at all, and matches the
 * `?tab=` convention these screens already use.
 */

const money = (minor) => `₦${(Number(minor || 0) / 100).toLocaleString()}`;

export const actions = [
  {
    id: 'create-user',
    title: 'Add a staff member',
    summary: 'Collects their details and opens the staff form with them filled in.',
    route: '/users/employees',
    trail: 'User Management → Staff',
    permissions: ['users.manage'],
    kind: 'write',
    keywords: [
      'create a user', 'add a user', 'register a user', 'new staff member',
      'onboard someone', 'give someone a login', 'add an employee',
      'create an account for', 'set up a user',
    ],
    slots: [
      {
        name: 'name', type: 'personName', required: true,
        prompt: 'What is their full name?',
        invalid: 'I did not catch a name there — what are their first and last names?',
      },
      {
        name: 'email', type: 'email', required: true,
        prompt: 'What is their email address?',
        invalid: 'That does not look like an email address. What should I use?',
      },
      { name: 'phone', type: 'phone', required: false, prompt: 'And their phone number? (or say skip)' },
    ],
    href: (values) => {
      const params = new URLSearchParams({ assist: 'create-user', name: values.name, email: values.email });
      if (values.phone) params.set('phone', values.phone);
      return `/users/employees?${params}`;
    },
    describe: (values) => ({
      summary: `Opening the staff form for ${values.name}.`,
      filled: [
        { label: 'Name', value: values.name },
        { label: 'Email', value: values.email },
        ...(values.phone ? [{ label: 'Phone', value: values.phone }] : []),
      ],
      /*
       * Role is deliberately not a slot. It is a permission grant — an
       * Administrator can approve money — and having a chat bot infer one from
       * "make him an admin" is the wrong place to be clever.
       */
      remaining: ['Choose their role', 'Review and save'],
    }),
  },

  {
    id: 'create-property',
    title: 'Add a property',
    summary: 'Opens the new property form, with the name filled in if you gave one.',
    route: '/properties/create',
    trail: 'Property → Property Listing',
    permissions: ['properties.create'],
    kind: 'write',
    keywords: [
      'create a property', 'add a property', 'list a property', 'new development',
      'new estate', 'add a house', 'put a property up', 'new listing',
    ],
    slots: [
      { name: 'name', type: 'givenName', required: false, prompt: 'What is the property called?' },
    ],
    href: (values) => {
      const params = new URLSearchParams({ assist: 'create-property' });
      if (values.name) params.set('name', values.name);
      return `/properties/create?${params}`;
    },
    describe: (values) => ({
      summary: values.name
        ? `Opening the new property form for “${values.name}”.`
        : 'Opening the new property form.',
      filled: values.name ? [{ label: 'Name', value: values.name }] : [],
      remaining: [
        'Add the location, description and photos',
        'Add each unit type with its price and how many are available',
        'Save, then have it approved',
      ],
    }),
  },

  {
    id: 'export-report',
    title: 'Export a report',
    summary: 'Opens the report for a date range, ready to download.',
    route: '/finance/reports',
    trail: 'Finance → Report',
    permissions: ['finance.reports.view'],
    kind: 'read',
    keywords: [
      'export a report', 'download a report', 'export to csv', 'export to excel',
      'get the data out', 'download invoices', 'export payments', 'export transactions',
      'spreadsheet of', 'pull a report',
    ],
    slots: [
      {
        name: 'range', type: 'dateRange', required: false,
        prompt: 'Which period? (for example “last month”, or say all time)',
      },
      {
        name: 'tab', type: 'oneOf', required: false,
        // The three tabs the report page actually has.
        options: [
          { value: 'invoices', match: ['invoices', 'invoice', 'billing'] },
          { value: 'transactions', match: ['transactions', 'transaction', 'payments', 'payment', 'ledger'] },
          { value: 'commissions', match: ['commissions', 'commission', 'payouts'] },
        ],
      },
    ],
    href: (values) => {
      const params = new URLSearchParams({ assist: 'export-report' });
      if (values.range?.from) { params.set('from', values.range.from); params.set('to', values.range.to); }
      if (values.tab) params.set('tab', values.tab);
      return `/finance/reports?${params}`;
    },
    describe: (values) => ({
      summary: values.range
        ? `Opening the report for ${values.range.label}.`
        : 'Opening the report.',
      filled: values.range
        ? [{ label: 'Period', value: `${values.range.from} to ${values.range.to}` }]
        : [],
      remaining: ['Choose the tab you want', 'Use CSV, Excel or PDF above the table'],
    }),
  },

  {
    id: 'find-payments-to-approve',
    title: 'Show payments waiting for approval',
    summary: 'Opens the approvals queue on the tab that needs you.',
    route: '/receipts',
    trail: 'Finance → Payments → Payment Approvals',
    permissions: ['finance.commissions.view'],
    kind: 'read',
    keywords: [
      'payments waiting', 'what needs approving', 'pending payments',
      'payments to approve', 'approval queue', 'anything waiting for me',
      'unapproved payments', 'receipts to check',
    ],
    slots: [],
    href: () => '/receipts?assist=find-payments-to-approve&tab=pending',
    describe: () => ({
      summary: 'Opening the payments waiting for approval.',
      remaining: ['Open a row to see the buyer’s proof', 'Approve it, or refuse it with a reason'],
    }),
  },

  {
    id: 'find-unpaid-invoices',
    title: 'Show unpaid invoices',
    summary: 'Opens the invoice list filtered to what is still owed.',
    route: '/finance/invoices',
    trail: 'Finance → Invoicing → All Invoices',
    permissions: ['finance.invoices.view'],
    kind: 'read',
    keywords: [
      'unpaid invoices', 'who owes us', 'outstanding invoices', 'overdue',
      'what is owed', 'money owed to us', 'debtors', 'not yet paid',
    ],
    slots: [],
    /*
     * The Due Invoices ROUTE, not a query string.
     *
     * This pointed at /finance/invoices?status=unpaid&sort=oldest, which the
     * page does not read — it takes its status as a route prop — so the link
     * quietly landed on the unfiltered list and the assistant appeared to have
     * done nothing. /finance/invoices/due is the filter that actually exists.
     */
    href: () => '/finance/invoices/due',
    describe: () => ({
      summary: 'Opening the invoices that are still owed, oldest first.',
    }),
  },

  {
    id: 'create-promotion',
    title: 'Set up a promotion',
    summary: 'Opens the promotion wizard.',
    route: '/promotions',
    trail: 'Property → Promotions',
    permissions: ['promotions.manage'],
    kind: 'write',
    keywords: [
      'create a promotion', 'set up a discount', 'run an offer', 'start a campaign',
      'percent off', 'new promotion', 'discount campaign',
    ],
    slots: [
      { name: 'name', type: 'givenName', required: false, prompt: 'What should the promotion be called?' },
    ],
    href: (values) => {
      const params = new URLSearchParams({ assist: 'create-promotion' });
      if (values.name) params.set('name', values.name);
      return `/promotions?${params}`;
    },
    describe: (values) => ({
      summary: 'Opening the promotion wizard.',
      filled: values.name ? [{ label: 'Name', value: values.name }] : [],
      remaining: [
        'Choose the property and units it covers',
        'Set what qualifies and what it gives',
        'Check the preview, then publish',
      ],
    }),
  },

  {
    id: 'build-payout-run',
    title: 'Pay realtors their commission',
    summary: 'Opens commission payouts, where a run is built.',
    route: '/finance/commission-payouts',
    trail: 'Finance → Commission → Commission Payouts',
    permissions: ['finance.commissions.manage'],
    kind: 'read',
    keywords: [
      'pay commission', 'payout run', 'pay realtors', 'commission payout',
      'settle commissions', 'who is owed commission',
    ],
    slots: [],
    href: () => '/finance/commission-payouts?assist=build-payout-run',
    describe: () => ({
      summary: 'Opening commission payouts.',
      remaining: [
        'Build payout run — this creates drafts and moves no money',
        'Approve a draft, then raise the debit note that pays it',
      ],
    }),
  },
];

export { EXTRACTORS, money };

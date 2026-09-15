/**
 * Walkthroughs for the money side of the platform.
 *
 * Every `route` here is checked against the generated app map by the integrity
 * test, so a screen that moves breaks the build rather than sending somebody to
 * a page that no longer exists.
 */

export const financeRecipes = [
  {
    id: 'raise-invoice',
    title: 'Raise an invoice for a client',
    summary: 'Bill a client for a property or unit, outright or on an instalment plan.',
    category: 'Finance',
    route: '/finance/invoices',
    trail: 'Finance → Invoicing → All Invoices',
    permissions: ['finance.invoices.create'],
    keywords: [
      'raise an invoice', 'create an invoice', 'bill a client', 'send a bill',
      'invoice someone', 'charge a client', 'new invoice', 'make an invoice',
    ],
    steps: [
      { text: 'Open **Finance → Invoicing → All Invoices**.' },
      { text: 'Choose **Create invoice**.' },
      { text: 'Pick the client, then the property and unit being bought.' },
      {
        text: 'Choose outright or an instalment plan.',
        note: 'Only plans assigned to that unit are offered — if the one you want is missing, assign it under Installment Plans first.',
      },
      { text: 'Save. The invoice is raised and the client can see it under My Invoices.' },
    ],
    related: ['approve-payment', 'instalment-plan'],
  },
  {
    id: 'approve-payment',
    title: 'Approve a payment a client submitted',
    summary: 'Review the proof a buyer uploaded and credit it against their invoice.',
    category: 'Finance',
    route: '/receipts',
    trail: 'Finance → Payments → Payment Approvals',
    permissions: ['finance.commissions.view'],
    keywords: [
      'approve a payment', 'verify a payment', 'confirm a payment', 'payment approval',
      'check a receipt', 'a client paid', 'someone sent proof of payment', 'credit a payment',
      'reject a payment',
    ],
    steps: [
      { text: 'Open **Finance → Payments → Payment Approvals**.' },
      { text: 'The **Awaiting approval** tab is what needs you; open a row to see the buyer’s proof.' },
      {
        text: 'Approve it, attaching your own receipt if your company requires one.',
        note: 'Whether a company receipt is required is a setting under Settings → Payment Gateways.',
      },
      {
        text: 'Or refuse it with a reason.',
        note: 'The buyer is shown the reason, and can correct and resubmit.',
      },
      { text: 'Approving allocates the money against the invoice’s schedule automatically.' },
    ],
    related: ['raise-invoice', 'overpayment'],
  },
  {
    id: 'overpayment',
    title: 'Deal with a client who overpaid',
    summary: 'The surplus becomes a debit note that goes for approval before it is refunded.',
    category: 'Finance',
    route: '/finance/debit-notes',
    trail: 'Finance → Debit Note',
    permissions: ['finance.debit-notes.manage'],
    keywords: [
      'client overpaid', 'overpayment', 'paid too much', 'refund a client',
      'credit balance', 'extra money', 'surplus payment',
    ],
    steps: [
      {
        text: 'Nothing to do at the moment of payment — the surplus raises a debit note on its own.',
        note: 'It is created as Waiting for approval, against the buyer, for exactly the amount over.',
      },
      { text: 'Open **Finance → Debit Note** to find it on the **Waiting for approval** tab.' },
      { text: 'Approve it to refund the buyer, or refuse it with a reason to leave the money on their plan for the next instalment.' },
      { text: 'Once approved, **Mark as paid** when the money actually goes out — that is what records it in the ledger.' },
    ],
    related: ['approve-payment', 'credit-note'],
  },
  {
    id: 'credit-note',
    title: 'Raise a credit note',
    summary: 'Write off part of what somebody owes. It goes for approval before it can be used.',
    category: 'Finance',
    route: '/finance/credit-notes',
    trail: 'Finance → Credit Note',
    permissions: ['finance.credit-notes.manage'],
    keywords: [
      'credit note', 'write off', 'reduce what a client owes', 'cancel a charge',
      'goodwill adjustment', 'discount an invoice after the fact',
    ],
    steps: [
      { text: 'Open **Finance → Credit Note** and choose **+ New Credit Note**.' },
      { text: 'Pick who it is for, the amount, and say why.' },
      {
        text: 'Save. It is raised as **Waiting for approval** — you cannot set its status yourself.',
        note: 'Approving needs the Approve Credit & Debit Notes permission, which is deliberately separate from raising one.',
      },
      { text: 'Once somebody approves it, **Mark as used** applies it against what the party owes.' },
    ],
    related: ['overpayment'],
  },
  {
    id: 'payment-reminders',
    title: 'Change when clients are reminded about payments',
    summary: 'Set the days before and after a due date that reminders go out.',
    category: 'Finance',
    route: '/finance/payment-reminders',
    trail: 'Finance → Payments → Payment Reminders',
    permissions: ['finance.payment-reminders.manage'],
    keywords: [
      'payment reminders', 'chase clients', 'remind about payment', 'due date reminder',
      'stop reminders', 'reminder schedule', 'nag clients',
      'stop chasing clients', 'stop chasing my clients', 'too many reminders',
      'clients complaining about reminders', 'turn off reminders',
    ],
    steps: [
      { text: 'Open **Finance → Payments → Payment Reminders**.' },
      {
        text: 'The panel at the top is the schedule — a week before, two days before, on the day, and two days late.',
        note: 'Until you save once you are looking at the platform default; saving gives your company its own copy.',
      },
      { text: 'Add or remove reminders, then **Save reminders**.' },
      {
        text: 'For particular invoices, use **Different reminders for particular invoices**.',
        note: 'A reminder is only ever sent if that instalment is still unpaid.',
      },
    ],
  },
  {
    id: 'export-report',
    /*
     * An ACTION shares this id and does more: it reads the period (and the
     * tab, for exports) out of what was said and opens the screen with them
     * applied. Without this link the two compete on keyword overlap, the prose
     * wins, and the action is unreachable — which is exactly what happened to
     * "export the invoices report for last month": it produced a plain link to
     * Reports and quietly dropped the month.
     */
    fulfilledBy: 'export-report',
    title: 'Export a report',
    summary: 'Download invoices, payments or commission as CSV, Excel or PDF.',
    category: 'Finance',
    route: '/finance/reports',
    trail: 'Finance → Report',
    permissions: ['finance.reports.view'],
    keywords: [
      'export a report', 'download a report', 'csv', 'excel', 'spreadsheet',
      'export invoices', 'export payments', 'export transactions', 'get the data out',
      'print a report', 'pdf report',
    ],
    steps: [
      { text: 'Open **Finance → Report**.' },
      { text: 'Set the date range and any status filter, then **Apply Filter**.' },
      { text: 'Choose the tab you want — Invoices, Transactions or Commissions.' },
      {
        text: 'Use **CSV**, **Excel** or **PDF** above the table.',
        note: 'The export takes the whole filtered set, not just the rows on screen.',
      },
    ],
  },
];

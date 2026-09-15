/**
 * Walkthroughs for the people who are not staff.
 *
 * ── Why these had to be written ─────────────────────────────────────────────
 *
 * Every recipe here began life describing a staff screen, because that is who
 * the knowledge base was written for. Once the assistant started confirming
 * permission before explaining anything, that became visible as a hole rather
 * than a bias: a buyer asking "how do I pay my invoice" matched the staff
 * walkthrough for RAISING one, could not be shown it, and got a refusal — for
 * a question about their own invoice, on a screen built for them.
 *
 * Refusing is only the right answer when there is nothing the person may be
 * told. These are the things they may be told.
 *
 * Their routes carry `showForTypes: ['client']` or `['realtor']` in navConfig,
 * so the gate admits exactly the audience the menu does.
 */

export const buyerRecipes = [
  {
    id: 'pay-invoice',
    title: 'Pay an invoice',
    summary: 'Pay what you have been billed, and send proof so it can be applied to your account.',
    category: 'My account',
    route: '/finance/my-invoices',
    trail: 'Finance → My Invoices',
    keywords: [
      'pay my invoice', 'how do i pay', 'make a payment', 'pay what i owe',
      'settle my invoice', 'i want to pay', 'payment methods', 'how to pay',
      'bank details to pay', 'where do i pay', 'abeg i wan pay',
    ],
    steps: [
      { text: 'Open **My Invoices**, or press **Pay Now** on your dashboard.' },
      { text: 'Choose the invoice you want to pay. The outstanding balance is shown at the top.' },
      {
        text: 'Pick how you are paying — a bank transfer, or online if your company has it switched on.',
        note: 'For a transfer, the account details to pay into are shown on that screen.',
      },
      {
        text: 'Upload your proof of payment and enter the amount you actually paid.',
        note: 'The amount can be less than the balance — a part payment is fine, and the rest stays outstanding.',
      },
      {
        text: 'Submit. It appears straight away under **My Payments** as awaiting approval.',
        note: 'It counts toward your invoice once somebody has checked it, not before.',
      },
    ],
    related: ['my-payments', 'payment-rejected'],
  },

  {
    id: 'my-payments',
    title: 'See the payments you have submitted',
    summary: 'What you have sent in, what has been approved, and what is still being checked.',
    category: 'My account',
    route: '/finance/my-payments',
    trail: 'Finance → My Payments',
    keywords: [
      'my payments', 'payments i made', 'did my payment go through', 'payment status',
      'has my payment been approved', 'proof i sent', 'payment history', 'receipts',
      'what have i paid', 'is my payment received',
    ],
    steps: [
      { text: 'Open **My Payments**.' },
      {
        text: 'Anything still needing attention is at the top, under **Awaiting your attention**.',
        note: 'A payment sits there while it is being checked, or if it was sent back to you.',
      },
      { text: 'The table below is your settled history — everything already applied to an invoice.' },
      {
        text: 'A payment you have not yet had approved can be corrected, or cancelled outright.',
        note: 'Cancelling does not count against you; you can submit a new one straight afterwards.',
      },
    ],
    related: ['pay-invoice', 'payment-rejected'],
  },

  {
    id: 'payment-rejected',
    title: 'A payment was sent back to you',
    summary: 'What to do when a payment you submitted was not accepted.',
    category: 'My account',
    route: '/finance/my-payments',
    trail: 'Finance → My Payments',
    keywords: [
      'payment rejected', 'payment declined', 'payment sent back', 'why was my payment rejected',
      'payment not accepted', 'they refused my payment', 'resubmit payment', 'payment failed',
    ],
    steps: [
      { text: 'Open **My Payments** — it will be at the top, under **Awaiting your attention**.' },
      {
        text: 'Read the reason given. It is written on the payment itself.',
        note: 'Usually the proof was unreadable, or the amount did not match what arrived.',
      },
      { text: 'Correct it and submit again, or cancel it and start a fresh payment.' },
      { text: 'If the reason does not make sense, raise it on the **Support** page and somebody will look.' },
    ],
    related: ['my-payments', 'pay-invoice'],
  },

  {
    id: 'my-properties',
    title: 'See the properties you have bought',
    summary: 'What you own or are paying towards, and where each one stands.',
    category: 'My account',
    route: '/finance/my-properties',
    trail: 'Finance → My Properties',
    keywords: [
      'my properties', 'what have i bought', 'my plots', 'my units', 'my purchase',
      'property i am paying for', 'my land', 'how much is left on my property',
    ],
    steps: [
      { text: 'Open **My Properties**.' },
      { text: 'Each one shows what you bought, what has been paid, and what is still outstanding.' },
      { text: 'Open a property to see its invoices and the payments applied to it.' },
    ],
    related: ['pay-invoice', 'my-payments'],
  },

  {
    id: 'realtor-commissions',
    title: 'See what you have earned',
    summary: 'Your commission statement — earned, approved, and paid.',
    category: 'My account',
    route: '/finance/my-commission',
    trail: 'Finance → My Commissions',
    keywords: [
      'my commission', 'what have i earned', 'my earnings', 'commission statement',
      'how much commission', 'have i been paid', 'my payout', 'when do i get paid',
    ],
    steps: [
      { text: 'Open **My Commissions**.' },
      {
        text: 'Each sale you are due on is listed with its stage.',
        note: 'An amount stays hidden until the commission has been approved — until then the figure could still change.',
      },
      { text: 'Select the approved ones you want paid and request a payout.' },
      { text: 'A requested payout is picked up in the next payout run.' },
    ],
    related: ['realtor-referral'],
  },
];

export default buyerRecipes;

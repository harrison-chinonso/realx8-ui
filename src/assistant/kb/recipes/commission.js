/** Walkthroughs for what realtors earn and how it reaches them. */

export const commissionRecipes = [
  {
    id: 'commission-plan',
    title: 'Set up a commission plan',
    summary: 'Decide what a sale pays, and to whom, then assign it to a property or unit.',
    category: 'Commission',
    route: '/finance/commission-plans',
    trail: 'Finance → Commission → Commission Plans',
    permissions: ['finance.commissions.view'],
    keywords: [
      'commission plan', 'set up commission', 'how much realtors earn',
      'configure commission', 'commission structure', 'change commission rate',
      'generational override', 'upline commission',
    ],
    steps: [
      { text: 'Open **Finance → Commission → Commission Plans** and create a plan.' },
      {
        text: 'Set the commissionable base and the pool — the cap on what the whole sale pays out.',
        note: 'If the rules claim more than the pool allows, everyone is reduced proportionally rather than the first rule taking it all.',
      },
      {
        text: 'Give each rule a rate per realtor level, or a flat rate for everyone.',
        note: 'Leave a level unset and it falls back to the rate on that level in Realtor Levels.',
      },
      { text: 'Add any taxes or charges under **Taxes and charges on the payout** — the preview shows what the realtor is actually paid.' },
      {
        text: 'Activate it, then **assign** it to a property or a unit.',
        note: 'A plan that is not assigned to anything never applies. A unit-level assignment beats a property-level one.',
      },
    ],
    related: ['commission-payout'],
  },
  {
    id: 'commission-payout',
    title: 'Pay a realtor their commission',
    summary: 'Build a payout run, approve it, and record the payment.',
    category: 'Commission',
    route: '/finance/commission-payouts',
    trail: 'Finance → Commission → Commission Payouts',
    permissions: ['finance.commissions.manage'],
    keywords: [
      'pay commission', 'commission payout', 'pay a realtor', 'payout run',
      'settle commission', 'realtor wants their money', 'build payout',
    ],
    steps: [
      {
        text: 'Open **Finance → Commission → Commission Payouts** and choose **Build payout run**.',
        note: 'This batches everything released and unpaid into one draft per realtor. It moves no money.',
      },
      { text: 'Review a draft with **Advice** — it shows gross, deductions and net.' },
      { text: 'Approve it.' },
      {
        text: 'When the transfer has gone, choose **Record payment** on the payout.',
        note: 'That is what writes the ledger entry — and it posts the NET, because withholding never left the building.',
      },
    ],
    related: ['commission-plan'],
  },
  {
    id: 'realtor-commission-request',
    title: 'Ask to be paid for a commission',
    summary: 'A realtor selects the commissions they want paid and requests them.',
    category: 'Commission',
    route: '/finance/my-commission',
    trail: 'Finance → Commission → My Commissions',
    keywords: [
      'request my commission', 'ask to be paid', 'when do i get paid',
      'request payout', 'my commission', 'claim commission',
    ],
    steps: [
      { text: 'Open **My Commissions**.' },
      {
        text: 'A commission appears as soon as a sale is attributed to you. Its amount is shown once it has been released — which follows the buyer paying.',
        note: 'While it is still accruing the figure can change — a cap or a correction can move it — so showing a provisional number would be worse than showing none. Nobody has to approve it: released commission is yours to ask for.',
      },
      { text: 'Tick the ones that are ready and choose **Request payment**.' },
      { text: 'An administrator sees the request on the Commission Payouts screen, and pays it in the next run.' },
    ],
  },
];

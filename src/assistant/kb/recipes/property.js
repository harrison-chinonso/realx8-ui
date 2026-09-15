/** Walkthroughs for listing and selling stock. */

export const propertyRecipes = [
  {
    id: 'branches',
    title: 'Set up a branch and file properties under it',
    summary: 'Create an office, then assign properties to it from the property itself.',
    category: 'Property',
    route: '/branches',
    trail: 'Property → Branches',
    permissions: ['properties.branches.manage'],
    keywords: [
      'create a branch', 'add a branch', 'new office', 'branches', 'office',
      'assign a property to a branch', 'which branch', 'move a property to another branch',
      'company branches', 'regional office', 'close a branch', 'delete a branch',
    ],
    steps: [
      { text: 'Open **Property → Branches** and choose **Add branch**.' },
      {
        text: 'Give it a name and the office address.',
        note: 'Those are the only two fields — a branch is an office, not a profile.',
      },
      {
        text: 'To file a property under it, edit the PROPERTY and pick the branch there.',
        note: 'A property belongs to one branch at a time, so choosing a new one moves it out of the old one.',
      },
      {
        text: 'Closing a branch unassigns its properties rather than deleting them.',
        note: 'They stay exactly as they were, with no branch, and can be put in another one afterwards.',
      },
    ],
    related: ['create-property'],
  },
  {
    id: 'create-property',
    /*
     * An ACTION shares this id and does more: it reads the period (and the
     * tab, for exports) out of what was said and opens the screen with them
     * applied. Without this link the two compete on keyword overlap, the prose
     * wins, and the action is unreachable — which is exactly what happened to
     * "export the invoices report for last month": it produced a plain link to
     * Reports and quietly dropped the month.
     */
    fulfilledBy: 'create-property',
    title: 'Add a property',
    summary: 'List a new development, with its unit types and prices.',
    category: 'Property',
    route: '/properties/create',
    trail: 'Property → Property Listing',
    permissions: ['properties.create'],
    keywords: [
      'add a property', 'create a property', 'list a property', 'new development',
      'new estate', 'add a house', 'put a property on the platform', 'new listing',
    ],
    steps: [
      { text: 'Open **Property → Property Listing** and start a new property.' },
      { text: 'Fill in the name, location and description, and add photos.' },
      {
        text: 'Add each unit type with its price and how many are available.',
        note: 'Units are what people actually buy — a property with no units cannot be purchased.',
      },
      {
        text: 'Save, then have it approved.',
        note: 'Only approved, available properties appear to buyers.',
      },
    ],
    related: ['instalment-plan', 'promotion'],
  },
  {
    id: 'instalment-plan',
    title: 'Offer an instalment plan on a unit',
    summary: 'Let buyers pay over time, with the plan charge and terms you set.',
    category: 'Property',
    route: '/finance/installment-plans',
    trail: 'Finance → Payments → Installment Plans',
    permissions: ['finance.installment-plans.view'],
    keywords: [
      'instalment plan', 'payment plan', 'let clients pay over time', 'monthly payments',
      'spread the cost', 'financing', 'pay in instalments',
    ],
    steps: [
      { text: 'Open **Finance → Payments → Installment Plans** and create a plan.' },
      { text: 'Set the duration in months and the plan charge — a percentage or a flat fee.' },
      { text: 'Set the grace period and any late fee.' },
      {
        text: 'Assign the plan to the units it applies to.',
        note: 'A buyer is only offered plans assigned to the unit they are buying, so an unassigned plan is invisible.',
      },
    ],
    related: ['create-property'],
  },
  {
    id: 'promotion',
    title: 'Run a promotion or discount',
    summary: 'Set up a campaign — a percentage off, buy-two-get-one, or tiered by quantity.',
    category: 'Property',
    route: '/promotions',
    trail: 'Property → Promotions',
    permissions: ['promotions.view'],
    keywords: [
      'promotion', 'discount', 'special offer', 'sale', 'percent off',
      'buy two get one', 'campaign', 'black friday', 'reduce the price',
    ],
    steps: [
      { text: 'Open **Property → Promotions** and choose **+ New Promotion**.' },
      { text: 'Name it and set the dates.' },
      { text: 'Choose the property and the units it covers.' },
      {
        text: 'Set what qualifies — a minimum quantity, a minimum spend, or a required combination of units.',
      },
      {
        text: 'Choose what it gives, and watch the preview on the right.',
        note: 'The preview runs the real engine, so what it shows is what a buyer will be charged.',
      },
      {
        text: 'Publish it.',
        note: 'A promotion never changes a unit’s price — the discount is worked out at purchase, so ending the campaign takes nothing away from a sale already made.',
      },
    ],
  },
];

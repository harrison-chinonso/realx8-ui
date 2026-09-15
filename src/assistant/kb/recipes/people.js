/** Walkthroughs for the people on the platform and what they can do. */

export const peopleRecipes = [
  {
    id: 'create-user',
    /*
     * There is an ACTION with this id too, and it is strictly better: it
     * collects the name and email and opens the form with them filled in. The
     * prose below is what somebody without `users.manage` sees, and what the
     * action falls back to. Naming it here stops the two competing in the
     * ranking, where the recipe was winning and the action was unreachable.
     */
    fulfilledBy: 'create-user',
    title: 'Add a staff member',
    summary: 'Create a login for a colleague and give them a role.',
    category: 'People',
    route: '/users/employees',
    trail: 'User Management → Staff',
    permissions: ['users.view'],
    keywords: [
      'add a user', 'create a user', 'new staff', 'give someone access',
      'create a login', 'onboard a colleague', 'add an admin', 'new employee',
    ],
    steps: [
      { text: 'Open **User Management → Staff** and choose **+ New User**.' },
      { text: 'Fill in their name, email and phone.' },
      {
        text: 'Choose their role.',
        note: 'The role decides what they can see and do. It is worth being deliberate — an Administrator can approve money.',
      },
      { text: 'Save. They receive a welcome email with how to sign in.' },
    ],
    related: ['permissions'],
  },
  {
    id: 'permissions',
    title: 'Change what a role can do',
    summary: 'Grant or remove permissions for a role, or for one person.',
    category: 'People',
    route: '/roles',
    trail: 'User Management → Roles & Permissions',
    permissions: ['roles.manage'],
    keywords: [
      'permissions', 'roles', 'what someone can do', 'give access to',
      'cannot see a menu', 'missing menu', 'access denied', 'they cannot approve',
      'grant permission', 'remove access',
    ],
    steps: [
      { text: 'Open **User Management → Roles & Permissions**.' },
      { text: 'Choose the role and tick the permissions it should have.' },
      {
        text: 'Save.',
        note: 'Anyone already signed in picks the change up when they next sign in — permissions travel with the session.',
      },
      {
        text: 'If a menu is missing for somebody, this is almost always why.',
        note: 'Menu items are hidden when the permission behind them is absent, so "the menu disappeared" and "they lost a permission" are the same event.',
      },
    ],
    related: ['create-user'],
  },
  {
    id: 'realtor-referral',
    title: 'Share a property so a realtor gets the commission',
    summary: 'A shared link carries the agent’s code, so whoever buys is attributed to them.',
    category: 'People',
    route: '/properties/listed',
    trail: 'Property → Listed Properties',
    keywords: [
      'share a property', 'referral link', 'my link', 'get credit for a sale',
      'refer a client', 'share link', 'attribution', 'my referral code',
    ],
    steps: [
      { text: 'Open the property under **Property → Listed Properties**.' },
      { text: 'Use the share control to copy the link.' },
      {
        text: 'The link carries your realtor code, so anybody who registers through it is attributed to you.',
        note: 'That holds whether they sign up with a password or with Google.',
      },
      {
        text: 'An account that already has an agent is never reassigned.',
        note: 'Otherwise a second link could quietly take another agent’s client, and their commission with them.',
      },
    ],
  },
  {
    id: 'browser-notifications',
    title: 'Get notified in the browser',
    summary: 'Turn on alerts that reach you when the application is closed.',
    category: 'People',
    route: '/settings/notifications',
    trail: 'General → Settings → Notifications',
    keywords: [
      'browser notifications', 'push notifications', 'desktop alerts',
      'notify me', 'alerts', 'turn on notifications', 'stop notifications',
    ],
    steps: [
      { text: 'Open **Settings → Notification Settings**.' },
      { text: 'Choose **Turn on for this browser** and allow the prompt.' },
      {
        text: 'Use **Send a test** to check it works.',
        note: 'This is per browser — turn it on again on your phone or any other device.',
      },
      {
        text: 'Per event, choose whether it goes to the bell, to email, to the browser, or a combination.',
      },
    ],
  },
];

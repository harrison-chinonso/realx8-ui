/**
 * What each module holds, in two or three words.
 *
 * The four bands that used to live here — Core, Sales & clients, Finance,
 * Administration — are gone with the grid that rendered them. Eight modules lay
 * out as two rows of four, which no grouping of three, one, two and two can
 * produce, and the order is navConfig's own. What remains is the single highest
 * value thing on a tile after its name: what "Operations & Support" contains,
 * instead of making somebody guess from two words that could mean anything.
 *
 * Keyed by section name. A module with no entry loses a line, not its tile.
 */
export const DESCRIPTIONS = {
  Dashboard: 'Figures and alerts',
  'People & Access': 'Staff, clients, realtors',
  Properties: 'Listings and units',
  'Sales & CRM': 'Pipeline and tasks',
  Finance: 'Invoices and payments',
  Investments: 'Opportunities and returns',
  'Marketing & Content': 'Posts and campaigns',
  'Operations & Support': 'Training, care, settings',
  'Realtor Hub': 'Your standing',
  // Sections flattened in the launcher show their screens, which need their own.
  'My Referrals': 'Who you brought in',
  'My Clients': 'Who you sell to',
  // Named after the one screen a realtor's Finance section holds.
  'My Commissions': 'What you have earned',
  'Listed Properties': 'What is on the market',
  'My Portfolio': 'What you own',
  'Credit & Debit Notes': 'Charges and refunds',
  'Platform Admin': 'Tenants and platform',
  // The overflow tile. Without a line here its name sits lower than its
  // neighbours', because every other tile reserves two lines for a description.
  More: 'Everything else',
};

/**
 * The order the launcher lays tiles out in, per user type.
 *
 * What falls out of navConfig is the order the MENU is declared in, which is
 * the right order for staff and the wrong one for the two roles whose tiles are
 * mostly their own things. A buyer wants what they own and what they owe before
 * support and notifications; a realtor wants their people and their money
 * before the pipeline and the back office.
 *
 * Declared here rather than by reordering navConfig, because that order is
 * shared: moving Notifications above Support Centre for a client would move it
 * for every member of staff too.
 *
 * An entry matches a tile by its PATH or by its NAME. Paths are the stabler
 * handle and are used wherever a tile goes somewhere; a realtor's grid also
 * holds tiles that open a module rather than a screen, and those have a name
 * and no path. Anything unlisted keeps its navConfig position, after these.
 */
export const TILE_ORDER = {
  client: [
    '/',
    '/properties/listed',
    '/finance/my-properties',
    '/finance/my-invoices',
    '/finance/my-payments',
    '/investments/portfolio',
    '/notifications',
    '/support',
    // Ninth, and so the one the cap pushes into More. Last on purpose: of the
    // client's screens this is the one they need least often.
    '/finance/my-notes',
  ],
  realtor: [
    'Dashboard',
    'Properties',
    'My Referrals',
    'My Clients',
    // Named 'Finance' once the section holds more than the commission
    // statement, and 'My Commissions' while it holds only that — the launcher
    // names a one-screen module after its screen. Both sit in the same slot so
    // the tile does not move when a second screen is added or removed.
    'Finance',
    'My Commissions',
    'Investments',
    'Sales & CRM',
    'Operations & Support',
  ],
};

/**
 * Sort tiles into the order declared for this user type.
 *
 * Stable: two tiles the list does not mention keep the order they arrived in,
 * so an unlisted screen appears where navConfig put it rather than jumping to
 * the front.
 */
export const orderTiles = (tiles = [], userType = null) => {
  const order = TILE_ORDER[userType];
  if (!order) return tiles;
  const rank = (tile) => {
    const byPath = tile.to ? order.indexOf(tile.to) : -1;
    if (byPath !== -1) return byPath;
    const byName = order.indexOf(tile.name ?? tile.label);
    return byName === -1 ? order.length : byName;
  };
  return tiles
    .map((tile, index) => ({ tile, index }))
    .sort((a, b) => (rank(a.tile) - rank(b.tile)) || (a.index - b.index))
    .map((entry) => entry.tile);
};

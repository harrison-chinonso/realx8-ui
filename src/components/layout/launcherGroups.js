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
  Investments: 'What you hold',
  'My Referrals': 'Who you brought in',
  'My Clients': 'Who you sell to',
  // Named after the one screen a realtor's Finance section holds.
  'My Commissions': 'What you have earned',
  'Listed Properties': 'What is on the market',
  'My Portfolio': 'What you own',
  'Platform Admin': 'Tenants and platform',
};

/**
 * The order a client's tiles are laid out in.
 *
 * Their launcher is flat — every screen they have, as eight tiles — and the
 * order that falls out of navConfig is the order the MENU is declared in:
 * Dashboard, then Properties, then the two screens they can see in Operations
 * & Support, then their portfolio. That is the order the sections make sense in
 * for staff, and the wrong one for a buyer, who wants what they own and what
 * they owe before support and notifications.
 *
 * Declared here rather than by reordering navConfig, because navConfig's order
 * is shared: putting Notifications above Support Centre for a client would move
 * it for every member of staff too.
 *
 * Anything not listed keeps its navConfig position, after these.
 */
export const CLIENT_TILE_ORDER = [
  '/',
  '/properties/listed',
  '/finance/my-properties',
  '/finance/my-invoices',
  '/finance/my-payments',
  '/investments/portfolio',
  '/notifications',
  '/support',
];

/** Sorts a client's screens into CLIENT_TILE_ORDER, stably. */
export const orderClientTiles = (tiles = []) => {
  const rank = (item) => {
    const index = CLIENT_TILE_ORDER.indexOf(item.to);
    return index === -1 ? CLIENT_TILE_ORDER.length : index;
  };
  return tiles
    .map((item, index) => ({ item, index }))
    .sort((a, b) => (rank(a.item) - rank(b.item)) || (a.index - b.index))
    .map((entry) => entry.item);
};

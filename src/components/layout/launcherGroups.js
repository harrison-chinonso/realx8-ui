/**
 * How the modules are grouped, and what each one actually contains.
 *
 * ── Why grouping is worth the mapping ───────────────────────────────────────
 *
 * A flat grid of twelve equal tiles has no vertical rhythm — the eye has
 * nothing to land on, so it reads every label in order. Four labelled groups
 * give it somewhere to start, and cost nothing: the tiles themselves stay
 * identical, which is the one rule the pattern will not bend on.
 *
 * ── Why a fallback group exists ─────────────────────────────────────────────
 *
 * This maps sections BY NAME, and this codebase has already been bitten once by
 * that: ModernLayout referred to sections by string, two were renamed, and they
 * silently vanished from that template alone. So an unmapped section is not
 * dropped — it lands in "More". A rename costs a module its grouping, which is
 * a cosmetic loss; dropping it costs a module its existence, which is not.
 *
 * The set also varies by who is looking. A buyer sees five sections, none of
 * them Finance or Administration; a platform admin sees Platform Admin, which
 * no group here names. Both are handled by the same fallback.
 */

/** Group order is fixed. Position is what people memorise. */
export const GROUPS = [
  { id: 'core', label: 'Core', sections: ['Dashboard', 'Property', 'Media'] },
  {
    id: 'sales',
    label: 'Sales & clients',
    sections: ['Leads & Deals', 'Realtor Hub', 'Customer Care', 'Front Desk', 'My Portfolio'],
  },
  { id: 'finance', label: 'Finance', sections: ['Finance', 'Investments'] },
  {
    id: 'admin',
    label: 'Administration',
    sections: ['User Management', 'General', 'Settings', 'Platform Admin'],
  },
];

/** Anything a group does not name still has a home. */
export const FALLBACK_GROUP = { id: 'more', label: 'More', sections: [] };

/**
 * Two or three words saying what a tile contains.
 *
 * The single highest-value thing on a tile after the name: it tells somebody
 * what "General" or "Media" holds instead of making them guess from one word.
 * Kept very short on purpose — centred text longer than three words scans
 * badly, and the description is there to be glanced at, not read.
 *
 * Keyed by the section name, with the same fallback reasoning as the groups: a
 * module with no description loses a line, not its tile.
 */
export const DESCRIPTIONS = {
  Dashboard: 'Figures and alerts',
  Property: 'Listings and units',
  Media: 'Posts and campaigns',
  'Leads & Deals': 'Pipeline and tasks',
  'Realtor Hub': 'Training and standing',
  'Customer Care': 'Tickets and support',
  'Front Desk': 'Visitors and attendance',
  'Visitor Log & Attendance': 'Visitors and attendance',
  'My Portfolio': 'What you own',
  Finance: 'Invoices and payments',
  Investments: 'Opportunities and returns',
  'User Management': 'Staff and realtors',
  General: 'Notifications',
  Settings: 'Company configuration',
  'Platform Admin': 'Tenants and platform',
};

/** Sort visible sections into their groups, keeping declared order within each. */
export const groupSections = (sections = []) => {
  const claimed = new Set();
  const groups = GROUPS.map((group) => {
    const members = sections.filter((section) => {
      /*
       * A section may have no NAME of its own — Dashboard is declared in
       * navConfig as a nameless group holding one link, which is why matching
       * on `section.section` alone dropped it into "More" next to the modules
       * nobody had classified. Where there is no section name, the single
       * destination's label is the name, because that is what the tile says.
       */
      const only = section.destinations?.length === 1 ? section.destinations[0] : null;
      const name = section.section || only?.label || section.label;
      if (!group.sections.includes(name)) return false;
      claimed.add(section);
      return true;
    });
    return { ...group, members };
  }).filter((group) => group.members.length > 0);

  const leftovers = sections.filter((section) => !claimed.has(section));
  return leftovers.length
    ? [...groups, { ...FALLBACK_GROUP, members: leftovers }]
    : groups;
};

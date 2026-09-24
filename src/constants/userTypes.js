/**
 * The account types the API's `type` column accepts, and how a role maps onto one.
 *
 * ── A role is not a type ────────────────────────────────────────────────────
 *
 * `type` is a fixed vocabulary the server's guards read. ROLES are
 * configuration — an administrator can add "Accountant" on the Roles screen,
 * and what that role may do is its permissions.
 *
 * The user forms used to send the chosen role name as the type, which works
 * only for as long as every role happens to share a name with a type. The first
 * role somebody added broke creation with "Data truncated for column 'type'".
 * A custom role's holder is an `employee` who carries that role.
 *
 * Kept in step with shared/src/userTypes.js on the server, which is the
 * authority — the list is short, changes rarely, and the server refuses
 * anything not on it, so a drift shows up as a clear message rather than a bad
 * write.
 */
export const USER_TYPES = [
  'superior_admin',
  'super_admin',
  'admin',
  'employee',
  'realtor',
  'client',
  'coo',
  'csmo',
  'product_manager',
  'customer_care',
  'media_team',
  'branch_manager',
  'front_desk',
];

/** The account type to create somebody under, given the role they were assigned. */
export const userTypeForRole = (role, fallback = 'employee') => (
  USER_TYPES.includes(String(role || '')) ? String(role) : fallback
);

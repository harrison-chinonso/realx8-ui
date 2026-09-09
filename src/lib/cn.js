/**
 * Joins class names, letting a caller's className win over a component default.
 *
 * A local 12-line helper rather than clsx + tailwind-merge: this codebase does
 * not otherwise depend on them, and the only behaviour needed is "later wins"
 * for the handful of Tailwind groups our primitives set.
 */
const GROUPS = [
  /^h-/, /^w-/, /^px-/, /^py-/, /^p-/, /^text-(xs|sm|base|lg|xl|\dxl)$/,
  /^rounded/, /^bg-/, /^border(-|$)/, /^font-/, /^gap-/,
];

export const cn = (...inputs) => {
  const classes = inputs.flat().filter(Boolean).join(' ').split(/\s+/).filter(Boolean);
  const seen = new Map();
  const plain = [];

  for (const cls of classes) {
    const group = GROUPS.find((re) => re.test(cls));
    if (group) seen.set(group, cls);   // later declaration replaces earlier
    else plain.push(cls);
  }
  return [...plain, ...seen.values()].join(' ');
};

export default cn;

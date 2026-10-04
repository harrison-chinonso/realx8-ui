/**
 * The company a white-label Realx8-Mobile app is locked to, or null.
 *
 * The app sets window.Realx8Native before this bundle runs; `locked` is true
 * only in a company's own branded build. Everywhere else — a browser, or the
 * general Realx8 app where a person picks their company — this is null and
 * nothing changes.
 */
export const lockedCompanyCode = () => {
  const native = typeof window !== 'undefined' ? window.Realx8Native : null;
  return native?.locked && native.tenant ? String(native.tenant) : null;
};

import { getDeviceId } from './deviceId';

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

/**
 * Whether the page is inside the iOS app with Sign in with Apple available.
 *
 * App Review requires it beside Google sign-in on iOS (guideline 4.8). The
 * shell announces what it can do in `capabilities`, so this does not guess
 * from the user agent.
 */
export const canSignInWithApple = () => {
  const native = typeof window !== 'undefined' ? window.Realx8Native : null;
  return Array.isArray(native?.capabilities) && native.capabilities.includes('appleSignIn');
};

/**
 * Hand Sign in with Apple to the iOS shell. It shows Apple's sheet, signs in
 * with Realx8-Core, and brings the result back to /auth/google/callback —
 * the same page Google's sign-in ends on, so every outcome is handled there.
 * The codes decide which company a NEW account joins, as for Google.
 */
export const startAppleSignIn = ({ companyCode = null, realtorCode = null, redirect = null } = {}) => {
  const native = typeof window !== 'undefined' ? window.Realx8Native : null;
  native?.postMessage({
    type: 'auth.appleSignIn',
    payload: {
      ...(companyCode ? { company_code: String(companyCode).toUpperCase() } : {}),
      ...(realtorCode ? { realtor_code: String(realtorCode).toUpperCase() } : {}),
      // Where to land afterwards — the server keeps it only if it is a path on this site.
      ...(redirect ? { redirect } : {}),
      // This device, for the one-device sign-in rule; the shell forwards it to
      // /auth/apple/native as `device_id`.
      device_id: getDeviceId(),
    },
  });
};

/**
 * Whether a company has switched an app feature off (Settings → Mobile app).
 * The shell passes the company's `mobile.features`; anything not listed is on.
 * Always false in a browser — these switches only shape the app.
 */
export const appFeatureOff = (name) => {
  const native = typeof window !== 'undefined' ? window.Realx8Native : null;
  return native?.features?.[name] === false;
};

/**
 * A ceiling on how often the session may be refreshed.
 *
 * Refreshing is the right answer to one expired token. It is the wrong answer
 * to a token the server will never accept — there the cycle is: a request
 * 401s, the client refreshes, the refresh SUCCEEDS, the retry 401s again, and
 * nothing stops it. Seen in production as hundreds of `POST /auth/refresh 200`
 * interleaved with 401s, which hammers the API and leaves the user unable to
 * do anything at all, including sign out.
 *
 * Past this many refreshes inside the window the session is treated as
 * unrecoverable and ended. Signing someone out is not a pleasant outcome, but
 * it is a FINITE one they can act on, which an endless loop is not.
 *
 * Six in two minutes cannot be legitimate: a healthy session refreshes about
 * once an hour.
 *
 * This lives in its own module rather than in client.js so that authStore can
 * reset it without the two importing each other — a cycle that works until
 * module evaluation order changes and then fails as an undefined import.
 */
const REFRESH_LIMIT = 6;
const REFRESH_WINDOW_MS = 2 * 60 * 1000;

let refreshTimes = [];

/** Records a refresh and reports whether the recent rate looks like a loop. */
export const refreshLooping = () => {
  const now = Date.now();
  refreshTimes = refreshTimes.filter((at) => now - at < REFRESH_WINDOW_MS);
  refreshTimes.push(now);
  return refreshTimes.length > REFRESH_LIMIT;
};

/** Cleared on a real sign-in, so a new session starts with a full budget. */
export const resetRefreshBudget = () => { refreshTimes = []; };

export default refreshLooping;

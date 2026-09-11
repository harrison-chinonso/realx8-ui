/**
 * Loading a code-split chunk, and surviving a deploy that happened mid-session.
 *
 * ── The failure this exists for ─────────────────────────────────────────────
 *
 * Chunk filenames carry a content hash, so every deploy produces new ones and
 * removes the old. A tab that was opened before the deploy is still running the
 * previous build, and the moment it needs a chunk it has not already fetched —
 * an export, a lazily-loaded route — it asks for a filename that no longer
 * exists.
 *
 * The browser reports that as "Failed to fetch dynamically imported module",
 * which tells the user nothing and offers them nothing. It is not really an
 * error: the application is simply out of date, and reloading fixes it
 * completely. This turns it into that.
 *
 * It is deliberately NOT an automatic reload. A reload discards whatever is in
 * a half-filled form elsewhere on the page, and doing that to someone who
 * clicked "Export" would be a worse surprise than the error. The caller is
 * given a message and offers the reload as a choice.
 */

/**
 * Every phrasing browsers use for "that chunk is not there any more".
 *
 * There is no shared wording and no error code, so this has to match on text.
 * The MIME-type entries matter most: when a host rewrites unknown paths to
 * index.html — which is what a single-page-app config does by default — the
 * missing chunk is answered with HTML at 200 rather than a 404, and the
 * browser complains about the content type instead of the missing file.
 *
 * Chrome and the others word even that differently, which is why there are two
 * patterns for one condition rather than one clever regex.
 */
const STALE_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  // Chrome: "...the server responded with a MIME type of 'text/html'".
  /responded with a mime type of/i,
  // Safari / Firefox.
  /is not a valid javascript mime type/i,
  /expected a javascript(-or-wasm)? module script/i,
  /module source uri is not allowed/i,
  /unable to preload/i,
];

export const STALE_BUILD = 'STALE_BUILD';

/** Whether a thrown error is "this build no longer exists on the server". */
export const isStaleBuildError = (error) => {
  if (!error) return false;
  if (error.code === STALE_BUILD) return true;
  const text = `${error.message || ''} ${error.name || ''}`;
  return STALE_PATTERNS.some((pattern) => pattern.test(text));
};

export const STALE_MESSAGE = 'A new version of the app has been released since you opened '
  + 'this page, so part of it could not be loaded. Reload to continue.';

/**
 * Runs a dynamic import, translating a stale-build failure into something the
 * interface can act on.
 *
 * Genuine errors — a bug inside the imported module, for instance — are
 * rethrown untouched, because reporting those as "reload the page" would send
 * someone chasing a problem that reloading cannot fix.
 */
export const lazyImport = async (loader) => {
  try {
    return await loader();
  } catch (error) {
    if (isStaleBuildError(error)) {
      throw Object.assign(new Error(STALE_MESSAGE), { code: STALE_BUILD, cause: error });
    }
    throw error;
  }
};

/**
 * Reloads onto the current build.
 *
 * `location.reload()` can be served the same cached index.html that referenced
 * the missing chunks, which reproduces the failure and looks like the reload
 * did nothing. Navigating to the URL with a changing query parameter forces a
 * fresh document, and it is stripped again by the router on arrival.
 */
export const reloadForNewBuild = () => {
  const url = new URL(window.location.href);
  url.searchParams.set('_v', String(Date.now()));
  window.location.replace(url.toString());
};

export default lazyImport;

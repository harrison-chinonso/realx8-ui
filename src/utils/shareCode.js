/**
 * Is this URL segment a share code, or the long public token it replaced?
 *
 * `/p/:token` accepts both shapes — a seven-character share code, and the
 * forty-eight hexadecimal characters every link issued before the code existed
 * carries. The page needs to tell them apart for one reason: a share code also
 * resolves through `/share/brand/:code`, so it can brand the page and name the
 * realtor who shared it. A public token cannot; it says nothing but which
 * property.
 *
 * Mirrors shared/src/shortCode.js on the server, and is loose in the same way:
 * a mistyped code still reaches the resolver and gets a "this link is not
 * valid" answer, rather than being taken for a token and failing differently
 * for the same mistake.
 */
export const looksLikeShareCode = (value) => typeof value === 'string'
  && value.length <= 12
  && /^[0-9A-Z]+$/i.test(value);

export default looksLikeShareCode;

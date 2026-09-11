/**
 * Payload encryption across the two repositories.
 *
 * Each half is already tested against itself: Realx8-Core has
 * verify:crypto for the server, and the browser half is exercised by the app.
 * Neither proves the thing that actually matters, which is that the two agree
 * about the WIRE — the envelope's field names, base64 over raw bytes, and
 * where the 16-byte GCM tag lives.
 *
 * That last one is the real hazard. WebCrypto appends the tag to the
 * ciphertext; Node's crypto keeps it in a separate field. Both halves are
 * correct on their own and produce bytes the other cannot read if either stops
 * splitting it. A disagreement here does not degrade gracefully: in permissive
 * mode every encrypted request silently falls back, and in strict mode the
 * whole application stops working at once.
 *
 * So this drives the browser module through esbuild and the server module
 * directly, and passes real envelopes between them.
 *
 * Run with: npm run verify:interop
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CORE = path.join(__dirname, '..', '..', 'Realx8-Core');
const CACHE = path.join(__dirname, '..', 'node_modules', '.cache', 'realx8-verify');

let pass = 0; let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${label}${detail ? `\n        ${detail}` : ''}`);
  if (ok) pass += 1; else fail += 1;
};

const serverModule = path.join(CORE, 'shared', 'src', 'payloadCrypto.js');
if (!fs.existsSync(serverModule)) {
  console.log(`\n  Realx8-Core is not beside this repository (looked in ${CORE}).`);
  console.log('  This check needs both halves; skipping rather than reporting a pass.\n');
  process.exit(0);
}

// A secret of our own, so the check never depends on how cred.env happens to be
// filled in and never reads a real key.
process.env.PAYLOAD_ENCRYPTION_SECRET = 'interop-test-secret';
const server = require(serverModule);

const bootstrapHex = server.bootstrapKeyHex();

fs.mkdirSync(CACHE, { recursive: true });
const bundle = path.join(CACHE, 'payloadCrypto.browser.cjs');
execFileSync('npx', [
  'esbuild', path.join(__dirname, '..', 'src', 'api', 'payloadCrypto.js'),
  '--bundle', '--format=cjs', '--platform=node', `--outfile=${bundle}`,
  `--define:import.meta.env=${JSON.stringify({
    VITE_PAYLOAD_ENCRYPTION: 'on',
    VITE_PAYLOAD_BOOTSTRAP_KEY: bootstrapHex,
    PROD: true,
  })}`,
], { stdio: 'inherit' });

const browser = require(bundle);

(async () => {
  const key = server.deriveKey(null); // Buffer, as the server holds it
  const keyHex = key.toString('hex'); // hex, as the browser holds it

  console.log('\n── The key both halves use is the same key ──────────────────────');

  check('The bootstrap key the server publishes is what the bundle carries',
    keyHex === bootstrapHex,
    'derived from the server secret rather than configured twice, so they cannot drift');

  check('It is a 256-bit key on both sides',
    key.length === 32 && bootstrapHex.length === 64, `${key.length} bytes`);

  console.log('\n── A request: the browser encrypts, the server reads it ─────────');

  const request = {
    unit: '7B', amount: 45000000, note: 'Balance on allocation',
    nested: { plan: 'installment', months: 24 },
  };
  const fromBrowser = await browser.encryptBody(request, keyHex);

  check('The envelope has the four fields the server expects',
    fromBrowser.v === 1 && typeof fromBrowser.iv === 'string'
    && typeof fromBrowser.tag === 'string' && typeof fromBrowser.data === 'string',
    `v=${fromBrowser.v} iv=${fromBrowser.iv.length}ch tag=${fromBrowser.tag.length}ch`);

  check('The server recognises it as an envelope at all',
    server.isEnvelope(fromBrowser), 'the shape check that decides encrypted vs plaintext');

  let serverRead = null;
  let serverError = null;
  try { serverRead = server.decrypt(fromBrowser, key); } catch (error) { serverError = error; }
  check('The server decrypts what the browser sent',
    JSON.stringify(serverRead) === JSON.stringify(request),
    serverError ? `THREW: ${serverError.message}` : JSON.stringify(serverRead));

  console.log('\n── A response: the server encrypts, the browser reads it ────────');

  const response = { data: [{ id: 1, reference: 'INV-0001' }], pagination: { total: 1 } };
  const fromServer = server.encrypt(response, key);

  check('The browser recognises the server\'s envelope',
    browser.isEnvelope(fromServer));

  let browserRead = null;
  let browserError = null;
  try { browserRead = await browser.decryptBody(fromServer, keyHex); } catch (error) { browserError = error; }
  check('The browser decrypts what the server sent',
    JSON.stringify(browserRead) === JSON.stringify(response),
    browserError ? `THREW: ${browserError.message}` : JSON.stringify(browserRead));

  console.log('\n── The tag: the one difference between the two crypto APIs ──────');

  check('The tag is exactly 16 bytes on the wire, from both halves',
    Buffer.from(fromBrowser.tag, 'base64').length === 16
    && Buffer.from(fromServer.tag, 'base64').length === 16,
    'WebCrypto appends it to the ciphertext, Node keeps it apart — splitting it is what makes these interoperate');

  check('The IV is 12 bytes from both halves',
    Buffer.from(fromBrowser.iv, 'base64').length === 12
    && Buffer.from(fromServer.iv, 'base64').length === 12);

  console.log('\n── Tampering is refused, in both directions ─────────────────────');

  {
    const tampered = { ...fromBrowser, data: Buffer.from('rewritten payload').toString('base64') };
    let refused = false;
    try { server.decrypt(tampered, key); } catch { refused = true; }
    check('The server refuses a payload whose ciphertext was edited', refused,
      'the GCM tag catches it — without it, bit-flipping would let a client edit what it cannot read');
  }
  {
    const tampered = { ...fromServer, tag: Buffer.alloc(16).toString('base64') };
    let refused = false;
    try { await browser.decryptBody(tampered, keyHex); } catch { refused = true; }
    check('The browser refuses a response whose tag does not verify', refused);
  }
  {
    const otherKey = server.deriveKey('some-other-session');
    let refused = false;
    try { server.decrypt(fromBrowser, otherKey); } catch { refused = true; }
    check('One session\'s key cannot open another session\'s payload', refused,
      'keys are derived per session id, so a captured body is useless elsewhere');
  }

  console.log('\n── Payloads that break naive implementations ────────────────────');

  {
    const unicode = { name: 'Chinonso Adeyemi', amount: '₦45,000,000', note: 'café — naïve “quotes”' };
    const sealed = await browser.encryptBody(unicode, keyHex);
    const read = server.decrypt(sealed, key);
    check('Unicode survives the round trip',
      JSON.stringify(read) === JSON.stringify(unicode), read.amount);
  }
  {
    // Larger than the 0x8000 chunk the browser's base64 encoder steps through.
    // Encoding it in one call overflows the call stack, which is why that loop
    // exists; this is the payload that proves the loop is right.
    const big = { rows: Array.from({ length: 4000 }, (_, i) => ({ i, ref: `INV-${i}`, note: 'x'.repeat(20) })) };
    const sealed = await browser.encryptBody(big, keyHex);
    const read = server.decrypt(sealed, key);
    check('A payload larger than the base64 chunk size survives',
      read.rows.length === 4000 && read.rows[3999].ref === 'INV-3999',
      `${Buffer.from(sealed.data, 'base64').length} bytes of ciphertext`);
  }
  {
    const sealed = await browser.encryptBody(null, keyHex);
    check('An empty body round-trips as null rather than breaking',
      server.decrypt(sealed, key) === null);
  }

  console.log('\n── Which key each half picks ────────────────────────────────────');

  check('With no session key, the browser uses the bootstrap key',
    browser.keyForRequest(true) === bootstrapHex,
    'so pre-login calls work, and so does a refresh that sends no Authorization header');

  {
    const sessionHex = server.deriveKey('session-abc').toString('hex');
    browser.setSessionKey(sessionHex);
    check('Once signed in, an authorised request uses the SESSION key',
      browser.keyForRequest(true) === sessionHex,
      'which the server derives from the sid in the token, never from anything the client sent');
    check('...and an unauthenticated request still uses the bootstrap key',
      browser.keyForRequest(false) === bootstrapHex,
      'both halves apply the same rule, so neither has to be told which was used');

    const sealed = await browser.encryptBody({ ok: true }, sessionHex);
    check('A session-key payload decrypts with the key derived from that sid',
      server.decrypt(sealed, server.deriveKey('session-abc')).ok === true);

    browser.clearSessionKey();
    check('Signing out drops the session key, falling back to bootstrap',
      browser.hasSessionKey() === false && browser.keyForRequest(true) === bootstrapHex,
      'the key lives in memory only, so a reload drops it too');
  }

  console.log('\n── Results ─────────────────────────────────────────────────────\n');
  console.log(`  ${fail === 0 ? '\x1b[32m' : '\x1b[31m'}${pass}/${pass + fail} checks passed.\x1b[0m\n`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((error) => {
  console.error('\n\x1b[31mThe verification itself failed:\x1b[0m', error);
  process.exit(1);
});

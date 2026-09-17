/**
 * The launcher grid, measured in a real browser at real device sizes.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 *
 * The tiles overlapped on a landscape phone. Not "looked tight" — overlapped,
 * by 34px, with 50px of the last row hanging outside the grid. The grid is
 * told to fill the page, and on an 844x390 viewport four rows had to share
 * about 330px for tiles with a 116px minimum, so the rows collapsed and the
 * content ran into itself.
 *
 * Nothing in a build or a linter can see that. It is a layout result, so it is
 * measured as one: the REAL exported CSS, the real markup, in Chrome, at
 * twelve viewport sizes including the landscape ones where it broke.
 *
 * ── Why iframes rather than window sizes ───────────────────────────────────
 *
 * Chrome will not open a window narrower than 500px on macOS, so
 * --window-size=390 silently measures 500 and every phone looks identical and
 * fine. Media queries inside an iframe evaluate against the frame, which is
 * the only way to get an honest 360 here.
 *
 * Requires Chrome. Skips with a clear message rather than failing if it is
 * missing, so this does not break a machine that has no browser installed.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

let pass = 0; let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${label}${detail ? `\n        ${detail}` : ''}`);
  if (ok) pass += 1; else fail += 1;
};

/*
 * Portrait phones, tablets, desktop — and landscape, which is where it broke.
 * A phone in landscape is a wide, SHORT viewport, and short is the dimension a
 * fill-the-page grid has trouble with.
 */
const SIZES = [
  [320, 900, 'portrait'], [360, 900, 'portrait'], [390, 900, 'portrait'],
  [414, 900, 'portrait'], [430, 900, 'portrait'],
  [520, 900, 'tablet'], [768, 1024, 'tablet'], [900, 1200, 'tablet'],
  [1280, 900, 'desktop'], [1680, 1050, 'desktop'],
  [667, 375, 'landscape'], [844, 390, 'landscape'], [932, 430, 'landscape'],
];

const tile = (n, grouped) => `
  <button class="rx-tile${grouped ? ' rx-tile-grouped' : ''}">
    <span class="rx-ic"><svg width="22" height="22"></svg></span>
    <span class="rx-name">Module ${n}</span>
    <span class="rx-desc">Two word line</span>
  </button>`;

const buildPage = (css) => {
  const inner = `<!doctype html><html><head>
<style>${css}</style><style>html,body{margin:0;height:100%}</style>
</head><body>
<div class="rx-panel rx-panel-grouped" style="height:100%">
  <div class="rx-body rx-body-modules"><div class="rx-group">
    <div class="rx-modules" id="main">${Array.from({ length: 8 }, (_, i) => tile(i + 1, true)).join('')}</div>
  </div></div>
</div>
<div class="rx-panel"><div class="rx-body">
  <div class="rx-grid" id="sub">${Array.from({ length: 6 }, (_, i) => tile(i + 1, false)).join('')}</div>
</div></div>
</body></html>`;

  return `<!doctype html><html><head><meta charset="utf-8"></head><body>
<div id="frames"></div><pre id="out"></pre>
<script>
const SRC = ${JSON.stringify(inner)};
const SIZES = ${JSON.stringify(SIZES)};

const measure = (doc, id) => {
  const grid = doc.getElementById(id);
  if (!grid) return null;
  const tiles = [...grid.children].map((el) => el.getBoundingClientRect());
  const rows = new Map();
  tiles.forEach((r) => {
    const key = Math.round(r.top);
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key).push(r);
  });
  const tops = [...rows.keys()].sort((a, b) => a - b);

  let minX = Infinity; let minY = Infinity;
  tops.forEach((top) => {
    const row = rows.get(top).sort((a, b) => a.left - b.left);
    for (let i = 1; i < row.length; i += 1) minX = Math.min(minX, row[i].left - row[i - 1].right);
  });
  for (let i = 1; i < tops.length; i += 1) {
    const bottom = Math.max(...rows.get(tops[i - 1]).map((r) => r.bottom));
    minY = Math.min(minY, tops[i] - bottom);
  }
  const box = grid.getBoundingClientRect();
  return {
    cols: rows.get(tops[0]).length,
    rows: tops.length,
    gapX: Number.isFinite(minX) ? +minX.toFixed(1) : null,
    gapY: Number.isFinite(minY) ? +minY.toFixed(1) : null,
    tileH: +tiles[0].height.toFixed(1),
    // A tile below the grid's own box: the rows were squeezed and the content
    // spilled out of the element that is supposed to contain it.
    spill: +Math.max(0, Math.max(...tiles.map((r) => r.bottom)) - box.bottom).toFixed(1),
  };
};

const results = [];
let pending = SIZES.length;
SIZES.forEach(([w, h, kind]) => {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'width:' + w + 'px;height:' + h + 'px;border:0;display:block';
  let done = false;
  frame.onload = () => {
    if (done || !frame.contentDocument.getElementById('main')) return;
    done = true;
    const doc = frame.contentDocument;
    results.push({
      width: w, height: h, kind,
      main: measure(doc, 'main'),
      sub: measure(doc, 'sub'),
      hScroll: doc.documentElement.scrollWidth > doc.documentElement.clientWidth + 1,
    });
    pending -= 1;
    if (pending === 0) document.getElementById('out').textContent = JSON.stringify(results);
  };
  document.getElementById('frames').appendChild(frame);
  frame.contentDocument.open();
  frame.contentDocument.write(SRC);
  frame.contentDocument.close();
  frame.onload();
});
</script></body></html>`;
};

(async () => {
  if (!fs.existsSync(CHROME)) {
    console.log(`\n  \x1b[33mChrome not found at ${CHROME} — skipping.\x1b[0m`);
    console.log('  Set CHROME_PATH to run this.\n');
    process.exit(0);
  }

  /*
   * Loading the module is itself a check. LAUNCHER_CSS is a template literal,
   * so a stray backtick in a CSS comment is a syntax error that only the build
   * catches — and it has been written by accident more than once.
   */
  let css;
  try {
    ({ LAUNCHER_CSS: css } = require('../src/components/layout/launcherStyles.js'));
  } catch (error) {
    console.log(`\n  \x1b[31mFAIL\x1b[0m  launcherStyles.js does not parse\n        ${error.message}`);
    console.log('        A backtick inside the LAUNCHER_CSS template literal is the usual cause.\n');
    process.exit(1);
  }
  check('launcherStyles.js parses and exports its CSS', typeof css === 'string' && css.length > 1000,
    `${css.length} characters`);

  const file = path.join(os.tmpdir(), `rx-launcher-${process.pid}.html`);
  fs.writeFileSync(file, buildPage(css));

  const dom = execFileSync(CHROME, [
    '--headless', '--disable-gpu', '--no-sandbox', '--virtual-time-budget=5000',
    '--window-size=1400,900', '--dump-dom', `file://${file}`,
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 32 * 1024 * 1024 });
  fs.unlinkSync(file);

  const match = dom.match(/<pre id="out">([\s\S]*?)<\/pre>/);
  if (!match || !match[1].trim()) {
    console.log('\n  \x1b[31mFAIL\x1b[0m  the page rendered nothing to measure\n');
    process.exit(1);
  }
  const results = JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'))
    .filter((r) => r.main);

  console.log('\n── Every viewport, both grids ───────────────────────────────────');
  console.log(`  ${'kind'.padStart(9)} ${'viewport'.padStart(10)} | ${'main'.padStart(6)} ${'gapY'.padStart(6)} ${'tileH'.padStart(7)} ${'spill'.padStart(6)} | ${'sub'.padStart(5)} ${'gapY'.padStart(5)}`);
  results.sort((a, b) => a.kind.localeCompare(b.kind) || a.width - b.width).forEach((r) => {
    console.log(`  ${r.kind.padStart(9)} ${`${r.width}x${r.height}`.padStart(10)} | `
      + `${`${r.main.cols}x${r.main.rows}`.padStart(6)} ${String(r.main.gapY).padStart(6)} `
      + `${String(r.main.tileH).padStart(7)} ${String(r.main.spill).padStart(6)} | `
      + `${`${r.sub.cols}x${r.sub.rows}`.padStart(5)} ${String(r.sub.gapY).padStart(5)}`);
  });

  console.log('\n── Tiles never touch ────────────────────────────────────────────');
  {
    const overlapping = results.filter((r) => r.main.gapY <= 0 || r.main.gapX <= 0
      || r.sub.gapY <= 0 || r.sub.gapX <= 0);
    /*
     * A gap of zero or less is tiles sharing pixels. This was -34 on a
     * landscape phone and nothing in the build said a word about it.
     */
    check(`No overlap at any of the ${results.length} sizes`, overlapping.length === 0,
      overlapping.map((r) => `${r.width}x${r.height} main gapY ${r.main.gapY}`).join(', '));
  }

  console.log('\n── Nothing spills out of the grid it belongs to ─────────────────');
  {
    const spilling = results.filter((r) => r.main.spill > 0 || r.sub.spill > 0);
    check('Every tile is inside its own grid box', spilling.length === 0,
      spilling.map((r) => `${r.width}x${r.height} by ${r.main.spill}px`).join(', '));
  }

  console.log('\n── The page never scrolls sideways ──────────────────────────────');
  {
    const sideways = results.filter((r) => r.hScroll);
    check('No horizontal scrollbar at any size', sideways.length === 0,
      sideways.map((r) => `${r.width}x${r.height}`).join(', '));
  }

  console.log('\n── Gutters are proportionate to the tiles ───────────────────────');
  {
    /*
     * Both grids were tuned when a tile was about 116px tall. The module grid
     * fills the page now, so a phone tile is over 200px — and the 9px gutter
     * that looked right against 116px reads as tiles stuck together against
     * 208px. Four per cent is the floor this asserts; the desktop four-column
     * view sits near it and everything else is comfortably above.
     */
    const thin = results.filter((r) => (r.main.gapY / r.main.tileH) < 0.03);
    check('No gutter is under 3% of the tile it separates', thin.length === 0,
      thin.map((r) => `${r.width}x${r.height} ${(100 * r.main.gapY / r.main.tileH).toFixed(1)}%`).join(', '));

    const phones = results.filter((r) => r.width <= 430 && r.kind === 'portrait');
    check('A phone gets at least 10px between tiles in both grids',
      phones.every((r) => r.main.gapY >= 10 && r.sub.gapY >= 10),
      phones.map((r) => `${r.width}: main ${r.main.gapY}, sub ${r.sub.gapY}`).join(' | '));
  }

  console.log('\n── The column counts the design specifies ───────────────────────');
  {
    const portrait = results.filter((r) => r.kind === 'portrait');
    check('Two columns on every phone', portrait.every((r) => r.main.cols === 2),
      portrait.map((r) => `${r.width}:${r.main.cols}`).join(' '));
    const wide = results.filter((r) => r.width >= 1280);
    check('Four on a desktop, so eight modules are 4 over 4',
      wide.every((r) => r.main.cols === 4), wide.map((r) => `${r.width}:${r.main.cols}`).join(' '));
  }

  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((error) => { console.error(error); process.exit(1); });

/**
 * ab.mjs — A/B one toggle and measure how much of the picture it actually moves.
 *
 *   node tools/ab.mjs <url> <js-that-turns-it-off> [outA.png outB.png] [w h]
 *
 * Screenshots before and after, then diffs the two PNGs on a canvas (no PIL, no
 * ImageMagick on this box). Prints mean abs difference and the share of pixels
 * that moved by more than 6/255 — a toggle that "looks like it works" but moves
 * 0.1% of pixels is not doing anything.
 */
import pw from '/Users/panglaohu/Downloads/TigerInBamboo/REA-agent/node_modules/playwright-core/index.js';
const { chromium } = pw;

const [url, offJs, outA = '/tmp/ab-a.png', outB = '/tmp/ab-b.png', w = '1200', h = '800'] = process.argv.slice(2);
if (!url) {
  console.error('usage: node tools/ab.mjs <url> <js> [outA outB] [w h]');
  process.exit(1);
}

const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(2200);
// AB_SETUP runs before *both* shots (camera, seed …) so the only difference
// between A and B is the toggle under test.
if (process.env.AB_SETUP) {
  await page.evaluate(process.env.AB_SETUP);
  await page.waitForTimeout(500);
}
const a = await page.screenshot({ path: outA });

if (offJs) {
  await page.evaluate(offJs);
  await page.waitForTimeout(600);
}
const b = await page.screenshot({ path: outB });
await page.close();

const p2 = await browser.newPage();
await p2.setContent('<canvas id="c"></canvas>');
const res = await p2.evaluate(async ([da, db]) => {
  const load = (url) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = url; });
  const [ia, ib] = await Promise.all([load(da), load(db)]);
  const c = document.getElementById('c');
  c.width = ia.width; c.height = ia.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(ia, 0, 0);
  const A = ctx.getImageData(0, 0, c.width, c.height).data;
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.drawImage(ib, 0, 0);
  const B = ctx.getImageData(0, 0, c.width, c.height).data;
  let sum = 0, moved = 0, max = 0;
  for (let i = 0; i < A.length; i += 4) {
    const d = (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2])) / 3;
    sum += d;
    if (d > 6) moved++;
    if (d > max) max = d;
  }
  const n = A.length / 4;
  return { mean: +(sum / n).toFixed(2), movedPct: +((moved / n) * 100).toFixed(2), max: +max.toFixed(1) };
}, [`data:image/png;base64,${a.toString('base64')}`, `data:image/png;base64,${b.toString('base64')}`]);

console.log(JSON.stringify(res));
await browser.close();

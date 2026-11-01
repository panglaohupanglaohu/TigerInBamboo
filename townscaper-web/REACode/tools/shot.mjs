/**
 * shot.mjs — headless screenshot + evaluate, the way the guide says to verify.
 *
 *   node tools/shot.mjs <url> <out.png> [w h] [js]
 *
 * SwiftShader keeps WebGL alive without a GPU, so this works on a headless box.
 * The `js` argument is evaluated in the page after 2.5s and its result is
 * printed, which is how stats get read back (window.reaTown / window.reaFusion).
 */
import pw from '/Users/panglaohu/Downloads/TigerInBamboo/REA-agent/node_modules/playwright-core/index.js';
const { chromium } = pw;

const [url, out, w = '1400', h = '900', js] = process.argv.slice(2);
if (!url || !out) {
  console.error('usage: node tools/shot.mjs <url> <out.png> [w h] [js]');
  process.exit(1);
}

const browser = await chromium.launch({
  channel: 'chrome',            // no bundled chromium on this box; use local Chrome
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-lcd-text'],
});
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });

const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(2500);

if (js) {
  try {
    const v = await page.evaluate(js);
    console.log('eval:', typeof v === 'string' ? v : JSON.stringify(v, null, 1));
  } catch (e) {
    console.log('eval failed:', e.message);
  }
}

await page.screenshot({ path: out });
if (logs.length) console.log(logs.join('\n'));
await browser.close();

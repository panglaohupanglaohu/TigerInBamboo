import { chromium } from '/Users/panglaohu/Downloads/TigerInBamboo/REA-agent/node_modules/playwright-core/index.mjs';
import fs from 'node:fs';

const dir = process.argv[2];
const cols = Number(process.argv[3] || 8);
const thumb = Number(process.argv[4] || 240);
const out = process.argv[5];

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
const times = fs.existsSync(dir + '/times.txt')
  ? fs.readFileSync(dir + '/times.txt', 'utf8').trim().split('\n')
  : [];

const cells = files.map((f, i) => {
  const t = times[i] ? times[i].split(' ')[0] : '';
  return '<figure><img src="' + encodeURIComponent(dir.split('/').pop()) + '/' + f + '"><figcaption>' + i + (t ? ' · ' + t + 's' : '') + '</figcaption></figure>';
});

const html = `<!doctype html><meta charset="utf-8">
<style>
  body { margin:0; background:#141414; font:12px/1.3 -apple-system,sans-serif; color:#eee; }
  .grid { display:grid; grid-template-columns:repeat(${cols}, ${thumb}px); gap:6px; padding:8px; }
  figure { margin:0; }
  img { width:${thumb}px; height:${thumb}px; display:block; background:#000; border-radius:2px; }
  figcaption { text-align:center; padding-top:2px; color:#9ad; }
</style>
<div class="grid">${cells.join('')}</div>`;

fs.writeFileSync('/tmp/vidcap/sheet.html', html);

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: cols * (thumb + 8) + 16, height: 400 } });
await page.goto('http://127.0.0.1:8801/sheet.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.screenshot({ path: out, fullPage: true });
console.log(out + '  frames=' + files.length);
await browser.close();

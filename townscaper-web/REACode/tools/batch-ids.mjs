/**
 * batch-ids.mjs — 按显式 id 抽帧，产出「一张总表 + 一份原文」。
 *
 * 为什么要有这个：tools/batch.mjs 只能从 learn/queue.json 里按 start/count 切片。
 * 队列 142 条走完之后，剩下的都是 data.js 里 status:todo 的存量条目（散落在队列各处，
 * 不连续），切片模式切不出来。所以这里把 batch.mjs 的抽帧逻辑原样搬出来，
 * 唯一区别是输入改成 --ids a,b,c。
 *
 *   node tools/batch-ids.mjs --ids 111,222,333 [--label todo1] [--frames 6] [--rate 2]
 *
 * 产物：
 *   tmp/cap/<id>/f0x.png
 *   tmp/cap/bsheet.html
 *   /tmp/batch-<label>.png
 */
import { chromium } from '/Users/panglaohu/Downloads/TigerInBamboo/REA-agent/node_modules/playwright-core/index.mjs';
import fs from 'node:fs';
import vm from 'node:vm';

const ROOT = '/Users/panglaohu/Downloads/TigerInBamboo/townscaper-web/REACode';
const PORT = Number(process.env.BATCH_PORT || 8817);
const BASE = `http://127.0.0.1:${PORT}`;
const CAP = ROOT + '/tmp/cap';

const argv = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 ? argv[i + 1] : dflt;
};
const ids = String(opt('ids', '')).split(',').map((s) => s.trim()).filter(Boolean);
const label = opt('label', 'ids');
const PER = Number(opt('frames', 6));
const RATE = Number(opt('rate', 2));
if (!ids.length) {
  console.log('用法：node tools/batch-ids.mjs --ids <id1,id2,...> [--label x]');
  process.exit(1);
}

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(ROOT + '/learn/data.js', 'utf8'), ctx);
const byId = new Map(ctx.window.LEARN.items.map((it) => [it.id, it]));

fs.mkdirSync(CAP, { recursive: true });
const missing = ids.filter((id) => !fs.existsSync(ROOT + '/gifs/' + id + '.mp4'));

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox', '--mute-audio'],
});
const page = await browser.newPage({ viewport: { width: 640, height: 640 } });
await page.goto(BASE + '/tools/player.html', { waitUntil: 'load' });

const rows = [];
for (const id of ids) {
  const dir = CAP + '/' + id;
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  let meta;
  try {
    meta = await page.evaluate((src) => window.loadSrc(src), '/gifs/' + id + '.mp4');
  } catch (e) {
    rows.push({ id, frames: [], err: String(e).slice(0, 60) });
    process.stdout.write('x');
    continue;
  }
  await page.evaluate((rate) => {
    const v = document.getElementById('v');
    window.__q = [];
    window.__done = false;
    let last = null;
    const onFrame = () => {
      const r = window.capture();
      if (r.sig !== last) {
        window.__q.push({ t: r.t, png: r.png });
        last = r.sig;
      }
      if (v.ended) { window.__done = true; return; }
      v.requestVideoFrameCallback(onFrame);
    };
    v.currentTime = 0;
    v.playbackRate = rate;
    v.play().then(() => v.requestVideoFrameCallback(onFrame));
  }, RATE);

  const kept = [];
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) {
    const got = await page.evaluate(() => window.__q.splice(0, 64).map((f) => ({ t: f.t, png: f.png })));
    for (const f of got) {
      if (kept.length < PER) {
        kept.push(f);
        fs.writeFileSync(dir + '/f' + String(kept.length - 1).padStart(2, '0') + '.png',
          Buffer.from(f.png.split(',')[1], 'base64'));
      }
    }
    const done = await page.evaluate(() => window.__done);
    if (done && kept.length >= PER) break;
    if (done && Date.now() - t0 > 3000) break;
    await new Promise((r) => setTimeout(r, 80));
  }
  rows.push({ id, frames: kept.map((f) => f.t), dur: meta.dur, size: meta.w + 'x' + meta.h });
  process.stdout.write('.');
}
process.stdout.write('\n');

const cell = 168;
const html = `<!doctype html><meta charset="utf-8">
<style>
 body{margin:0;background:#141414;color:#eee;font:11px/1.25 -apple-system,sans-serif}
 table{border-collapse:collapse}
 td{padding:2px 4px;vertical-align:top}
 .id{color:#9ad;font-weight:600;white-space:nowrap;width:150px}
 .topic{color:#8c8;width:46px}
 img{width:${cell}px;height:${cell}px;object-fit:contain;background:#000;display:block}
 .t{color:#777;font-size:9px;text-align:center}
</style>
<table>
${rows.map((r, i) => {
  const it = byId.get(r.id);
  return `<tr>
 <td class="id">${i + 1}. ${r.id}<br><span class="t">${it ? it.topic : ''} ${r.size || ''} ${r.dur ? r.dur.toFixed(1) + 's' : ''}</span></td>
 <td class="topic">${it ? it.topic : '?'}</td>
 ${r.frames.map((t, j) => `<td><img src="${r.id}/f${String(j).padStart(2, '0')}.png"><div class="t">${t.toFixed(1)}s</div></td>`).join('')}
 ${r.err ? `<td style="color:#e77">${r.err}</td>` : ''}
</tr>`;
}).join('')}
</table>`;
fs.writeFileSync(CAP + '/bsheet.html', html);

const shot = await browser.newPage({ viewport: { width: 1200, height: 400 } });
await shot.goto(BASE + '/tmp/cap/bsheet.html', { waitUntil: 'networkidle' });
await shot.waitForTimeout(300);
const out = '/tmp/batch-' + label + '.png';
await shot.screenshot({ path: out, fullPage: true });
console.log('sheet -> ' + out + '  (' + rows.filter((r) => r.frames.length).length + '/' + rows.length + ' 有条)');
if (missing.length) console.log('缺片 ' + missing.length + ' 条: ' + missing.join(','));

for (const r of rows) {
  const it = byId.get(r.id);
  console.log(`[${r.id}] ${it ? it.status : '?'} ${r.frames.length}f | ` + (it ? it.text.replace(/\s+/g, ' ').slice(0, 200) : ''));
}
await browser.close();

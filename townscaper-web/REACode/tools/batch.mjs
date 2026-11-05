/**
 * batch.mjs — 一次喂一批片子，产出「一张总表 + 一份原文」。
 *
 * 为什么要有这个：逐条跑 video-frames + contact-sheet，每条要开一次 Chrome、
 * 拼一张图、再读一次；12 条就是 12 次往返。学习真正花时间的是「看画面」，
 * 不是开浏览器。所以这里用一条浏览器会话串行抽完全部，最后合成一张
 * N 行 × K 列的总表，配着 data.js 里的原文一起读。
 *
 * 独立运行（不依赖别的会话开的 8801）：
 *   # 1) 在 REACode 根目录起一个服务，端口随意，默认 8817
 *   python3 -m http.server 8817 --bind 127.0.0.1 &
 *   # 2) 抽一批
 *   node tools/batch.mjs <start> <count> [framesPerClip] [rate]
 *
 * 依赖：channels 里 /tools/player.html、/gifs/<id>.mp4 都由同一个服务提供，
 * 抽出来的帧写回 REACode/tmp/cap/<id>/，总表也写在 tmp/cap/ 下，
 * 所以整条链路只有一个 http 根，换机器只改 BASE。
 *
 * 产物：
 *   tmp/cap/<id>/f0x.png        每条抽到的帧
 *   tmp/cap/bsheet.html
 *   /tmp/batch-<start>.png      总表截图（12 条一屏）
 *   stdout                      每条的 id / topic / 原文（截断 200 字）
 */
import { chromium } from '/Users/panglaohu/Downloads/TigerInBamboo/REA-agent/node_modules/playwright-core/index.mjs';
import fs from 'node:fs';
import vm from 'node:vm';

const ROOT = '/Users/panglaohu/Downloads/TigerInBamboo/townscaper-web/REACode';
const PORT = Number(process.env.BATCH_PORT || 8817);
const BASE = `http://127.0.0.1:${PORT}`;
const CAP = ROOT + '/tmp/cap';

const start = Number(process.argv[2] || 0);
const count = Number(process.argv[3] || 12);
const PER = Number(process.argv[4] || 6);
const RATE = Number(process.argv[5] || 2);

const queue = JSON.parse(fs.readFileSync(ROOT + '/learn/queue.json', 'utf8')).items.slice(start, start + count);
if (!queue.length) {
  console.log('队列已空：start=' + start + ' 超过总数');
  process.exit(0);
}

// 原文从 data.js 取，未登记的没有
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(ROOT + '/learn/data.js', 'utf8'), ctx);
const byId = new Map(ctx.window.LEARN.items.map((it) => [it.id, it]));

fs.mkdirSync(CAP, { recursive: true });
// 缺片直接报出来，不要静默跳过
const missing = queue.filter((q) => !fs.existsSync(ROOT + '/gifs/' + q.id + '.mp4'));

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox', '--mute-audio'],
});
const page = await browser.newPage({ viewport: { width: 640, height: 640 } });
await page.goto(BASE + '/tools/player.html', { waitUntil: 'load' });

const rows = [];
for (const q of queue) {
  const dir = CAP + '/' + q.id;
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  let meta;
  try {
    meta = await page.evaluate((src) => window.loadSrc(src), '/gifs/' + q.id + '.mp4');
  } catch (e) {
    rows.push({ ...q, frames: [], err: String(e).slice(0, 60) });
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
  rows.push({ ...q, frames: kept.map((f) => f.t), dur: meta.dur, size: meta.w + 'x' + meta.h });
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
${rows.map((r, i) => `<tr>
 <td class="id">${start + i}. ${r.id}<br><span class="t">${r.size || ''} ${r.dur ? r.dur.toFixed(1) + 's' : ''}</span></td>
 <td class="topic">${r.topic}</td>
 ${r.frames.map((t, j) => `<td><img src="${r.id}/f${String(j).padStart(2, '0')}.png"><div class="t">${t.toFixed(1)}s</div></td>`).join('')}
 ${r.err ? `<td style="color:#e77">${r.err}</td>` : ''}
</tr>`).join('')}
</table>`;
fs.writeFileSync(CAP + '/bsheet.html', html);

const shot = await browser.newPage({ viewport: { width: 1200, height: 400 } });
await shot.goto(BASE + '/tmp/cap/bsheet.html', { waitUntil: 'networkidle' });
await shot.waitForTimeout(300);
const out = '/tmp/batch-' + start + '.png';
await shot.screenshot({ path: out, fullPage: true });
console.log('sheet -> ' + out + '  (' + rows.filter((r) => r.frames.length).length + '/' + rows.length + ' 有条)');
if (missing.length) console.log('缺片 ' + missing.length + ' 条: ' + missing.map((m) => m.id).join(','));

for (const r of rows) {
  const it = byId.get(r.id);
  const txt = it ? it.text.replace(/\s+/g, ' ') : '(未登记)';
  console.log(`[${r.id}] ${r.topic} ${r.status} ${r.frames.length}f | ` + txt.slice(0, 200));
}
await browser.close();

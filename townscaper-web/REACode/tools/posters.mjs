/**
 * posters.mjs — 给「有 mp4、没登记」的老片各抽一张封面，供清单页快速扫。
 *
 * 为什么要封面而不是第一帧：第一帧多半是黑场或者还没进入画面；
 * 这里按 4 倍速播，取第 3 个不同帧（约 t≈0.6~1.2s）当封面，
 * 再看画面上有没有东西。
 *
 * 用法：node tools/posters.mjs [输出目录]
 * 产物：<输出目录>/<id>.jpg + <输出目录>/index.json
 */
import { chromium } from '/Users/panglaohu/Downloads/TigerInBamboo/REA-agent/node_modules/playwright-core/index.mjs';
import fs from 'node:fs';
import vm from 'node:vm';

const ROOT = '/Users/panglaohu/Downloads/TigerInBamboo/townscaper-web/REACode';
const PORT = Number(process.env.BATCH_PORT || 8817);
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = process.argv[2] || ROOT + '/learn/thumbs-unreg';
fs.mkdirSync(OUT, { recursive: true });

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(ROOT + '/learn/data.js', 'utf8'), ctx);
const known = new Set(ctx.window.LEARN.items.map((i) => i.id));
const ALL_OLD = process.argv.includes('--old');   // 2016–2017 的老片全抽，不管登没登记
const isOld = (id) => {
  const y = new Date(Number(BigInt(id) >> 22n) + 1288834974657).getUTCFullYear();
  return y >= 2016 && y <= 2017;
};
let ids = fs.readdirSync(ROOT + '/gifs').filter((f) => f.endsWith('.mp4'))
  .map((f) => f.replace('.mp4', '')).filter((id) => (ALL_OLD ? isOld(id) : !known.has(id)));

// 断点续跑：index.json 里已经有封面的跳过，上次被打断不用从头来
const idxPath = OUT + '/index.json';
const prev = fs.existsSync(idxPath) ? JSON.parse(fs.readFileSync(idxPath, 'utf8')) : [];
const doneIds = new Set(prev.filter((r) => r.poster).map((r) => r.id));
ids = ids.filter((id) => !doneIds.has(id));
console.log('未登记总数 ' + (ids.length + doneIds.size) + ' 条，本次待抽 ' + ids.length + ' 条（已有封面 ' + doneIds.size + '）');
if (!ids.length) { console.log('全部已有封面'); process.exit(0); }

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox', '--mute-audio'],
});
const page = await browser.newPage({ viewport: { width: 640, height: 640 } });
await page.goto(BASE + '/tools/player.html', { waitUntil: 'load' });

// 雪花 ID → 日期
const snowDate = (id) => new Date(Number(BigInt(id) >> 22n) + 1288834974657).toISOString().slice(0, 10);
const index = [];

for (const id of ids) {
  let meta;
  try {
    meta = await page.evaluate((src) => window.loadSrc(src), '/gifs/' + id + '.mp4');
  } catch (e) {
    console.log('x ' + id + ' 载入失败');
    index.push({ id, date: snowDate(id), err: String(e).slice(0, 40) });
    continue;
  }
  await page.evaluate(() => {
    const v = document.getElementById('v');
    window.__q = []; window.__done = false;
    let last = null;
    const onFrame = () => {
      const r = window.capture();
      if (r.sig !== last) { window.__q.push({ t: r.t, png: r.png }); last = r.sig; }
      if (v.ended) { window.__done = true; return; }
      v.requestVideoFrameCallback(onFrame);
    };
    v.currentTime = 0; v.playbackRate = 4;
    v.play().then(() => v.requestVideoFrameCallback(onFrame));
  });

  const kept = [];
  const t0 = Date.now();
  while (Date.now() - t0 < 8000) {
    const got = await page.evaluate(() => window.__q.splice(0, 32).map((f) => ({ t: f.t, png: f.png })));
    for (const f of got) if (kept.length < 3) kept.push(f);
    if (kept.length >= 3) break;
    const done = await page.evaluate(() => window.__done);
    if (done) break;
    await new Promise((r) => setTimeout(r, 70));
  }

  const pick = kept[Math.min(2, kept.length - 1)];
  if (pick) {
    fs.writeFileSync(OUT + '/' + id + '.jpg', Buffer.from(pick.png.split(',')[1], 'base64'));
    index.push({ id, date: snowDate(id), dur: +meta.dur.toFixed(2), w: meta.w, h: meta.h, t: +pick.t.toFixed(2), poster: id + '.jpg' });
  } else {
    index.push({ id, date: snowDate(id), dur: +meta.dur.toFixed(2), w: meta.w, h: meta.h, err: 'no frame' });
  }
  process.stdout.write('.');
}
process.stdout.write('\n');
const merged = [...prev.filter((r) => r.poster), ...index].sort((a, b) => (a.id < b.id ? -1 : 1));
fs.writeFileSync(idxPath, JSON.stringify(merged, null, 1));
console.log('完成本次 ' + index.filter((i) => i.poster).length + '/' + ids.length + '，累计 ' + merged.length + ' -> ' + OUT);
await browser.close();

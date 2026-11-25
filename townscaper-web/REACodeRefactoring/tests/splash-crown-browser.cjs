// 1258421104756097029 · 第 165 轮：「splashier splashes」——主场景默认档的运行验收。
//
// 片子（436 帧，见 artifacts/coverage/1258421104756097029-review-r165.md）：
//   ① 落水瞬间竖起一圈竖直水帘（冠状、几乎不外抛），~0.35s 到顶、0.9s 前塌落；
//   ② 水面 2–3 圈同心泡沫环向外扩，事件后 3.2s 仍有淡环；
//   ③ 9–12 颗圆飞沫，偏竖直，落回水面即灭。
// 机制 r56 就在 src/life/splash-c07.js（10 条 / 3 圈 3.8s / 10–12 颗），但只有 `?c07=splash` 才装，默认场景仍是旧的一圈 1.1s +
// 26 颗外抛飞沫，且从没在页面上跑过。本轮把默认改到冠状档（`?splash=plain` 对照），下面用真实像素回答形态问题。
//
// 量具：uTime 由本测手写（冻 render），同一 t 下**开/关水花层**做整帧差分 —— 水面本身也吃 uTime（岸沫在动），
// 直接数白像素会把岸沫算进水花（第一版就这么错了：0.1s 887 → 1.1s 5201）。
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function decodePng(buf) {
  let p = 8, w = 0, h = 0, ch = 0, idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ch = data[9] === 6 ? 4 : (data[9] === 2 ? 3 : 0); if (!ch) throw Error('unsupported color type ' + data[9]); }
    else if (type === 'IDAT') idat.push(data); else if (type === 'IEND') break;
    p += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * ch, out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride), cur = out.subarray(y * stride, y * stride + stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0, b = y ? out[(y - 1) * stride + x] : 0, c = (x >= ch && y) ? out[(y - 1) * stride + x - ch] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      cur[x] = v & 255;
    }
  }
  return { w, h, ch, data: out };
}
const lum = (im, x, y) => { const i = (y * im.w + x) * im.ch; return 0.299 * im.data[i] + 0.587 * im.data[i + 1] + 0.114 * im.data[i + 2]; };

/** 阈值白像素（只看 on 帧，用于「水帘是否真的画出来」）。 */
function whiteCount(im, box, thr) {
  let n = 0;
  for (let y = Math.max(0, box.y0); y < Math.min(im.h, box.y1); y++) for (let x = Math.max(0, box.x0); x < Math.min(im.w, box.x1); x++) if (lum(im, x, y) >= thr) n++;
  return n;
}

/** 开/关差分：>16 亮度差的像素算「被水花层改过」，返回计数、包围盒、按半径的峰。 */
function diffStats(on, off, box, cx, cy) {
  let px = 0, x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
  const hist = new Array(60).fill(0);
  for (let y = Math.max(0, box.y0); y < Math.min(on.h, box.y1); y++) for (let x = Math.max(0, box.x0); x < Math.min(on.w, box.x1); x++) {
    if (Math.abs(lum(on, x, y) - lum(off, x, y)) <= 16) continue;
    px++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    const b = Math.floor(Math.hypot(x - cx, y - cy) / 180 * 60); if (b >= 0 && b < 60) hist[b]++;
  }
  const peaks = [];
  for (let b = 1; b < 59; b++) if (hist[b] >= 6 && hist[b] >= hist[b - 1] && hist[b] > hist[b + 1]) peaks.push({ r: +(b * 3).toFixed(0), n: hist[b] });
  return { px, w: px ? x1 - x0 + 1 : 0, h: px ? y1 - y0 + 1 : 0, top: px ? y0 : 0, peaks: peaks.filter((p, i) => i === 0 || p.r - peaks[i - 1].r > 6) };
}

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const base = process.env.REA_TEST_URL || 'http://localhost:8769';
  const shotDir = path.resolve(__dirname, '../artifacts/coverage') + path.sep;
  const out = {}, errors = [];

  async function setup(url) {
    const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
    p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await p.goto(url);
    await p.waitForFunction(() => window.rea?.view?.effects && (window.rea.world?.cells?.length || 0) > 0, null, { timeout: 90000 });
    await p.waitForTimeout(900);
    const geo = await p.evaluate(() => {
      const v = rea.view, w = rea.world;
      v.__orig = v.render.bind(v); v.render = () => v.__orig(0);  // 冻时间轴（r164 做法）：循环照画，但 dt=0、uTime 由测试手写
      const cells = w.cells.filter((c) => w.top(c) === 0 && !w.isRock?.(c, 0));
      const near = cells.find((c) => (w.neighbors?.(c) ?? []).some((n) => n && w.top(n) > 0)) || cells[0];
      v.target.set(near.cx, 0, near.cz); v.distance = 6.2; v.pitch = 0.82; v.updateCamera();
      v.autoRotate = false;
      return { id: near.id, cx: near.cx, cz: near.cz, L: v.levelHeight, style: v.effects.splashStyle };
    });
    return { p, geo };
  }

  /** 同一 t 下开/关水花层（crown 组 + 旧环）各拍一张，差分。 */
  async function measure(page, geo, t, shot) {
    const box = { x0: 0, y0: 0, x1: 1e9, y1: 1e9 };
    const onBuf = await page.evaluate((t) => {
      const v = rea.view, fx = v.effects; v.waterUniforms.uTime.value = t;
      fx.crown.group.visible = fx.splashStyle === 'crown'; fx.rings.visible = fx.splashStyle === 'plain';
      return { uTime: v.waterUniforms.uTime.value };
    }, t);
    await page.waitForTimeout(260);
    const on = decodePng(await page.screenshot(shot ? { path: shot } : {}));
    const c = await page.evaluate(({ cx, cz }) => {
      const v = rea.view, p = new (rea.view.camera.position.constructor)(cx, 0, cz).project(v.camera);
      return [Math.round((p.x * .5 + .5) * innerWidth), Math.round((-p.y * .5 + .5) * innerHeight)];
    }, { cx: geo.cx, cz: geo.cz });
    box.x0 = Math.max(0, c[0] - 260); box.x1 = Math.min(on.w, c[0] + 260);
    box.y0 = Math.max(0, c[1] - 280); box.y1 = Math.min(on.h, c[1] + 120);
    await page.evaluate(() => { const fx = rea.view.effects; fx.crown.group.visible = false; fx.rings.visible = false; });
    await page.waitForTimeout(260);
    const off = decodePng(await page.screenshot());
    const whites = {};
  for (const thr of [200, 215, 230]) whites[thr] = whiteCount(on, box, thr);
  // 水帘窗：中心正上方 140×62（水线以上 8–70px）—— 片子里的竖直水帘正好长在这块，岸沫/白垩房都在窗外
  const crownBox = { x0: c[0] - 70, x1: c[0] + 70, y0: c[1] - 70, y1: c[1] - 8 };
  const crownWhite = whiteCount(on, crownBox, 225);
  return { ...diffStats(on, off, box, c[0], c[1]), whites, crownWhite, screen: c };
  }

  /* ---------------- A · 默认档 ---------------- */
  const A = await setup(base + '/index.html');
  out.style = A.geo.style;
  out.spawn = await A.p.evaluate(({ cx, cz, L }) => {
    const w = rea.world, c = w.cells.find((x) => Math.abs(x.cx - cx) < 1e-6 && Math.abs(x.cz - cz) < 1e-6);
    rea.view.waterUniforms.uTime.value = 0;
    rea.view.effects.onEdit(c, 0, 1, L);        // 主场景真实触发口径：第一块落进水里
    return { id: c.id, style: rea.view.effects.splashStyle };
  }, { cx: A.geo.cx, cz: A.geo.cz, L: A.geo.L });

  out.stats = {};
  for (const t of [0.02, 0.18, 0.34, 0.6, 0.88, 1.05, 1.6, 2.4, 3.2, 3.9]) out.stats[t] = await A.p.evaluate((t) => rea.view.effects.splashStats(t), t);

  out.pix = {};
  for (const t of [0.3, 0.8, 1.6, 3.2]) out.pix[t] = await measure(A.p, A.geo, t, t === 0.3 ? shotDir + 'splash-crown-top-r165.png' : (t === 3.2 ? shotDir + 'splash-crown-rings-r165.png' : null));
  out.noise = (await measure(A.p, A.geo, 0.3)).px - out.pix[0.3].px;
  await A.p.close();

  /* ---------------- B · 旧档对照 ---------------- */
  const B = await setup(base + '/index.html?splash=plain');
  out.plainStyle = B.geo.style;
  await B.p.evaluate(({ cx, cz, L }) => {
    const w = rea.world, c = w.cells.find((x) => Math.abs(x.cx - cx) < 1e-6 && Math.abs(x.cz - cz) < 1e-6);
    rea.view.waterUniforms.uTime.value = 0; rea.view.effects.onEdit(c, 0, 1, L);
  }, { cx: B.geo.cx, cz: B.geo.cz, L: B.geo.L });
  out.plainDraw = await B.p.evaluate(() => ({ ringN: rea.view.effects.ringN, rings: rea.view.effects.rings.count, crownEvents: rea.view.effects.crown.stats(0).events }));
  out.plainPix = {};
  for (const t of [0.3, 3.2]) out.plainPix[t] = await measure(B.p, B.geo, t, t === 3.2 ? shotDir + 'splash-plain-rings-r165.png' : null);
  await B.p.close();
  await b.close();

  /* ---------------- 断言 ---------------- */
  const s = out.stats;
  const need = (ok, m) => { if (!ok) throw Error('FAIL ' + m + ' :: ' + JSON.stringify({ style: out.style, stats: { h034: s[0.34].crown, r05: s[0.6].rings, r32: s[3.2].rings, drops: s[0.02].drops }, pix: out.pix, plain: out.plainDraw, plainPix: out.plainPix, noise: out.noise }, null, 1)); };
  need(out.style === 'crown', 'default style must be crown');
  // ① 冠状：10 条、0.34s 到顶、0.9s 前塌落
  need(s[0.34].crown.strips === 10, '10 crown strips');
  need(s[0.34].crown.h > 0.28 && s[0.34].crown.h <= 0.40, 'crown peak height ≈0.6·scale');
  need(s[0.18].crown.h > 0.05 && s[0.18].crown.h < s[0.34].crown.h, 'crown rises to peak');
  need(!s[1.05].crown.alive && s[0.88].crown.h < 0.03, 'crown collapses before 0.9s');
  // ② 环：3 圈、3.2s 仍 3 圈且半径随时间外扩、3.9s 首圈已死
  need(s[0.6].rings.total === 3 && s[0.6].rings.alive === 3, 'three rings by 0.6s');
  need(s[3.2].rings.alive === 3 && s[3.2].rings.states[0].r > s[0.6].rings.states[0].r, '3 rings alive at 3.2s and expanding');
  need(s[3.9].rings.alive === 2, 'first ring expires just after 3.8s');
  // ③ 飞沫 10–12
  need(s[0.02].drops.spawned >= 10 && s[0.02].drops.spawned <= 12, '10-12 droplets');
  // 画面：水帘窗（中心正上方，水线以上 8–70px）在 0.3s 有 700+ 亮像素，0.8s 减半，1.6s 归零 —— 竖起→塌落
  need(out.pix[0.3].crownWhite > 500, 'crown strips drawn in the window above the waterline at 0.3s');
  need(out.pix[0.8].crownWhite > 0 && out.pix[0.8].crownWhite < out.pix[0.3].crownWhite, 'crown collapsing at 0.8s');
  need(out.pix[1.6].crownWhite === 0 && out.pix[3.2].crownWhite === 0, 'no crown left after 0.9s');
  // 3.2s 环还在画：关掉水花层后整帧仍有 >80px 差异（环 + 水面倒影），且白像素只到 215 档（环是淡的、不是水帘）
  need(out.pix[3.2].px > 80 && out.pix[3.2].whites[230] === 0, 'faint rings still affect the frame at 3.2s');
  need(out.noise === 0, 'same-t rerender noise 0');
  // 对照档：旧一圈 + 26 颗，3.2s 已全没
  need(out.plainStyle === 'plain' && out.plainDraw.ringN === 1 && out.plainDraw.crownEvents === 0, 'plain uses legacy ring, no crown');
  need(out.plainPix[3.2].px < out.pix[3.2].px * 0.35, 'plain splash is gone at 3.2s');
  need(errors.length === 0, 'no console errors :: ' + errors.join(' | '));

  fs.writeFileSync(shotDir + 'splash-crown-browser.json', JSON.stringify({ ok: true, ...out, errors }, null, 1));
  console.log('ALL PASS', JSON.stringify({
    style: out.style, crown: { strips: s[0.34].crown.strips, h: s[0.34].crown.h, dead105: !s[1.05].crown.alive },
    rings: { total: s[0.6].rings.total, alive32: s[3.2].rings.alive, r32: s[3.2].rings.states.map((r) => r.r), a32: s[3.2].rings.states.map((r) => r.a) },
    drops: s[0.02].drops.spawned,
    pix: Object.fromEntries(Object.entries(out.pix).map(([k, v]) => [k, { px: v.px, h: v.h, peaks: v.peaks.slice(0, 4) }])),
    plain: { ringN: out.plainDraw.ringN, px32: out.plainPix[3.2].px },
    noise: out.noise,
  }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });

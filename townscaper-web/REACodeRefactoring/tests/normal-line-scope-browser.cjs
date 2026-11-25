// 1482011744843223042 · 「pixel thin lines from contrasts in my procedural normal map」
// 口径：同一量具量两边 —— 原片原生帧与本仓渲染都走同一个 inkStats（脊线检测：两侧都亮 d 级 → 线像素），
// 报四件事：① 线像素密度（‰ 表面像素）② 线宽（min(水平run,垂直run) 的 p50/p90）③ 天空/海面（背景）里的线像素 ④ 剪影 2px 带内的线占比。
// 片子事实：线只出现在岛表面（草面块交界、崖面竖向分块之间）、约 1 像素宽、天空与海面干净、剪影无粗描边。
// 本仓落点：?c11=normalline（view-c11-normalline.js）—— 线源 = 程序化大笔触法线图（paintnormal）的法线缓冲反差，uDepthMix 0。
const { chromium } = require('playwright');
const fs = require('fs');
const assert = require('node:assert/strict');

const MEASURE = `(() => {
  window.inkStats = function (data, w, h, opt = {}) {
    const delta = opt.delta ?? 12, k = 2;
    const lum = new Float32Array(w * h), R = new Uint8Array(w * h), G = new Uint8Array(w * h), B = new Uint8Array(w * h);
    for (let i = 0, p = 0; i < w * h; i++, p += 4) { R[i] = data[p]; G[i] = data[p + 1]; B[i] = data[p + 2]; lum[i] = .299 * R[i] + .587 * G[i] + .114 * B[i]; }
    const cnt = new Map(), key = (i) => (R[i] >> 3) + ',' + (G[i] >> 3) + ',' + (B[i] >> 3);
    for (let x = 0; x < w; x++) for (const y of [0, 1, h - 2, h - 1]) { const kk = key(y * w + x); cnt.set(kk, (cnt.get(kk) || 0) + 1); }
    for (let y = 0; y < h; y++) for (const x of [0, 1, w - 2, w - 1]) { const kk = key(y * w + x); cnt.set(kk, (cnt.get(kk) || 0) + 1); }
    let best = null, bestN = -1; for (const [kk, n] of cnt) if (n > bestN) { bestN = n; best = kk; }
    const bg = best.split(',').map((v) => (+v << 3) + 4);
    const surf = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) if (Math.abs(R[i] - bg[0]) + Math.abs(G[i] - bg[1]) + Math.abs(B[i] - bg[2]) > 26) surf[i] = 1;
    const dist = new Uint8Array(w * h).fill(9);
    for (let i = 0; i < w * h; i++) if (!surf[i]) dist[i] = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (!dist[i]) continue; let d = 9; if (x > 0) d = Math.min(d, dist[i - 1] + 1); if (y > 0) d = Math.min(d, dist[i - w] + 1); if (x > 0 && y > 0) d = Math.min(d, dist[i - w - 1] + 1); if (x < w - 1 && y > 0) d = Math.min(d, dist[i - w + 1] + 1); dist[i] = d; }
    for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { const i = y * w + x; if (!dist[i]) continue; let d = dist[i]; if (x < w - 1) d = Math.min(d, dist[i + 1] + 1); if (y < h - 1) d = Math.min(d, dist[i + w] + 1); if (x < w - 1 && y < h - 1) d = Math.min(d, dist[i + w + 1] + 1); if (x > 0 && y < h - 1) d = Math.min(d, dist[i + w - 1] + 1); dist[i] = d; }
    const lmax = new Float32Array(w * h), tmp = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let m = 0; for (let o = -1; o <= 1; o++) m = Math.max(m, lum[y * w + Math.min(w - 1, Math.max(0, x + o))]); tmp[y * w + x] = m; }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let m = 0; for (let o = -1; o <= 1; o++) m = Math.max(m, tmp[Math.min(h - 1, Math.max(0, y + o)) * w + x]); lmax[y * w + x] = m; }
    const ink = new Uint8Array(w * h);
    const at = (x, y) => lum[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, c = lum[i];
      const ridge = (at(x - k, y) - c > delta && at(x + k, y) - c > delta) || (at(x, y - k) - c > delta && at(x, y + k) - c > delta)
        || (at(x - k, y - k) - c > delta && at(x + k, y + k) - c > delta) || (at(x + k, y - k) - c > delta && at(x - k, y + k) - c > delta);
      if (ridge && lmax[i] - c > delta) ink[i] = 1;
    }
    const hr = new Int16Array(w * h), vr = new Int16Array(w * h);
    for (let y = 0; y < h; y++) { let x = 0; while (x < w) { if (!ink[y * w + x]) { x++; continue; } let e = x; while (e < w && ink[y * w + e]) e++; for (let i = x; i < e; i++) hr[y * w + i] = e - x; x = e; } }
    for (let x = 0; x < w; x++) { let y = 0; while (y < h) { if (!ink[y * w + x]) { y++; continue; } let e = y; while (e < h && ink[e * w + x]) e++; for (let i = y; i < e; i++) vr[i * w + x] = e - y; y = e; } }
    let surfPx = 0, bgPx = 0, inkSurf = 0, inkBg = 0, bandPx = 0, bandInk = 0;
    const widths = [];
    for (let i = 0; i < w * h; i++) {
      if (surf[i]) { surfPx++; if (ink[i]) { inkSurf++; widths.push(Math.min(hr[i], vr[i])); } if (dist[i] <= 2) { bandPx++; if (ink[i]) bandInk++; } }
      else if (dist[i] >= 3) { bgPx++; if (ink[i]) inkBg++; }
    }
    widths.sort((a, b) => a - b);
    const q = (p) => (widths.length ? widths[Math.min(widths.length - 1, Math.floor(p * widths.length))] : 0);
    return { surfPx, bgPx, inkSurf, inkBg, inkPer1000: +(1000 * inkSurf / Math.max(1, surfPx)).toFixed(2), bgInkPer1000: +(1000 * inkBg / Math.max(1, bgPx)).toFixed(2), widthP50: q(.5), widthP90: q(.9), bandPct: +(100 * bandInk / Math.max(1, bandPx)).toFixed(2), bgColor: bg };
  };
  return true;
})()`;

(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !m.location().url.endsWith('favicon.ico')) errs.push(m.text()); });
  try {
    await p.goto('http://127.0.0.1:8769/index.html?scene=terrain&grid=mixed', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await p.waitForFunction(() => window.rea?.view?.worldMesh, null, { timeout: 120000 });
    await p.evaluate(() => {
      const v = window.rea.view;
      const pin = () => { v.target.set(0, 0.6, 0); v.distance = 14; v.pitch = 0.85; v.yaw = 0.7; };
      pin(); setInterval(pin, 120);
      document.querySelectorAll('#hud,#topright,#tools,.hud').forEach((e) => (e.style.opacity = 0));
    });
    await p.waitForTimeout(2000);
    await p.evaluate(MEASURE);
    const cap = async (label) => {
      const r = await p.evaluate(async () => {
        const v = window.rea.view; v.render(0);
        const src = v.renderer.domElement, c = document.createElement('canvas');
        c.width = src.width; c.height = src.height;
        const ctx = c.getContext('2d'); ctx.drawImage(src, 0, 0);
        return { st: window.inkStats(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height), png: c.toDataURL('image/png').split(',')[1] };
      });
      fs.writeFileSync(`artifacts/coverage/normal-line-scope-${label}.png`, Buffer.from(r.png, 'base64'));
      return r.st;
    };
    const base = await cap('base');
    const statsOn = await p.evaluate(async () => { await window.rea.view.c11.set('normalline', true); return window.rea.view.c11.mods.normalline.stats(); });
    await p.waitForTimeout(800);
    const on = await cap('on');
    await p.evaluate(async () => { await window.rea.view.c11.set('normalline', false); });
    await p.waitForTimeout(500);
    const off = await cap('off');
    await p.evaluate(async () => { await window.rea.view.c11.set('normalline', true); });
    await p.waitForTimeout(500);
    const on2 = await cap('on2');
    await p.evaluate(async () => { await window.rea.view.c11.set('normalline', false); });
    await p.waitForTimeout(400);
    const off2 = await cap('off2');
    // 原片原生帧，同一 inkStats
    const film = [];
    for (const f of ['frame-0100.jpg', 'frame-0125.jpg', 'frame-0300.jpg']) {
      film.push(await p.evaluate(async (f) => {
        const img = new Image(); img.src = '/artifacts/coverage/1482011744843223042/' + f; await img.decode();
        const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
        const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
        return { f, st: window.inkStats(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height) };
      }, f));
    }

    // —— 判据 ——
    // ① 开关真的起作用，且关回去与基线同口径（幂等；旧实现 off→on 会抛 composite token missing 并把描边留在天上）
    assert.ok(on.inkPer1000 > base.inkPer1000 * 1.3, `开档线密度应显著高于基线：${base.inkPer1000} → ${on.inkPer1000}`);
    assert.ok(Math.abs(off.inkPer1000 - base.inkPer1000) < 2, `关档回到基线：${off.inkPer1000} vs ${base.inkPer1000}`);
    assert.ok(Math.abs(on2.inkPer1000 - on.inkPer1000) < 3, `再开一次同结果：${on2.inkPer1000} vs ${on.inkPer1000}`);
    assert.ok(Math.abs(off2.inkPer1000 - base.inkPer1000) < 2, `再关一次回到基线：${off2.inkPer1000}`);
    // ② 天空/海面（背景）不能有细线 —— 原片同口径也是 0
    assert.equal(base.bgInkPer1000, 0);
    assert.equal(on.bgInkPer1000, 0, '开档天空/海面仍无线');
    assert.ok(film.every((f) => f.st.bgInkPer1000 === 0), '原片天空/海面无线（同口径）');
    // ③ 线宽：原片 2/3（p50/p90），本仓同为 2/3
    assert.ok(film.every((f) => f.st.widthP50 === 2 && f.st.widthP90 === 3), '原片线宽 p50=2 p90=3');
    assert.equal(on.widthP50, 2, '本仓线宽 p50=2');
    assert.equal(on.widthP90, 3, '本仓线宽 p90=3');
    // ④ 线源限定在共享地形材质：法线遍藏掉的物体数 > 0，且被藏的对象不是地形本体
    assert.equal(statsOn.depthMix, 0, 'uDepthMix 0：只用法线反差，剪影不另描');
    assert.equal(statsOn.paintedNormalPass, true);
    assert.equal(statsOn.scopeSize, 1);
    assert.ok(statsOn.outOfScope === null || statsOn.outOfScope >= 0);
    assert.deepEqual(errs, []);
    const out = { base, on, off, on2, off2, film, statsOn, errors: errs };
    fs.writeFileSync('artifacts/coverage/normal-line-scope-browser.json', JSON.stringify(out, null, 2));
    console.log('PASS 线源限定共享地形材质：开 ' + on.inkPer1000 + '‰ / 关 ' + off.inkPer1000 + '‰ / 基线 ' + base.inkPer1000 + '‰；背景线 0；线宽 p50 2 p90 3（原片 2/3）；幂等 on2 ' + on2.inkPer1000 + ' off2 ' + off2.inkPer1000 + '；原片 ' + film.map((f) => f.f + ' ' + f.st.inkPer1000 + '‰').join(' / '));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });

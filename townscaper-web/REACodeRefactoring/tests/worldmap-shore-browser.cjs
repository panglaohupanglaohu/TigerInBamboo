// r154 · 1783792917183606829「Texture test!」岸缘贴图（src/sphere/worldmap-shore.js）运行验收
// 页面：planet.html?map=1&stage=maptest&shore=1（「贴图测试」球 = 原片那颗光滑贴图星球）
// 口径：原片四件事逐条量 —— ① 陆侧沿海一圈深色暗带 ② 海侧数道平行浪线（越外越淡、断断续续）
// ③ 少数海湾的浅色沙滩月牙 ④ 陆内两色草块；外加 note 里的「3D 纹理」主张（无极点拉伸 / 无经度接缝）
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const BASE = 'http://127.0.0.1:8769/planet.html?map=1&stage=maptest';
const LAUNCH = { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] };
const OUT = 'artifacts/coverage';

// —— 页面内一次算完：屏幕层 A/B（A = 页面 ?shore=1 装的材质，B = 同 API 的 r55 基线材质）+ 贴图层统计 ——
const PROBE = async ({ yaw, distF, wantTex, shot }) => {
  const L = window.planetLighting, d = window.planetDemo;
  L.renderer.setAnimationLoop(null);
  document.getElementById('ui').style.display = 'none';
  const mesh = d.world.children.find((c) => c.isMesh);
  const matA = mesh.material;
  const out = { yaw, distF };

  d.world.rotation.set(0.12, yaw, 0);
  const R = d.planet.R;
  L.camera.position.set(0, 0.35, R * distF); L.camera.lookAt(0, 0.12, 0);
  const gl = L.renderer.getContext(), cv = L.renderer.domElement, w = cv.width, h = cv.height;
  const grab = () => { L.renderer.render(L.scene, L.camera); const b = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, b); return b; };
  const A = grab(), A2 = grab();                        // 同状态再渲一次 → 噪声应为 0
  mesh.material = window.__r55mat;
  const B = grab();
  mesh.material = matA;

  let noise = 0;
  for (let k = 0; k < w * h * 4; k++) if (A[k] !== A2[k]) noise++;
  const lum = (b, i) => .299 * b[i] + .587 * b[i + 1] + .114 * b[i + 2];
  const sat = (r, g, bl) => { const mx = Math.max(r, g, bl), mn = Math.min(r, g, bl); return mx ? (mx - mn) / mx : 0; };
  // 陆/海掩码取自 r55 基线（同一几何同一机位，只有配色不同）
  const cls = new Uint8Array(w * h);
  for (let k = 0; k < w * h; k++) {
    const i = k * 4, r = B[i], g = B[i + 1], b = B[i + 2];
    if (Math.abs(r - 38) + Math.abs(g - 51) + Math.abs(b - 59) < 26) { cls[k] = 0; continue; }
    const mx = Math.max(r, g, b), s = sat(r, g, b);
    cls[k] = (mx > 165 && s < 0.30) || g > b + 4 ? 1 : 2;
  }
  // 到对岸的屏幕距离（双向 chamfer）
  const INF = 1e6, dist = new Float32Array(w * h).fill(INF);
  for (let k = 0; k < w * h; k++) {
    const c = cls[k]; if (!c) continue;
    const x = k % w, y = (k / w) | 0;
    for (const [xx, yy] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]])
      if (xx >= 0 && xx < w && yy >= 0 && yy < h && cls[yy * w + xx] && cls[yy * w + xx] !== c) { dist[k] = 1; break; }
  }
  for (let pass = 0; pass < 2; pass++) for (let n = 0; n < w * h; n++) {
    const k = pass === 0 ? n : w * h - 1 - n, c = cls[k]; if (!c || dist[k] <= 1) continue;
    const x = k % w, y = (k / w) | 0;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const xx = x + dx, yy = y + dy; if (xx < 0 || xx >= w || yy < 0 || yy >= h) continue;
      const q = yy * w + xx; if (cls[q] !== c) continue;
      const nd = dist[q] + (dx && dy ? 1.4142 : 1); if (nd < dist[k]) dist[k] = nd;
    }
  }
  const bands = [[1, 2], [2, 3], [3, 5], [5, 7], [7, 10], [10, 14], [14, 20], [20, 30]];
  const prof = { land: [], sea: [] };
  for (const side of ['land', 'sea']) for (const [lo, hi] of bands) {
    let n = 0, sA = 0, sB = 0, pos = 0, neg = 0;
    for (let k = 0; k < w * h; k++) {
      if (cls[k] !== (side === 'land' ? 1 : 2)) continue;
      const dd = dist[k]; if (dd < lo || dd >= hi) continue;
      const i = k * 4, la = lum(A, i), lb = lum(B, i);
      n++; sA += la; sB += lb; if (la - lb > 6) pos++; else if (lb - la > 6) neg++;
    }
    prof[side].push({ band: `${lo}-${hi}`, n, dA: n ? +((sA - sB) / n).toFixed(2) : 0, pos, neg });
  }
  let planet = 0, diff = 0, near = 0;
  for (let k = 0; k < w * h; k++) {
    if (!cls[k]) continue; planet++;
    const i = k * 4;
    const dd = Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]);
    if (dd > 24) { diff++; if (dist[k] <= 6) near++; }
  }
  // 沙滩：岸线附近的高明度暖色像素（r ≥ b），两侧各 4px 内都算
  let coastN = 0, coastSand = 0, sandPx = 0;
  for (let k = 0; k < w * h; k++) {
    const i = k * 4, r = A[i], g = A[i + 1], b = A[i + 2];
    if (r > 195 && r >= b + 6 && sat(r, g, b) < 0.26) sandPx++;
    if (cls[k] !== 1 || dist[k] > 1) continue;
    coastN++;
    const x = k % w, y = (k / w) | 0; let hit = false;
    for (let dy = -4; dy <= 4 && !hit; dy++) for (let dx = -4; dx <= 4; dx++) {
      const xx = x + dx, yy = y + dy; if (xx < 0 || xx >= w || yy < 0 || yy >= h) continue;
      const q = yy * w + xx, j = q * 4;
      if (A[j] > 195 && A[j] >= A[j + 2] + 6 && sat(A[j], A[j + 1], A[j + 2]) < 0.26) { hit = true; break; }
    }
    if (hit) coastSand++;
  }
  // 浪线（屏幕层）：海面里比 11×11 局部均值亮 >8 的细线像素，按到岸距离分箱找峰
  const LUM = new Float32Array(w * h);
  for (let k = 0; k < w * h; k++) LUM[k] = lum(A, k * 4);
  const linePx = [], waveHist = new Float64Array(41);
  for (let y = 6; y < h - 6; y++) for (let x = 6; x < w - 6; x++) {
    const k = y * w + x; if (cls[k] !== 2) continue;
    let s2 = 0, n2 = 0;
    for (let dy = -5; dy <= 5; dy += 1) for (let dx = -5; dx <= 5; dx += 1) { s2 += LUM[k + dy * w + dx]; n2++; }
    if (LUM[k] - s2 / n2 > 8 && dist[k] >= 2 && dist[k] <= 40) { linePx.push(k); waveHist[Math.round(dist[k])]++; }
  }
  const wPeaks = [];
  for (let d2 = 3; d2 <= 38; d2++) if (waveHist[d2] > 12 && waveHist[d2] >= waveHist[d2 - 1] && waveHist[d2] >= waveHist[d2 + 1]) wPeaks.push({ px: d2, n: waveHist[d2] });
  out.screen = { w, h, noise, planet, diff, wave: { n: linePx.length, peaks: wPeaks, hist: Array.from(waveHist).map((v) => Math.round(v)) }, diffPct: +(diff / planet * 100).toFixed(2), nearFrac: diff ? +(near / diff).toFixed(3) : 0, prof, coastPx: coastN, sandCover: coastN ? +(coastSand / coastN).toFixed(3) : 0, sandPx };
  if (shot) {
    // 截图用：把 A 再渲一次保证是最新帧
    mesh.material = matA; L.renderer.render(L.scene, L.camera);
    out.shotDone = true;
  }

  if (wantTex) {
    const W = await import('/src/sphere/worldmap.js');
    const S = await import('/src/sphere/worldmap-shore.js');
    const map = W.buildWorldMap({ w: 1024, h: 512, seed: 7 });
    const shore = S.worldMapShoreColors(map), r55 = W.worldMapColors(map);
    const D = S.shoreDistance(map).dist, N = map.w * map.h, gap = 0.022, rim = 0.035;
    const lumT = (k) => .299 * shore.rgba[k * 4] + .587 * shore.rgba[k * 4 + 1] + .114 * shore.rgba[k * 4 + 2];

    // ① 浪线：海侧亮度按「离岸距离」的剖面 → 去掉慢变基线后数峰
    const STEP = 0.0005, MAXR = 0.12, NB = Math.round(MAXR / STEP);
    const bin = new Float64Array(NB), cnt = new Float64Array(NB);
    for (let k = 0; k < N; k++) { if (map.land[k]) continue; const b = Math.floor(D[k] / STEP); if (b >= NB) continue; bin[b] += lumT(k); cnt[b]++; }
    const profS = []; for (let b = 0; b < NB; b++) if (cnt[b] > 20) profS.push({ r: (b + .5) * STEP, L: bin[b] / cnt[b] });
    const W2 = 16;   // ±0.008 rad 基线
    const res = profS.map((p, i) => {
      let s = 0, n = 0;
      for (let j = Math.max(0, i - W2); j <= Math.min(profS.length - 1, i + W2); j++) { s += profS[j].L; n++; }
      return { r: p.r, e: p.L - s / n };
    });
    const peaks = [];
    for (let i = 2; i < res.length - 2; i++)
      if (res[i].e > 0.8 && res[i].e >= res[i - 1].e && res[i].e >= res[i + 1].e && res[i].e > res[i - 2].e && res[i].e > res[i + 2].e) peaks.push({ r: +res[i].r.toFixed(4), e: +res[i].e.toFixed(2) });
    const strong = peaks.filter((p) => p.e > 1.2 && p.r > 0.6 * gap);
    // 抖动会让同一道浪线出现相邻双峰 → 按 0.006 rad 聚成一簇，取簇内最大
    const clusters = [];
    for (const p of strong) {
      const c = clusters[clusters.length - 1];
      if (c && p.r - c.rMax < 0.006) { c.e = Math.max(c.e, p.e); c.rMax = p.r; }
      else clusters.push({ r: p.r, rMax: p.r, e: p.e });
    }
    // ② 暗带：陆侧亮度随离岸距离的剖面
    const lb = new Float64Array(200), lc = new Float64Array(200);
    for (let k = 0; k < N; k++) { if (!map.land[k]) continue; const b = Math.floor(D[k] / (rim / 20)); if (b >= 200) continue; lb[b] += lumT(k); lc[b]++; }
    const profL = []; for (let b = 0; b < 200; b++) if (lc[b] > 20) profL.push({ r: (b + .5) * (rim / 20), L: lb[b] / lc[b] });
    const inner = profL.filter((p) => p.r > 0.35 * rim);
    const dip = inner.reduce((a, p) => (p.L < a.L ? p : a), inner[0]);
    const farL = profL.filter((p) => p.r > 1.3 * rim).map((p) => p.L);
    const grassL = farL.reduce((a, b2) => a + b2, 0) / Math.max(1, farL.length);
    // ③ 沙滩：角色计数（暖色 r>b）与「只出现在岸边」
    let sandN = 0, sandFar = 0;
    for (let k = 0; k < N; k++) { const i = k * 4; if (!(shore.rgba[i] > 200 && shore.rgba[i] >= shore.rgba[i + 2] + 4 && shore.rgba[i + 1] > 190)) continue; sandN++; if (D[k] > 0.03) sandFar++; }
    // ④ 两色草：亮草（g>170）的横向游程 + 两种草的亮度差
    const runs = []; let darkN = 0, darkSum = 0;
    for (let j = 0; j < map.h; j++) {
      let r = 0;
      for (let i = 0; i < map.w; i++) {
        const k = j * map.w + i, isL = map.land[k] && shore.rgba[k * 4 + 1] > 170;
        if (isL) r++; else { if (r) runs.push(r); r = 0; }
        if (map.land[k] && shore.rgba[k * 4 + 1] <= 170 && D[k] > rim) { darkN++; darkSum += lumT(k); }
      }
      if (r) runs.push(r);
    }
    runs.sort((a, b2) => a - b2);
    const hg = new Float64Array(256); let gTot = 0;
    for (let k = 0; k < N; k++) if (map.land[k] && D[k] > rim) { hg[shore.rgba[k * 4 + 1]]++; gTot++; }
    // 两个峰（把 200–255 的沙/墨排除，只看草带 120–200）
    let p1 = 120, p2 = 120;
    for (let g = 121; g < 200; g++) { if (hg[g] > hg[p1]) p1 = g; }
    for (let g = 121; g < 200; g++) { if (Math.abs(g - p1) > 8 && hg[g] > hg[p2]) p2 = g; }
    const lo = Math.min(p1, p2), hi = Math.max(p1, p2);
    let valley = Infinity;
    for (let g = lo + 3; g < hi - 2; g++) valley = Math.min(valley, hg[g]);
    const twoTone = { g1: lo, g2: hi, n1: hg[lo], n2: hg[hi], valley: valley === Infinity ? gTot : valley, ratio: +(Math.min(hg[lo], hg[hi]) / Math.max(1, valley === Infinity ? 1 : valley)).toFixed(1) };
    // ⑤ 极点行：3D 采样下「极点行 = 一个方向」→ 行内几乎恒定；mode:'uv' 作反向对照
    const rowStd = (col, j) => {
      let m = 0; for (let i = 0; i < map.w; i++) m += col.rgba[(j * map.w + i) * 4 + 1]; m /= map.w;
      let v = 0; for (let i = 0; i < map.w; i++) v += (col.rgba[(j * map.w + i) * 4 + 1] - m) ** 2;
      return Math.sqrt(v / map.w);
    };
    const uvMap = W.buildWorldMap({ w: 1024, h: 512, seed: 7, mode: 'uv' }), uvCol = S.worldMapShoreColors(uvMap);
    // ⑥ 经度接缝：第 0 列与第 w−1 列（回绕相邻）之差 vs 行内相邻列差
    const colDiff = (col, i0, i1) => { let s = 0; for (let j = 0; j < map.h; j++) { const a = (j * map.w + i0) * 4, b2 = (j * map.w + i1) * 4; s += Math.abs(col.rgba[a] - col.rgba[b2]) + Math.abs(col.rgba[a + 1] - col.rgba[b2 + 1]) + Math.abs(col.rgba[a + 2] - col.rgba[b2 + 2]); } return s / map.h; };
    out.tex = {
      w: map.w, h: map.h, landPct: map.stats.landPct, coastPx: map.stats.coastPx,
      roles: shore.roles, r55roles: r55.roles, gap, rim,
      seaPeaks: peaks, clusters,
      dipR: +dip.r.toFixed(4), dipL: +dip.L.toFixed(1), grassL: +grassL.toFixed(1), dipDepth: +(grassL - dip.L).toFixed(1),
      sandN, sandFar, sandPerCoast: +(sandN / map.stats.coastPx).toFixed(3),
      grassRunP50: runs.length ? runs[(runs.length * .5) | 0] : 0, grassRunP90: runs.length ? runs[(runs.length * .9) | 0] : 0,
      twoTone,
      poleStd: +Math.max(rowStd(shore, 1), rowStd(shore, map.h - 2)).toFixed(2), eqStd: +rowStd(shore, map.h >> 1).toFixed(2),
      uvPoleStd: +rowStd(uvCol, 1).toFixed(2), uvEqStd: +rowStd(uvCol, uvMap.h >> 1).toFixed(2),
      seam: +colDiff(shore, 0, map.w - 1).toFixed(2), stepIn: +colDiff(shore, 0, 1).toFixed(2),
      stepMid: +colDiff(shore, map.w >> 1, (map.w >> 1) + 1).toFixed(2), stepEnd: +colDiff(shore, map.w - 2, map.w - 1).toFixed(2),
      texelPx: +(640 / (2 * Math.PI * d.planet.R / (1 / d.planet.R * 0 + 1))).toFixed(2),
    };
  }
  return out;
};

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const errors = [];
  const watch = (p) => {
    p.on('pageerror', (e) => errors.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !(m.location().url || '').endsWith('favicon.ico')) errors.push(m.text()); });
  };
  try {
    /* ---------- 0) 页面入口：?shore=1 走岸缘配色；?shore=0 保持 r55（无浪线、有 slope） ---------- */
    const entry = {};
    for (const [q, wantWave] of [['&shore=1', true], ['&shore=0', false]]) {
      const p = await browser.newPage({ viewport: { width: 640, height: 640 } });
      watch(p);
      await p.goto(BASE + q, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await p.waitForFunction(() => window.planetDemo && window.planetDemo.worldMap, null, { timeout: 120000 });
      const wm = await p.evaluate(() => window.planetDemo.worldMap);
      entry[q] = wm.roles;
      assert.equal(!!(wm.roles && wm.roles.wave > 0), wantWave, `页面 ${q} 的配色：wave ${wantWave ? '应有' : '不应有'}`);
      if (!wantWave) assert.ok(wm.roles.slope > 0, 'r55 基线仍应有 slope 角色');
      await p.close();
    }
    console.log('ENTRY', JSON.stringify(entry));

    /* ---------- 1) 主页面：wide / close 两档 + 贴图层 ---------- */
    const page = await browser.newPage({ viewport: { width: 640, height: 640 } });
    watch(page);
    await page.goto(BASE + '&shore=1', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => window.planetDemo && window.planetDemo.worldMap, null, { timeout: 120000 });
    await page.evaluate(async () => {
      const THREE = await import('three');
      const { worldMapTexture, attachWorldMap } = await import('/src/sphere/worldmap-material.js');
      const r55 = worldMapTexture({ w: 1024, h: 512, seed: 7 });
      window.__r55mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .8 });
      attachWorldMap(window.__r55mat, r55.texture, { mix: 1, walls: 1 });
    });
    // 机位扫描：哪个 yaw 的岸线最长、沙滩最多（原片近景正是有沙滩的海湾）
    const scan = await page.evaluate((distF) => {
      const L = window.planetLighting, d = window.planetDemo, m = d.world.children.find((c) => c.isMesh);
      L.renderer.setAnimationLoop(null); document.getElementById('ui').style.display = 'none';
      const gl = L.renderer.getContext(), cv = L.renderer.domElement, w = cv.width, h = cv.height;
      const buf = new Uint8Array(w * h * 4), out = [];
      for (let k = 0; k < 24; k++) {
        const yaw = k * Math.PI / 12;
        d.world.rotation.set(0.12, yaw, 0);
        L.camera.position.set(0, 0.35, d.planet.R * distF); L.camera.lookAt(0, 0.12, 0);
        L.renderer.render(L.scene, L.camera);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        let sand = 0, pale = 0;
        for (let q = 0; q < w * h; q++) {
          const i = q * 4, r = buf[i], g = buf[i + 1], b = buf[i + 2];
          const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
          if (r > 195 && r >= b + 6 && (mx ? (mx - mn) / mx : 0) < 0.26) sand++;
          if (mx > 200 && (mx ? (mx - mn) / mx : 0) < 0.12) pale++;   // 沙 + 浪线一起算「岸缘可见度」
        }
        out.push({ yaw: +yaw.toFixed(3), sand, pale });
      }
      return out;
    }, 2.4);
    const pool = scan.filter((s2) => s2.pale > 200);
    const best = (pool.length ? pool : scan).sort((a, b2) => (b2.sand * 6 + b2.pale) - (a.sand * 6 + a.pale))[0];
    console.log('SCAN', JSON.stringify(scan), '→ yaw', best.yaw);
    const wide = await page.evaluate(PROBE, { yaw: best.yaw, distF: 4.3, wantTex: true });
    const close = await page.evaluate(PROBE, { yaw: best.yaw, distF: 2.4, wantTex: false });
    console.log('TEX', JSON.stringify(wide.tex, null, 1));
    console.log('WIDE', JSON.stringify(wide.screen));
    console.log('CLOSE', JSON.stringify(close.screen));

    /* ---------- 2) 截图（wide / close / r55 基线）---------- */
    await page.evaluate(PROBE, { yaw: best.yaw, distF: 4.3, wantTex: false, shot: true });
    await page.screenshot({ path: `${OUT}/planet-shore-wide-r154.png` });
    await page.evaluate(PROBE, { yaw: best.yaw, distF: 2.4, wantTex: false, shot: true });
    await page.screenshot({ path: `${OUT}/planet-shore-close-r154.png` });
    await page.evaluate((yaw) => {   // 同一机位只换 r55 基线材质
      const L = window.planetLighting, d = window.planetDemo, m = d.world.children.find((c) => c.isMesh);
      d.world.rotation.set(0.12, yaw, 0);
      L.camera.position.set(0, 0.35, d.planet.R * 4.3); L.camera.lookAt(0, 0.12, 0);
      m.material = window.__r55mat; L.renderer.render(L.scene, L.camera);
    }, best.yaw);
    await page.screenshot({ path: `${OUT}/planet-shore-r55baseline-r154.png` });

    /* ---------- 3) 断言 ---------- */
    const T = wide.tex;
    // ① 浪线：三道峰、位置在 n·gap、越外越淡、出了 (waves+1)·gap 就没有
    const gap = T.gap, cl = T.clusters;
    assert.ok(cl.length >= 3, `海侧应数出 ≥3 道浪线（实测 ${JSON.stringify(cl)}）`);
    const three = cl.slice(0, 3);
    for (let n = 0; n < 3; n++) assert.ok(Math.abs(three[n].r - (n + 1) * gap) < gap * .45, `第 ${n + 1} 道浪线应≈${((n + 1) * gap).toFixed(4)}，实测 ${three[n].r}`);
    assert.ok(three[0].e >= three[2].e * 0.9, `浪线应越外越淡：${three.map((p) => p.e).join('/')}`);
    assert.ok(cl.every((p) => p.r < 4.4 * gap), `浪线不应越过 4.4·gap：${JSON.stringify(cl.filter((p) => p.r >= 4.4 * gap))}`);
    assert.equal(T.roles.wave > 0, true, '应有 wave 角色');
    // ② 暗带：陆侧近岸有亮度凹谷，谷在 rim 以内，谷底比内陆草暗
    assert.ok(T.dipDepth >= 8, `陆侧暗带深度应 ≥8 级（实测 ${T.dipDepth}：草 ${T.grassL} → 谷 ${T.dipL}）`);
    assert.ok(T.dipR < T.rim, `暗带谷应落在 rim=${T.rim} 以内（实测 ${T.dipR}）`);
    assert.equal(T.roles.rim > 0, true, '应有 rim 角色');
    // ③ 沙滩：只出现在岸边、只占一段岸线（不是整圈）
    assert.ok(T.sandN > 0, '应有沙滩像素');
    assert.equal(T.sandFar, 0, `沙滩不应离岸 >0.03 rad（越界 ${T.sandFar} px）`);
    assert.ok(T.sandPerCoast > .05 && T.sandPerCoast < .9, `沙滩应只占部分岸线（实测 ${T.sandPerCoast}）`);
    // ④ 两色草：大块斑驳（游程大）+ 两色亮度分明
    assert.ok(T.grassRunP50 >= 8, `亮草应是成块斑驳而非逐像素噪声（P50 游程 ${T.grassRunP50}）`);
    assert.ok(T.twoTone.g2 - T.twoTone.g1 >= 15, `两色草的绿通道两峰应相距 ≥15 级（${T.twoTone.g1}/${T.twoTone.g2}）`);
    assert.ok(T.twoTone.ratio >= 3, `两峰之间应有明显谷（峰/谷 ${T.twoTone.ratio}）`);
    // ⑤ 3D 采样：极点行近乎恒定（2D/uv 模式会撕裂）
    assert.ok(T.poleStd <= 3 && T.eqStd >= 15, `极点行应近恒定：极点行 std ${T.poleStd} vs 赤道行 ${T.eqStd}`);
    assert.ok(T.uvPoleStd > T.uvEqStd * 1.5, `mode:'uv' 反向对照应在极点撕裂（${T.uvPoleStd} vs ${T.uvEqStd}）`);
    // ⑥ 经度接缝：回绕相邻列差不应跳变
    const stepMax = Math.max(T.stepIn, T.stepEnd);
    assert.ok(T.seam <= stepMax * 1.5, `经度接缝不应跳变：seam ${T.seam} vs 相邻列差 ${T.stepIn}/${T.stepMid}/${T.stepEnd}`);
    // ⑦ 屏幕层：宽景 —— 陆侧近岸变暗、海侧变亮、差分贴岸
    const W2 = wide.screen, landB = W2.prof.land, seaB = W2.prof.sea;
    assert.equal(W2.noise, 0, `同状态重渲噪声应为 0（实测 ${W2.noise}）`);
    assert.ok(landB[0].dA <= -6 && landB[1].dA <= -8, `宽景陆侧 1–3px 应明显变暗（${landB[0].dA}/${landB[1].dA}）`);
    // 海侧：r55 的海整体更浅，所以不能只比净和；要的是「浪线那几档明显更亮且多数像素变亮」
    const lit = seaB.filter((p2) => p2.dA >= 4 && p2.pos > p2.neg);
    assert.ok(lit.length >= 2, `宽景海侧应有 ≥2 档明显更亮的浪线带（实测 ${JSON.stringify(seaB.map((p2) => p2.dA))}）`);
    assert.ok(W2.diff > 15000 && W2.nearFrac > .15, `宽景差分应贴岸：${W2.diff}px / 贴岸 ${W2.nearFrac}`);
    assert.ok(W2.sandPx > 0 && W2.sandCover < .9, `宽景应看得见沙滩且只覆盖部分岸线（沙像素 ${W2.sandPx} / 覆盖 ${W2.sandCover}）`);
    // ⑧ 屏幕层：近景 —— 暗带随像素尺度变宽、浪线仍在
    const C = close.screen, landC = C.prof.land, seaC = C.prof.sea;
    assert.equal(C.noise, 0, `近景同状态噪声应为 0（${C.noise}）`);
    assert.ok(landC[3].dA <= -8 && landC[4].dA <= -8, `近景陆侧 5–10px 应明显变暗（${landC[3].dA}/${landC[4].dA}）`);
    // 近景：海面应有「比局部亮」的细线，且它们的离岸距离成 1×/2×/3× 的峰（平行浪线）
    assert.ok(C.wave.n > 300, `近景海面应数出明显浪线像素（${C.wave.n}）`);
    const wp = C.wave.peaks;
    assert.ok(wp.length >= 2, `浪线到岸距离应成峰（${JSON.stringify(wp)}）`);
    const s1 = wp[0].px;
    assert.ok(wp.slice(1).some((q) => Math.abs(q.px - s1 * 2) <= 2 || Math.abs(q.px - s1 * 3) <= 3), `浪线峰应落在 1×/2×/3× 间距上（${JSON.stringify(wp)}）`);
    assert.ok(C.diff > 20000, `近景差分应更大（${C.diff}px）`);
    assert.ok(C.sandPx > 0 && C.sandCover > 0, `近景应看得见沙滩（沙像素 ${C.sandPx} / 覆盖 ${C.sandCover}）`);
    // ⑨ 0 console error
    assert.deepEqual(errors, [], `页面不应报错：${JSON.stringify(errors)}`);
    console.log('ALL PASS');
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });

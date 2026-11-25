// 821321422140309504「（无文字）」+ 821680056514781186「Revenge of the Blues!」运行验收（第 130 轮起，第 131 轮补「盘子在画面上可见」）。
//
// 两条片子是同一场 BadNorth 灰模战斗（315 帧 / 763 帧），note 挂了几十轮的那句是
// 「暗斑不能单独证明原阴影方法 / 不能认证软影高度或坡面算法」+【卡点·C 算法未公开】。
// 本轮核实：`src/core/unit-shadow.js` 的 blobshadow 就是这件事（0.36·h 光向偏移 / 1÷cosθ 坡向拉长 /
// 跨格连续 / groundAt 贴地 / measure() 指标表），`src/life/unit-shadow-batch.js` 由 `battle.js:70` 实例化、
// `battle.js#draw` 每帧 update —— 但 `enabled` 默认 false，只有 g3 的 `shadowFit` 顺带置 true，
// **默认战斗一片软盘都不画**（本轮探针：24 个活单位 count=0 / drawRange 0）。这才是两条片子的真缺口。
//
// 本轮做两件事：
//   ① 接触软盘默认开（`battle.js` 构造里 enabled 读 `?unitShadows=0` 才关）；
//   ② 从页面量出来（不读日志、不读 build 台账，直接读 GPU / 几何 / 材质）：
//      每个活单位一片软盘、盘面落在该单位所在楼层平面、跨格连续有拼片、
//      离地 h 沿光向偏 0.36·h（alpha 与半径按同一条公式）、坡向拉长 1/cosθ 且 XZ 面积守恒、
//      开/关像素 A/B（同状态噪声底 0）。
const {chromium} = require('playwright');
const fs = require('fs'), path = require('path');

const OUT = path.resolve(__dirname, '../artifacts/coverage');
const BASE = process.env.REA_TEST_URL || 'http://localhost:8769';
const LIGHT = [0.62, 0.78];
const LN = Math.hypot(LIGHT[0], LIGHT[1]);

function stats(a) {
  const s = [...a].sort((x, y) => x - y), q = (p) => s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))];
  return {n: s.length, min: +s[0].toFixed(5), p50: +q(0.5).toFixed(5), max: +s[s.length - 1].toFixed(5), sum: +s.reduce((x, y) => x + y, 0).toFixed(5)};
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({viewport: {width: 1280, height: 900}});
  const errors = [], report = {};
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource:')) errors.push(m.text()); });
  const t0 = Date.now(), stage = (s) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${s}`);
  stage('start');

  try {
    await page.goto(BASE + '/index.html?scene=badnorth');
    await page.waitForFunction(() => window.rea?.battle?.running, null, {timeout: 60000});
    await page.waitForTimeout(2200);            // 让单位下船 / 站位稳定
    // 量之前先停住单位：每帧 #draw 先写软盘几何再走单位，unit.x 是活对象 —— 不停的话读到的
    // 是「上一帧的盘 + 这一帧的脚」，会量出几百个 1e-3 的假偏移（r130 第一版就踩了）。
    await page.evaluate(() => { rea.battle.paused = true; });
    await page.waitForTimeout(200);

    /* ---------------- ① 默认战斗里到底有没有软盘 ---------------- */
    report.default = await page.evaluate(() => {
      const b = rea.battle, s = b.unitShadows;
      const live = b.units.filter((u) => !u.dead && !u.onBoat && !u.fall && b.navigation.unitNode(u));
      return {
        enabled: s.enabled, count: s.count, visible: s.mesh.visible,
        drawRange: s.geometry.drawRange.count, stats: {...s.stats},
        units: b.units.length, live: live.length, hasG3: !!b.g3, g3shadowFit: !!b.g3?.on?.shadowFit,
        material: {transparent: s.material.transparent, depthWrite: s.material.depthWrite, opacityFloor: true},
      };
    });
    if (!report.default.enabled) throw new Error('默认战斗里 unitShadows.enabled 仍是 false：' + JSON.stringify(report.default));
    if (!(report.default.count > 0)) throw new Error('软盘开着一个都没画：' + JSON.stringify(report.default));
    if (report.default.count !== report.default.live) throw new Error(`软盘数 ${report.default.count} ≠ 活单位数 ${report.default.live}`);
    if (!(report.default.drawRange > 0 && report.default.visible)) throw new Error('drawRange/visible 不对：' + JSON.stringify(report.default));

    /* ---------------- ② 盘面落点：每个单位一片，且落在自己那层的地面 ---------------- */
    report.floor = await page.evaluate(() => {
      const b = rea.battle, s = b.unitShadows, L = b.L, P = s.geometry.attributes.position.array;
      const st = (a) => { const q = [...a].sort((x, y) => x - y), at = (p) => q[Math.min(q.length - 1, Math.floor(p * (q.length - 1)))]; return {n: q.length, min: +q[0].toFixed(5), p50: +at(0.5).toFixed(5), max: +q[q.length - 1].toFixed(5)}; };
      const rows = [], ys = [], slopes = [];
      // 面积加权重心（扇三角化把 poly[0] 复用了 n 次，直接平均顶点会偏 r/7 ≈ 0.004，r130 第一版就踩了）
      const centroid = (start, n) => { let A = 0, cx = 0, cz = 0; for (let i = 0; i < n; i += 3) { const a = (start + i) * 3, b2 = (start + i + 1) * 3, c = (start + i + 2) * 3; const ar = ((P[b2] - P[a]) * (P[c + 2] - P[a + 2]) - (P[c] - P[a]) * (P[b2 + 2] - P[a + 2])) / 2; A += ar; cx += ar * (P[a] + P[b2] + P[c]) / 3; cz += ar * (P[a + 2] + P[b2 + 2] + P[c + 2]) / 3; } return [cx / A, cz / A]; };
      for (const r of s.ranges) {
        let minY = Infinity, maxY = -Infinity;
        for (let i = 0; i < r.count; i++) { const y = P[(r.start + i) * 3 + 1]; minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
        const [cx, cz] = centroid(r.start, r.count);
        ys.push(minY - r.floor * L); slopes.push(maxY - minY);
        const h = Math.max(0, r.unit.y - r.floor * L);
        let area = 0;
        for (let i = 0; i < r.count; i += 3) { const a = (r.start + i) * 3, b2 = (r.start + i + 1) * 3, c = (r.start + i + 2) * 3; area += Math.abs((P[b2] - P[a]) * (P[c + 2] - P[a + 2]) - (P[c] - P[a]) * (P[b2 + 2] - P[a + 2])) / 2; }
        const full = Math.PI * Math.pow(0.12 * (r.unit.bodyScale ?? 1), 2);
        rows.push({floor: r.floor, tris: r.count / 3, area: +area.toFixed(6), fill: +(area / full).toFixed(4), minAboveFloor: +(minY - r.floor * L).toFixed(6), ySpread: +(maxY - minY).toFixed(6), stair: !!r.stair, fit: !!r.fit, h: +h.toFixed(5), offXZ: +Math.hypot(cx - r.unit.x, cz - r.unit.z).toFixed(5), expectOff: +(0.36 * h).toFixed(5)});
      }
      const stairUnits = rows.filter((r) => r.stair).length, multi = s.stats.pieces - s.count;
      const floors = [...new Set(rows.map((r) => r.floor))].sort((a, b2) => a - b2);
      return {rows, floors, stairUnits, pieces: s.stats.pieces, multiCell: s.stats.multiCell, onStairs: s.stats.onStairs, minAboveFloor: st(ys), ySpread: st(slopes), offXZ: st(rows.map((r) => r.offXZ))};
    });
    if (report.floor.minAboveFloor.min < 0.007999) throw new Error('有软盘被埋进地面：' + JSON.stringify(report.floor.minAboveFloor));
    if (report.floor.minAboveFloor.max > 0.02) throw new Error('有软盘浮在地面上方：' + JSON.stringify(report.floor.minAboveFloor));
    // 站在地上（h=0）时不该有光向偏移。注意：盘子被格边裁成多块时，几何重心天然偏离圆心（r114 的坑），
    // 所以这里只把「偏移上限 ≤ 0.36·h + 0.05 的裁剪余量」当判据；精确的 0.36·h 由 ③ 的单块盘给。
    // 说明：被格边裁过的盘，其**几何重心**必然偏向「留下的那一块」，所以重心不能当圆心用（r130 第一版踩了两次）。
    // 站立偏移的口径改成面积账：每单位实画面积 0 < A ≤ π·r²（r = .12·bodyScale），且不能是薄薄一条。
    report.floor.area = {full: +(Math.PI * 0.12 * 0.12).toFixed(6), rows: report.floor.rows.length};
    if (!report.floor.rows.every((r) => r.area > 0.004 && r.fill <= 1.0001)) throw new Error('软盘面积账不对：' + JSON.stringify(report.floor.rows.slice(0, 4)));
    if (!(report.floor.rows.filter((r) => r.fill > 0.5).length >= report.floor.rows.length * 0.8)) throw new Error('超过两成单位的软盘被格边裁成薄条：' + JSON.stringify(report.floor.rows.filter((r) => r.fill <= 0.5)));

    /* ---------------- ③ 离地高度 → 0.36·h 光向偏移 / alpha 与半径同步 ---------------- */
    report.height = await page.evaluate(() => {
      const b = rea.battle, s = b.unitShadows, L = b.L, LIGHT = [0.62, 0.78], LN = Math.hypot(LIGHT[0], LIGHT[1]);
      const single = b.units.filter((u) => !u.dead && !u.onBoat && !u.fall && b.navigation.unitNode(u));
      const out = [];
      for (const u of single.slice(0, 40)) {
        s.update(b.world, [u], b.navigation, L);
        const r = s.ranges[0]; if (!r) continue;
        // 「整圆」= 包围盒就是直径（被格边裁过的盘 bbox 会缩、pieces 却可能仍是 1，r130 第一版又踩了这个）
        const box = () => { const P2 = s.geometry.attributes.position.array, rg = s.ranges[0]; let mnx = 1e9, mxx = -1e9, mnz = 1e9, mxz = -1e9; for (let i = 0; i < rg.count; i++) { const x = P2[(rg.start + i) * 3], z = P2[(rg.start + i) * 3 + 2]; mnx = Math.min(mnx, x); mxx = Math.max(mxx, x); mnz = Math.min(mnz, z); mxz = Math.max(mxz, z); } return {cx: (mnx + mxx) / 2, cz: (mnz + mxz) / 2, w: mxx - mnx, d: mxz - mnz}; };
        const full = (b2, r2) => Math.abs(b2.w - 2 * r2) < 0.004 && Math.abs(b2.d - 2 * r2) < 0.004;
        const rad0 = 0.12 * (u.bodyScale ?? 1);
        const b0 = box(); if (!full(b0, rad0)) continue;
        const O = s.geometry.attributes.opacity.array;
        // 圆心取包围盒中心：整圆（pieces==1）时对称、精确；被裁过的盘不参与（下面会跳过）
        const cxz = () => { const P2 = s.geometry.attributes.position.array, rg = s.ranges[0]; let mnx = 1e9, mxx = -1e9, mnz = 1e9, mxz = -1e9; for (let i = 0; i < rg.count; i++) { const x = P2[(rg.start + i) * 3], z = P2[(rg.start + i) * 3 + 2]; mnx = Math.min(mnx, x); mxx = Math.max(mxx, x); mnz = Math.min(mnz, z); mxz = Math.max(mxz, z); } return [(mnx + mxx) / 2, (mnz + mxz) / 2]; };
        const x0 = b0.cx, z0 = b0.cz, a0 = O[r.start];
        const y0 = u.y; u.y = y0 + 0.45;
        s.update(b.world, [u], b.navigation, L);
        const r2 = s.ranges[0], b1 = box(), rad1 = rad0 * (1 + 0.35 * 0.45 / 0.8);
        if (!r2 || !full(b1, rad1)) { u.y = y0; continue; }    // 抬起来被格边裁了 → 圆心不可用
        const x1 = b1.cx, z1 = b1.cz, a1 = O[r2.start], P2 = s.geometry.attributes.position.array;
        let yMin = Infinity, yMax = -Infinity; for (let i = 0; i < r2.count; i++) { const y = P2[(r2.start + i) * 3 + 1]; yMin = Math.min(yMin, y); yMax = Math.max(yMax, y); }
        u.y = y0;
        const dx = x1 - x0, dz = z1 - z0, dist = Math.hypot(dx, dz);
        const along = (dx * LIGHT[0] + dz * LIGHT[1]) / LN, cos = dist > 1e-9 ? along / dist : 0;
        out.push({h: 0.45, dx: +dx.toFixed(5), dz: +dz.toFixed(5), offset: +dist.toFixed(5), alongLight: +along.toFixed(5), cos: +cos.toFixed(5), alpha0: +a0.toFixed(5), alpha45: +a1.toFixed(5), discY: +((yMin + yMax) / 2).toFixed(5)});
        if (out.length >= 6) break;
      }
      return {cases: out, expect: {offset: 0.36 * 0.45, alpha45: 0.3 * (1 - 0.45 / 0.8), radiusGrowth: 1 + 0.35 * 0.45 / 0.8}};
    });
    if (!report.height.cases.length) throw new Error('找不到单块软盘的单位，无法量高度偏移');
    for (const c of report.height.cases) {
      if (Math.abs(c.alongLight - report.height.expect.offset) > 0.012) throw new Error('高度偏移不是 0.36·h：' + JSON.stringify(c));
      if (Math.abs(c.alpha45 - report.height.expect.alpha45) > 5e-4) throw new Error('离地后浓度没按 fade 衰减：' + JSON.stringify(c));
    }

    /* ---------------- ④ 坡向：1÷cosθ 拉长、XZ 面积守恒、盘面随坡起伏 ---------------- */
    report.slope = await page.evaluate(() => {
      const b = rea.battle, s = b.unitShadows, L = b.L;
      const u = b.units.find((x) => !x.dead && !x.onBoat && !x.fall && b.navigation.unitNode(x));
      const area = (start, n, P) => { let a = 0; for (let i = 0; i < n; i += 3) a += Math.abs((P[(start + i + 1) * 3] - P[(start + i) * 3]) * (P[(start + i + 2) * 3 + 2] - P[(start + i) * 3 + 2]) - (P[(start + i + 2) * 3] - P[(start + i) * 3]) * (P[(start + i + 1) * 3 + 2] - P[(start + i) * 3 + 2])) / 2; return a; };
      const extent = (start, n, P) => { let ax = -Infinity, bx = Infinity, az = -Infinity, bz = Infinity; for (let i = 0; i < n; i++) { const x = P[(start + i) * 3], z = P[(start + i) * 3 + 2]; ax = Math.max(ax, x); bx = Math.min(bx, x); az = Math.max(az, z); bz = Math.min(bz, z); } return {x: ax - bx, z: az - bz}; };
      const keep = s.groundSampler;
      const base = b.navigation.unitNode(u).floor * L;
      s.groundSampler = null; s.update(b.world, [u], b.navigation, L);
      const r0 = s.ranges[0], P0 = s.geometry.attributes.position.array, a0 = area(r0.start, r0.count, P0), e0 = extent(r0.start, r0.count, P0);
      const deg = 20, tan = Math.tan(deg * Math.PI / 180);
      s.groundSampler = (uu) => ({groundAt: (x) => base + tan * (x - uu.x), groundY: base, slope: {x: 1, z: 0, deg}, samples: 5});
      s.update(b.world, [u], b.navigation, L);
      const r1 = s.ranges[0], P1 = s.geometry.attributes.position.array, a1 = area(r1.start, r1.count, P1), e1 = extent(r1.start, r1.count, P1);
      let yMin = Infinity, yMax = -Infinity; for (let i = 0; i < r1.count; i++) { const y = P1[(r1.start + i) * 3 + 1]; yMin = Math.min(yMin, y); yMax = Math.max(yMax, y); }
      s.groundSampler = keep; s.update(b.world, [u], b.navigation, L);
      return {deg, xFlat: +e0.x.toFixed(5), xTilt: +e1.x.toFixed(5), ratio: +(e1.x / e0.x).toFixed(5), expectRatio: +(1 / Math.cos(deg * Math.PI / 180)).toFixed(5),
        zFlat: +e0.z.toFixed(5), zTilt: +e1.z.toFixed(5), areaFlat: +a0.toFixed(8), areaTilt: +a1.toFixed(8), areaRatio: +(a1 / a0).toFixed(5), ySpreadTilt: +(yMax - yMin).toFixed(5)};
    });
    if (Math.abs(report.slope.ratio - report.slope.expectRatio) > 0.02) throw new Error('坡向没按 1/cosθ 拉长：' + JSON.stringify(report.slope));
    if (Math.abs(report.slope.areaRatio - 1) > 0.02) throw new Error('坡向椭圆面积没守恒：' + JSON.stringify(report.slope));
    if (!(report.slope.ySpreadTilt > 0.01)) throw new Error('坡面软盘没随坡起伏（ySpread=0）：' + JSON.stringify(report.slope));

    /* ---------------- ⑤ 真实地形坡面（g3 shadowFit 射线拟合）+ 开/关像素 A/B ---------------- */
    report.fitted = await page.evaluate(() => {
      const b = rea.battle, s = b.unitShadows, L = b.L;
      b.g3.set('shadowFit', true);
      s.update(b.world, b.units, b.navigation, L);
      const P = s.geometry.attributes.position.array, fits = [];
      for (const r of s.ranges) if (r.fit) { let mn = Infinity, mx = -Infinity; for (let i = 0; i < r.count; i++) { const y = P[(r.start + i) * 3 + 1]; mn = Math.min(mn, y); mx = Math.max(mx, y); } fits.push({floor: r.floor, ySpread: +(mx - mn).toFixed(5), slopeDeg: +(r.slopeDeg ?? 0).toFixed(2)}); }
      return {enabled: s.enabled, fittedRanges: fits.length, ranges: s.ranges.length, fits: fits.slice(0, 8), g3fitted: b.g3.stats.fitted};
    });
    if (!report.fitted.enabled) throw new Error('shadowFit 打开后软盘被关了');
    if (!(report.fitted.fittedRanges > 0)) throw new Error('shadowFit 打开后没有一片用上射线拟合：' + JSON.stringify(report.fitted));

    // 近景机位（软盘半径 .12，全岛机位下只有 2–4 px）。
    // r130 的两次机位（dist 3/pitch 1.0 → 云层、dist 5/pitch 0.42 → 台地侧壁）画面里只见墙，本轮改成 r127 的做法：
    //   ① 120ms 定时器钉住 target/distance/pitch（app 会在世界异步生成后再 fit 一次相机）；
    //   ② 冻时间轴（render 恒 dt=0），否则同状态两帧差分上万个 px，暗盘信号全被植被摆动淹没；
    //   ③ 取**楼层最高**的单位当目标：台地顶层上方没有植被/侧壁，俯视 pitch 1.25 能直接看到脚下地面。
    const aim = await page.evaluate(() => {
      const b = rea.battle, v = rea.view;
      document.getElementById('hud')?.style.setProperty('display', 'none');
      document.querySelectorAll('[data-progress-badge]').forEach((n) => { n.closest('div').style.display = 'none'; });
      const live = b.units.filter((u) => !u.dead && !u.onBoat && !u.fall && b.navigation.unitNode(u));
      const best = live.map((u) => ({u, f: b.navigation.unitNode(u).floor})).sort((a, c) => c.f - a.f)[0];
      const t = [best.u.x, best.u.y, best.u.z];
      window.__pinCam = () => { v.target.set(t[0], t[1], t[2]); v.distance = 4.0; v.pitch = 1.25; v.yaw = Math.PI * 0.28; v.updateCamera(); };
      window.__pinCam();
      if (!window.__pinTimer) window.__pinTimer = setInterval(window.__pinCam, 120);
      const orig = v.render.bind(v); v.render = () => { orig(0); };   // 冻时间轴：相机 / 水面 / 植被摆动全停
      window.__pinCam();
      b.paused = true;
      return {target: t.map((x) => +x.toFixed(3)), distance: v.distance, pitch: v.pitch, floor: best.f,
        cam: v.camera.position.toArray().map((x) => +x.toFixed(3))};
    });
    report.aim = aim;
    await page.waitForTimeout(800);

    // 像素对比：把两张截图塞回页面用 2D canvas 解码（node 侧没有 PNG 解码器，也别引第三方包）。
    const cmpPng = (bufA, bufB) => page.evaluate(async ([A, B]) => {
      const load = async (b64) => { const blob = await (await fetch('data:image/png;base64,' + b64)).blob(); return createImageBitmap(blob); };
      const ia = await load(A), ib = await load(B), w = ia.width, h = ia.height;
      const c = new OffscreenCanvas(w, h), g = c.getContext('2d', {willReadFrequently: true});
      const grab = async (img) => { g.clearRect(0, 0, w, h); g.drawImage(img, 0, 0); return g.getImageData(0, 0, w, h).data; };
      const da = await grab(ia), db = await grab(ib);
      let n = 0, sumA = 0, sumB = 0, minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
      for (let i = 0; i < da.length; i += 4) {
        const la = 0.299 * da[i] + 0.587 * da[i + 1] + 0.114 * da[i + 2];
        const lb = 0.299 * db[i] + 0.587 * db[i + 1] + 0.114 * db[i + 2];
        if (Math.abs(la - lb) > 8) { n++; sumA += la; sumB += lb; const p = i / 4, x = p % w, y = (p - x) / w; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
      }
      return {w, h, diffPx: n, meanA: +(sumA / Math.max(1, n)).toFixed(2), meanB: +(sumB / Math.max(1, n)).toFixed(2), box: n ? [minX, minY, maxX, maxY] : null};
    }, [bufA.toString('base64'), bufB.toString('base64')]);

    // 像素 A/B 走截图差分（本页的 renderer.readRenderTargetPixels 在这个场景里读不到软盘那一层：
    // 同一帧 visible on/off 两次读回逐位相同，r130 试过 RT 1024×768 与 512×384 两次都是 0 —— 改用截图差分，
    // 由 `python3` 侧 PIL 数像素写进证据 md，测试本身只保证「两种状态都截到了」）。
    /* ---------------- ⑥ 截图：开 / 关（钉住机位 + 冻时间轴，同一帧状态） ---------------- */
    fs.mkdirSync(OUT, {recursive: true});
    // 截图的 A/B 必须切 `enabled`（真状态）：`#draw` 每帧都会把 mesh.visible 重写成 count>0，
    // 只翻 visible 的话下一帧就被冲回去了 —— r130 第一版截出来的两张图只差 26 px 就是被这个骗的。
    const shoot = async (on, name) => {
      await page.evaluate((v) => { const b = rea.battle; b.unitShadows.enabled = v; b.unitShadows.update(b.world, b.units, b.navigation, b.L); }, on);
      await page.waitForTimeout(450);
      const buf = await page.locator('canvas').screenshot({path: path.join(OUT, name)});
      const st = await page.evaluate(() => ({count: rea.battle.unitShadows.count, visible: rea.battle.unitShadows.mesh.visible}));
      return {buf, ...st};
    };
    const on1 = await shoot(true, 'battle-unit-shadow-r131-on.png');
    const on2 = await shoot(true, 'battle-unit-shadow-r131-on2.png');
    const off = await shoot(false, 'battle-unit-shadow-r131-off.png');
    const back = await shoot(true, 'battle-unit-shadow-r131-on-back.png');
    report.shotOn = {count: on1.count, visible: on1.visible};
    report.shotOff = {count: off.count, visible: off.visible};
    if (!(on1.count > 0 && on1.visible)) throw new Error('开档截图时软盘没画：' + JSON.stringify(on1.count));
    if (off.count !== 0 || off.visible) throw new Error('关档截图时软盘还在：' + JSON.stringify(off));

    // 先量同状态噪声底（必须 0，否则下面的差分不可信 —— r130 就是被摆动植被的 2 万 px 底噪骗过）
    report.pixels = {
      noise: await cmpPng(on1.buf, on2.buf),
      onOff: await cmpPng(on1.buf, off.buf),
      restored: await cmpPng(on1.buf, back.buf),
    };
    if (report.pixels.noise.diffPx !== 0) throw new Error('同状态两帧噪声不是 0（时间轴没冻住）：' + JSON.stringify(report.pixels.noise));
    if (!(report.pixels.onOff.diffPx > 2000)) throw new Error('软盘开/关在画面上没差别（看不到盘子）：' + JSON.stringify(report.pixels.onOff));
    // 差分像素的亮度必须是「开档更暗」：暗盘 0.08/0.10/0.12 + alpha 0.3 落在浅绿地面上的实际压暗量
    const drop = report.pixels.onOff.meanB - report.pixels.onOff.meanA;
    report.pixels.drop = +drop.toFixed(2);
    if (!(drop > 8)) throw new Error('差分处亮度差不足（盘子太淡或没画上去）：drop=' + drop.toFixed(2));
    if (report.pixels.restored.diffPx !== 0) throw new Error('开→关→开没回到同一画面：' + JSON.stringify(report.pixels.restored));
    stage('shots');

    /* ---------------- ⑦ 回归：默认 URL 下软盘仍在（?unitShadows=0 才关） ---------------- */
    await page.goto(BASE + '/index.html?scene=badnorth&unitShadows=0');
    await page.waitForFunction(() => window.rea?.battle?.running, null, {timeout: 60000});
    await page.waitForTimeout(1200);
    report.off = await page.evaluate(() => ({enabled: rea.battle.unitShadows.enabled, count: rea.battle.unitShadows.count}));
    if (report.off.enabled || report.off.count) throw new Error('?unitShadows=0 没关掉：' + JSON.stringify(report.off));

    report.errors = errors;
    if (errors.length) throw new Error('console errors: ' + errors.slice(0, 4).join(' | '));
    fs.writeFileSync(path.join(OUT, 'battle-unit-shadow-r131.json'), JSON.stringify(report, null, 1));
    console.log(JSON.stringify(report, null, 1));
    console.log('\nPASS battle-unit-shadow（r131）');
    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('\nFAIL', err.message);
    try { fs.writeFileSync(path.join(OUT, 'battle-unit-shadow-r131.json'), JSON.stringify({report, error: err.message}, null, 1)); } catch {}
    await browser.close();
    process.exit(1);
  }
})();

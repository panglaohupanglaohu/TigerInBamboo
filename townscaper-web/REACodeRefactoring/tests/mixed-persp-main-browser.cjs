// 1310503825510367232 第 171 轮运行时验收：混合透视「接主视图」这一层（片内口径 + 真实帧缓冲）。
//
// 原文两句话就是判据：「houses further away are smaller」（近大远小必须保留）
//                     「yet the vertical lines stay straight and parallel」（竖线必须笔直平行、不朝上收敛）
// 片内（200 帧 / 32.84fps / 6.06s，sheet-00 0000–0099 + sheet-01 0100–0199 全看）：
// 镜头绕一座彩色低多边形小岛与中央细高塔旋转；塔身竖边在每一帧里都彼此平行（0200 帧内两次转到正面时最明显），
// 而左侧远处一排房子明显比前景小 —— 正是「竖线平行 + 近大远小」，没有 UI、没有对照标签。
//
// 代码侧（本轮先核实再动手，核实结论写进 artifacts/coverage/1310503825510367232-review-r171.md）：
//   src/core/mixed-perspective.js — w 行世界 y 系数按 k 衰减 + P'=M'·V⁻¹（供 three 直接用）
//   src/world/view-mixed-persp.js — 换掉 camera.updateProjectionMatrix、改深度行、修 pick 射线（fixRay）
//   src/world/view.js:311 / 1270  — `?mixedPersp=` 装载 + pick 前调 fixRay
// 也就是说「主视图未接 / pick 未同步」是过期账；真缺的是**页面运行验收**（从没在 index.html 上量过一次）。
//
// 本测判据全部从真实页面取：竖线横移按相机矩阵算像素、近大远小按同高柱的屏幕高度、
// 像素账按 480×360 RenderTarget 逐像素读回、拾取按「射线打到真实网格的交点落在哪个格」独立复核。
const { chromium } = require('playwright');
const path = require('path');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'http://127.0.0.1:8769/index.html?scene=town&grid=quad&seed=3';
const OUT = path.join(__dirname, '..', 'artifacts', 'coverage');
const problems = [];
const check = (name, ok, detail) => {
  const d = detail === undefined ? '' : (typeof detail === 'string' ? detail : JSON.stringify(detail));
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${d ? ' :: ' + d : ''}`);
  if (!ok) problems.push(name + (d ? ' :: ' + d : ''));
};

async function boot(browser, url, wantMixed) {
  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
    // 失败的起页（serve.py 的 ERR_CONNECTION_RESET）不记账，否则会把网络 flake 记成页面报错
    const local = [];
    page.on('pageerror', (e) => local.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') local.push('console: ' + m.text().slice(0, 240)); });
    try {
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForFunction((mixed) => (mixed ? !!window.reaView?.mixedPersp : !!window.reaView?.gridStats),
        wantMixed, { polling: 200, timeout: 45000 });
      await page.waitForTimeout(500);
      problems.push(...local.filter((m) => !/ERR_CONNECTION_RESET|Failed to load resource/.test(m)));
      return page;
    } catch (e) {
      lastErr = e;
      await page.close();
      // 已知 flake：tools/serve.py 长跑后偶发 ERR_CONNECTION_RESET，第一次渲染就死在加载上
      console.log(`  …第 ${attempt} 次起页失败（${String(e.message).slice(0, 60)}），重试`);
      await new Promise((r) => setTimeout(r, 800));
    }
  }
  throw new Error('页面起不来（3 次）：' + lastErr);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  try {
    /* ============ 第一段：带 ?mixedPersp=1 的主场景 ============ */
    const page = await boot(browser, BASE + '&mixedPersp=1', true);

    const loaded = await page.evaluate(() => {
      const v = window.reaView;
      return { k: v.mixedPersp.k, applied: v.mixedPersp.applied, cells: window.rea.grid.cells.length, levelHeight: v.levelHeight };
    });
    check('① 页面入口 ?mixedPersp=1 真的装上了（k=1、已 apply）', loaded.k === 1 && loaded.applied > 0, loaded);

    // 投影矩阵与 three 原生透视的差异（k=0 必须逐元素相同；k=1 必须真的换了一份）
    const proj = await page.evaluate(async () => {
      const THREE = await import('three');
      const v = window.reaView, cam = v.camera;
      const stock = new THREE.PerspectiveCamera(30, cam.aspect, cam.near, cam.far);
      stock.updateProjectionMatrix();
      const maxAbs = (a, b) => Math.max(...a.map((x, i) => Math.abs(x - b[i])));
      const at = (k) => { v.mixedPersp.setK(k); return cam.projectionMatrix.elements.slice(); };
      const k1 = at(1), k0 = at(0);
      const s = stock.projectionMatrix.elements;
      // three 的投影矩阵单位与画布尺寸相关 → 把 aspect 对齐后再比
      return { k0VsStock: maxAbs(k0, s), k1VsStock: maxAbs(k1, s), aspect: cam.aspect, stockAspect: stock.aspect };
    });
    check('① k=0 的 projectionMatrix 与原生透视逐元素相同（关档零行为变化）', proj.k0VsStock < 1e-12, proj);
    check('① k=1 真的换了投影（与原生差 > 0.01）', proj.k1VsStock > 0.01, { k1VsStock: proj.k1VsStock });

    /* ---- ② 竖线笔直平行：12 根真实世界竖柱，k=1 横移必须为 0 ---- */
    const lines = await page.evaluate(() => {
      const v = window.reaView, w = window.rea.world, grid = window.rea.grid;
      const probes = [];
      for (const c of grid.cells) {
        const top = w.top(c);
        if (!(top > 1)) continue;                       // 只要柱高 ≥2 层的，竖线才有量
        probes.push({ id: c.id, x: c.cx, z: c.cz, y0: 0, y1: top * v.levelHeight });
        if (probes.length >= 12) break;
      }
      const at = (k) => { v.mixedPersp.setK(k); return probes.map((p) => v.mixedPersp.verticalDrift(p.x, p.z, p.y0, p.y1)); };
      const k1 = at(1), k0 = at(0), k1b = at(1);
      return {
        n: probes.length,
        k1MaxDrift: Math.max(...k1.map((r) => r.dxPx)),
        k0MaxDrift: Math.max(...k0.map((r) => r.dxPx)),
        k0CountOver1px: k0.filter((r) => r.dxPx > 1).length,
        repeatDelta: Math.max(...k1.map((r, i) => Math.abs(r.dxPx - k1b[i].dxPx))),
        heights: k1.map((r) => +r.heightPx.toFixed(1)),
      };
    });
    check('② k=1 时 12 根世界竖柱的屏幕横移全为 0（竖线笔直平行）', lines.k1MaxDrift < 0.01, { k1MaxDrift: lines.k1MaxDrift, n: lines.n });
    check('② k=0 时同一批竖柱确有肉眼可见横移（对照成立）', lines.k0MaxDrift > 3 && lines.k0CountOver1px >= 6, { k0MaxDrift: +lines.k0MaxDrift.toFixed(2), k0CountOver1px: lines.k0CountOver1px });
    check('② 同一档重复测量没有漂移', lines.repeatDelta < 1e-9, { repeatDelta: lines.repeatDelta });

    /* ---- ③ 近大远小仍保留（k=1 不能退化成正交）：同一批柱子，k=0 / k=1 各量一遍 ---- */
    const depth = await page.evaluate(() => {
      const v = window.reaView, w = window.rea.world, grid = window.rea.grid, cam = v.camera;
      const rows = [];
      for (const c of grid.cells) {
        if (!(w.top(c) > 0)) continue;
        rows.push({ dist: Math.hypot(cam.position.x - c.cx, cam.position.z - c.cz), cx: c.cx, cz: c.cz });
      }
      const measure = (k) => {
        v.mixedPersp.setK(k);
        const rs = rows.map((r) => {
          const d = v.mixedPersp.verticalDrift(r.cx, r.cz, 0, v.levelHeight);   // 同高 1 层
          return d && d.heightPx > 2 ? { dist: r.dist, h: d.heightPx } : null;
        }).filter(Boolean);
        const bucket = (lo, hi) => {
          const part = rs.filter((r) => r.dist >= lo && r.dist < hi);
          return part.length ? { dist: lo, n: part.length, h: +(part.reduce((s, r) => s + r.h, 0) / part.length).toFixed(2) } : null;
        };
        return { n: rs.length, buckets: [bucket(9, 11), bucket(11, 13), bucket(13, 15), bucket(15, 19)].filter(Boolean), near: bucket(9, 12), far: bucket(15, 19) };
      };
      return { k1: measure(1), k0: measure(0) };
    });
    const mono = (d) => d.buckets.length === 4 && d.buckets.every((b, i) => i === 0 || b.h < d.buckets[i - 1].h);
    const drop = (d) => (d.buckets.length ? 1 - d.buckets[d.buckets.length - 1].h / d.buckets[0].h : 0);
    check('③ k=1 时同 1 层高的柱子在 4 段距离上逐段变小（没退化成正交）', mono(depth.k1),
      depth.k1.buckets.map((b) => `${b.dist}:${b.h}px`).join(' → '));
    check('③ 近→远至少缩 15%（近大远小仍可读，且与 k=0 同向）',
      drop(depth.k1) >= 0.15 && mono(depth.k0) && drop(depth.k0) > 0,
      { dropK1: +(drop(depth.k1) * 100).toFixed(1) + '%', dropK0: +(drop(depth.k0) * 100).toFixed(1) + '%' });

    /* ---- ④ 倒影：同一相机下镜像网格，竖线同样必须笔直 ---- */
    const refl = await page.evaluate(() => {
      const v = window.reaView, w = window.rea.world, grid = window.rea.grid;
      v.mixedPersp.setK(1);
      let c = null;
      for (const x of grid.cells) { if (w.top(x) > 1) { c = x; break; } }
      const top = w.top(c) * v.levelHeight;
      const d = v.mixedPersp.verticalDrift(c.cx, c.cz, -top, 0);
      return { visible: v.reflection.visible, scaleY: v.reflection.scale.y, drift: d.dxPx, heightPx: +d.heightPx.toFixed(1) };
    });
    check('④ 倒影网格在同相机下存在（scale.y=-1）', refl.visible === true && Math.abs(refl.scaleY + 1) < 1e-9, refl);
    check('④ 倒影里的竖线同样零横移', refl.drift < 0.01, { drift: refl.drift });

    /* ---- ⑤ 拾取：混合投影下射线不再过眼点，必须仍打在同一根柱上 ---- */
    const pick = await page.evaluate(async () => {
      const THREE = await import('three');
      const { pointInQuad } = await import('./src/core/spatial.js');
      const v = window.reaView, w = window.rea.world, grid = window.rea.grid, cam = v.camera;
      const V3 = THREE.Vector3, M4 = THREE.Matrix4;
      const probes = [];
      for (const c of grid.cells) {
        const top = w.top(c);
        if (!(top > 0)) continue;
        for (const k of [0, 1]) {
          v.mixedPersp.setK(k);
          const p = new V3(c.cx, top * v.levelHeight, c.cz).project(cam);
          if (!(Math.abs(p.x) < 0.75 && Math.abs(p.y) < 0.75)) continue;
        }
        probes.push({ id: c.id, cx: c.cx, cz: c.cz, top });
        if (probes.length >= 24) break;
      }
      const at = (k, pr) => {
        v.mixedPersp.setK(k);
        const p = new V3(pr.cx, pr.top * v.levelHeight, pr.cz).project(cam);
        return [p.x, p.y];
      };
      const rows = [];
      let k1Agree = 0, k0Agree = 0, solid = 0;
      for (const pr of probes) {
        const n1 = at(1, pr), n0 = at(0, pr);
        const h1 = v.pick(n1[0], n1[1]);
        const h0 = v.pick(n0[0], n0[1]);
        if (h1 && w.isSolid(h1.cell, h1.level)) solid++;
        if (h1 && h1.cell.id === pr.id) k1Agree++;
        if (h0 && h0.cell.id === pr.id) k0Agree++;
        rows.push({ id: pr.id, k1: h1 ? h1.cell.id : null, k0: h0 ? h0.cell.id : null });
      }
      // 网格交点独立复核（只作读数：本仓存在重叠/重复格 id，命中格不一定等于网格三角所属格）
      const inv = new M4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse).invert();
      let meshAgree = 0, meshMiss = 0, minGap = Infinity;
      for (const pr of probes) {
        const ndc = at(1, pr);
        const a = new V3(ndc[0], ndc[1], -1).applyMatrix4(inv);
        const b = new V3(ndc[0], ndc[1], 1).applyMatrix4(inv);
        const dir = b.sub(a).normalize();
        const eye = cam.getWorldPosition(new V3());
        const t = eye.clone().sub(a).dot(dir);
        const origin = a.clone().addScaledVector(dir, t > 0 ? t : 0);
        minGap = Math.min(minGap, origin.distanceTo(eye));
        const hits = new THREE.Raycaster(origin, dir).intersectObject(v.mesh, false);
        if (!hits.length) { meshMiss++; continue; }
        const pt = hits[0].point;
        const cell = v.index.at(pt.x, pt.z).find((c) => pointInQuad(c.pts, pt.x, pt.z));
        const h = v.pick(ndc[0], ndc[1]);
        if (cell && h && cell.id === h.cell.id) meshAgree++;
      }
      // fixRay 关档对照：同一批 NDC、只把 fixRay 停掉（= 旧的眼点射线），命中会不会变
      const stock = v.mixedPersp.fixRay;
      v.mixedPersp.fixRay = () => {};
      const unfixed = probes.map((pr) => { const ndc = at(1, pr); const h = v.pick(ndc[0], ndc[1]); return h ? h.cell.id : null; });
      v.mixedPersp.fixRay = stock;
      v.mixedPersp.setK(1);
      const changed = probes.filter((pr, i) => { const ndc = at(1, pr); const h = v.pick(ndc[0], ndc[1]); return (h ? h.cell.id : null) !== unfixed[i]; }).length;
      return { n: probes.length, solid, k1Agree, k0Agree, meshAgree, meshMiss, changed, minGap: +minGap.toFixed(3), rows };
    });
    check('⑤ 混合投影下 24 次拾取全部落在实心格上', pick.solid === pick.n, { solid: pick.solid, n: pick.n });
    check('⑤ 拾取精度没有因混合投影掉档（k=1 命中自身 ≥ k=0 命中自身）',
      pick.k1Agree >= pick.k0Agree && pick.k1Agree >= Math.ceil(pick.n * 0.5),
      { k1: pick.k1Agree + '/' + pick.n, k0: pick.k0Agree + '/' + pick.n });
    check('⑤ fixRay 真的换了射线：起点在线上离相机最近点 + 关掉它同一批 NDC 大面积改判',
      pick.minGap > 0.05 && pick.changed >= pick.n * 0.5,
      { minGap: pick.minGap, changed: pick.changed, n: pick.n, meshAgree: pick.meshAgree + '/' + pick.n, meshMiss: pick.meshMiss });

    /* ---- ⑥ 像素账：同机位 k=0 / k=1 的真实帧差分 + 噪声 ---- */
    const px = await page.evaluate(async () => {
      const THREE = await import('three');
      const v = window.reaView, r = v.renderer, cam = v.camera, scene = v.scene;
      const W = 480, H = 360;
      const orig = v.render.bind(v);
      const rt = new THREE.WebGLRenderTarget(W, H);
      const draw = () => {
        orig(0);                                        // dt=0：时间轴冻住，只剩投影这一件事在变
        r.setRenderTarget(rt); r.render(scene, cam); r.render(scene, cam);
        const a = new Uint8Array(W * H * 4);
        r.readRenderTargetPixels(rt, 0, 0, W, H, a);
        r.setRenderTarget(null);
        return a;
      };
      const diff = (a, b, thr = 6) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > thr) n++; return n; };
      v.mixedPersp.setK(0); const off = draw(), off2 = draw();
      v.mixedPersp.setK(1); const on = draw(), on2 = draw();
      v.mixedPersp.setK(1);
      return { offOn: diff(off, on), offOnStrict: diff(off, on, 12), noiseOff: diff(off, off2), noiseOn: diff(on, on2), px: W * H };
    });
    check('⑥ k=0 → k=1 整帧差分显著（投影真的画进画面）', px.offOn > 5000, px);
    check('⑥ 同档连画两帧噪声为 0（差分不是抖动）', px.noiseOff === 0 && px.noiseOn === 0, px);

    /* ---- 截图：整页 + 只截画布，两档各一张 ---- */
    for (const [k, tag] of [[0, 'k0'], [1, 'k1']]) {
      await page.evaluate((kk) => window.reaView.mixedPersp.setK(kk), k);
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT, `mixed-persp-main-${tag}-r171.png`) });
      await page.locator('#view').screenshot({ path: path.join(OUT, `mixed-persp-canvas-${tag}-r171.png`) });
    }
    await page.close();

    /* ============ 第二段：不带参数的主场景（必须零行为变化） ============ */
    const plain = await boot(browser, BASE, false);
    const vanilla = await plain.evaluate(() => {
      const v = window.reaView, w = window.rea.world, grid = window.rea.grid;
      const probes = [];
      for (const c of grid.cells) { if (w.top(c) > 1) { probes.push({ x: c.cx, z: c.cz, y1: w.top(c) * v.levelHeight }); } if (probes.length >= 12) break; }
      const drift = probes.map((p) => {
        const cam = v.camera;
        const V3 = cam.position.constructor;
        const a = new V3(p.x, 0, p.z).project(cam), b = new V3(p.x, p.y1, p.z).project(cam);
        return Math.abs(a.x - b.x) * v.renderer.domElement.width / 2;
      });
      return { mixed: v.mixedPersp ?? null, maxDrift: Math.max(...drift), n: probes.length };
    });
    check('⑦ 不带参数的页面不装载混合透视（mixedPersp 为空）', vanilla.mixed === null, { mixed: !!vanilla.mixed });
    check('⑦ 不带参数时竖线横移与 k=0 档同量级（默认零行为变化）',
      Math.abs(vanilla.maxDrift - lines.k0MaxDrift) < 1, { vanilla: +vanilla.maxDrift.toFixed(3), k0: +lines.k0MaxDrift.toFixed(3) });
    await plain.close();

    if (problems.length) {
      console.log('FAIL ' + problems.length + ' 项');
      process.exitCode = 1;
    } else {
      console.log('PASS mixed perspective @ main view:',
        JSON.stringify({
          k1MaxDrift: lines.k1MaxDrift, k0MaxDrift: +lines.k0MaxDrift.toFixed(2),
          sizeRatio: depth.near && depth.far ? +(depth.near.h / depth.far.h).toFixed(2) : null,
          pickAgree: pick.k1Agree + '/' + pick.n, pickK0: pick.k0Agree + '/' + pick.n, fixRayChanged: pick.changed, meshAgree: pick.meshAgree,
          offOnPx: px.offOn, noise: [px.noiseOff, px.noiseOn],
        }));
    }
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });

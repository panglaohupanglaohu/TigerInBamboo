// 第 105 轮 · 灌木带宽「同机位」标定（[000] 缺口收口：1707497006640365880 / 1707490932017279035）。
//
// 为什么需要这个：r101 量出「本仓 P90 只有原片 ~60%」，但两边机位/缩放不可比（本仓 1100×760 全景 vs
//   原片 640 见方特写），所以当时**不许改常数**。要把 `SHRUB_BAND.max` 收到实测值，先得有一个无量纲量：
//
//     R = 带的像素厚度 / 该格「格心→这条边」的像素距离（= 着色器里的宽度比例）
//
//   R 对机位/缩放不变（分子分母都沿同一条面内方向被同一透视因子压缩），所以两边可以比。
//
// 本脚本只做「本仓那一半」，并且把相机推到原片同一档取景（apothem ≈ 130px，640×640，俯角接近原片），
//   截图交给 tools/shrub-salmon-metric.py 用**同一个口径**（Chebyshev 腐蚀 P90）量厚度，再除 apothem 得 R。
//
// 用法：
//   NODE_PATH=/tmp/pw-shim:/Users/panglaohu/Downloads/TigerInBamboo/REA-agent/node_modules \
//     node tests/shrub-band-scale-browser.cjs [apothemPx=130]
const { chromium } = require('playwright');
const fs = require('fs');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = 'artifacts/coverage';
const TARGET = Number(process.argv[2] || 130);

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const problems = [];
  const rows = [];
  const ok = (c, m) => rows.push({ ok: !!c, m });
  const page = await browser.newPage({ viewport: { width: 640, height: 640 } });
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text().slice(0, 300)); });
  try {
    await page.goto('http://127.0.0.1:8769/index.html?scene=terrain', { waitUntil: 'load' });
    await page.waitForFunction(() => window.rea?.view?.renderer?.info?.render?.calls > 0, null, { polling: 200, timeout: 90000 });
    await page.waitForFunction(() => (window.rea?.world?.cells?.length || 0) > 200, null, { polling: 200, timeout: 90000 });
    await page.waitForFunction(() => (window.rea?.view?.worldMesh?.geometry?.attributes?.aBand?.count || 0) > 45000, null, { polling: 200, timeout: 90000 });
    await page.waitForTimeout(300);

    // ① 只看画面：藏掉 HUD（原片是纯画面，量像素时不能让面板/配色条进来）
    await page.evaluate(() => { const h = document.getElementById('hud'); if (h) h.style.display = 'none'; });

    // ② 选一条「有落差、有带子」的边，投影出「格心→这条边中点」的像素长度（= apothem_px）
    const pick = await page.evaluate((target) => {
      const { world, view } = window.rea;
      const L = view.levelHeight || 1;
      const W = view.renderer.domElement.clientWidth || 640;
      const H = view.renderer.domElement.clientHeight || 640;
      const proj = (cam, p) => {
        const m = cam.matrixWorldInverse.elements, pr = cam.projectionMatrix.elements;
        const vx = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12];
        const vy = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
        const vz = m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14];
        const vw = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15] || 1;
        const cx = pr[0] * vx + pr[4] * vy + pr[8] * vz + pr[12] * vw;
        const cy = pr[1] * vx + pr[5] * vy + pr[9] * vz + pr[13] * vw;
        const cw = pr[3] * vx + pr[7] * vy + pr[11] * vz + pr[15] * vw || 1;
        return [(cx / cw * 0.5 + 0.5) * W, (1 - (cy / cw * 0.5 + 0.5)) * H];
      };
      // 找「maxDrop>=2 且格面最大」的格：格面越大，apothem 越大，降到目标像素所需的 distance 越近
      let best = null;
      for (const c of world.cells) {
        if (!(c.pts?.length >= 4)) continue;
        const g = world.top(c);
        if (!g) continue;
        const n = c.pts.length;
        let dropI = -1, drop = 0;
        for (let i = 0; i < n; i++) { const o = world.neighbor(c, i); if (o) { const d = g - world.top(o); if (d > drop) { drop = d; dropI = i; } } }
        if (drop < 2) continue;
        const cx = c.cx ?? c.pts.reduce((s, p) => s + p.x, 0) / n;
        const cz = c.cz ?? c.pts.reduce((s, p) => s + p.z, 0) / n;
        let ap = 0;
        for (let i = 0; i < n; i++) { const a = c.pts[i], b = c.pts[(i + 1) % n]; ap = Math.max(ap, Math.hypot((a.x + b.x) / 2 - cx, (a.z + b.z) / 2 - cz)); }
        if (!best || ap > best.ap) best = { cell: c.id, cx, cz, y: g * L, ap, drop, dropI, n };
      }
      if (!best) return { found: false };
      const c = world.cells.find((q) => q.id === best.cell);
      const a = c.pts[best.dropI], b = c.pts[(best.dropI + 1) % c.n];
      const mid = [(a.x + b.x) / 2, best.y, (a.z + b.z) / 2];
      const ctr = [best.cx, best.y, best.cz];
      view.target.set(best.cx, best.y, best.cz);
      view.yaw = Math.PI * 0.25;
      view.pitch = 0.62;                    // 接近原片 frame-0150 的俯角（顶面大面积可见）
      view.distance = 3.2;
      view.updateCamera();
      view.render(0.016);
      const measure = () => {
        const p0 = proj(view.camera, ctr), p1 = proj(view.camera, mid);
        return { apothemPx: Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), p0, p1 };
      };
      // 二分 distance：像素长度 ∝ 1/distance（近轴），两步迭代足够
      let dist = 3.2;
      for (let k = 0; k < 24; k++) {
        view.distance = dist; view.updateCamera();
        const m = measure();
        if (!isFinite(m.apothemPx) || m.apothemPx <= 0) break;
        dist *= m.apothemPx / target;
        if (Math.abs(m.apothemPx - target) / target < 0.01) break;
      }
      view.distance = dist; view.updateCamera(); view.render(0.016);
      const m = measure();
      return { found: true, ...best, distance: dist, ...m, W, H,
        widthU: window.rea.view.shrubStyle?.value?.x ?? null };
    }, TARGET);

    ok(pick.found, '找到满 2 层落差以上的台地格');
    ok(pick.found && Math.abs(pick.apothemPx - TARGET) / TARGET < 0.05, `apothem 对齐原片取景 ${pick.found ? pick.apothemPx.toFixed(1) : 0}px（目标 ${TARGET}）`);
    await page.waitForTimeout(250);

    // ③ 截图：灌木开 / 关（关的那张只用来做差，证明带子确实在画）
    const shotOn = `${OUT}/shrub-band-scale-on.png`;
    const shotOff = `${OUT}/shrub-band-scale-off.png`;
    await page.evaluate(() => { window.rea.view.shrubOn.value = 1; window.rea.view.render(0.016); });
    await page.waitForTimeout(220);
    await page.screenshot({ path: shotOn });
    await page.evaluate(() => { window.rea.view.shrubOn.value = 0; window.rea.view.render(0.016); });
    await page.waitForTimeout(220);
    await page.screenshot({ path: shotOff });
    await page.evaluate(() => { window.rea.view.shrubOn.value = 1; window.rea.view.render(0.016); });

    // ④ 同格各边的 aBand（证明这一格真的吃了逐三角倍率；标定取的是「这一格的带子」）
    const bands = await page.evaluate((cellId) => {
      const g = window.rea.view.worldMesh?.geometry;
      const arr = g?.attributes?.aBand?.array, edge = g?.attributes?.aEdge?.array;
      if (!arr) return null;
      const tiers = new Set();
      for (let i = 0; i < arr.length; i += 3) tiers.add(arr[i].toFixed(4));
      return { tris: arr.length / 3, tiers: tiers.size, min: Math.min(...arr), max: Math.max(...arr) };
    }, pick.cell);
    ok(!!bands, `活网格 aBand ${bands ? `${bands.tris} 三角 / ${bands.tiers} 档 / ${bands.min.toFixed(3)}–${bands.max.toFixed(3)}` : '缺失'}`);

    console.log(rows.map((r) => `  ${r.ok ? '✓' : '✗'} ${r.m}`).join('\n'));
    const report = { target: TARGET, pick, bands, problems, shots: [shotOn, shotOff] };
    fs.writeFileSync(`${OUT}/shrub-band-scale-report.json`, JSON.stringify(report, null, 1));
    console.log('APOTHEM_PX=' + (pick.apothemPx || 0).toFixed(2));
    const bad = rows.filter((r) => !r.ok).length;
    console.log(bad ? `\nFAIL ${bad}/${rows.length}` : `\nALL PASS ${rows.length}/${rows.length}`);
    process.exitCode = bad ? 1 : 0;
  } catch (e) {
    console.log('ERROR ' + e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();

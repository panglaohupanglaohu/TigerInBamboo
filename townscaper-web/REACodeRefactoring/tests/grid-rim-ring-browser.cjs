/**
 * grid-rim-ring-browser.cjs — 第 82 轮 · 1120036868966502401 缺口 ①「外缘方块做成真回字形」
 *
 * 原片证据（460×460 原始帧 frame-0074，逐像素读亮度）：
 *   外缘交点上是一个 6×6px 空心方块 —— 四边各 1px 深色（lum 0–11），
 *   内部 4×4 是 lum 244–254 的**白芯**（比地表 lum≈200 更亮，所以不是「透出地表」）。
 *   旧实现「5px 黑点 + 白点压心」在第 81 轮把交点白点层默认关掉后只剩实心黑点，白芯消失。
 *
 * 判据（真机位渲染后**读像素**，不看 exit code）：
 *   ① 外缘层是 shader 点精灵，uSize/uStroke 按视口折算（760 高 → 6k / 1k，460 高 → 6 / 1）；
 *   ② 环心是亮的、四边是深的 —— 空心的；
 *   ③ 把描边置 0（实心档）后同一位置环心变深 —— 说明「亮心」确实来自环本身，不是地表；
 *   ④ 实心档与环形档在该点邻域像素不同，而环形档默认生效；
 *   ⑤ 外缘点数 >0 且小于交点总数（只有外缘顶点带标记）。
 */
const { chromium } = require('playwright');
const fs = require('fs');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = 'artifacts/coverage';

const shot = async (page) => (await page.screenshot()).toString('base64');

/** 截图解码成像素，按给定屏幕点取 9×9 邻域统计「环心 / 四边」亮度。 */
const sample = (page, b64, pts) => page.evaluate(async ([b64, pts]) => {
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + b64; });
  const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
  const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, img.width, img.height).data;
  const lum = (x, y) => {
    const i = (Math.round(y) * img.width + Math.round(x)) * 4;
    return (d[i] + d[i + 1] + d[i + 2]) / 3;
  };
  return pts.map((p) => {
    const cx = Math.round(p.x), cy = Math.round(p.y);
    const r = Math.max(2, Math.round(p.r));
    const center = lum(cx, cy);
    const edges = [lum(cx - r, cy), lum(cx + r, cy), lum(cx, cy - r), lum(cx, cy + r)];
    return {
      x: cx, y: cy, r, center: +center.toFixed(1),
      edges: edges.map((v) => +v.toFixed(1)),
      edgeMin: +Math.min(...edges).toFixed(1),
      edgeMax: +Math.max(...edges).toFixed(1),
    };
  });
}, [b64, pts]);

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const problems = [];
  const report = { ok: false };
  const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text().slice(0, 300)); });
  try {
    await page.goto('http://127.0.0.1:8769/index.html?scene=terrain&on=grid', { waitUntil: 'load' });
    await page.waitForFunction(() => window.rea?.view?.gridLines, null, { polling: 200, timeout: 90000 });
    await page.waitForFunction(() => (window.rea?.world?.cells?.length || 0) > 100, null, { polling: 200, timeout: 90000 });

    // 真机位：近俯视，整岛入画（原片 frame-0074 的视角量级）
    report.setup = await page.evaluate(() => {
      const v = window.rea.view;
      const hud = document.querySelector('#hud'); if (hud) hud.style.display = 'none';
      v.setDebug('grid', true);
      v.setGridRegular(true);
      v.yaw = 0; v.pitch = 1.32; v.distance = 26;
      v.target.set(0, 1.2, 0); v.updateCamera();
      v.applyGridPx(760);
      v.render(0.016);
      const m = v.gridRim.material;
      return {
        rimCount: v.gridRim.geometry.getAttribute('position')?.count || 0,
        cornerCount: v.gridDots.geometry.getAttribute('position')?.count || 0,
        visible: v.gridRim.visible,
        isShader: !!m.uniforms,
        uSize: m.uniforms?.uSize?.value, uStroke: m.uniforms?.uStroke?.value,
        matSize: m.size, px: { ...v.gridPx },
        fill: m.uniforms?.uFill?.value?.getHexString?.(), edge: m.uniforms?.uEdge?.value?.getHexString?.(),
      };
    });

    // 把外缘顶点投到屏幕上，挑落在画面中段、且周围一格内没有别个标记的点（免得邻点互相污染采样）
    // 注意：不用 Vector3.project（页面里拿不到 THREE，`v.target.clone()` 不是可 set 的向量），
    // 直接读 camera 的 view/projection 矩阵手算 clip 坐标。
    report.pick = await page.evaluate(() => {
      const v = window.rea.view;
      const geo = v.gridRim.geometry.getAttribute('position');
      const rect = v.renderer.domElement.getBoundingClientRect();
      const w = rect.width, h = rect.height;
      const cam = v.camera; cam.updateMatrixWorld(true);
      const e = cam.matrixWorldInverse.elements, pr = cam.projectionMatrix.elements;
      const list = [];
      for (let i = 0; i < geo.count; i++) {
        const x0 = geo.getX(i), y0 = geo.getY(i), z0 = geo.getZ(i);
        const vx = e[0] * x0 + e[4] * y0 + e[8] * z0 + e[12];
        const vy = e[1] * x0 + e[5] * y0 + e[9] * z0 + e[13];
        const vz = e[2] * x0 + e[6] * y0 + e[10] * z0 + e[14];
        const vw = e[3] * x0 + e[7] * y0 + e[11] * z0 + e[15];
        const cx = pr[0] * vx + pr[4] * vy + pr[8] * vz + pr[12] * vw;
        const cy = pr[1] * vx + pr[5] * vy + pr[9] * vz + pr[13] * vw;
        const cw = pr[3] * vx + pr[7] * vy + pr[11] * vz + pr[15] * vw;
        if (cw <= 0) continue;
        const x = rect.left + (cx / cw * 0.5 + 0.5) * w;
        const y = rect.top + (-cy / cw * 0.5 + 0.5) * h;
        if (x < 120 || x > w - 120 || y < 120 || y > h - 120) continue;
        list.push({ x: +x.toFixed(1), y: +y.toFixed(1) });
      }
      // 稀疏化：彼此相距 > 16px 才留一个，最多 12 个
      const keep = [];
      for (const p of list) {
        if (keep.every((q) => Math.hypot(q.x - p.x, q.y - p.y) > 16)) keep.push(p);
        if (keep.length >= 12) break;
      }
      const size = v.gridPx.rim || 6;
      // 描边带在「外沿 −0.6…−stroke−0.6」之间：取 0.42×边长 就落在深色环中部
      const rEdge = Math.max(2, Math.round(size * 0.42));
      return { screened: list.length, pts: keep.map((p) => ({ ...p, r: rEdge })), rimPx: size, viewport: { w, h } };
    });

    // 环形档（默认）
    await page.waitForTimeout(200);
    const ringShot = await shot(page);
    fs.writeFileSync(`${OUT}/grid-rim-ring.png`, Buffer.from(ringShot, 'base64'));
    report.ring = await sample(page, ringShot, report.pick.pts);

    // 实心档对照：描边 0
    report.solidSetup = await page.evaluate(() => {
      const v = window.rea.view;
      v.setGridRimSize(6, 0);
      v.render(0.016);
      return { uSize: v.gridRim.material.uniforms.uSize.value, uStroke: v.gridRim.material.uniforms.uStroke.value };
    });
    await page.waitForTimeout(200);
    const solidShot = await shot(page);
    fs.writeFileSync(`${OUT}/grid-rim-solid.png`, Buffer.from(solidShot, 'base64'));
    report.solid = await sample(page, solidShot, report.pick.pts);

    // 460 视口：尺寸回到原片口径（uSize=6 / uStroke=1）
    await page.setViewportSize({ width: 1000, height: 460 });
    await page.waitForTimeout(250);
    report.at460 = await page.evaluate(() => {
      const v = window.rea.view;
      v.renderer.setSize(1000, 460, false);
      v.camera.aspect = 1000 / 460; v.camera.updateProjectionMatrix();
      v.setGridRimSize(6, 1);
      v.render(0.016);
      return { uSize: v.gridRim.material.uniforms.uSize.value, uStroke: v.gridRim.material.uniforms.uStroke.value, scale: v.gridPx.scale };
    });
    await page.screenshot({ path: `${OUT}/grid-rim-460.png` });

    // 越界/实心校验
    report.guards = await page.evaluate(() => {
      const v = window.rea.view;
      const bad = [];
      for (const [a, b] of [[1, 1], [20, 1], [6, 3], [6, -1]]) {
        try { v.setGridRimSize(a, b); bad.push(a + '/' + b); } catch (e) { /* 期望抛错 */ }
      }
      v.setGridRimSize(6, 1);
      return { wrongAccepted: bad };
    });

    const ringOk = report.ring.filter((p) => p.center > 200 && p.edgeMin < 110);
    const solidOk = report.solid.filter((p) => p.center < 120);
    const brighter = report.ring.map((p, i) => p.center - (report.solid[i]?.center ?? 0));
    report.checks = {
      rimLayerPresent: report.setup.rimCount > 0,
      rimOnlyAtRim: report.setup.rimCount > 0 && report.setup.rimCount < report.setup.cornerCount,
      rimVisible: report.setup.visible === true,
      rimIsShaderRing: report.setup.isShader === true && report.setup.uStroke > 0,
      rimSizeFromMeasurement: Math.abs(report.setup.px.base.rim - 6) < 1e-6 && Math.abs(report.setup.px.base.rimStroke - 1) < 1e-6,
      rimScaledToViewport: Math.abs(report.setup.uSize - 6 * report.setup.px.scale) < 0.05
        && Math.abs(report.setup.matSize - report.setup.uSize) < 0.01 && report.setup.uStroke >= 1,
      // 白芯 + 深边 = 空心（至少 8 个采样点里 6 个成立，避开压在深色岩石上的那一两个）
      ringHollow: ringOk.length >= Math.min(6, report.pick.pts.length),
      // 实心档同一位置环心变深 → 亮心来自环内芯，不是地表
      solidHasDarkCenter: solidOk.length >= Math.min(6, report.pick.pts.length),
      // 逐点对照：环形档环心明显比实心档亮
      ringBrighterThanSolid: brighter.filter((v) => v > 60).length >= Math.min(6, report.pick.pts.length),
      backToOriginalAt460: Math.abs(report.at460.uSize - 6) < 0.05 && Math.abs(report.at460.uStroke - 1) < 0.05,
      guardsThrow: report.guards.wrongAccepted.length === 0,
    };
    report.pick.pts.forEach((p, i) => { if (report.ring[i]) report.ring[i].solid = report.solid[i]?.center; });
    report.ok = Object.values(report.checks).every(Boolean) && problems.length === 0;
    report.problems = problems;
    fs.writeFileSync(`${OUT}/grid-rim-ring-report.json`, JSON.stringify(report, null, 1));
    console.log(JSON.stringify(report.checks));
    console.log('rims=' + report.setup.rimCount + ' corners=' + report.setup.cornerCount +
      ' uSize=' + report.setup.uSize + ' uStroke=' + report.setup.uStroke +
      ' ringCenters=' + report.ring.map((p) => p.center).join(',') +
      ' solidCenters=' + report.solid.map((p) => p.center).join(','));
  } catch (e) {
    report.error = String(e && e.message || e);
    report.problems = problems;
    fs.writeFileSync(`${OUT}/grid-rim-ring-report.json`, JSON.stringify(report, null, 1));
    console.log('FAIL ' + report.error);
  } finally {
    await browser.close();
  }
  if (!report.ok) process.exit(1);
})();

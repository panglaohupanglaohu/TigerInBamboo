/**
 * shrub-scallop-measure.cjs — 第 82 轮 · 1707490932017279035 / 1707497006640365880 外缘圆齿定量
 *
 * 目的不是再"看一眼像不像"，而是把两边的**同一把尺**量出来：
 *   原片（第 81 轮同口径实测）：外缘凸起周期 9.21px、格边 24–25px → 周期/格边 = 0.376（2.6–5 个凸起/格边）
 *   本仓渲染：同机位、460 高视口，量橙色带外轮廓的峰周期 + 同一帧的格边像素长 → 同样的比值
 * 判据：比值落在 0.25–0.55（= 2.6–5 个/格边）即「单尺度圆齿已在正确量级」，不需要再改 freq；
 *       超出区间才动 `ragged`/freq。
 */
const { chromium } = require('playwright');
const fs = require('fs');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = 'artifacts/coverage';

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1000, height: 460 } });
  const out = { ok: false, checks: {} };
  try {
    await page.goto('http://127.0.0.1:8769/index.html?scene=terrain', { waitUntil: 'load' });
    await page.waitForFunction(() => (window.rea?.world?.cells?.length || 0) > 200, null, { timeout: 90000 });
    await page.waitForFunction(() => window.rea?.view?.renderer?.info?.render?.calls > 0, null, { timeout: 90000 });

    out.setup = await page.evaluate(() => {
      const v = window.rea.view;
      const hud = document.querySelector('#hud'); if (hud) hud.style.display = 'none';
      if (v.setDebug) v.setDebug('grid', false);
      v.shrubOn.value = 1;
      v.renderer.setSize(1000, 460, false);
      v.camera.aspect = 1000 / 460; v.camera.updateProjectionMatrix();
      // 近俯视看台地边缘（原片 257 帧那种机位）
      v.yaw = 0.6; v.pitch = 1.05; v.distance = 14; v.target.set(0, 2.0, 0); v.updateCamera();
      v.render(0.016);
      // 同一帧的世界→像素尺度：用相机矩阵把 1 个世界单位投到屏幕上
      const cam = v.camera; cam.updateMatrixWorld(true);
      const e = cam.matrixWorldInverse.elements, pr = cam.projectionMatrix.elements;
      const proj = (x, y, z) => {
        const vx = e[0] * x + e[4] * y + e[8] * z + e[12];
        const vy = e[1] * x + e[5] * y + e[9] * z + e[13];
        const vz = e[2] * x + e[6] * y + e[10] * z + e[14];
        const vw = e[3] * x + e[7] * y + e[11] * z + e[15];
        const cx = pr[0] * vx + pr[4] * vy + pr[8] * vz + pr[12] * vw;
        const cy = pr[1] * vx + pr[5] * vy + pr[9] * vz + pr[13] * vw;
        const cw = pr[3] * vx + pr[7] * vy + pr[11] * vz + pr[15] * vw;
        return [(cx / cw * 0.5 + 0.5) * 1000, (-cy / cw * 0.5 + 0.5) * 460];
      };
      const a = proj(0, 2, 0), b = proj(1, 2, 0);
      return {
        pxPerUnitX: +Math.hypot(b[0] - a[0], b[1] - a[1]).toFixed(2),
        latticeSpacing: v.gridStats?.lattice?.spacing?.median ?? null,
        shrubStyle: { ...(v.shrubStyle?.value ? { x: v.shrubStyle.value.x, y: v.shrubStyle.value.y, z: v.shrubStyle.value.z, w: v.shrubStyle.value.w } : {}) },
        tooth: v.shrubTooth?.value, width: 1000, height: 460,
      };
    });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/shrub-scallop-measure.png` });

    // 在 Node 侧用 python 量（PIL 已装）——这里直接把截图交给 python
    out.measure = JSON.parse(require('child_process').execSync(
      `python3 tools/shrub-scallop-measure.py ${OUT}/shrub-scallop-measure.png ${out.setup.pxPerUnitX} ${out.setup.latticeSpacing ?? 0.4544}`,
      { encoding: 'utf8' }));
    const r = out.measure.ratio;
    out.checks = {
      bandFound: out.measure.bandPixels > 2000,
      enoughPeaks: out.measure.peaks >= 8,
      singleScaleInRange: r >= 0.25 && r <= 0.55,
      noCrash: out.measure.edgePx > 0,
    };
    out.ok = Object.values(out.checks).every(Boolean);
    fs.writeFileSync(`${OUT}/shrub-scallop-measure.json`, JSON.stringify(out, null, 1));
    console.log(JSON.stringify(out.checks));
    console.log(`period=${out.measure.periodPx}px edge=${out.measure.edgePx}px ratio=${r} peaks=${out.measure.peaks} band=${out.measure.bandPixels}`);
  } catch (e) {
    out.error = String(e && e.message || e);
    fs.writeFileSync(`${OUT}/shrub-scallop-measure.json`, JSON.stringify(out, null, 1));
    console.log('FAIL ' + out.error);
  } finally {
    await browser.close();
  }
  if (!out.ok) process.exit(1);
})();

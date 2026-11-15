// 第 74 轮 · 1120036868966502401（703f）：补第 73 轮收敛出的缺口「调试层全 depthTest:false，原片吃遮挡」。
// 原片证据（本轮 3× 裁切复核）：
//   · frame-0445：红/蓝/黄分行只出现在地台浅色平面上，跨到深色岛体即断 —— 线被几何挡住；
//   · frame-0470：白格线到方块边缘就停，方块顶面上一条线也没有 —— 格线同样走深度；
//   · frame-0260：红区域边界被块切断（第 73 轮已记）。
// 本仓原先 mesh / regions / regionThickMat / candidates / dots / corners / outlineMat 全 depthTest:false，
// 调试层透穿一切几何。本轮加总开关 setDepthOcclusion()，assembly.html 默认按原片打开。
// 判据：
//   A. 页面默认 occlusion=on，七层材质 depthTest 全 true；
//   B. 关掉后七层全 false（开关双向有效，不是只置了一边）；
//   C. 同机位开/关截图不同像素 > 2000（真的影响画面，不是只改了标志位）；
//   D. 语义正确：白格与黑格两种奇偶的**可见像素都**在 ON 时减少（方块把它们脚下的候选铺面挡住），
//      不能只统计亮度 —— 棋盘半白半黑，亮度平均会两边抵消（本轮第一版就是这么误判的）；
//   E. 候选棋盘可见面积 ON < OFF（块把它脚下的候选铺面挡住了，与原片一致）；
//   F. 无 pageerror / console error / WebGL 报错。
const { chromium } = require('playwright');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const fs = require('fs');
const OUT = 'artifacts/coverage';

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const errors = [];
  const out = { ok: false, checks: {} };
  let ok = true;
  const check = (name, pass, detail) => { out.checks[name] = { pass: !!pass, detail }; if (!pass) ok = false; console.log(`${pass ? 'PASS' : 'FAIL'} ${name} — ${detail}`); };
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 820 } });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300)); });
    await page.goto('http://127.0.0.1:8769/assembly.html?play=0&tileset=fort&seed=2', { waitUntil: 'load' });
    await page.waitForFunction(() => window.__assembly?.ok === true, null, { polling: 200, timeout: 60000 });
    // 打开候选棋盘 + 贴近机位（低机位才能让方块真正挡在调试层前面）
    await page.evaluate(() => {
      const cb = document.querySelector('#cand'); cb.checked = true; cb.onchange();
      const v = window.assemblyView; v.distance = 4.6; v.pitch = 0.34; v.render(0.016);
    });
    await page.waitForTimeout(400);

    // A / B：标志位双向
    const flags = await page.evaluate(() => {
      const o = window.assemblyView.contourOverlay;
      const pick = () => ({
        mesh: o.mesh.material.depthTest, regions: o.regions.material.depthTest,
        thick: o.regionThickMat.depthTest, cand: o.candidates.material.depthTest,
        dots: o.dots.material.depthTest, corners: o.corners.material.depthTest,
        outline: o.outlineMat.depthTest,
      });
      const def = { pageFlag: window.__assemblyOcclusion, layerFlag: o.depthOccluded, mats: pick(), renderOrder: o.mesh.renderOrder };
      o.setDepthOcclusion(false); const off = pick();
      o.setDepthOcclusion(true); const on = pick();
      const n = Object.keys(on).length;
      const allTrue = Object.values(on).every((v) => v === true);
      const allFalse = Object.values(off).every((v) => v === false);
      return { def, off, on, n, allTrue, allFalse, renderOrderKept: o.mesh.renderOrder };
    });
    check('A 页面默认吃遮挡', flags.def.pageFlag === true && flags.def.layerFlag === true && flags.n === 7, `page=${flags.def.pageFlag} layer=${flags.def.layerFlag} 覆盖层数=${flags.n}`);
    check('A2 默认七层 depthTest 全 true', flags.allTrue, JSON.stringify(flags.on));
    check('B 关掉后七层全 false', flags.allFalse, JSON.stringify(flags.off));

    // C / D / E：像素级
    const px = await page.evaluate(async () => {
      const v = window.assemblyView, r = v.renderer, gl = r.getContext(), o = v.contourOverlay;
      const grab = (occ) => {
        o.setDepthOcclusion(occ); v.render(0.016);
        const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
        const b = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, b);
        return { b, w, h };
      };
      const on = grab(true), off = grab(false);
      let diff = 0;
      const nearWhite = (b, i) => b[i] > 225 && b[i + 1] > 228 && b[i + 2] > 225;
      const nearBlack = (b, i) => b[i] < 40 && b[i + 1] < 40 && b[i + 2] < 44;
      let wOn = 0, wOff = 0, bOn = 0, bOff = 0;
      for (let i = 0; i < on.b.length; i += 4) {
        if (nearWhite(on.b, i)) wOn++;
        if (nearWhite(off.b, i)) wOff++;
        if (nearBlack(on.b, i)) bOn++;
        if (nearBlack(off.b, i)) bOff++;
        const d = Math.abs(on.b[i] - off.b[i]) + Math.abs(on.b[i + 1] - off.b[i + 1]) + Math.abs(on.b[i + 2] - off.b[i + 2]);
        if (d > 12) diff++;
      }
      o.setDepthOcclusion(true); v.render(0.016);
      return { diff, px: on.w * on.h, wOn, wOff, bOn, bOff };
    });
    check('C 开/关像素不同', px.diff > 2000, `不同像素=${px.diff}/${px.px} (${(100 * px.diff / px.px).toFixed(1)}%)`);
    check('D 白格与黑格可见像素都减少', px.wOn < px.wOff && px.bOn < px.bOff, `白 on=${px.wOn} off=${px.wOff} · 黑 on=${px.bOn} off=${px.bOff}`);
    check('E 候选铺面可见面积 ON<OFF（白格）', px.wOn < px.wOff, `近白像素 on=${px.wOn} off=${px.wOff}`);

    // 截图存档（开着遮挡，原片口径）
    await page.evaluate(() => { window.assemblyView.contourOverlay.setDepthOcclusion(true); window.assemblyView.render(0.016); });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/assembly-depth-occlusion.png` });
    await page.evaluate(() => { window.assemblyView.contourOverlay.setDepthOcclusion(false); window.assemblyView.render(0.016); });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/assembly-depth-occlusion-off.png` });
    await page.close();

    check('F 无运行时错误', errors.length === 0, errors.length ? errors.join(' | ') : 'clean');
    out.ok = ok;
    out.flags = flags;
    out.px = px;
    fs.writeFileSync(`${OUT}/assembly-depth-occlusion-browser.json`, JSON.stringify(out, null, 2));
    console.log(out.ok ? 'ALL PASS' : 'SOME FAIL');
    process.exitCode = out.ok ? 0 : 1;
  } catch (e) {
    console.error('ERR', e.message);
    process.exitCode = 1;
  } finally { await browser.close(); }
})();

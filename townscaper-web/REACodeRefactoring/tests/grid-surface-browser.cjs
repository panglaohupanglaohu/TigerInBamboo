/**
 * grid-surface-browser.cjs — 第 71 轮 · 1120036868966502401 缺口 ①「格线按 world.top 铺到岛体顶面（含跨层竖边）」
 *
 * 原片证据：frame-0080 / frame-0088 的 3× 裁切里，白线是**贴着实体表面**走的 ——
 * 屋面斜着走、竖直墙面上一段竖直短线；而本仓把整张格线钉在 y=0.015，岛体一挡就整片看不见。
 *
 * 判据（全部读活几何，不看 exit code）：
 *   ① 默认贴面档生效：stats.surface=true、maxY 随台地抬高（>0.5 层高）、竖边数 > 0；
 *   ② 每条段只有两种形态 —— 水平段（两端 y 相等，且 y = k·L + 0.015）或竖直段（两端 x、z 相同、y 不同）；
 *   ③ 关掉贴面档回到 y=0.015 平铺（全部水平段、maxY=0.015），说明可逆、不是写死；
 *   ④ 开/关两张截图像素不同（不是只改了字段）。
 */
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const out = { ok: true, checks: [] };
  const check = (n, c, d) => { out.checks.push({ name: n, pass: !!c, detail: d }); if (!c) out.ok = false; console.log(`  ${c ? 'PASS' : 'FAIL'} ${n} — ${d}`); };

  try {
    await page.goto('http://127.0.0.1:8769/index.html?scene=terrain', { waitUntil: 'load' });
    await page.waitForFunction(() => (window.rea?.world?.cells?.length || 0) > 200, null, { timeout: 90000 });
    await page.waitForFunction(() => window.rea?.view?.renderer?.info?.render?.calls > 0, null, { timeout: 90000 });

    const on = await page.evaluate(() => {
      const v = rea.view, L = v.levelHeight || 1;
      v.setDebug('grid', true);
      const st = v.refreshGridGeometry();
      const p = v.gridLines.geometry.attributes.position.array;
      let horiz = 0, vert = 0, badH = 0, badV = 0, maxDev = 0;
      for (let i = 0; i < p.length; i += 6) {
        const ax = p[i], ay = p[i + 1], az = p[i + 2], bx = p[i + 3], by = p[i + 4], bz = p[i + 5];
        if (Math.abs(ay - by) < 1e-6) {
          horiz++;
          const k = (ay - 0.015) / L, dev = Math.abs(k - Math.round(k));
          if (dev > 1e-3) badH++;
          if (dev > maxDev) maxDev = dev;
        } else if (Math.abs(ax - bx) < 1e-6 && Math.abs(az - bz) < 1e-6) vert++;
        else badV++;
      }
      v.pitch = 1.05; v.distance = 16; v.updateCamera(); v.render(0.016);
      return { st, horiz, vert, badH, badV, maxDev: +maxDev.toFixed(5), quads: v.gridThick.geometry.userData.quads };
    });
    check('① 贴面档生效', on.st.surface === true, `surface=${on.st.surface} cells=${on.st.cells} segs=${on.st.segments}`);
    check('① 高度随台地抬升', on.st.maxY > 0.5 && on.st.maxY <= 8.02, `maxY=${on.st.maxY}（levelHeight 单位）`);
    check('① 跨层竖边存在', on.st.vertical > 0 && on.vert > 0, `stats.vertical=${on.st.vertical} 实测竖直段=${on.vert}`);
    check('② 水平段都在整层高度上', on.badH === 0, `水平 ${on.horiz} 段，偏离整层 >1e-3 的有 ${on.badH} 条（最大 ${on.maxDev}）`);
    check('② 无斜穿段', on.badV === 0, `既非水平也非竖直的段 = ${on.badV}`);
    check('② 四边形数=段数', on.quads === on.st.segments, `quads=${on.quads} segs=${on.st.segments}`);
    await page.waitForTimeout(300);
    const shotOn = await page.screenshot({ path: 'artifacts/coverage/grid-surface-on.png' });

    const off = await page.evaluate(() => {
      const v = rea.view;
      const st = v.setGridSurface(false);
      const p = v.gridLines.geometry.attributes.position.array;
      let flat = 0, notFlat = 0;
      for (let i = 1; i < p.length; i += 3) { if (Math.abs(p[i] - 0.015) < 1e-6) flat++; else notFlat++; }
      v.render(0.016);
      return { st, flat, notFlat, quads: v.gridThick.geometry.userData.quads };
    });
    check('③ 关掉回到平铺', off.st.flat === true && off.st.maxY === 0.015 && off.notFlat === 0,
      `surface=${off.st.surface} maxY=${off.st.maxY} 非 0.015 顶点=${off.notFlat}`);
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'artifacts/coverage/grid-surface-off.png' });

    const pxDiff = await page.evaluate(async () => {
      const v = rea.view, r = v.renderer, gl = r.getContext();
      const grab = (surface) => {
        v.setGridSurface(surface); v.render(0.016);
        const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
        const b = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, b); return b;
      };
      const a = grab(true), b = grab(false);
      let diff = 0;
      for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) diff++;
      v.setGridSurface(true); v.render(0.016);
      return diff;
    });
    check('④ 开/关像素不同', pxDiff > 2000, `不同像素=${pxDiff}`);
    out.on = on; out.off = off; out.pxDiff = pxDiff;
    if (errors.length) { out.ok = false; out.errors = errors; }
    fs.writeFileSync('artifacts/coverage/grid-surface-browser.json', JSON.stringify(out, null, 2));
    console.log(out.ok ? 'ALL PASS' : 'SOME FAIL');
    process.exitCode = out.ok ? 0 : 1;
  } catch (e) {
    console.error('ERR', e.message); process.exitCode = 1;
  } finally { await browser.close(); }
})();

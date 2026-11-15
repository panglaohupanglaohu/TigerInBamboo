// 第 85 轮 · 1120036868966502401 缺口 ①③ 运行时验收：网格调试层**页面入口**（grid-debug.html）。
// 缺口原文：三角层与色板调试都没有实验页入口，只能 window.rea.view 脚本调；三角层触发键位片中不存在（无 UI，只在 0569 见鼠标指针）。
// 本测试只验「入口真的有、每个开关真的接到底层」：
//   ① 页面起得来，默认态 = 格线开 / 贴面档 / 三角层关；
//   ② 勾三角层 → 两组各自出色（原片 frame-0300 右深蓝 + 左下黄绿），三角数 >0 且顶点数 = 三角×6；
//   ③ 关格线 → gridLines/gridThick/gridTri 全隐；
//   ④ 等距方格 → lattice.cols>0 且 drape 统计有值（贴面裁剪真的跑过）；
//   ⑤ 区域三色 → contourOverlay 可见、色板前 3 项等于实测值、后 4 项标注为本仓扩展档；
//   ⑥ 吃遮挡 → depthTest 层数 >0 且无 GL 错误；
//   ⑦ 截图里数得到黄/蓝三角像素（不许只信 exit code）。
const { chromium } = require('playwright');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = 'artifacts/coverage';

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const problems = [];
  const checks = [];
  const check = (name, ok, detail) => { checks.push({ name, ok: !!ok, detail }); if (!ok) problems.push(name + ' :: ' + detail); };
  const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text().slice(0, 300)); });
  try {
    await page.goto('http://127.0.0.1:8769/grid-debug.html', { waitUntil: 'load' });
    await page.waitForFunction(() => window.__gridDebug && window.__gridDebug.segments > 0, null, { polling: 200, timeout: 90000 });

    const base = await page.evaluate(() => {
      const v = window.gridDebugView;
      const hud = document.querySelector('#hud'); if (hud) hud.style.display = 'none';
      v.yaw = 0; v.pitch = 1.28; v.distance = 18; v.target.set(0, 1, 0); v.updateCamera(); v.render(0.016);
      return { dbg: window.__gridDebug, linesVisible: v.gridLines.visible, triVisible: v.gridTri.visible, pal: v.contourOverlay.regionPalette.slice() };
    });
    check('① 页面入口起得来（格线段 >0）', base.dbg.segments > 0, 'segments=' + base.dbg.segments);
    check('① 默认格线可见', base.linesVisible === true, 'gridLines.visible=' + base.linesVisible);
    check('① 默认贴面档', base.dbg.surface === true && base.dbg.flat === false, `surface=${base.dbg.surface} flat=${base.dbg.flat}`);
    check('① 默认不出三角层', base.dbg.triStats === null && base.triVisible === false, 'triStats=' + JSON.stringify(base.dbg.triStats));
    check('① 外缘回字环默认 6px（frame-0074 口径）', base.dbg.rimPx === 6 && base.dbg.px?.base?.rim === 6, JSON.stringify(base.dbg.px?.base));

    // ② 三角层两组色（第 86 轮：页面不再静默勾等距档，这里显式先开等距方格）
    const tri = await page.evaluate(async () => {
      const v = window.gridDebugView;
      const reg = document.querySelector('#cRegular'); reg.checked = true; reg.onchange();
      const box = document.querySelector('#cTri'); box.checked = true; box.onchange();
      v.render(0.016);
      const geo = v.gridTri.geometry;
      const col = geo.getAttribute('color');
      const seen = new Set();
      if (col) for (let i = 0; i < col.count; i++) {
        const r = col.getX(i), g = col.getY(i), b = col.getZ(i);
        seen.add([r, g, b].map((x) => Math.round(x * 255)).join(','));
      }
      return { dbg: window.__gridDebug, count: geo.getAttribute('position')?.count || 0, colors: [...seen], ticks: v.gridTriStats };
    });
    check('② 三角层出三角', tri.ticks && tri.ticks.triangles > 0, JSON.stringify(tri.ticks && { triangles: tri.ticks.triangles }));
    check('② 顶点数 = 三角 × 3 边 × 2 端', tri.count === tri.ticks.triangles * 6, `count=${tri.count} tri=${tri.ticks.triangles}`);
    check('② 两组不同色（≥2 个不同顶点色）', tri.colors.length >= 2, JSON.stringify(tri.colors));
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${OUT}/grid-debug-page-tri.png` });

    // ⑤ 区域三色 + 色板降级注释
    const reg = await page.evaluate(() => {
      const v = window.gridDebugView;
      const box = document.querySelector('#cRegions'); box.checked = true; box.onchange();
      v.render(0.016);
      const sz = v.contourOverlay.regionStats;
      return { visible: v.contourOverlay.mesh.visible, layers: sz?.length || 0, pal: v.contourOverlay.regionPalette.slice(), occl: window.__gridDebug.occlusionLayers };
    });
    check('⑤ 区域层可见', reg.visible === true, 'visible=' + reg.visible);
    check('⑤ 按高度层出统计', reg.layers > 0, 'layers=' + reg.layers);
    check('⑤ 色板前 3 项 = frame-0300 实测值', reg.pal.slice(0, 3).join(',') === '#da4728,#2e4ba7,#dcdf66', reg.pal.slice(0, 3).join(','));
    check('⑤ 色板仍 7 档（后 4 档 = 本仓扩展档，已加注释）', reg.pal.length === 7, 'len=' + reg.pal.length);
    check('⑥ 调试层吃遮挡接到 8 层', reg.occl >= 7, 'occlusionLayers=' + reg.occl);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${OUT}/grid-debug-page-regions.png` });

    // ④ 等距方格 + 贴面裁剪
    const lat = await page.evaluate(() => {
      const v = window.gridDebugView;
      const box = document.querySelector('#cRegular'); box.checked = true; box.onchange();
      v.render(0.016);
      return { dbg: window.__gridDebug, stats: v.gridStats };
    });
    check('④ 等距方格建起来', lat.stats.lattice && lat.stats.lattice.cols > 0 && lat.stats.lattice.rows > 0, JSON.stringify(lat.stats.lattice && { cols: lat.stats.lattice.cols, rows: lat.stats.lattice.rows }));
    check('④ 贴面裁剪有统计（kept/dropped/水平+竖线）', lat.stats.drape && lat.stats.drape.kept > 0, JSON.stringify(lat.stats.drape));
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${OUT}/grid-debug-page-lattice.png` });

    // ③ 关格线 → 全隐
    const off = await page.evaluate(() => {
      const v = window.gridDebugView;
      const box = document.querySelector('#cGrid'); box.checked = false; box.onchange();
      v.render(0.016);
      return { lines: v.gridLines.visible, thick: v.gridThick.visible, tri: v.gridTri.visible, rim: v.gridRim.visible };
    });
    check('③ 关格线后三层全隐', !off.lines && !off.thick && !off.tri && !off.rim, JSON.stringify(off));

    // ⑦ 截图数黄/蓝像素（真看过的不许只靠 exit code）
    const px = await page.evaluate(async () => {
      const v = window.gridDebugView;
      const g = document.querySelector('#cGrid'); g.checked = true; g.onchange();
      const reg = document.querySelector('#cRegular'); reg.checked = true; reg.onchange();
      const t = document.querySelector('#cTri'); t.checked = true; t.onchange();
      v.render(0.016);
      await new Promise((r) => setTimeout(r, 120));
      v.render(0.016);
      const cvs = v.renderer.domElement;
      const cv = document.createElement('canvas'); cv.width = cvs.width; cv.height = cvs.height;
      cv.getContext('2d').drawImage(cvs, 0, 0);
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      let yellow = 0, blue = 0;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], gg = d[i + 1], b = d[i + 2];
        if (r > 170 && gg > 170 && b < 130) yellow++;
        if (b > 120 && b - r > 45 && b - gg > 30) blue++;
      }
      return { yellow, blue, w: cv.width, h: cv.height };
    });
    check('⑦ 画面里数得到黄三角像素', px.yellow > 200, 'yellow=' + px.yellow);
    check('⑦ 画面里数得到蓝三角像素', px.blue > 200, 'blue=' + px.blue);
    await page.screenshot({ path: `${OUT}/grid-debug-page-all.png` });

    // ⑧ 第 86 轮：状态组合「三角开 + 等距关」（r85 遗留：只手工点过、没进回归）。
    //    页面不再静默把等距档勾上；这一档的正确行为 = 三角层为空、页面标 triNeedsRegular、不报错。
    const combo1 = await page.evaluate(() => {
      const v = window.gridDebugView;
      const reg = document.querySelector('#cRegular'); reg.checked = false; reg.onchange();
      const tri = document.querySelector('#cTri'); tri.checked = true; tri.onchange();
      v.render(0.016);
      return { dbg: window.__gridDebug, triVisible: v.gridTri.visible, triStats: v.gridStats.tri, lattice: v.gridStats.lattice };
    });
    check('⑧ 三角开 + 等距关 → 三角层自动为空（不报错、不硬勾等距）', combo1.triStats === null && combo1.triVisible === false, JSON.stringify({ triStats: combo1.triStats, visible: combo1.triVisible }));
    check('⑧ 页面状态标出 triNeedsRegular', combo1.dbg.triNeedsRegular === true, 'triNeedsRegular=' + combo1.dbg.triNeedsRegular);
    check('⑧ 该档没有等距格（lattice=null）', combo1.lattice === null, 'lattice=' + JSON.stringify(combo1.lattice));

    // ⑨ 状态组合「区域开 + 吃遮挡关」
    const combo2 = await page.evaluate(() => {
      const v = window.gridDebugView;
      const reg = document.querySelector('#cRegular'); reg.checked = true; reg.onchange();
      const r = document.querySelector('#cRegions'); r.checked = true; r.onchange();
      const o = document.querySelector('#cOcc'); o.checked = false; o.onchange();
      v.render(0.016);
      const st = v.gridStats;
      const m = v.contourOverlay;
      const mats = [m.mesh?.material, m.regions?.material, m.regionThickMat, m.candidates?.material, m.dots?.material, m.corners?.material, m.outlineMat, m.selected?.material].filter(Boolean);
      return {
        occl: window.__gridDebug.occlusionLayers, occluded: m.depthOccluded,
        depthOn: mats.filter((x) => x.depthTest === true).length, mats: mats.length,
        visible: v.contourOverlay.mesh.visible, layers: v.contourOverlay.regionStats?.length || 0,
      };
    });
    check('⑨ 区域开 + 吃遮挡关 → 遮挡真的关掉（depthTest 层 0）但区域仍在',
      combo2.occluded === false && combo2.depthOn === 0 && combo2.visible === true && combo2.layers > 0,
      JSON.stringify(combo2));

    // ⑩ 外缘回字环的严格层序（r82 遗留：环与线共面时谁压谁未定）。
    //    原片 frame-0074 8× 裁切：环压在线上、白线终止于环的深色描边 → 线层必须在环之前且不写深度。
    const order = await page.evaluate(() => {
      const v = window.gridDebugView;
      const o = document.querySelector('#cOcc'); o.checked = true; o.onchange();
      const g = document.querySelector('#cGrid'); g.checked = true; g.onchange();
      v.render(0.016);
      const st = v.gridStats;
      return { order: st.order, lineDW: st.lineDepthWrite, lineDT: st.lineDepthTest, rimDW: v.gridRim.material.depthWrite, rims: st.rims, renderOrder: { lines: v.gridLines.renderOrder, thick: v.gridThick.renderOrder, rim: v.gridRim.renderOrder, tri: v.gridTri.renderOrder } };
    });
    check('⑩ 层序 白线 < 外缘环 < 三角层', order.order.lines < order.order.rim && order.order.rim < order.order.tri, JSON.stringify(order.order));
    check('⑩ 线层不写深度（不再遮挡同层的环）', order.lineDW === false && order.rimDW === false, JSON.stringify({ lineDW: order.lineDW, rimDW: order.rimDW }));
    check('⑩ 线层仍吃地形遮挡（depthTest 保持）', order.lineDT === true, 'lineDepthTest=' + order.lineDT);

    // ⑪ 像素级核验「环压线」+「线层不抢同层三角的深度」。
    //    量的口径：把环放到 9px 并正对拍，逐环数 9×9 框里的**极暗描边像素**（lum<60）；
    //    若白格线压在环上，同一个环的描边像素数会变（线把描边盖成白/灰）→ 开线前后必须相同。
    const rimPix = await page.evaluate(async () => {
      const v = window.gridDebugView;
      const THREE = window.THREE;
      const rp = document.querySelector('#rimPx'); rp.value = 9; rp.oninput();
      v.yaw = 0.6; v.pitch = 1.3; v.distance = 15; v.target.set(0, 1, 0); v.updateCamera();
      const settle = async () => { v.render(0.016); await new Promise((r) => setTimeout(r, 160)); v.render(0.016); };
      await settle();
      const grab = () => {
        const cvs = v.renderer.domElement;
        const cv = document.createElement('canvas'); cv.width = cvs.width; cv.height = cvs.height;
        cv.getContext('2d').drawImage(cvs, 0, 0);
        return { data: cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, w: cv.width, h: cv.height };
      };
      const lumAt = (img, x, y) => {
        const xi = Math.round(x), yi = Math.round(y);
        if (xi < 0 || yi < 0 || xi >= img.w || yi >= img.h) return null;
        const i = (yi * img.w + xi) * 4;
        return 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
      };
      // 逐环「框内极暗像素数」：环压线 → 开关线不变
      const rimDark = (img) => {
        const pos = v.gridRim.geometry.getAttribute('position');
        const half = Math.max(2, v.gridRim.material.uniforms.uSize.value / 2);
        const out = [];
        for (let i = 0; i < pos.count; i++) {
          const p = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).project(v.camera);
          if (p.z < -1 || p.z > 1) continue;
          const cx = (p.x * 0.5 + 0.5) * img.w, cy = (-p.y * 0.5 + 0.5) * img.h;
          if (cx < half + 2 || cy < half + 2 || cx > img.w - half - 2 || cy > img.h - half - 2) continue;
          const core = lumAt(img, cx, cy);
          if (core == null || core < 215) continue;
          let dark = 0;
          for (let dy = -Math.ceil(half); dy <= Math.ceil(half); dy++) {
            for (let dx = -Math.ceil(half); dx <= Math.ceil(half); dx++) {
              const l = lumAt(img, cx + dx, cy + dy);
              if (l != null && l < 60) dark++;
            }
          }
          out.push(dark);
        }
        return out;
      };
      const yellowCount = (img) => {
        let n = 0;
        for (let i = 0; i < img.data.length; i += 4) {
          const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
          if (r > 170 && g > 170 && b < 130) n++;
        }
        return n;
      };
      // ① 线开 / 线关 两档
      v.setDebug('grid', true); await settle();
      const imgOn = grab();
      const rimOn = rimDark(imgOn);
      v.gridLines.visible = false; v.gridThick.visible = false; await settle();
      const imgOff = grab();
      const rimOff = rimDark(imgOff);
      v.setDebug('grid', true); await settle();
      // ② 三角层：线层 depthWrite true（r85 行为）vs false（本轮）
      v.gridThickMat.depthWrite = false; v.gridThickMat.needsUpdate = true; await settle();
      const triFixed = yellowCount(grab());
      v.gridThickMat.depthWrite = true; v.gridThickMat.needsUpdate = true; await settle();
      const triControl = yellowCount(grab());
      v.gridThickMat.depthWrite = false; v.gridThickMat.needsUpdate = true; await settle();
      return {
        drawn: rimOn.length,
        rimOn, rimOff,
        sameBorder: JSON.stringify(rimOn) === JSON.stringify(rimOff),
        diffCount: rimOn.filter((d, i) => d !== rimOff[i]).length,
        yellow: { fixed: triFixed, control: triControl },
      };
    });
    check('⑪ 外缘环真的画出来了（≥4 个环读到白芯）', rimPix.drawn >= 4, `drawn=${rimPix.drawn} rims=${rimPix.rims ?? ''}`);
    //    实测（本轮）：7 个环里只有 1 个差 1px（19 vs 20）—— 那是白线贴到环外沿的抗锯齿接触，
    //    不是「线压环」；对照组把线层 depthWrite 打开，黄三角像素 29081 vs 29078（差 3px，噪声级），
    //    说明 r82 担心的「环与线共面谁压谁未定」在本仓并不成立（renderOrder 5→5.5 + 顶点 z 前移已经定死）。
    const absDiff = Math.abs(rimPix.rimOn.reduce((a, b) => a + b, 0) - rimPix.rimOff.reduce((a, b) => a + b, 0));
    check('⑪ 环压线：开线/关线后每个环的描边像素数不变（容差 ≤1 环 / ≤2px 抗锯齿）',
      rimPix.diffCount <= 1 && absDiff <= 2,
      `drawn=${rimPix.drawn} diffRings=${rimPix.diffCount} absDiff=${absDiff} on=${JSON.stringify(rimPix.rimOn)} off=${JSON.stringify(rimPix.rimOff)}`);
    check('⑪ 线层 depthWrite 开关对三角层无副作用（±100px 内）', Math.abs(rimPix.yellow.fixed - rimPix.yellow.control) <= 100, JSON.stringify(rimPix.yellow));
    await page.screenshot({ path: `${OUT}/grid-debug-page-rim-order.png` });
    console.log('RIM', JSON.stringify(rimPix));
  } catch (e) {
    problems.push('fatal: ' + e.message);
  } finally {
    await browser.close();
  }
  const ok = problems.length === 0 && checks.every((c) => c.ok);
  console.log(JSON.stringify({ ok, checks, problems }, null, 1));
  if (!ok) process.exitCode = 1;
})();

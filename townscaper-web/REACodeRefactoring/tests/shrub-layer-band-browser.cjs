// 第 100 轮 · 灌木叠层接 `vBand` 的浏览器验收（真 GPU、真着色器、活几何）。
//
// 逻辑测试 tests/shrub-layer-band.mjs 只证源码结构同式；这里证**接了之后画面真的跟着 aBand 变**：
//   ① 用 createLayer('shrubtex', …) 起能力库那条叠层，世界网格有 aBand、无 shader 编译/链接报错；
//   ② 宿主灌木关掉（shrubOn=0）—— 屏幕上只剩叠层自己画的灌木，改动 aBand 的像素差只可能来自叠层；
//   ③ aBand 全 1 vs 原始（0.70–1.36）两档像素差 > 0.3% 画幅（叠层真的读了 vBand，不是摆设）；
//   ④ 对照组：叠层 dispose 掉之后，同样的 aBand 改动**零像素差**（证明 ③ 的差不是宿主/噪声带来的）；
//   ⑤ 噪声底：连拍两帧同参数，像素差 < 0.05%（防止把抖动当成效果）；
//   ⑥ 截图两张（band 原始 / band 全 1）供 ViewImage 人工复核带宽。
const { chromium } = require('playwright');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = 'artifacts/coverage';

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const problems = [];
  const rows = [];
  const ok = (c, m) => rows.push({ ok: !!c, m });
  const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text().slice(0, 300)); });
  const report = {};
  try {
    await page.goto('http://127.0.0.1:8769/index.html?scene=terrain', { waitUntil: 'load' });
    await page.waitForFunction(() => window.rea?.view?.renderer?.info?.render?.calls > 0, null, { polling: 200, timeout: 90000 });
    await page.waitForFunction(() => (window.rea?.view?.worldMesh?.geometry?.attributes?.aBand?.count || 0) > 45000, null, { polling: 200, timeout: 90000 });
    await page.waitForTimeout(300);
    ok(!problems.some((p) => /shader|program|compile|link/i.test(p)), `加载期无着色器报错（${problems.length} 条页面报错）`);

    // ---- 起叠层：宿主灌木关掉，只留能力库这条 ----
    report.mount = await page.evaluate(async () => {
      const { view, world } = window.rea;
      const mod = await import('/src/capabilities/layers.js');
      window.__layer = mod.createLayer('shrubtex', { scene: view.scene, world, levelHeight: view.levelHeight });
      window.__layer.refresh();
      view.shrubOn.value = 0;                       // 宿主那条关掉
      // 机位：挑落差最大的格子，贴过去看带宽
      const L = view.levelHeight || 1;
      let best = null;
      for (const c of world.cells) {
        const g = world.top(c);
        if (!g || !(c.pts?.length >= 3)) continue;
        let drop = 0;
        for (let i = 0; i < c.pts.length; i++) { const o = world.neighbor(c, i); if (o) drop = Math.max(drop, g - world.top(o)); }
        const cx = c.cx ?? c.pts.reduce((s, p) => s + p[0], 0) / c.pts.length;
        const cz = c.cz ?? c.pts.reduce((s, p) => s + p[2], 0) / c.pts.length;
        if (drop >= 2 && (!best || drop > best.drop)) best = { x: cx, z: cz, y: g * L, drop };
      }
      view.target.set(best.x, best.y, best.z); view.yaw = Math.PI * 0.3; view.pitch = 0.36; view.distance = 7; view.updateCamera(); view.render(0.016);
      const mesh = [...view.scene.children].find((o) => o.name === 'shrub-texture-layer');
      return {
        glued: !!mesh && mesh.geometry === view.worldMesh.geometry,
        count: window.__layer.count,
        drop: best.drop,
        hasBand: !!view.worldMesh.geometry?.attributes?.aBand,
        bandCount: view.worldMesh.geometry?.attributes?.aBand?.count || 0,
        visible: !!mesh?.visible,
      };
    });
    ok(report.mount.glued, `叠层与世界网格共用同一份几何（count=${report.mount.count} 条边）`);
    ok(report.mount.count > 0, `叠层数到 ${report.mount.count} 条灌木边（>0，找到宿主网格了）`);
    ok(report.mount.hasBand && report.mount.bandCount > 45000, `活网格 aBand ${report.mount.bandCount} 顶点（>45000）`);
    ok(report.mount.visible, '叠层 mesh 可见');

    // ---- 像素比对工具（页内画布） ----
    // 顺手把渲染循环冻住：app.js 的 rAF 每帧传真实 dt（水/烟/鸟一直在动），不冻的话噪声底 0.12% 画幅，
    // 会把「叠层到底有没有读 vBand」淹掉。__draw 用固定 dt 手动出帧 → 同参数两帧应当逐位相同。
    await page.addScriptTag({ content: `
      window.__freeze = () => {
        const v = window.rea.view;
        if (v.__frozen) return true;
        v.__origRender = v.render.bind(v);
        v.render = () => {};                       // 循环里的调用变空操作
        v.__frozen = true;
        return true;
      };
      window.__draw = (dt) => window.rea.view.__origRender(dt || 1 / 60);
      window.__grab = () => window.rea.view.renderer.domElement.toDataURL('image/png');
      window.__cmp = async (a, b) => {
        const load = (u) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = u; });
        const A = await load(a), B = await load(b);
        const cv = document.createElement('canvas'); cv.width = A.width; cv.height = A.height;
        const cx = cv.getContext('2d');
        cx.drawImage(A, 0, 0); const da = cx.getImageData(0, 0, cv.width, cv.height).data;
        cx.clearRect(0, 0, cv.width, cv.height); cx.drawImage(B, 0, 0); const db = cx.getImageData(0, 0, cv.width, cv.height).data;
        let n = 0;
        for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i]-db[i]) + Math.abs(da[i+1]-db[i+1]) + Math.abs(da[i+2]-db[i+2]) > 12) n++;
        return { changed: n, share: +(n / (da.length / 4)).toFixed(5) };
      };
      window.__setBand = (v) => {
        const g = window.rea.view.worldMesh.geometry;
        const a = g.getAttribute('aBand'); if (!a) return 0;
        if (v === null) return a.array.length;
        for (let i = 0; i < a.array.length; i++) a.array[i] = v;
        a.needsUpdate = true;
        return a.array.length;
      };
    ` });
    report.frozen = await page.evaluate(() => window.__freeze());
    ok(report.frozen === true, '渲染循环已冻结（手动固定 dt 出帧）');

    // ---- ⑤ 噪声底（只测量，用来给后面的差立标尺：独立 rAF 的道具动画还在跑，冻不干净） ----
    report.noise = await page.evaluate(async () => {
      window.__draw(); const a = window.__grab();
      window.__draw(); const b = window.__grab();
      return window.__cmp(a, b);
    });

    // ---- ③ band 原始 vs 全 1（叠层开着） ----
    report.keep = await page.evaluate(() => {
      const g = window.rea.view.worldMesh.geometry;
      return [...g.getAttribute('aBand').array];
    });
    await page.screenshot({ path: `${OUT}/shrub-layer-band-on.png`, clip: { x: 150, y: 120, width: 800, height: 520 } });
    report.diff = await page.evaluate(async () => {
      window.__draw(); const a = window.__grab();
      window.__setBand(1.0); window.__draw(); const b = window.__grab();
      return window.__cmp(a, b);
    });
    await page.screenshot({ path: `${OUT}/shrub-layer-band-flat.png`, clip: { x: 150, y: 120, width: 800, height: 520 } });
    ok((report.diff.share ?? 0) > 0.003, `叠层像素随 aBand 变化 ${(100 * (report.diff.share ?? 0)).toFixed(2)}% 画幅（>0.3%，vBand 真接了）`);
    ok((report.diff.changed ?? 0) > 4 * Math.max(1, report.noise.changed ?? 0), `band 差 ${report.diff.changed}px 是噪声底 ${report.noise.changed}px 的 ${((report.diff.changed || 0) / Math.max(1, report.noise.changed || 0)).toFixed(1)}×（>4×）`);
    ok((report.noise.changed ?? 1) < 0.3 * (report.diff.changed ?? 0), `噪声底 ${report.noise.changed}px（${(100 * (report.noise.share ?? 0)).toFixed(2)}%）= 道具层独立 rAF 的灯/旗在动，< 0.3× 信号`);

    // ---- ④ 对照组：叠层 dispose 后同样改动 → 回到噪声底 ----
    report.control = await page.evaluate(async () => {
      window.__layer.dispose();
      window.__draw();
      const a = window.__grab();
      window.__setBand(0.70); window.__draw();
      const b = window.__grab();
      return window.__cmp(a, b);
    });
    ok((report.control.changed ?? 1) <= 2 * Math.max(1, report.noise.changed ?? 0), `对照（无叠层）同改动差异 ${report.control.changed}px ≤ 2× 噪声底 ${report.noise.changed}px（差异只来自叠层）`);

    // 还原几何，别把现场留给下一轮
    await page.evaluate((keep) => {
      const g = window.rea.view.worldMesh.geometry;
      g.getAttribute('aBand').array.set(keep);
      g.getAttribute('aBand').needsUpdate = true;
      window.rea.view.shrubOn.value = 1;
      window.__draw();
    }, report.keep);

    ok(!problems.some((p) => /shader|program|compile|link/i.test(p)), `全程无着色器报错（${problems.length} 条页面报错）`);
  } catch (e) {
    problems.push('fatal: ' + e.message);
  } finally {
    await browser.close();
  }
  const bad = rows.filter((r) => !r.ok);
  console.log(rows.map((r) => `  ${r.ok ? '✓' : '✗'} ${r.m}`).join('\n'));
  if (problems.length) console.log('\n页面报错：\n' + problems.map((p) => '  ! ' + p).join('\n'));
  console.log('\n' + JSON.stringify(report, null, 1));
  console.log(bad.length || problems.length ? `\nFAIL ${bad.length}/${rows.length}` : `\nALL PASS ${rows.length}/${rows.length}`);
  if (bad.length || problems.length) process.exitCode = 1;
})();

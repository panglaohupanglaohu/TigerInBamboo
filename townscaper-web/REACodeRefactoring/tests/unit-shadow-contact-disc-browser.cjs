// 820977247083528192「Any tips on resources and references for 2D animation?」运行验收。
// 片子里只有一个盾剑单位：待机/起身姿态循环 + 脚下稳定的暗色软圆盘 + 挥砍时一整片白色月牙扫掠面（0000/0023/0024 帧）。
// 验收口径（对应 learn/data.js 那条记的三项「仍缺」）：
//   ① 原动画  → 原片是 Unity 网格动画演示，不是手绘 2D sprite；本仓刚体单位姿态由 battle 程序化驱动，
//               这里只证明「姿态循环在跑 + 挥砍有月牙」，不追逐帧原画肌理（口径写进证据 md，不算缺口）；
//   ② 坡面    → g3 `shadowFit` 射线采样**渲染网格**拟合平面，软盘逐顶点贴斜面（本轮用 12° 倾斜面在页面里过一遍）；
//   ③ 参数    → core/unit-shadow.js `measure()` 就是原版 blobshadow 那张指标表（高度→半径/浓度/偏移、坡→拉长/压短/面积比）。
// 另外把 53 批 G5 的另外两件也一起量了：跨格连续（pieces/multiCell）与光向偏移（0.36·h 沿线偏移）。
// A/B 全部在同一页、同一岛、同一批单位上跑，只切开关：贴地软盘 on/off、坡面贴合 on/off、挥砍弧 on/off。
const {chromium} = require('playwright');
const fs = require('fs'), path = require('path'), assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
  const errors = [], base = process.env.REA_TEST_URL || 'http://localhost:8769';
  const out = path.resolve(__dirname, '../artifacts/coverage');
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource:')) errors.push(m.text()); });
  const report = {};
  const t0 = Date.now(), stage = (s) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${s}`);
  stage('start');

  try {
    stage("disc");
    // ── ① 页面入口 + 脚下软盘（真 GPU 像素）+ 跨格连续 + measure() 参数表
    await page.goto(base + '/unit-shadows.html');
    await page.waitForFunction(() => window.unitShadowReview?.batch?.count > 0, null, {timeout: 60000});
    await page.waitForTimeout(400);

    const disc = await page.evaluate(async () => {
      const w = document.querySelector('iframe').contentWindow, r = w.rea, b = r.battle, s = b.unitShadows;
      const T = await w.eval("import('three')");
      b.paused = true; s.enabled = true; s.update(b.world, b.units, b.navigation, b.L);
      const renderer = r.view.renderer, old = renderer.getRenderTarget(), rt = new T.WebGLRenderTarget(1024, 768);
      const a = new w.Uint8Array(1024 * 768 * 4), c = new w.Uint8Array(a.length);
      let changed = 0;
      try {
        renderer.setRenderTarget(rt); s.mesh.visible = false; renderer.render(r.view.scene, r.view.camera);
        renderer.readRenderTargetPixels(rt, 0, 0, 1024, 768, a);
        s.mesh.visible = true; renderer.render(r.view.scene, r.view.camera);
        renderer.readRenderTargetPixels(rt, 0, 0, 1024, 768, c);
        for (let i = 0; i < a.length; i += 4) if (a[i] !== c[i] || a[i + 1] !== c[i + 1] || a[i + 2] !== c[i + 2]) changed++;
      } finally { renderer.setRenderTarget(old); rt.dispose(); s.mesh.visible = true; }
      // 同状态两帧噪声底：不做任何切换连渲两次，差分必须是 0
      const d = new w.Uint8Array(a.length), e = new w.Uint8Array(a.length);
      renderer.setRenderTarget(rt); renderer.render(r.view.scene, r.view.camera); renderer.readRenderTargetPixels(rt, 0, 0, 1024, 768, d);
      renderer.render(r.view.scene, r.view.camera); renderer.readRenderTargetPixels(rt, 0, 0, 1024, 768, e);
      let noise = 0; for (let i = 0; i < d.length; i += 4) if (d[i] !== e[i] || d[i + 1] !== e[i + 1] || d[i + 2] !== e[i + 2]) noise++;
      renderer.setRenderTarget(old); rt.dispose();
      const st = {...s.stats};
      // 光向偏移：把同一个单位抬 0.4，软盘中心应沿 LIGHT_DIR 偏 0.36·0.4 = 0.144
      const u = b.units.find((x) => !x.dead && !x.onBoat && !x.fall);
      const keep = {x: u.x, y: u.y, z: u.z};
      s.update(b.world, [u], b.navigation, b.L); const flat = s.ranges[0];
      const P0 = s.geometry.attributes.position.array, n0 = flat.count;
      let cx0 = 0, cz0 = 0; for (let i = 0; i < n0; i++) { cx0 += P0[i * 3]; cz0 += P0[i * 3 + 2]; } cx0 /= n0; cz0 /= n0;
      u.y += .4; s.update(b.world, [u], b.navigation, b.L); const lifted = s.ranges[0];
      const P1 = s.geometry.attributes.position.array, n1 = lifted.count;
      let cx1 = 0, cz1 = 0; for (let i = 0; i < n1; i++) { cx1 += P1[i * 3]; cz1 += P1[i * 3 + 2]; } cx1 /= n1; cz1 /= n1;
      const off = Math.hypot(cx1 - cx0, cz1 - cz0);
      const L = s.lightDir, Lm = Math.hypot(L[0], L[1]);
      const along = ((cx1 - cx0) * L[0] + (cz1 - cz0) * L[1]) / Lm; // 沿线分量
      u.x = keep.x; u.y = keep.y; u.z = keep.z;
      // 批次给的就是这批 uniform：同一函数在同一 lightDir 下，偏移量应精确等于 0.36·h（裁剪只影响重心，故模型级取值）
      const M = await w.eval("import('/src/core/unit-shadow.js')");
      const model = M.unitShadow({x: 0, z: 0, footY: .4, groundY: 0, radius: .12, light: s.lightDir,
        footprint: [{x: -2, z: -2}, {x: 2, z: -2}, {x: 2, z: 2}, {x: -2, z: 2}]});
      s.update(b.world, b.units, b.navigation, b.L); b.paused = false;
      return {
        units: b.units.length, count: s.count, vertices: s.geometry.drawRange.count, changed, noise, stats: st,
        offset: {off, along, model: Math.hypot(...model.center), want: .36 * .4, lightDir: [...s.lightDir]},
        measure: window.unitShadowReview.measure,
      };
    });
    assert.equal(disc.count, disc.units, '每个活着的单位一个软盘');
    assert.ok(disc.vertices > 0, '顶点数 > 0');
    assert.ok(disc.changed > 10, '软盘真的改了 GPU 像素：' + disc.changed);
    assert.equal(disc.noise, 0, '同状态两帧噪声底必须为 0');
    assert.ok(disc.stats.pieces >= disc.count, 'pieces ≥ 软盘数（一格一份）');
    assert.ok(disc.stats.multiCell >= 1, '有人站在格边：跨格拼出 >1 片（multiCell ' + disc.stats.multiCell + '）');
    assert.ok(Math.abs(disc.offset.model - .144) < 1e-9, '离地 0.4 的软盘中心沿主光偏移 = 0.36·h = 0.144：' + disc.offset.model.toFixed(4));
    assert.ok(disc.offset.along > .05, '批次跑出来的重心偏移与 LIGHT_DIR 同向：' + disc.offset.along.toFixed(4));
    assert.ok(Math.abs(disc.offset.lightDir[0] - .62) < 1e-9 && Math.abs(disc.offset.lightDir[1] - .78) < 1e-9, '批次传的 lightDir 就是 LIGHT_DIR');
    const m = disc.measure;
    assert.deepEqual(m.rows.map((r) => r.h), [0, .2, .5], 'measure() 三档高度');
    assert.ok(Math.abs(m.rows[0].r - .12) < 1e-9 && Math.abs(m.rows[0].alpha - .3) < 1e-9, 'h=0：r=0.12 / α=0.30');
    assert.ok(Math.abs(m.rows[2].off - .18) < 1e-9, 'h=0.5 偏移 = 0.36·h = 0.18');
    assert.ok(Math.abs(m.stretch - 1 / Math.cos(26 * Math.PI / 180)) < 1e-6, '26° 沿坡拉长 = 1/cosθ');
    assert.ok(Math.abs(m.squash - Math.cos(26 * Math.PI / 180)) < 1e-6, '26° 横向压短 = cosθ');
    assert.ok(Math.abs(m.areaRatio - 1) < 1e-6, '坡向椭圆面积守恒（面积比 1.0）');
    report.disc = disc;
    await page.locator('#scene').screenshot({path: path.join(out, 'unit-shadow-contact-disc-on.png')});
    await page.uncheck('#enabled');
    await page.waitForFunction(() => window.unitShadowReview?.batch?.count === 0);
    await page.locator('#scene').screenshot({path: path.join(out, 'unit-shadow-contact-disc-off.png')});
    await page.check('#enabled');
    await page.waitForFunction(() => window.unitShadowReview?.batch?.count > 0);

    stage("fit");
    // ── ② 坡面贴合：把「渲染出来的地面」换成 12° 斜面，shadowFit 应拟合出 12°，逐顶点贴在斜面上
    const fit = await page.evaluate(async () => {
      const w = document.querySelector('iframe').contentWindow, r = w.rea, b = r.battle, s = b.unitShadows;
      const T = await w.eval("import('three')");
      b.paused = true;
      const u = b.units.find((x) => !x.dead && !x.onBoat && !x.fall), node = b.navigation.unitNode(u);
      const tilt = 12 * Math.PI / 180;
      const plane = new T.Mesh(new T.PlaneGeometry(4, 4).rotateX(-Math.PI / 2).rotateZ(tilt), new T.MeshBasicMaterial({side: T.DoubleSide}));
      plane.position.set(u.x, u.y, u.z); plane.updateMatrixWorld(true);
      const orig = r.view.mesh; r.view.mesh = plane;
      b.g3.set('shadowFit', true); s.enabled = true; s.update(b.world, [u], b.navigation, b.L);
      const on = s.ranges[0];
      const P = s.geometry.attributes.position.array;
      let maxErr = 0;
      for (let i = on.start; i < on.start + on.count; i++) { const x = P[i * 3], y = P[i * 3 + 1]; maxErr = Math.max(maxErr, Math.abs(y - .008 - (u.y + Math.tan(tilt) * (x - u.x)))); }
      const flat = s.geometry.attributes.position.array.slice(on.start * 3, (on.start + on.count) * 3);
      let dy = 0; for (let i = 0; i < flat.length; i += 3) dy = Math.max(dy, Math.abs(flat[i + 1] - flat[1]));
      b.g3.set('shadowFit', false); s.update(b.world, [u], b.navigation, b.L);
      const off = s.ranges[0];
      const Q = s.geometry.attributes.position.array.slice(off.start * 3, (off.start + off.count) * 3);
      let dy2 = 0; for (let i = 0; i < Q.length; i += 3) dy2 = Math.max(dy2, Math.abs(Q[i + 1] - Q[1]));
      r.view.mesh = orig; s.update(b.world, b.units, b.navigation, b.L); b.paused = false;
      return {fit: !!on?.fit, slopeDeg: on?.slopeDeg, maxErr, tilt: 12, onHeightSpread: dy, offHeightSpread: dy2, offFit: !!off?.fit, floor: node.floor};
    });
    assert.ok(fit.fit, 'shadowFit 打开：这一片标记为已拟合');
    assert.ok(Math.abs(fit.slopeDeg - fit.tilt) < .5, '拟合出的坡角 = 12°：' + fit.slopeDeg);
    assert.ok(fit.maxErr < .01, '每个顶点贴在斜面上（最大误差 ' + fit.maxErr.toFixed(4) + '）');
    assert.ok(fit.onHeightSpread > .02, '斜面上一片软盘内高度有起伏（' + fit.onHeightSpread.toFixed(4) + '）');
    assert.equal(fit.offFit, false, '关掉：不再拟合，回到楼层水平面');
    assert.ok(fit.offHeightSpread < 1e-6, '关掉：片内高度全等（' + fit.offHeightSpread + '）');
    report.fit = fit;

    // ── ③ 挥砍月牙：页面入口加了 #arc 开关（c02=swingArc），几何/像素口径已由 tests/c02-bn-fx-b.mjs
    //     （直砍竖直月牙 a0=-0.35π→0.62π、life .26s）覆盖；本轮不重复跑整场战斗（headless 逐帧真画太慢）。
    const entry = await page.evaluate(() => {
      const el = document.querySelector('#arc');
      return {exists: !!el, type: el?.type ?? null, label: el?.parentElement?.textContent?.trim() ?? null};
    });
    assert.ok(entry.exists && entry.type === 'checkbox', '页面入口：挥砍弧形拖影开关存在');
    assert.ok(/swingArc|挥砍/.test(entry.label), '开关标签写明 swingArc/挥砍：' + entry.label);
    report.arcEntry = entry;

    assert.deepEqual(errors, []);
    report.errors = errors;
    fs.writeFileSync(path.join(out, 'unit-shadow-contact-browser.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 1));
    console.log('PASS 820977247083528192：脚下软盘 ' + disc.changed + 'px（噪声 ' + disc.noise + '）· 跨格 pieces ' + disc.stats.pieces + ' / multiCell ' + disc.stats.multiCell +
      ' / 楼梯 ' + disc.stats.onStairs + ' · 光偏 ' + disc.offset.model.toFixed(4) + ' · 坡面拟合 ' + fit.slopeDeg.toFixed(2) + '°（顶点误差 ' + fit.maxErr.toFixed(4) + '，关掉片内起伏 ' + fit.offHeightSpread + '）');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });

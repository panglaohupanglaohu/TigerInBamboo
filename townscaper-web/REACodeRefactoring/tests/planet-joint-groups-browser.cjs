// 1769641473895432220（"all module-containing cells should have their desired shape and size"，479 帧）运行验收：
// 原片可观察行为：球面上的一批方格被当成「一个模块」整体约束 —— 墙是径向的、格子的形状与海平面一致、不鼓成蘑菇。
// 本测试在 planet.html 上真的声明一个 3 格模块组（?groups=3），跑 solver=joint，逐层量组内边长误差，
// 并和 spring / shape 两档对拍；同时核 relaxConflictReport 的墙倾斜与翻折。
const { chromium } = require('playwright');
const fs = require('fs');
const assert = require('node:assert/strict');

const URL = 'http://127.0.0.1:8769/planet.html?solver=joint&groups=3';

(async () => {
  const b = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const errors = [];
  try {
    const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
    p.on('pageerror', (e) => errors.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico')) errors.push(m.text()); });
    await p.goto(URL);
    await p.waitForFunction(() => window.planetDemo && window.planetDemo.groupReport, null, { timeout: 90000 });

    // ---------- ① 声明组：3 格、连通、全在陆地且同高 ----------
    const grp = await p.evaluate(() => {
      const d = window.planetDemo, P = window.planetLighting.planet, g = d.groups[0];
      const connected = (() => { const s = new Set([g[0]]), q = [g[0]]; while (q.length) for (const nb of P.cells[q.pop()].nb) if (nb >= 0 && g.includes(nb) && !s.has(nb)) { s.add(nb); q.push(nb); } return s.size === g.length; })();
      return { g, H: g.map((id) => P.H[id]), connected, cells: P.cells.length, maxH: Math.max(...P.H) };
    });
    assert.equal(grp.g.length, 3, '?groups=3 应声明 3 格模块组');
    assert.ok(grp.connected, '声明的模块组必须连通（不连通只能被切成多片，名不副实）');
    assert.ok(grp.H.every((h) => h === grp.H[0] && h > 0), '组内格应同高且在陆地 ' + JSON.stringify(grp.H));

    // ---------- ② joint 逐层量：层数完整、均值优于 spring ----------
    const cmp = await p.evaluate(async () => {
      const P = await import('/src/sphere/planet.js');
      const G = await import('/src/sphere/module-group-fit.js');
      const planet = window.planetLighting.planet, group = window.planetDemo.groups[0];
      const top = Math.min(...group.map((id) => planet.H[id]));
      const run = (s, edgeTol = Infinity) => {
        const at = P.cornerPositions(planet, { relax: true, solver: s, moduleGroups: s === 'joint' ? [group] : null, edgeTol });
        const per = [];
        for (let l = 1; l <= top; l++) per.push(G.moduleGroupReport(planet, group, at, l));
        return { mean: +(per.reduce((a, x) => a + x.mean, 0) / per.length).toFixed(4), worst: +Math.max(...per.map((x) => x.worst)).toFixed(4), levels: per.map((x) => ({ l: x.level, mean: +x.mean.toFixed(3), worst: +x.worst.toFixed(3), edges: x.edges.length })) };
      };
      const spring = run('spring'), shape = run('shape'), joint = run('joint'), jointTol = run('joint', 0.2);
      return { top, spring, shape, joint, jointTol, page: window.planetDemo.groupReport };
    });
    assert.equal(cmp.top, 6, '这组格的层数应为 6');
    assert.equal(cmp.joint.levels.length, 6, 'joint 应逐层给出 1..6 的组内误差');
    assert.ok(cmp.joint.levels.every((x) => x.edges === 14), '组内边数应恒为 14（3 格共享边）');
    assert.ok(cmp.joint.mean < cmp.spring.mean * 0.8, 'joint 的组内平均边长误差应明显小于 spring ' + JSON.stringify({ joint: cmp.joint.mean, spring: cmp.spring.mean }));
    assert.ok(Math.abs(cmp.page.worst - cmp.joint.worst) < 1e-3, '页面里报的组内误差与现算不一致 ' + JSON.stringify({ page: cmp.page.worst, fresh: cmp.joint.worst }));

    // ---------- ③ 墙体：倾斜不超 30°、无翻折 ----------
    const conf = await p.evaluate(() => { const c = window.planetDemo.conflict; return { lean: +c.leanMaxDeg.toFixed(2), folded: c.folded, shapeErr: +c.shapeErrMean.toFixed(4), sizeErr: +c.sizeErrMean.toFixed(4) }; });
    assert.ok(conf.lean <= 30, '墙倾斜超过 maxLean ' + conf.lean);
    assert.equal(conf.folded, 0, '出现翻折面 ' + conf.folded);

    // ---------- ④ 真实像素：球面城镇可见 ----------
    const px = await p.evaluate(async () => {
      const L = window.planetLighting, THREE = await import('three');
      const rt = new THREE.WebGLRenderTarget(480, 480, { depthBuffer: true }), r = L.renderer;
      const old = r.getRenderTarget(); r.setRenderTarget(rt); r.render(L.scene, L.camera);
      const buf = new Uint8Array(480 * 480 * 4); r.readRenderTargetPixels(rt, 0, 0, 480, 480, buf);
      r.setRenderTarget(old);
      let green = 0, blue = 0, total = 0, sig = [];
      for (let i = 0; i < buf.length; i += 4) {
        const R = buf[i], G = buf[i + 1], B = buf[i + 2];
        if (R || G || B) total++;
        if (G > R + 12 && G > B + 8) green++;
        if (B > R + 18 && B > G - 10) blue++;
        if (i % 131 === 0) sig.push(R + ',' + G + ',' + B);
      }
      rt.dispose();
      return { green, blue, total, sig };
    });
    assert.ok(px.total > 60000, '球体没画出来（非黑像素太少）' + px.total);
    assert.ok(px.green > 12000, '球面陆地（绿）太少 ' + px.green);

    await p.screenshot({ path: 'artifacts/coverage/planet-joint-groups.png' });
    // 截图后复位到对比档：?groups=0 的 spring（旧档）留一张对照
    await p.goto('http://127.0.0.1:8769/planet.html?solver=spring&groups=0');
    await p.waitForFunction(() => window.planetDemo && window.planetDemo.groupReport !== undefined, null, { timeout: 90000 });
    await p.waitForTimeout(300);
    await p.screenshot({ path: 'artifacts/coverage/planet-spring-baseline.png' });

    assert.deepEqual(errors, []);
    fs.writeFileSync('artifacts/coverage/planet-joint-groups.json', JSON.stringify({ grp, cmp, conf, px: { green: px.green, blue: px.blue, total: px.total }, errors }, null, 2));
    console.log('PASS planet joint 模块组：组', grp.g, 'H', grp.H, '· joint 均', cmp.joint.mean, 'vs spring', cmp.spring.mean, '· 最差边', cmp.joint.worst, '· lean', conf.lean, '°· 折面', conf.folded, '· 绿像素', px.green);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });

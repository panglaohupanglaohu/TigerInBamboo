// 1238474550511308800（"Turns out my monitor was too saturated..."，202 帧）运行验收：
// 片内可观察行为：封闭院墙内整片草地一次铺上（0026→0029 两帧到位），小径随后叠在草上；
// 墙有地面开口时院内一格草都不长。本测试在 garden.html 的真实游戏 World 里搭封闭/矮墙/开口三种院墙，
// 用 classifyCourtyards + planCourtyardGrass 现算草地块，并对真实渲染取像素。
const { chromium } = require('playwright');
const fs = require('fs');
const assert = require('node:assert/strict');

const URL = 'http://127.0.0.1:8769/garden.html';

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
    await p.waitForFunction(() => window.gardenReview && window.gardenReview.api, null, { timeout: 90000 });
    const scene = p.frames().find((f) => f.url().includes('index.html'));
    assert.ok(scene, '游戏 iframe 没起来');

    // 三种院墙各建一次，量草地块
    const plan = async (boundary) => {
      await p.selectOption('#boundary', boundary);
      await p.waitForTimeout(120);
      return scene.evaluate(async () => {
        const C = await import('/src/core/courtyards.js');
        const G = await import('/src/build/courtyard-grass.js');
        const rea = window.rea, world = rea.world;
        const courtyard = C.classifyCourtyards(world);
        const garden = rea.view.worldMesh.garden;
        const path = new Uint8Array(world.cells.length);
        for (const id of garden.paths) if (world.cells[id]) path[id] = 1;
        const g = G.planCourtyardGrass(world, courtyard, { path });
        // 封闭组件内每格都必须长草；小径格底色仍是草
        let miss = 0, pathOnGrass = 0, pathTotal = 0;
        for (const comp of courtyard.components) for (const c of comp) if (!g.grass[c.id]) miss++;
        for (const id of garden.paths) if (world.cells[id]) { pathTotal++; if (g.grass[id]) pathOnGrass++; }
        return {
          yards: garden.yards.size, paths: garden.paths.size,
          components: courtyard.components.length, openComponents: (courtyard.openComponents || []).length,
          lowWallEdges: (courtyard.lowWallEdges || []).length,
          openReasons: (courtyard.openComponents || []).map((o) => [...new Set(o.openings.map((x) => x.reason))]),
          bridgeFlags: (courtyard.openComponents || []).map((o) => o.openings.some((x) => x.bridge)),
          // 矮墙档：把封闭院的内部边全当矮墙 → 分区多子区但不封院，草照长
          lowWallProbe: (() => {
            const c2 = C.classifyCourtyards(world, { lowWalls: () => true });
            const g2 = G.planCourtyardGrass(world, c2, { path });
            return { components: c2.components.length, grass: g2.stats.grassCells, sub: (g2.components || []).map((x) => x.subregionCount), edges: (c2.lowWallEdges || []).length };
          })(),
          stats: g.stats, miss, pathTotal, pathOnGrass,
          perComp: g.components.map((c) => ({ n: c.cells.length, sub: c.subregionCount, grass: c.grassCells, underPath: c.grassUnderPath })),
        };
      });
    };

    const closed = await plan('closed');
    const lowWall = await plan('elevated');
    const open = await plan('open');

    // 封闭院：每格都长草，没有漏格
    assert.ok(closed.components > 0, '封闭院墙下没识别出封闭组件 ' + JSON.stringify(closed));
    assert.equal(closed.miss, 0, '封闭院里有格子没长草 ' + closed.miss);
    assert.equal(closed.stats.grassCells, closed.perComp.reduce((a, c) => a + c.n, 0), '草地格数应等于封闭组件总格数（全格草，不是半个院）');
    assert.equal(closed.stats.openCellsSkipped, 0, '封闭院不该有被跳过的开口格');
    assert.ok(closed.pathTotal > 0 && closed.pathOnGrass === closed.pathTotal, '小径格必须叠在草上（草底），实测 ' + JSON.stringify({ p: closed.pathTotal, g: closed.pathOnGrass }));

    // 开口院：一格草都不长（触发词是 enclosed，一个缺口就漏）
    assert.ok(open.stats.openCellsSkipped > 0, '开口院墙下没记到被跳过的开口格 ' + JSON.stringify(open));
    assert.equal(open.stats.grassCells, 0, '有地面开口的院子仍铺了草 ' + open.stats.grassCells);

    // 上层有桥、墙层镂空：缺口照样算开口（bridge 标记），院不被封 → 一格草都不长
    assert.ok(lowWall.openComponents >= 1, '墙层镂空档应记成带开口组件 ' + JSON.stringify(lowWall));
    assert.ok(lowWall.openReasons.some((r) => r.includes('wall-layer-gap')), '墙层镂空没被标成 wall-layer-gap ' + JSON.stringify(lowWall.openReasons));
    assert.ok(lowWall.bridgeFlags.some(Boolean), '缺口上方有实心却没打 bridge 标记 ' + JSON.stringify(lowWall.bridgeFlags));
    assert.equal(lowWall.stats.grassCells, 0, '上层有桥跨过缺口时仍把院封上铺草 ' + lowWall.stats.grassCells);

    // 矮墙：分区不封院 —— 封闭组件保留、被子区切开，草照长（每格）
    assert.ok(closed.lowWallProbe.components === closed.components, '矮墙不该改变封闭组件数 ' + JSON.stringify(closed.lowWallProbe));
    assert.equal(closed.lowWallProbe.grass, closed.stats.grassCells, '矮墙档草地格数应与无矮墙时相同（矮墙只分区，不影响草）');
    assert.ok(closed.lowWallProbe.sub.some((s) => s > 1), '矮墙档没有把封闭组件切成多个子区 ' + JSON.stringify(closed.lowWallProbe.sub));

    // 真实像素：回到封闭院，取游戏画面里的绿像素
    await p.selectOption('#boundary', 'closed');
    await p.waitForTimeout(300);
    await p.screenshot({ path: 'artifacts/coverage/courtyard-grass-closed.png' });
    const px = await scene.evaluate(async () => {
      const THREE = await import('three'), rea = window.rea, v = rea.view;
      const W = 480, H = 320, rt = new THREE.WebGLRenderTarget(W, H), r = v.renderer;
      const old = r.getRenderTarget(); r.setRenderTarget(rt); r.render(v.scene, v.camera);
      const buf = new Uint8Array(W * H * 4); r.readRenderTargetPixels(rt, 0, 0, W, H, buf);
      r.setRenderTarget(old); rt.dispose();
      let green = 0, total = 0;
      for (let i = 0; i < buf.length; i += 4) { const R = buf[i], G = buf[i + 1], B = buf[i + 2]; if (R || G || B) total++; if (G > R + 10 && G > B + 6) green++; }
      return { green, total, w: W, h: H };
    });
    assert.ok(px.total > 100000, '游戏画面没渲染 ' + JSON.stringify(px));
    assert.ok(px.green > 3000, '院内草地绿像素太少 ' + px.green);

    assert.deepEqual(errors, []);
    fs.writeFileSync('artifacts/coverage/courtyard-grass-browser.json', JSON.stringify({ closed, lowWall, open, px, errors }, null, 2));
    console.log('PASS 庭院草：封闭', closed.stats.grassCells, '格 / 开口', open.stats.grassCells, '格 / 矮墙', lowWall.stats.lowWallEdges, '边 ·', lowWall.perComp.map((c) => c.sub).join('+'), '子区 · 绿像素', px.green);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });

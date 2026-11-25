/**
 * 1670720537662836736 "I smooth my mesh according to an edge type hierarchy. Black is hard, red is
 * game-tile-border and blue is material-border. Verts only get to pull at equal or lower order verts,
 * and only along the appropriate edges"
 *
 * 页面口径：hierarchy.html 的「边类型着色」三色层（黑=硬边 / 红=模块边界 / 蓝=材质边界）+ 逐切面段数表 + 真画面像素。
 *
 * 断言分四组：
 *   A 页面入口：三色开关默认开、图例写明黑/红/蓝、三条 LineSegments 的线色与名字对得上；
 *   B 分类真实：页面画的段数与「用 shape.rank() 独立重算」逐类相等；三类都非空，且默认切面就是有蓝色那层；
 *   C 分级不变量：三档平滑（none/dumb/hierarchical）rank 逐顶点一致；钉住点位移 0；不给 materials 时没有 material 类；
 *   D 画面：同机位开/关三色层的像素差远超噪声底；差异像素里黑/红/蓝三色各自出现（蓝要在材质边界近景里数）。
 */
const { chromium } = require('playwright');
const fs = require('fs');
const assert = require('node:assert/strict');

(async () => {
  const b = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  const report = {};

  const grab = (key) => p.evaluate((k) => {
    const { view } = window.hierarchyClasses.shape ? window.hierarchyModes.api() : window.hierarchyModes.api();
    view.render(0);
    const gl = view.renderer.getContext();
    const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
    const buf = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    window.__px = window.__px || {};
    window.__px[k] = { W, H, buf };
    return { W, H };
  }, key);

  const diff = (a, b2) => p.evaluate(([ka, kb]) => {
    const A = window.__px[ka], B = window.__px[kb];
    if (!A || !B) return null;
    let n = 0, maxd = 0;
    const ink = { black: 0, red: 0, blue: 0 };
    const len = Math.min(A.buf.length, B.buf.length);
    for (let i = 0; i < len; i += 4) {
      const d = Math.abs(A.buf[i] - B.buf[i]) + Math.abs(A.buf[i + 1] - B.buf[i + 1]) + Math.abs(A.buf[i + 2] - B.buf[i + 2]);
      if (d <= 9) continue;
      n++; if (d > maxd) maxd = d;
      const r = A.buf[i], g = A.buf[i + 1], bl = A.buf[i + 2];
      if (Math.max(r, g, bl) < 40) ink.black++;
      else if (r > 140 && r > g * 1.7 && r > bl * 1.7) ink.red++;
      else if (bl > 140 && bl > r * 1.5 && bl > g * 1.25) ink.blue++;
    }
    return { differing: n, total: len / 4, maxd, ink };
  }, [a, b2]);

  try {
    await p.goto('http://127.0.0.1:8769/hierarchy.html');
    let ready = false;
    for (let k = 0; k < 3 && !ready; k++) {
      try {
        await p.waitForFunction(() => !!window.hierarchyClasses, null, { timeout: 45000 });
        ready = true;
      } catch (e) {
        // 本地 serve.py 偶发 ERR_CONNECTION_RESET（iframe 变错误页、rea 永不就绪）→ 重载一次
        if (k === 2) { console.error('page errors:', errors); throw e; }
        await p.reload();
      }
    }
    // 冻时间轴 + 整岛侧视机位 + 摘 HUD：与原片「整座岛 + 三类边」同口径
    await p.evaluate(() => {
      const v = window.hierarchyModes.api().view;
      const o = v.render.bind(v);
      v.render = () => o(0);
      v.onFrame = null;
      v.target.set(0, 3.2, 0); v.distance = 40; v.pitch = 0.62; v.yaw = 0.55; v.updateCamera(); v.render(0);
      const doc = document.querySelector('#scene').contentDocument;
      const hud = doc?.querySelector('#hud');
      if (hud) hud.style.display = 'none';
    });
    await p.waitForTimeout(1200);

    // A. 页面入口
    const entry = await p.evaluate(() => ({
      checked: document.querySelector('#clsOn').checked,
      label: document.querySelector('#clsOn').parentElement.textContent,
      out: document.querySelector('#clsOut').textContent,
      segs: window.hierarchyClasses.segments(),
      colors: window.hierarchyClasses.colors,
      visible: window.hierarchyClasses.visible(),
    }));
    assert.equal(entry.checked, true, '三色层默认开');
    assert.ok(/边类型着色/.test(entry.label));
    assert.ok(/黑/.test(entry.out) && /红/.test(entry.out) && /蓝/.test(entry.out));
    assert.ok(/材质边界/.test(entry.out) && /硬边/.test(entry.out) && /模块边界/.test(entry.out));
    assert.equal(entry.segs.length, 3, '黑/红/蓝三条线层都要有');
    const byName = Object.fromEntries(entry.segs.map((s) => [s.name, s]));
    assert.ok(byName['edge-class-hard'] && byName['edge-class-tile'] && byName['edge-class-material']);
    // 0x111111 黑 / 0xff2d2d 红 / 0x2f6bff 蓝
    assert.equal(byName['edge-class-hard'].color, 0x111111);
    assert.equal(byName['edge-class-tile'].color, 0xff2d2d);
    assert.equal(byName['edge-class-material'].color, 0x2f6bff);
    assert.equal(entry.visible, true);
    report.entry = entry;

    // B. 分类真实：用 shape.rank() 独立重算，逐类与页面画出的段数核对
    const recount = await p.evaluate(async () => {
      const api = window.hierarchyModes.api();
      const sh = window.hierarchyClasses.shape();
      const mod = await import('/src/terrain/shape.js');
      const pairs = window.hierarchyClasses.materials(), hard = window.hierarchyClasses.hard();
      const s = window.hierarchyClasses.slice();
      const grid = api.grid, seen = new Set(), cnt = { hard: 0, tile: 0, material: 0 };
      for (const c of grid.cells) for (let i = 0; i < c.n; i++) {
        const a = c.pts[i].id, b = c.pts[(i + 1) % c.n].id;
        const key = a < b ? a + ':' + b : b + ':' + a;
        if (seen.has(key)) continue; seen.add(key);
        const ra = sh.rank(a, s), rb = sh.rank(b, s);
        let k = null;
        if (ra === 'pinned' || rb === 'pinned') k = 'hard';
        else if (/cliff/.test(ra) || /cliff/.test(rb)) k = 'tile';
        else if (ra === 'material' || rb === 'material') k = 'material';
        if (k) cnt[k]++;
      }
      // 三档 rank 逐顶点一致（同一套 materials 输入）+ 钉住点零位移
      const world = api.world, n = grid.verts.length;
      const shapes = Object.fromEntries(['none', 'dumb', 'hierarchical'].map((m) => [m, mod.shapeTerrain(world, { mode: m, materials: pairs, hardEdges: hard })]));
      let rankDiff = 0, pinnedBad = 0, matNoOpt = 0, samples = 0;
      const bare = mod.shapeTerrain(world, { hardEdges: hard });
      for (let ss = 1; ss < sh.slices; ss++) for (const v of grid.verts) {
        samples++;
        const r0 = sh.rank(v.id, ss);
        if (shapes.none.rank(v.id, ss) !== r0 || shapes.dumb.rank(v.id, ss) !== r0 || shapes.hierarchical.rank(v.id, ss) !== r0) rankDiff++;
        if (r0 === 'pinned' && Math.hypot(sh.at(v, ss)[0] - v.x, sh.at(v, ss)[1] - v.z) > 1e-5) pinnedBad++;
        if (bare.rank(v.id, ss) === 'material') matNoOpt++;
      }
      return {
        counts: cnt, slice: s, slices: sh.slices, samples, rankDiff, pinnedBad, matNoOpt,
        table: window.hierarchyClasses.table(),
        materials: window.hierarchyClasses.materials().length,
        firstMatSlice: window.hierarchyClasses.table().find((r) => r.material > 0)?.slice ?? null,
      };
    });
    const counts = await p.evaluate(() => window.hierarchyClasses.counts());
    assert.deepEqual(counts.hard, recount.counts.hard, '页面黑色段数 == 独立重算');
    assert.deepEqual(counts.tile, recount.counts.tile, '页面红色段数 == 独立重算');
    assert.deepEqual(counts.material, recount.counts.material, '页面蓝色段数 == 独立重算');
    assert.ok(counts.hard > 300, `硬边段数 ${counts.hard}`);
    assert.ok(counts.tile > 100, `模块边界段数 ${counts.tile}`);
    assert.ok(counts.material >= 1, `材质边界段数 ${counts.material}`);
    assert.ok(recount.materials >= 1, '蓝色类的输入（river 归属不同的同高度相邻格）非空');
    assert.equal(recount.slice, recount.firstMatSlice, '默认切面就是有蓝色那一层');
    assert.equal(recount.rankDiff, 0, '三档平滑的 rank 分类逐顶点一致（分类不随平滑档变）');
    assert.equal(recount.pinnedBad, 0, '钉住点（黑）在各切面零位移');
    assert.equal(recount.matNoOpt, 0, '不给 materials 时不存在 material 类（蓝色不是白送的）');
    // 逐切面表：三层都出现过，蓝色只在最低切面
    const rows = recount.table;
    assert.equal(rows.length, recount.slices - 1);
    for (const r of rows) assert.equal(r.hard + r.tile + r.material, r.total);
    assert.ok(rows.filter((r) => r.tile > 0).length > 3, '红色出现在多个切面');
    assert.equal(rows.filter((r) => r.material > 0).length, 1);
    report.recount = recount;

    // C. 画面 A/B：整岛机位，开/关三色层
    await grab('on');
    await grab('on2');
    const offCounts = await p.evaluate(() => { window.hierarchyClasses.setVisible(false); return window.hierarchyClasses.counts(); });
    await p.waitForTimeout(400);
    await grab('off');
    await p.screenshot({ path: 'artifacts/coverage/hierarchy-edge-classes-r167-off.png' });
    await p.evaluate(() => window.hierarchyClasses.setVisible(true));
    await p.waitForTimeout(400);
    await grab('on3');
    await p.screenshot({ path: 'artifacts/coverage/hierarchy-edge-classes-r167.png' });

    const noise = await diff('on', 'on2');
    const noiseBack = await diff('on', 'on3');
    const ab = await diff('on', 'off');
    assert.equal(noise.differing, 0, '同状态重渲必须逐像素一致');
    assert.equal(noiseBack.differing, 0, '关→开回位必须逐像素一致');
    assert.ok(ab.differing > 3000, `三色层必须真画在画面上（${ab.differing} px）`);
    assert.ok(ab.ink.black > 200, `黑色硬边像素 ${ab.ink.black}`);
    assert.ok(ab.ink.red > 100, `红色模块边界像素 ${ab.ink.red}`);
    report.ab = ab;
    report.offCounts = offCounts;

    // D. 材质边界近景：蓝色那一段必须在画面上数得到
    await p.evaluate(() => { document.querySelector('#focusMat').click(); });
    await p.waitForTimeout(500);
    await grab('matOn');
    await p.evaluate(() => window.hierarchyClasses.setVisible(false));
    await p.waitForTimeout(300);
    await grab('matOff');
    await p.screenshot({ path: 'artifacts/coverage/hierarchy-edge-classes-r167-mat.png' });
    await p.evaluate(() => window.hierarchyClasses.setVisible(true));
    await p.waitForTimeout(300);
    await p.screenshot({ path: 'artifacts/coverage/hierarchy-edge-classes-r167-mat-on.png' });
    const matAb = await diff('matOn', 'matOff');
    assert.ok(matAb.differing > 200, `材质边界近景差分 ${matAb.differing} px`);
    assert.ok(matAb.ink.blue > 5, `近景里蓝色材质边界像素 ${matAb.ink.blue}`);
    report.matAb = matAb;
    assert.deepEqual(errors, []);

    fs.writeFileSync('artifacts/coverage/hierarchy-edge-classes-browser.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify({
      counts, firstMatSlice: recount.firstMatSlice, materials: recount.materials,
      slices: recount.slices, samples: recount.samples,
      table: rows.map((r) => `${r.slice}:${r.hard}/${r.tile}/${r.material}`),
      noise: [noise.differing, noiseBack.differing],
      ab: { differing: ab.differing, ink: ab.ink, maxd: ab.maxd },
      matAb: { differing: matAb.differing, ink: matAb.ink },
    }, null, 1));
  } finally {
    await b.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });

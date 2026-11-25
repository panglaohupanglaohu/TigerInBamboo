// 1447488323845509121 · 656 帧 · "Properly combine seamless soft slopes with distinct sharp cliffs /
// Erosion valid terrain with no local minimums / Get the best of both square tiles and triangular tiles"
// 口径：三件事全部在真实页面（terrain-r55.html）上量，像素 A/B 走同一 World 的 tops=0 / tops=1 两档。
// 关键量具：把画出来的墙按「同一格边叠了几块（每块 1 层）」分档 —— 1 块=缓坡台阶、≥2 块=真崖。
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = 'http://localhost:8769';
const OUT = 'artifacts/coverage';
let fails = 0;
const ok = (c, m, x) => { if (c) console.log('  PASS ' + m); else { fails++; console.log('  FAIL ' + m + (x !== undefined ? ' → ' + JSON.stringify(x) : '')); } };

(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1000, height: 780 } });
  const errors = [];
  p.on('pageerror', (e) => { errors.push(e.message); console.log('  PAGEERR ' + e.message); });
  p.on('console', (m) => { if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico')) { errors.push(m.text()); console.log('  CONSOLE ' + m.text()); } });

  const CAM = '&clean=1&cam=soft&dist=24&pitch=0.55&yaw=0.8';
  const load = async (q) => {
    // serve.py 偶发连接重置（r150 同型）：goto + wait 各重试 3 次
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await p.goto(BASE + '/terrain-r55.html?' + q + CAM, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await p.waitForFunction(() => !!window.__r55, null, { polling: 100, timeout: 90000 });
        await p.waitForTimeout(400);
        return await p.evaluate(() => window.__r55);
      } catch (e) {
        console.log('  RETRY ' + attempt + ' ' + q + ' · ' + String(e.message).split('\n')[0]);
        if (attempt === 3) throw e;
        await p.waitForTimeout(1500);
      }
    }
  };
  const frame = () => p.frames().find((f) => f.url().includes('scene=terrain'));
  // 页面自己的 rAF 循环会按真实 dt 推进水面时间 → 不冻帧两张图必然不同（r145 同型）。冻住 render，截图走 __origRender(0)。
  const freeze = () => frame().evaluate(() => {
    const v = window.rea.view;
    if (!v.__origRender) { v.__origRender = v.render.bind(v); v.render = () => {}; }
  });
  const shot = async () => {
    await freeze();
    return frame().evaluate(() => {
      const v = window.rea.view;
      v.__origRender(0);
      const src = v.renderer.domElement;
      const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
      c.getContext('2d').drawImage(src, 0, 0);
      return c.toDataURL('image/png').split(',')[1];
    });
  };
  const save = (b64, name) => { const f = `${OUT}/${name}`; fs.writeFileSync(f, Buffer.from(b64, 'base64')); return f; };
  const diff = async (a, c) => p.evaluate(async ([a, c]) => {
    const dec = async (s) => { const r = await fetch('data:image/png;base64,' + s); return createImageBitmap(await r.blob()); };
    const [i1, i2] = await Promise.all([dec(a), dec(c)]);
    if (i1.width !== i2.width || i1.height !== i2.height) return { size: [i1.width, i1.height, i2.width, i2.height] };
    const cv1 = new OffscreenCanvas(i1.width, i1.height), x1 = cv1.getContext('2d'); x1.drawImage(i1, 0, 0);
    const cv2 = new OffscreenCanvas(i2.width, i2.height), x2 = cv2.getContext('2d'); x2.drawImage(i2, 0, 0);
    const d1 = x1.getImageData(0, 0, i1.width, i1.height).data, d2 = x2.getImageData(0, 0, i2.width, i2.height).data;
    let n = 0, sum = 0; for (let i = 0; i < d1.length; i += 4) { const dd = Math.abs(d1[i] - d2[i]) + Math.abs(d1[i + 1] - d2[i + 1]) + Math.abs(d1[i + 2] - d2[i + 2]); if (dd > 24) { n++; sum += dd / 3; } }
    return { pixels: n, total: d1.length / 4, mean: +(sum / Math.max(1, n)).toFixed(2) };
  }, [a, c]);

  // ---------- ① 同一 World 的 tops=0 / tops=1 两档（mixed 7 + quad 7） ----------
  const R = {};
  for (const [name, grid] of [['mixed', 'mixed'], ['quad', 'quad']]) {
    const base = `grid=${grid}&seed=7&soft=1&softrelax=1&edges=1`;
    R[name] = { file: {} };
    R[name].off = await load(base + '&tops=0');
    R[name].file.off = save(await shot(), `slope-cliff-${name}-terraced-r151.png`);
    R[name].on = await load(base);
    const on1 = await shot();
    R[name].file.on = save(on1, `slope-cliff-${name}-soft-r151.png`);
    const on2 = await shot();
    R[name].noise = await diff(on1, on2);
    R[name].ab = await diff(fs.readFileSync(R[name].file.off).toString('base64'), on1);
  }

  console.log('\n[mixed/7 · 软坡 vs 台阶]');
  const M = R.mixed;
  ok(M.off.soft == null && M.off.edges.seamless === 0, 'tops=0 时没有软坡台账、台地线一条都不 seamless（反向对照）', { soft: M.off.soft, edges: M.off.edges });
  ok(M.on.soft && M.on.soft.stepEdges > 100, 'tops=1 缓坡台阶 ' + M.on.soft.stepEdges + ' 条参与合流', M.on.soft);
  ok(M.on.soft.meltedShare >= 0.75, '其中 ' + (M.on.soft.meltedShare * 100).toFixed(1) + '% 被焊成斜面', M.on.soft.meltedShare);
  ok(M.on.soft.cliffHorizontal === 0, '≥2 层崖一条都没被压成平面（cliffHorizontal 0）', M.on.soft.cliffHorizontal);
  ok(M.on.soft.cliffShared / M.on.soft.cliffEdges < 0.2, '崖边被邻组借角的比例 ' + (100 * M.on.soft.cliffShared / M.on.soft.cliffEdges).toFixed(1) + '%（只做倒角，不改高度差）', M.on.soft);
  ok(Math.abs((M.off.walls.hist[1] - M.on.walls.hist[1]) - (M.on.soft.seamless - (M.on.walls.fill || 0))) <= 2, '1 层墙 ' + M.off.walls.hist[1] + '→' + M.on.walls.hist[1] + '，减少量 == 焊死台阶数 ' + M.on.soft.seamless + ' − 混合顶点填缝墙 ' + (M.on.walls.fill || 0) + '（±2：个别焊死边本来就没墙）', M.on.walls);
  ok(M.on.walls.hist[2] === M.off.walls.hist[2] && M.on.walls.hist[3] === M.off.walls.hist[3] && M.on.walls.hist.more === M.off.walls.hist.more, '≥2 层崖墙逐档一字不差（' + [2, 3, 'more'].map((k) => M.off.walls.hist[k]).join('/') + '）', { off: M.off.walls.hist, on: M.on.walls.hist });
  ok(M.off.edges.drawn - M.on.edges.drawn === M.on.soft.seamless, '台地线 ' + M.off.edges.drawn + '→' + M.on.edges.drawn + '，减少量 == 焊死台阶数', { off: M.off.edges, on: M.on.edges });
  ok(M.off.slope.soft === 0 && M.on.slope.soft > 10, '斜面面积（3°–40° 顶面）' + M.off.slope.soft + '→' + M.on.slope.soft + ' m²', M.on.slope);
  ok(M.on.slope.wallArea < M.off.slope.wallArea, '墙面面积 ' + M.off.slope.wallArea + '→' + M.on.slope.wallArea + ' m²');
  ok(M.ab.pixels > 3000, '像素 A/B（同一 World，仅 tops 切换）' + M.ab.pixels + 'px（均值 ' + M.ab.mean + ' 级）', M.ab);
  ok(M.noise.pixels === 0, '同 URL 重载噪声 ' + M.noise.pixels + 'px', M.noise);

  console.log('\n[quad/7 · 同一口径复核]');
  const Q = R.quad;
  ok(Q.on.soft.meltedShare >= 0.9, '方块网格 ' + (Q.on.soft.meltedShare * 100).toFixed(1) + '% 台阶焊死', Q.on.soft.meltedShare);
  ok(Math.abs((Q.off.walls.hist[1] - Q.on.walls.hist[1]) - Q.on.soft.seamless) <= 2, '1 层墙 ' + Q.off.walls.hist[1] + '→' + Q.on.walls.hist[1] + '（seamless ' + Q.on.soft.seamless + '，±2 容差：个别焊死边本来就没墙）', Q.on.walls);
  ok([2, 3, 'more'].every((k) => Q.on.walls.hist[k] === Q.off.walls.hist[k]), '崖墙不变 ' + JSON.stringify(Q.off.walls.hist), Q.on.walls);

  // ---------- ② 方 + 三角两种 tile 在同一岛上，且都参与软坡 ----------
  console.log('\n[混合格 · 方 + 三角]');
  ok(M.on.gridSides['3'] > 0 && M.on.gridSides['4'] > 0, '同岛并存 ' + M.on.gridSides['3'] + ' 个三角格 + ' + M.on.gridSides['4'] + ' 个四方格', M.on.gridSides);
  const by = M.on.soft.bySides;
  ok(by['4:3'] && by['3:4'] && by['3:3'] && by['4:4'], '四种配对（4:4 / 4:3 / 3:4 / 3:3）都有台阶合流', Object.keys(by));
  ok(Object.values(by).every((s) => s.melted > 0 && s.seamless > 0), '每种配对都有真的焊死（无「方格那一半才吃软坡」）', by);

  // ---------- ③ 侵蚀：无局部低洼 ----------
  console.log('\n[侵蚀 · 无局部低洼]');
  const E = await load('grid=mixed&seed=7&soft=1&softrelax=1&erosion=1');
  ok(E.erosion && E.erosion.lowered > 0, '侵蚀真的降格 ' + (E.erosion && E.erosion.lowered) + ' 格（体积 ' + (E.erosion && E.erosion.volume) + '）', E.erosion);
  ok(E.water.minimaBefore > 0, '侵蚀+填洼前本岛确有 ' + E.water.minimaBefore + ' 个局部低洼（反向对照）', E.water);
  ok(E.water.minimaAfter === 0 && E.water.minimaWorld === 0, '填洼后与 World 实数都是 0 个局部低洼', E.water);
  ok(E.water.drainedFill === 1 && E.water.drainedRaw === 1, '全部陆地格都能沿不升的路径下海（drained 1.0）', E.water);
  const Ebase = await load('grid=mixed&seed=7&soft=1&softrelax=1&tops=0');
  ok(Ebase.water == null, '对照：未开侵蚀的同一份地形不报 water 台账（minimaBefore 只在开侵蚀时出现）', Ebase.water);
  // 侵蚀后再验一次软坡仍然工作（侵蚀会把坡面重排，不能把软坡改坏）
  ok(E.soft && E.soft.meltedShare > 0.75 && E.soft.cliffHorizontal === 0, '侵蚀后软坡仍 ' + (E.soft && (E.soft.meltedShare * 100).toFixed(1)) + '% 焊死、崖仍不塌', E.soft);

  // ---------- ④ 台地线开关（片中的白线阶段） ----------
  console.log('\n[台地线 · 片中白线阶段]');
  const ED = await load('grid=mixed&seed=7&soft=1&softrelax=1&edges=1');
  ok(ED.edges && ED.edges.drawn > 0 && ED.edges.seamless > 0, '台地线 ' + ED.edges.drawn + ' 段，其中 seamless ' + ED.edges.seamless + ' 段');
  ok(ED.edges.seamless === ED.soft.seamless, 'seamless 段数 == 焊死台阶数（' + ED.soft.seamless + '）');
  save(await shot(), 'slope-cliff-edges-r151.png');

  // ---------- ⑤ node 回归 ----------
  console.log('\n[node 回归]');
  const { execFileSync } = require('child_process');
  for (const t of ['tests/soft-slopes-overhang.mjs', 'tests/soft-continuous.mjs', 'tests/depfill-lakes.mjs', 'tests/lakes-erosion-r55.mjs', 'tests/soft-tops-collide-r55.mjs']) {
    try { execFileSync('node', [t], { stdio: 'pipe' }); ok(true, 'node 回归 ' + t); } catch (e) { ok(false, 'node 回归 ' + t, String(e.stdout || e.message).slice(-300)); }
  }

  ok(errors.length === 0, '0 console/page error', errors);
  fs.writeFileSync(`${OUT}/soft-slope-cliff-r151.json`, JSON.stringify({ R, E, ED, errors }, null, 2));
  await b.close();
  console.log('\n' + (fails ? 'FAIL ' + fails : 'ALL PASS'));
  if (fails) process.exit(1);
})();

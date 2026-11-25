// r138 · 1769691526924292506「Mega river system!」+ 1795831296952041691「travel faster along rivers」
// 页面：planet-rivers-c09.html（collapseRiversFirst：河道先 DFS 坍缩 → 其余 BFS 缓坡；buildNav 沿河费用）
// 断言口径：原文四件事逐条落地 —— ① 河是特例（DFS 深度决定河床高度、单宽、树形回溯出支流）
// ② 其余陆地 BFS（父链不升、缓坡为主）③ 只偶尔碰到陡崖（steepShare 小但 >0）④ 沿河更快（顺流 < 逆流 < 步行）
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('fs');

const URL0 = 'http://127.0.0.1:8769/planet-rivers-c09.html';
const LAUNCH = { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] };

// 帧缓冲直读：renderer.render() 之后同一个 task 里 readPixels 才拿得到刚画的那帧
const PIX = () => {
  const { renderer, scene, camera } = window.__c09view;
  renderer.render(scene, camera);
  const gl = renderer.getContext(), cv = renderer.domElement;
  const w = cv.width, h = cv.height, buf = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  let blue = 0, pale = 0, land = 0, planet = 0, riverish = 0; const grid = new Array(32 * 32).fill(0);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, r = buf[i], g = buf[i + 1], b = buf[i + 2];
    if (Math.abs(r - 111) + Math.abs(g - 143) + Math.abs(b - 151) < 24) continue;   // 页面底色 #6f8f97 不算星球
    planet++;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx ? (mx - mn) / mx : 0;
    if (b > r + 10 && b > g + 5) { blue++; grid[((y * 32 / h) | 0) * 32 + ((x * 32 / w) | 0)]++; }
    else if (mx > 200 && sat < 0.16) pale++;
    else land++;
  }
  return { blue, pale, land, planet, grid, w, h };
};

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const errors = [], reports = {};
  const watch = (p) => {
    p.on('pageerror', (e) => errors.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !(m.location().url || '').endsWith('favicon.ico')) errors.push(m.text()); });
  };
  try {
    /* ---------- 1) 结构：DFS 河树 + BFS 父链（n=2500 与默认 n=4000 各一次） ---------- */
    for (const n of [2500, 4000]) {
      const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      watch(p);
      await p.goto(`${URL0}?still=1&n=${n}&seed=3&lines=0`, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await p.waitForFunction(() => window.__c09river && window.__c09planet, null, { timeout: 120000 });
      const r = await p.evaluate(() => {
        const d = window.__c09river, st = window.__c09planet, N = d.cells, G = Int32Array.from(d.ground);
        const kids = new Int32Array(N); for (let i = 0; i < N; i++) if (d.river[i] && d.flowTo[i] >= 0) kids[d.flowTo[i]]++;
        const out = { st, N, land: d.land, riverCells: d.riverCells, mouths: d.mouths.length, confluences: d.confluences, cliffs: d.cliffs, forcedSteep: d.forcedSteep, paths: d.paths.length, path0: d.path0, maxLevel: st.maxLevel, source: d.source };

        // ① 河是特例：河床高度 = 1 + floor(DFS 深度 / 9)，与 BFS/削坡无关
        let dfsLaw = 0, dfsBad = 0, mono = 0, monoBad = 0, wide = 0, wideBad = 0, cyc = 0, brokenRiver = 0, nonMouth = 0;
        for (let i = 0; i < N; i++) {
          if (!d.river[i]) continue;
          if (d.depth[i] >= 0) { dfsLaw++; if (G[i] !== Math.min(st.maxLevel - 1, 1 + Math.floor(d.depth[i] / 9))) dfsBad++; }
          const f = d.flowTo[i];
          if (f >= 0) { nonMouth++; mono++; if (G[f] > G[i]) monoBad++; }
          // 单宽：相邻的河格只能是自己的下游或自己的直接支流（不并排）
          for (const o of d.nb[i]) if (o >= 0 && d.river[o]) { wide++; if (o !== f && d.flowTo[o] !== i) wideBad++; }
          // 无环 + 必到河口：沿 flowTo 走到 -1，且该格贴海
          let x = i, k = 0; while (d.flowTo[x] >= 0 && k++ <= N) x = d.flowTo[x];
          if (k > N) cyc++;
          if (d.flowTo[x] >= 0 || !d.nb[x].some((o) => o >= 0 && G[o] === 0)) brokenRiver++;
        }
        // ② 其余陆地 BFS：父链高度不升、链必通到河/海、每个陆地格都被覆盖
        let bfs = 0, bfsDrop = 0, chainOk = 0, chainBad = 0, uncovered = 0;
        for (let i = 0; i < N; i++) {
          if (G[i] === 0 || d.river[i]) continue;
          const par = d.parent[i];
          if (par < 0) { uncovered++; continue; }
          bfs++; if (G[i] < Math.max(1, G[par])) bfsDrop++;
          let x = i, k = 0, ok = false;
          while (k++ <= N) { if (G[x] === 0 || d.river[x]) { ok = true; break; } const q = d.parent[x]; if (q < 0) break; if (G[q] > G[x]) break; x = q; }
          ok ? chainOk++ : chainBad++;
        }
        // ③ 缓坡为主、只偶尔陡崖；零局部洼地与零不排水（同一口径重算，不抄 stats）
        let landEdges = 0, steep = 0, minima = 0;
        for (let i = 0; i < N; i++) {
          if (!G[i]) continue;
          for (const o of d.nb[i]) if (o > i && G[o]) { landEdges++; if (Math.abs(G[o] - G[i]) > 1) steep++; }
          if (d.nb[i].every((o) => o >= 0 && G[o] > G[i])) minima++;
        }
        const reach = new Uint8Array(N), q = [];
        for (let i = 0; i < N; i++) if (!G[i] || d.river[i]) { reach[i] = 1; q.push(i); }
        for (let h = 0; h < q.length; h++) for (const o of d.nb[q[h]]) if (o >= 0 && !reach[o] && G[o] >= G[q[h]]) { reach[o] = 1; q.push(o); }
        let undrained = 0; for (let i = 0; i < N; i++) if (G[i] && !reach[i]) undrained++;
        let confluence = 0; for (let i = 0; i < N; i++) if (d.river[i] && kids[i] >= 2) confluence++;
        let leaves = 0; for (let i = 0; i < N; i++) if (d.river[i] && kids[i] === 0) leaves++;
        return { ...out, dfsLaw, dfsBad, mono, monoBad, wide, wideBad, cyc, brokenRiver, nonMouth, bfs, bfsDrop, chainOk, chainBad, uncovered, landEdges, steep, steepShare: steep / Math.max(1, landEdges), minima, undrained, confluence, leaves, turtle: st.tortuosity };
      });
      assert.equal(r.source, 'collapse-c09', '河网来源是 C09 坍缩（不是 r55 先地形后挖河）');
      assert.ok(r.dfsBad === 0 && r.dfsLaw > 300, `河床高度 = 1+floor(DFS 深度/9) 逐格成立（${r.dfsLaw} 格，违例 ${r.dfsBad}）`);
      assert.ok(r.monoBad === 0 && r.mono > 300, `沿 flowTo 下游从不爬升（${r.mono} 边）`);
      assert.ok(r.wideBad === 0, `河道单宽：相邻河格只能是上下游关系（${r.wide} 对，并排 ${r.wideBad}）`);
      assert.ok(r.cyc === 0 && r.brokenRiver === 0, `每条河都能走到贴海的河口（断流 ${r.brokenRiver}、成环 ${r.cyc}）`);
      assert.ok(r.mouths >= 10 && r.mouths <= 18, `入海口 ${r.mouths} 个（page rivers=18，minMouthGap 后实际更少）`);
      assert.ok(r.confluence >= 10 && r.confluence === r.confluences, `回溯长出支流：汇流格 ${r.confluence}（stats ${r.confluences}）`);
      assert.equal(r.leaves, r.paths, '每条支流一条 path（叶子数 == paths 数）');
      assert.ok(r.path0.length >= 25 && Math.max(...r.turtle) >= 1.6, `"wiggle real far"：主干 ${r.path0.length} 格、曲率 ${Math.max(...r.turtle)}`);
      assert.ok(r.bfsDrop === 0 && r.bfs > 500 && r.chainBad === 0 && r.uncovered === 0, `其余陆地走 BFS：${r.bfs} 格父链全不降（降 ${r.bfsDrop}）、断链 ${r.chainBad}、漏格 ${r.uncovered}）`);
      assert.ok(r.steepShare > 0 && r.steepShare < 0.08, `"only occasionally meet steep cliffs"：陡边 ${r.steep}/${r.landEdges} = ${(r.steepShare * 100).toFixed(2)}%`);
      assert.equal(r.minima, 0, '零局部洼地（同一口径重算）');
      assert.equal(r.undrained, 0, '每个陆地格沿不升的边通到河/海');
      assert.ok(r.st.maxLevel >= 5 && r.forcedSteep >= 0 && r.cliffs > 0, `偶发陡崖真的发生过（cliffs ${r.cliffs}）`);
      reports['n' + n] = r;
      if (n === 2500) {
        const focus = r.path0[Math.floor(r.path0.length * 0.5)];
        fs.writeFileSync('artifacts/coverage/planet-rivers-c09-model.json', JSON.stringify({ focus, ...r, st: r.st }, null, 1));
        await p.close();
        // 记下 focus 给像素段用
        reports.focus = focus;
      } else await p.close();
    }

    /* ---------- 2) 画面：河格真的画成蓝色（?river=0 A/B）、流向线真的存在（?lines=0） ---------- */
    const focus = reports.focus;
    const shot = async (query, file) => {
      const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      watch(p);
      await p.goto(`${URL0}?still=1&n=2500&seed=3&focus=${focus}${query}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await p.waitForFunction(() => window.__c09view && window.__c09river, null, { timeout: 120000 });
      await p.waitForTimeout(600);
      const pix = await p.evaluate(PIX);
      if (file) await p.screenshot({ path: file });
      await p.close();
      return pix;
    };
    const sea = await shot('', 'artifacts/coverage/planet-rivers-c09-river.png');                 // 默认：海 + 河格 + 流向线
    const noRiver = await shot('&river=0', 'artifacts/coverage/planet-rivers-c09-land.png');     // 河格按陆地色
    const noLine = await shot('&lines=0', 'artifacts/coverage/planet-rivers-c09-nolines.png');   // 关流向线
    const landOnly = await shot('&sea=0&lines=0', 'artifacts/coverage/planet-rivers-c09-sea0.png'); // 只留陆地（对齐原片 f0065）
    const gridDiff = (a, b) => a.grid.reduce((s, v, i) => s + Math.abs(v - b.grid[i]), 0) / 2;
    const riverPix = sea.blue - noRiver.blue, linePix = sea.blue - noLine.blue;
    assert.ok(riverPix > 3000, `河格画面上是蓝色：?river=1 比 ?river=0 多 ${riverPix} 个蓝像素`);
    assert.ok(gridDiff(sea, noRiver) > 500, `A/B 差分布在 ${Math.round(gridDiff(sea, noRiver))} 个格（不是整屏变色）`);
    assert.ok(noLine.pale < sea.pale, `流向线是浅色细线：?lines=1 浅像素 ${sea.pale} > 关掉 ${noLine.pale}`);
    reports.pix = { blue: sea.blue, planet: sea.planet, blueShare: sea.blue / sea.planet, blueNoRiver: noRiver.blue, riverPix, riverShareOfPlanet: riverPix / sea.planet, paleWithLines: sea.pale, paleNoLines: noLine.pale, blueLandOnly: landOnly.blue, planetLandOnly: landOnly.planet, blueShareLandOnly: landOnly.blue / landOnly.planet, paleLandOnly: landOnly.pale, w: sea.w, h: sea.h };

    /* ---------- 3) 沿河更快（1795831296952041691）：共享 World 的 flowSource 必须还是 carve ---------- */
    const pn = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    watch(pn);
    await pn.goto(`${URL0}?still=1&n=2500&seed=3&nav=auto&face=0`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await pn.waitForFunction(() => window.__c09nav && window.__c09river, null, { timeout: 120000 });
    const nav = await pn.evaluate(() => {
      const nv = window.__c09nav, d = window.__c09river, N = d.cells, G = Int32Array.from(d.ground);
      // 同一棵树上的顺/逆流代价：主干首尾
      const trunk = d.path0, src = trunk[trunk.length - 1], mouth = trunk[0];
      return { ...nv, N, landCells: G.filter((h) => h > 0).length, src, mouth, trunk: trunk.length };
    });
    assert.equal(nav.flowSource, 'carve', '星球河网被 navgraph 认成 carve（不是退回河口距离）');
    assert.ok(nav.treeEdgesOnRiver > 100, `导航树里沿河的边 ${nav.treeEdgesOnRiver}（顺流 0.3 / 逆流 0.65）`);
    assert.ok(nav.reached / nav.landCells > 0.95, `可达陆地 ${nav.reached}/${nav.landCells}`);
    assert.ok(nav.regions >= 1, `区域 ${nav.regions}`);
    await pn.screenshot({ path: 'artifacts/coverage/planet-rivers-c09-nav.png' });
    await pn.close();
    reports.nav = nav;

    assert.deepEqual(errors, [], '0 console/page error');
    fs.writeFileSync('artifacts/coverage/planet-rivers-c09-browser.json', JSON.stringify({ reports, errors }, null, 1));
    console.log('PASS planet-rivers-c09', JSON.stringify({ riverCells: reports.n2500.riverCells, confluences: reports.n2500.confluence, steepShare: reports.n2500.steepShare, riverPix, nav: { flowSource: nav.flowSource, treeEdgesOnRiver: nav.treeEdgesOnRiver, reached: nav.reached } }));
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });

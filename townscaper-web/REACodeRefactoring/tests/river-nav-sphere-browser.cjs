// r139 · 1795831296952041691「I'm putting together a navigation structure that lets you travel faster
// along rivers (and especially downstream)」—— 球面 / 复杂汇流那一层的运行验收。
// 页面：planet-rivers-c09.html?nav=auto（buildNav + metric=球面弦长 + slopeStep=1，真实球面 World）
// 原文那件事拆成五个可读数：
//   ① 顺流 < 逆流 < 纯步行（沿河确实更快，且不是只快一格）
//   ② 汇流点（入度≥2）的每条支流都按 carve 顺序判顺流、且「汇入」比「逆出」便宜
//   ③ 顺流边绝不朝上坡（高差优先，不被相邻曲流之间的捷径骗）
//   ④ 每条主干都成立（不是只挑最长那条）
//   ⑤ 完整接口在球面上也通：findNavPath 代价 == 树上时间；简化图真压缩、边价有限
// 平面网格那一层由 tests/river-nav-browser.cjs 覆盖，本支专测球面 + 汇流，不重复。
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('fs');

const URL0 = 'http://127.0.0.1:8769/planet-rivers-c09.html';
const LAUNCH = {
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
};

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const errors = [];
  const reports = [];
  const watch = (p) => {
    p.on('pageerror', (e) => errors.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !(m.location().url || '').endsWith('favicon.ico')) errors.push(m.text()); });
  };
  try {
    /* ---------- 1) 球面 + 汇流：两条种子各量一次 ---------- */
    for (const seed of [3, 5]) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      watch(page);
      await page.goto(`${URL0}?still=1&n=2500&seed=${seed}&nav=auto&labels=1&face=0`, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.waitForFunction(() => window.__c09routes && window.__c09nav && window.__c09river, null, { timeout: 120000 });

      const r = await page.evaluate(async () => {
        const d = window.__c09river, nv = window.__c09nav;
        const first = window.__c09routes;
        const all = [];
        for (let i = 0; i < first.paths; i++) all.push(window.__c09routeProbe(i));
        return { first, all, flowSource: first.flowSource, navOut: nv, confluences: d.confluences, mouths: d.mouths.length, trunk0: all[0] };
      });

      if (r.evalError) throw new Error(`seed${seed} 页面量具报错：${r.evalError}`);

      // ① 边层面：球面上每条河格→父格都判得出顺流，没有中性、没有上坡顺流
      assert.equal(r.flowSource, 'carve', `seed${seed} 星球河网被认成 carve`);
      assert.ok(r.first.edges > 200, `seed${seed} 河格有向边 ${r.first.edges}`);
      assert.equal(r.first.neutral, 0, `seed${seed} 球面没有方向未知的河格边（全走 carve 顺序）`);
      assert.equal(r.first.uphillDown, 0, `seed${seed} 顺流边朝上坡的条数必须为 0`);
      assert.ok(r.first.down / r.first.edges > 0.95, `seed${seed} 顺流占比 ${(r.first.down / r.first.edges).toFixed(3)}`);

      // ② 汇流：入度≥2 的父格，每条支流都顺流且更便宜
      assert.ok(r.first.confluences >= 10, `seed${seed} 汇流格 ${r.first.confluences}（stats ${r.confluences}）`);
      assert.equal(r.first.confluenceResolved, r.first.confluences, `seed${seed} 汇流支流方向全部判出`);
      assert.equal(r.first.confluenceCheaper, r.first.confluences, `seed${seed} 汇流支流全部「汇入更便宜」`);

      // ③ 整段：顺流 < 逆流 < 纯步行（主干两端，球面弦长同一把尺）
      const trunk = r.trunk0;
      assert.ok(Number.isFinite(trunk.tDown) && Number.isFinite(trunk.tUp), `seed${seed} 主干两端可达`);
      assert.ok(trunk.tDown < trunk.tUp, `seed${seed} 顺流 ${trunk.tDown.toFixed(3)} < 逆流 ${trunk.tUp.toFixed(3)}`);
      assert.ok(trunk.tUp < trunk.walk * 1.0001, `seed${seed} 逆流 ${trunk.tUp.toFixed(3)} < 沿路步行 ${trunk.walk.toFixed(3)}`);
      assert.ok(trunk.speedup > 1.5, `seed${seed} 沿河比走同一条路快 ×${trunk.speedup.toFixed(2)}`);
      assert.ok(trunk.upDownRatio > 1.2, `seed${seed} 逆行/顺行 时间比 ${trunk.upDownRatio.toFixed(2)}`);
      assert.ok(trunk.detourRatio < 1, `seed${seed} 沿河最优 ${trunk.tDown.toFixed(3)} < 纯步行最优 ${trunk.walkOptimal.toFixed(3)}（比 ×${trunk.detourRatio.toFixed(3)}）`);

      // ④ 每条主干都成立（不是只挑了最长那条）
      const ok = r.all.filter((x) => Number.isFinite(x.tDown) && x.tDown < x.tUp && x.tDown < x.walkOptimal);
      assert.equal(ok.length, r.all.length, `seed${seed} ${ok.length}/${r.all.length} 条主干顺流最快`);
      for (const x of r.all) assert.equal(x.uphillDown, 0, `主干${x.pathIdx} 顺流上坡 ${x.uphillDown}`);

      reports.push({
        seed, edges: r.first.edges, down: r.first.down, neutral: r.first.neutral, uphillDown: r.first.uphillDown,
        confluences: r.first.confluences, pathCount: r.all.length,
        steps: trunk.steps, tDown: trunk.tDown, tUp: trunk.tUp, walk: trunk.walk, walkOptimal: trunk.walkOptimal,
        speedup: trunk.speedup, speedupOptimal: trunk.speedupOptimal, upDownRatio: trunk.upDownRatio, detourRatio: trunk.detourRatio,
        treeEdgesOnRiver: r.navOut.treeEdgesOnRiver, reached: r.navOut.reached, labels: r.navOut.labels,
      });
      if (seed === 3) await page.screenshot({ path: 'artifacts/coverage/river-nav-sphere-r139.png' });
      await page.close();
    }

    /* ---------- 2) 完整接口（球面口径）：findNavPath 与树上时间同值；简化图真压缩、边价有限且在河段上有向价差 ---------- */
    const p2 = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    watch(p2);
    await p2.goto(`${URL0}?still=1&n=2500&seed=3&nav=auto&face=0`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await p2.waitForFunction(() => window.__c09routes && window.__c09navHandle && window.__c09world, null, { timeout: 120000 });
    const iface = await p2.evaluate(async () => {
      const { findNavPath, simplifyNav } = await import('./src/world/navgraph.js');
      const nav = window.__c09navHandle, w = window.__c09world, r = window.__c09routeProbe(0);
      const from = w.cells[r.src], to = w.cells[r.mouth];
      const found = findNavPath(w, nav, from, to);
      const sim = simplifyNav(w, nav);
      let finiteEdges = 0, badEdges = 0, directed = 0;
      for (const e of sim.edges) { if (Number.isFinite(e.cost) && Number.isFinite(e.reverseCost)) finiteEdges++; else badEdges++; if (Math.abs(e.cost - e.reverseCost) > 1e-9) directed++; }
      // 价格确实是活的：平床河格边上 顺流/逆流 必须精确等于 0.3/0.65
      const d = window.__c09river; let flatPairs = 0, priceBad = 0;
      for (let i = 0; i < d.cells; i++) {
        const pid = d.flowTo[i]; if (pid < 0 || !d.river[i]) continue;
        const a = w.cells[i], b = w.cells[pid]; if (nav.hgt[a.id] !== nav.hgt[b.id]) continue;
        flatPairs++; if (Math.abs(nav.cost(a, b) / nav.cost(b, a) - 0.3 / 0.65) > 1e-9) priceBad++;
      }
      return { pathCost: found.cost, pathSteps: found.path.length - 1, treeTime: r.tDown, steps: r.steps, nodes: sim.nodes.length, walkable: sim.walkable, compression: sim.compression, finiteEdges, badEdges, directed, flatPairs, priceBad };
    });
    assert.ok(iface.pathSteps > 3, `findNavPath 在球面上出路径 ${iface.pathSteps} 步`);
    assert.ok(Math.abs(iface.pathCost - iface.treeTime) <= 1e-9, `findNavPath 代价 ${iface.pathCost.toFixed(6)} == 树上时间 ${iface.treeTime.toFixed(6)}`);
    assert.equal(iface.badEdges, 0, `简化图边价全部有限（坏边 ${iface.badEdges}）`);
    assert.ok(iface.compression > 0 && iface.compression < 1, `简化图压缩 ${(iface.compression * 100).toFixed(1)}%（${iface.nodes}/${iface.walkable}）`);
    assert.ok(iface.directed > 0, `简化图里有向价差边 ${iface.directed} 条（河段顺/逆不同价）`);
    assert.ok(iface.flatPairs > 50, `平床河格边 ${iface.flatPairs} 对（这些边没有高差可用，方向只能来自 carve 顺序）`);
    assert.equal(iface.priceBad, 0, `平床河格 顺/逆 价格比全部精确 = 0.3/0.65（坏 ${iface.priceBad}/${iface.flatPairs}）`);

    /* ---------- 3) 反证：整段往返的时间比必须明显 < 1 ----------
       主干两端的最短路会借一段陆地缓坡（1.25）绕行，所以整段比值天然被稀释到 0.5–0.8；
       真正证明「价格是活的」用上面那条逐边口径（0.3/0.65 精确）。若优惠没生效，这两个数都会≈1。 */
    const ratio = await p2.evaluate(() => {
      const r = window.__c09routeProbe(0);
      return { tDown: r.tDown, tUp: r.tUp, ratio: r.tDown / r.tUp, speedup: r.speedup, steps: r.steps };
    });
    assert.ok(ratio.ratio > 0.3 && ratio.ratio < 0.85, `顺/逆 整段时间比 ${ratio.ratio.toFixed(3)}（远处有绕行，落在 0.3–0.85）`);
    assert.ok(ratio.speedup > 1.5, `沿河 ×${ratio.speedup.toFixed(2)} 快于沿路步行`);

    assert.deepEqual(errors, [], 'no console errors');
    fs.writeFileSync('artifacts/coverage/river-nav-sphere-browser.json', JSON.stringify({ reports, iface, ratio, errors }, null, 2));
    console.log('PASS river-nav-sphere', JSON.stringify({
      reports: reports.map((r) => ({ seed: r.seed, edges: r.edges, down: r.down, conf: r.confluences, tDown: +r.tDown.toFixed(3), tUp: +r.tUp.toFixed(3), speedup: +r.speedup.toFixed(2), upDown: +r.upDownRatio.toFixed(2), detour: +r.detourRatio.toFixed(3), paths: r.pathCount, treeRiver: r.treeEdgesOnRiver })),
      iface: { pathCost: +iface.pathCost.toFixed(6), tree: +iface.treeTime.toFixed(6), compression: +iface.compression.toFixed(3), directed: iface.directed, flatPairs: iface.flatPairs, priceBad: iface.priceBad },
      ratio: +ratio.ratio.toFixed(3),
    }));
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });

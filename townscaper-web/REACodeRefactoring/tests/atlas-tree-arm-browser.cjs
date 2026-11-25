// 运行验收：atlas-tree-c09.html（1765115069837221962「visualizing the recursive tree parsing as it adds new rects.
// Note that when the board is more fragmented the arm tends to have more fingers.」）
// 口径：臂必须由「真实树碰撞查询」的 trace 画出来（手指数 == 查询真正走到的叶子数），不是模拟生长；
// 板子越碎（freeLeaves 涨）手臂手指越多；跨叶放置真的发生（一个槽吃掉 ≥2 片叶子）；2D/3D 两态都从页面画出来。
const { chromium } = require('playwright'), assert = require('node:assert/strict'), fs = require('fs');
const BASE = 'http://127.0.0.1:8769/atlas-tree-c09.html';
const OUT = 'artifacts/coverage/atlas-tree-arm-browser.json';

(async () => {
  const b = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const p = await b.newPage({ viewport: { width: 900, height: 900 } });
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  const out = {};
  // 画布像素统计：直接读页面 2D canvas（就是屏幕上那张图）
  const pixels = () => p.evaluate(() => {
    const cv = window.atlasTree.canvas(), g = cv.getContext('2d');
    const d = g.getImageData(0, 0, cv.width, cv.height).data;
    let cyan = 0, ink = 0, dark = 0, half = 0;
    const hist = new Map();
    const total = cv.width * cv.height;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], gg = d[i + 1], bb = d[i + 2];
      if (r < 140 && gg > 170 && bb > 180) cyan++;              // #3ee6f0 手臂
      const k = (r >> 4) + ',' + (gg >> 4) + ',' + (bb >> 4);
      hist.set(k, (hist.get(k) || 0) + 1);
      if (r + gg + bb < 260) dark++;
      if (Math.abs(r - 123) + Math.abs(gg - 131) + Math.abs(bb - 129) > 24) { ink++; if ((i / 4) < total / 2) half++; }
    }
    const rects = [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, n]) => ({ rgb: k, n }));
    return { w: cv.width, h: cv.height, cyan, ink, dark, half, top: rects };
  });
  const board = () => p.evaluate(() => window.atlasTree.st.live.map((s) => [s.x, s.y, s.w, s.h]));

  try {
    // ① 早期：臂的几何必须来自 trace（逐段轴对齐、父下标递增、手指 == free+used 叶）
    await p.goto(BASE + '?auto=0&steps=0&seed=7&arm=1');
    await p.waitForFunction(() => window.atlasTree);
    const stepOnce = () => p.evaluate(() => {
      const T = window.atlasTree; T.step();
      const L = T.st.last;
      if (!L || !L.trace) return null;
      const tr = L.trace;
      return {
        fingers: L.arm.fingers, segs: L.arm.segments.length, pruned: L.arm.pruned, reach: L.arm.reach,
        trace: tr.length, free: tr.filter((e) => e.decision === 'free').length,
        used: tr.filter((e) => e.decision === 'used').length, outside: tr.filter((e) => e.decision === 'outside').length,
        branch: tr.filter((e) => e.decision === 'branch').length,
        parentsOK: tr.every((e, i) => e.parent < i), depths: tr.map((e) => e.depth),
        axisAligned: L.arm.segments.every(([x0, y0, x1, y1]) => (Math.abs(y0 - y1) < 1e-9) || (Math.abs(x0 - x1) < 1e-9)),
        inBoard: L.arm.segments.every((s) => s.every((v) => v >= 0 && v <= 512)),
        tried: L.tried, placed: !!L.slot, freeLeaves: T.st.atlas.report().freeLeaves,
      };
    });
    const steps = [];
    for (let i = 0; i < 150; i++) { const s = await stepOnce(); if (s) steps.push(s); }
    await p.evaluate(() => window.atlasTree.draw());
    const check = steps.filter((s) => s.placed);
    out.arm = {
      steps: check.length, first: check[0], last: check[check.length - 1],
      allParentOrder: check.every((s) => s.parentsOK), allAxis: check.every((s) => s.axisAligned),
      allInBoard: check.every((s) => s.inBoard), allFingersMatch: check.every((s) => s.fingers === s.free + s.used),
      allPrunedMatch: check.every((s) => s.pruned === s.outside), maxReach: Math.max(...check.map((s) => s.reach)),
      maxTrace: Math.max(...check.map((s) => s.trace)),
    };
    assert.ok(check.length > 140, '150 步里至少 140 次真的落位');
    assert.ok(out.arm.allFingersMatch, '手指数必须 == 这次查询真正走到的叶子数（free+used）');
    assert.ok(out.arm.allPrunedMatch, '被包围盒剪掉的枝数必须 == trace 的 outside 事件数');
    assert.ok(out.arm.allParentOrder, 'trace 的 parent 下标必须递增（真实递归解析，不是事后编排）');
    assert.ok(out.arm.allAxis, '手臂必须是直角折线（先横后竖）');
    assert.ok(out.arm.allInBoard, '手臂段必须落在板子范围内');
    assert.ok(out.arm.maxReach >= 3, '碎片化后手臂要伸到树深处（reach≥3）');
    const statText = await p.locator('#st').innerText();
    assert.match(statText, /本次手指 \d+/);
    out.statText = statText;
    const fragShot = await p.screenshot({ path: 'artifacts/coverage/atlas-tree-arm-frag-r155.png' });
    const pxFrag = await pixels();
    const boardFrag = await board();
    out.px = { frag: pxFrag };

    // ② 「板子越碎 → 手指越多」：早 20 次 vs 末 20 次（freeLeaves 涨、手指涨、试的候选数暴涨）
    const mean = (a, k) => a.reduce((s, x) => s + x[k], 0) / a.length;
    const early = check.slice(0, 20), late = check.slice(-20);
    out.fragment = {
      earlyFingers: mean(early, 'fingers'), lateFingers: mean(late, 'fingers'),
      earlyFreeLeaves: mean(early, 'freeLeaves'), lateFreeLeaves: mean(late, 'freeLeaves'),
      earlyTried: mean(early, 'tried'), lateTried: mean(late, 'tried'),
      earlyTrace: mean(early, 'trace'), lateTrace: mean(late, 'trace'),
    };
    assert.ok(out.fragment.lateFreeLeaves > out.fragment.earlyFreeLeaves * 2, '末段空闲叶至少翻倍（板子真的更碎）');
    assert.ok(out.fragment.lateFingers > out.fragment.earlyFingers * 1.5, '碎片化后手指数上升（原片那句话）');
    assert.ok(out.fragment.lateTried > out.fragment.earlyTried * 5, '碎片化后要试的候选数暴涨');

    // ③ 跨叶放置：一个槽吃掉 ≥2 片叶子（allocateAt 可跨叶），且面积守恒；已放块永不移动
    const cross = await p.evaluate(() => {
      const T = window.atlasTree, rows = [];
      for (const s of T.st.live) {
        const leaves = T.leavesInSlot(s);
        const area = leaves.reduce((n, l) => n + l.w * l.h, 0);
        rows.push({ n: leaves.length, area, slotArea: s.w * s.h, used: leaves.every((l) => l.used) });
      }
      return rows;
    });
    out.crossLeaf = {
      slots: cross.length, multi: cross.filter((r) => r.n > 1).length,
      maxLeaves: Math.max(...cross.map((r) => r.n)),
      areaExact: cross.every((r) => r.area === r.slotArea),
      allUsed: cross.every((r) => r.used),
      hist: cross.reduce((m, r) => (m[r.n] = (m[r.n] || 0) + 1, m), {}),
    };
    assert.ok(out.crossLeaf.multi >= 10, '跨叶槽应常见（≥10 个）');
    assert.ok(out.crossLeaf.maxLeaves >= 3, '至少有一个槽吃掉 3 片以上叶子');
    assert.ok(out.crossLeaf.areaExact, '槽内叶子面积之和必须 == 槽面积（跨叶是真拼起来的）');
    assert.ok(out.crossLeaf.allUsed, '槽内叶子都必须标 used');
    const before = await board();
    await p.evaluate(() => { for (let i = 0; i < 10; i++) window.atlasTree.step(); });
    const after = await board();
    out.stable = { before: before.length, after: after.length, moved: before.some((r, i) => JSON.stringify(r) !== JSON.stringify(after[i])) };
    assert.equal(out.stable.moved, false, '存活槽不许随新放置移动');
    assert.ok(out.stable.after > out.stable.before);

    // ④ 早期态截图（板子还很空，手指少）
    await p.goto(BASE + '?auto=0&steps=6&seed=7&arm=1');
    await p.waitForFunction(() => window.atlasTree && window.atlasTree.st.live.length >= 5);
    await p.evaluate(() => window.atlasTree.draw());
    await p.screenshot({ path: 'artifacts/coverage/atlas-tree-arm-early-r155.png' });
    const pxEarly = await pixels();
    out.px.early = pxEarly;
    assert.ok(pxEarly.cyan > 0 && pxFrag.cyan > 0, '两态画面上都要有青色手臂');

    // ⑤ arm=0 对照：同一块板、只关手臂 → 青色像素归零、差分集中在细线
    await p.goto(BASE + '?auto=0&steps=150&seed=7&arm=0');
    await p.waitForFunction(() => window.atlasTree && window.atlasTree.st.live.length > 140);
    await p.evaluate(() => window.atlasTree.draw());
    await p.screenshot({ path: 'artifacts/coverage/atlas-tree-arm-off-r155.png' });
    const pxOff = await pixels();
    const boardOff = await board();
    out.ab = { on: { cyan: pxFrag.cyan, ink: pxFrag.ink }, off: { cyan: pxOff.cyan, ink: pxOff.ink } };
    assert.equal(pxOff.cyan, 0, 'arm=0 时画布上不许有青色手臂像素');
    assert.ok(pxFrag.cyan > 500, 'arm=1 时青色手臂像素要成规模（>500）');
    out.ab.sameBoard = JSON.stringify(boardOff) === JSON.stringify(boardFrag);
    assert.ok(out.ab.sameBoard, 'arm=0 与 arm=1 必须是同一块板（只差手臂）');

    // ⑥ 3D 展开：根在最上、按深度一层层往下叠；投影对 z 单调；画面上半部真的画了节点框
    await p.goto(BASE + '?view=3d&auto=0&steps=60&seed=7');
    await p.waitForFunction(() => window.atlasTree);
    const layers = await p.evaluate(() => {
      const T = window.atlasTree, L = T.treeLayers(), S = 512;
      const gap = 512 * 0.75 / Math.max(1, L.maxDepth), pitch = 38 * Math.PI / 180, yaw = 35 * Math.PI / 180;
      const opt = { yaw, pitch, cx: S / 2, cy: S / 2, scale: 1 };
      const z = (d) => (L.maxDepth - d + 1) * gap;
      const byDepth = new Map();
      for (const n of L.nodes) {
        const v = T.project3D(n.x + n.w / 2, n.y + n.h / 2, z(n.depth), opt)[1];
        if (!byDepth.has(n.depth)) byDepth.set(n.depth, []);
        byDepth.get(n.depth).push(v);
      }
      const meanV = [...byDepth.entries()].sort((a, b) => a[0] - b[0]).map(([d, vs]) => [d, vs.reduce((s, x) => s + x, 0) / vs.length]);
      const monoZ = [T.project3D(256, 256, 0, opt)[1], T.project3D(256, 256, 100, opt)[1], T.project3D(256, 256, 200, opt)[1]];
      // 每个节点都必须画在自己板面足迹的上方（层叠方向），同一 (x,y) 下 z 越大越高
      const above = L.nodes.filter((n) => n.depth > 0).map((n) => {
        const v0 = T.project3D(n.x + n.w / 2, n.y + n.h / 2, 0, opt)[1];
        const v1 = T.project3D(n.x + n.w / 2, n.y + n.h / 2, z(n.depth), opt)[1];
        return v0 - v1;
      });
      const rises = meanV.filter((row, i) => i > 0 && row[1] > meanV[i - 1][1]).length;
      return { nodes: L.nodes.length, branches: L.branches.length, maxDepth: L.maxDepth, leaves: L.nodes.filter((n) => n.leaf).length,
        meanV: meanV.slice(0, 8), meanVAll: meanV, monoZ, gap,
        liftMin: Math.min(...above), liftMean: above.reduce((s, x) => s + x, 0) / above.length,
        span: Math.abs(meanV[meanV.length - 1][1] - meanV[0][1]), rises };
    });
    out.layers = layers;
    assert.equal(layers.branches, layers.nodes - 1, '树：branch 数必须 == 节点数-1（一棵真树）');
    assert.ok(layers.maxDepth >= 8, '3D 展开至少 8 层');
    assert.ok(layers.monoZ[2] < layers.monoZ[1] && layers.monoZ[1] < layers.monoZ[0], 'z 越大画得越高（层叠方向）');
    const mono = layers.monoZ[2] < layers.monoZ[1] && layers.monoZ[1] < layers.monoZ[0];
    out.layers.monoZ = mono;
    assert.ok(mono, 'z 越大画得越高（层叠方向）');
    assert.ok(layers.liftMin > 0.5, '每个非根节点都必须叠在自己板面足迹上方（层叠方向统一）');
    assert.ok(layers.span > 150, '根层到最深层要有明显竖向跨度（>150px）');
    out.layers.spanOK = layers.span;
    assert.ok(layers.meanVAll.every((row, i) => i === 0 || row[1] > layers.meanVAll[0][1]), '根层（深度 0）必须比其余每一层的平均落点都高（根在最上）');
    // 逐层竖向间距 gap·cos(pitch) ≈ 11px，小于节点位置带来的 ±160px 摆动 —— 单步比较没意义，
    // 按「浅 5 层 vs 深 5 层」看整体趋势（rises 只作为读数如实记录，不作断言）。
    const shallow = layers.meanVAll.slice(0, 5), deep = layers.meanVAll.slice(-5);
    const m5 = (a) => a.reduce((s, r) => s + r[1], 0) / a.length;
    out.layers.trend = { shallow: m5(shallow), deep: m5(deep), rises: layers.rises };
    assert.ok(m5(deep) - m5(shallow) > 100, '深 5 层必须整体落在浅 5 层之下（>100px）');
    await p.evaluate(() => window.atlasTree.draw());
    await p.screenshot({ path: 'artifacts/coverage/atlas-tree-3d-r155.png' });
    const px3d = await pixels();
    out.px.d3 = px3d;
    assert.ok(px3d.half > 3000, '3D 画面上半部必须有大量节点框像素（不是空背景）');
    assert.ok(px3d.top.some((t) => t.rgb === '7,8,8'), '3D 背景应为 #7b8381 一档');

    // ⑦ 噪声：同一 URL 重开一次 → 像素差 0（臂来自确定性序列）
    await p.goto(BASE + '?auto=0&steps=150&seed=7&arm=1');
    await p.waitForFunction(() => window.atlasTree && window.atlasTree.st.live.length > 140);
    await p.evaluate(() => window.atlasTree.draw());
    const pxAgain = await pixels();
    out.noise = { cyan: pxAgain.cyan, ink: pxAgain.ink, sameAsOn: pxAgain.cyan === pxFrag.cyan && pxAgain.ink === pxFrag.ink };
    assert.ok(out.noise.sameAsOn, '同一 URL 重开：像素统计必须一致（噪声 0）');
    assert.deepEqual(errors, []);
    fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
    console.log('PASS atlas-tree arm-from-trace / fragmentation→fingers / cross-leaf slots / 2D+3D / arm=0 A/B / 0 error');
    console.log(JSON.stringify({ arm: { steps: out.arm.steps, maxTrace: out.arm.maxTrace, maxReach: out.arm.maxReach },
      fragment: out.fragment, crossLeaf: out.crossLeaf, ab: out.ab, layers: { nodes: layers.nodes, maxDepth: layers.maxDepth, mono },
      px: { early: { cyan: pxEarly.cyan, ink: pxEarly.ink }, frag: { cyan: pxFrag.cyan, ink: pxFrag.ink }, off: { cyan: pxOff.cyan, ink: pxOff.ink }, d3: { half: px3d.half } } }, null, 1));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });

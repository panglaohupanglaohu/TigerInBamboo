// 运行验收：atlas-tree-c09.html —— 1764958522398146667「A cute binary tree rect packer」
// 口径（按片子的三段镜头，一镜一断言）：
//   ① 0018–0049（2D）：块从板子**左下角**开始堆，板上浅色树线把空间切成叶，落位处有黄框 + 青色手臂；
//   ② 0050–0269（3D）：每层节点框叠在板子上方（根最上、按深度往下），白色树枝只连相邻层；
//   ③ 0270–0295（回到近俯视）：层叠被压扁成「梳齿」，但仍画在板面上（不是切回 2D 图）。
// 现有 tests/atlas-tree-arm-browser.cjs 只量了手臂/碎片/3D 层高，未量 ①③ 两段与树线可见性。
const { chromium } = require('playwright'), assert = require('node:assert/strict'), fs = require('fs');
const BASE = 'http://127.0.0.1:8769/atlas-tree-c09.html';
const OUT = 'artifacts/coverage/atlas-tree-phases-browser.json';

(async () => {
  const b = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const p = await b.newPage({ viewport: { width: 900, height: 900 } });
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  const out = {};

  // 画布读数（这是 2D canvas，可以直接 getImageData）：黄框 / 青臂 / 浅色树线 / 白树枝 / 彩块 / 上半部墨量
  const px = () => p.evaluate(() => {
    const cv = window.atlasTree.canvas(), g = cv.getContext('2d');
    const d = g.getImageData(0, 0, cv.width, cv.height).data, W = cv.width, H = cv.height;
    let yellow = 0, cyan = 0, pale = 0, bright = 0, color = 0, halfInk = 0;
    let minX = W, maxX = -1, minY = H, maxY = -1;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], gg = d[i + 1], bb = d[i + 2], idx = i / 4, x = idx % W, y = (idx / W) | 0;
      const mx = Math.max(r, gg, bb), mn = Math.min(r, gg, bb);
      if (r > 200 && gg > 185 && bb < 140) yellow++;                     // #f2e64a 落位黄框
      if (r < 140 && gg > 170 && bb > 180) cyan++;                       // #3ee6f0 手臂
      if (r > 190 && gg > 190 && bb > 190 && mx - mn < 26) pale++;        // 浅色树线 rgba(240,246,244,.55)
      if (r > 225 && gg > 225 && bb > 225 && mx - mn < 20) bright++;      // 3D 白树枝 rgba(255,255,255,.9)
      const isBg = Math.abs(r - 123) + Math.abs(gg - 131) + Math.abs(bb - 129) < 18 ||
                   Math.abs(r - 61) + Math.abs(gg - 59) + Math.abs(bb - 74) < 18;
      if (!isBg) { if (y < H / 2) halfInk++; }
      if (mx - mn > 24 && mx > 90 && mx < 240) { color++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    }
    return { W, H, yellow, cyan, pale, bright, color, halfInk, box: [minX, minY, maxX, maxY] };
  });
  const live = () => p.evaluate(() => window.atlasTree.st.live.map((r) => [r.x, r.y, r.w, r.h]));
  const geo = () => p.evaluate(() => {
    const T = window.atlasTree, L = T.treeLayers(), S = 512;
    const gap = 512 * .75 / Math.max(1, L.maxDepth);
    const q = new URLSearchParams(location.search);
    const pitch = (+q.get('pitch')) * Math.PI / 180, yaw = (+q.get('yaw')) * Math.PI / 180;
    const opt = { yaw, pitch, cx: S / 2, cy: S / 2, scale: 1 }, z = (d) => (L.maxDepth - d + 1) * gap;
    const by = new Map();
    for (const n of L.nodes) {
      const v = T.project3D(n.x + n.w / 2, n.y + n.h / 2, z(n.depth), opt)[1];
      if (!by.has(n.depth)) by.set(n.depth, []);
      by.get(n.depth).push(v);
    }
    const rows = [...by.entries()].sort((a, b) => a[0] - b[0]).map(([d, vs]) => [d, vs.reduce((s, x) => s + x, 0) / vs.length]);
    return { nodes: L.nodes.length, branches: L.branches.length, leaves: L.nodes.filter((n) => n.leaf).length,
      maxDepth: L.maxDepth, layers: by.size, span: Math.abs(rows[rows.length - 1][1] - rows[0][1]),
      rootHighest: rows[0][1] < Math.min(...rows.slice(1).map((r) => r[1])) };
  });

  try {
    // ① 2D：底-左起堆 + 浅色树线 + 黄框 + 青臂
    await p.goto(BASE + '?auto=0&steps=18&seed=7&view=arm');
    await p.waitForFunction(() => window.atlasTree);
    await p.evaluate(() => window.atlasTree.draw());
    const l18 = await live();
    const a = await px();
    const st18 = await p.textContent('#st');
    await p.screenshot({ path: 'artifacts/coverage/atlas-tree-phases-2d-r196.png' });
    out.phase2d = { n: l18.length, minX: Math.min(...l18.map((r) => r[0])), minY: Math.min(...l18.map((r) => r[1])),
      maxTop: Math.max(...l18.map((r) => r[1] + r[3])), px: a, st: st18 };
    assert.ok(l18.length >= 15, '2D 段至少要摆下 15 块');
    assert.equal(out.phase2d.minX, 0, '第一块必须贴左边界（底-左顺序）');
    assert.equal(out.phase2d.minY, 0, '第一块必须贴下边界（板子 y=0 画在底边）');
    assert.ok(a.pale > 300, '2D 画面上必须看得到浅色树线（片 0030 原尺寸：板上是浅色细线）');
    assert.ok(a.yellow > 80, '落位处必须有黄框');
    assert.ok(a.cyan > 300, '落位处必须有青色手臂');
    assert.match(st18, /树深 \d+/);

    // ② 3D（片内机位 pitch≈38°）：根最上、按深度往下叠、白树枝、彩块在板面上
    await p.goto(BASE + '?view=3d&auto=0&steps=60&seed=7&pitch=38&yaw=35');
    await p.waitForFunction(() => window.atlasTree);
    await p.evaluate(() => window.atlasTree.draw());
    const g38 = await geo(), p38 = await px();
    await p.screenshot({ path: 'artifacts/coverage/atlas-tree-phases-3d38-r196.png' });
    out.phase3d = { geo: g38, px: p38 };
    assert.equal(g38.branches, g38.nodes - 1, '树：树枝数必须 == 节点数−1');
    assert.equal(g38.layers, g38.maxDepth + 1, '层数 == 树深+1（每深度一层）');
    assert.equal(g38.leaves, await p.evaluate(() => window.atlasTree.st.atlas.report().leaves), '叶数 == 共享 Atlas 的 report.leaves');
    assert.ok(g38.rootHighest, '根层必须比其余每一层都高（根在最上）');
    assert.ok(g38.span > 150, '根层到最深层要有明显竖向跨度（>150px）');
    assert.ok(p38.halfInk > 20000, '3D 画面上半部必须有成规模的节点框像素');
    assert.ok(p38.bright > 1000, '白色树枝必须成规模（>1000px）');
    assert.ok(p38.color > 20000, '板面上必须有彩色已放块');
    assert.ok(p38.yellow > 80, '3D 段落位处也保留黄框（片 0140 左下角黄框）');

    // ③ 近俯视（片 0270–0295）：层叠被压扁成梳齿，但仍在板面上、彩块不变
    await p.goto(BASE + '?view=3d&auto=0&steps=60&seed=7&pitch=86&yaw=35');
    await p.waitForFunction(() => window.atlasTree);
    await p.evaluate(() => window.atlasTree.draw());
    const g86 = await geo(), p86 = await px();
    await p.screenshot({ path: 'artifacts/coverage/atlas-tree-phases-3d86-r196.png' });
    out.phaseTop = { geo: g86, px: p86, spanRatio: g86.span / g38.span };
    assert.equal(g86.nodes, g38.nodes, '同一块板：节点数不变（只换机位）');
    assert.ok(out.phaseTop.spanRatio < 0.45, 'near-top: 层间竖向跨度必须压到 38° 的 45% 以下（当前 ' + out.phaseTop.spanRatio.toFixed(3) + '）');
    assert.ok(p86.halfInk < p38.halfInk * .6, 'near-top: 上半部墨量必须明显低于 38°（梳齿压到板面上）');
    assert.ok(p86.halfInk > 8000, 'near-top: 仍要画节点框（不是切回 2D 图，片里梳齿一直在）');
    assert.ok(p86.color > p38.color * .7, 'near-top: 彩色板面必须还在（没被压没）');

    // ④ 噪声：同一 URL 重开 → 像素读数逐位相同
    await p.goto(BASE + '?view=3d&auto=0&steps=60&seed=7&pitch=38&yaw=35');
    await p.waitForFunction(() => window.atlasTree);
    await p.evaluate(() => window.atlasTree.draw());
    const again = await px();
    out.noise = { same: again.yellow === p38.yellow && again.color === p38.color && again.bright === p38.bright };
    assert.ok(out.noise.same, '同一 URL 重开：黄框/彩块/树枝像素数必须一致（噪声 0）');
    assert.deepEqual(errors, []);

    fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
    console.log('PASS atlas-tree 三段镜头（底-左起堆→3D 分层树→近俯视梳齿）+ 树线可见 + 噪声 0');
    console.log(JSON.stringify({ p2d: { n: out.phase2d.n, pale: a.pale, yellow: a.yellow, cyan: a.cyan, maxTop: out.phase2d.maxTop },
      p3d: { nodes: g38.nodes, layers: g38.layers, span: +g38.span.toFixed(1), halfInk: p38.halfInk, bright: p38.bright, color: p38.color },
      pTop: { span: +g86.span.toFixed(1), ratio: +out.phaseTop.spanRatio.toFixed(3), halfInk: p86.halfInk, color: p86.color } }, null, 1));
  } finally { await b.close(); }
})();

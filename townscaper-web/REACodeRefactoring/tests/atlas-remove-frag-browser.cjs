// 运行验收：1765041830461055127「Now supports removing rects too! The bin space gets quite fragmented after a while
// though.. I've tried to optimize it on the fly but I can't figure out how to when it get sort of interlocked.
// Still packs tight though!」
// 口径：① 删除真的生效且重复/伪造/跨实例释放被拒；② 删多了空间确实碎（空闲叶数与小叶数上涨、最大空闲块占比掉下来）；
// ③ 只在「两个子节点都空」时向上合并（自底向上），不做随时的全局重排；④ 碎了以后仍然塞得进新块（still packs tight）。
const { chromium } = require('playwright'), assert = require('node:assert/strict'), fs = require('fs');
const BASE = 'http://127.0.0.1:8769/atlas-tree-c09.html';
const OUT = 'artifacts/coverage/atlas-remove-browser.json';

(async () => {
  const b = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const p = await b.newPage({ viewport: { width: 900, height: 900 } });
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  const out = {};
  // 板面空白（#3d3b4a）像素数 = 未被块占住的洞；板子内部才算
  const holes = () => p.evaluate(() => {
    const T = window.atlasTree, cv = T.canvas(), g = cv.getContext('2d');
    const k = cv.width, m = k * .1, sc = (k - 2 * m) / 512;
    const x0 = m, y0 = k - m - 512 * sc, side = 512 * sc;
    const d = g.getImageData(Math.round(x0), Math.round(y0), Math.round(side), Math.round(side)).data;
    let bg = 0;
    for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - 61) < 6 && Math.abs(d[i + 1] - 59) < 6 && Math.abs(d[i + 2] - 74) < 6) bg++;
    return { px: d.length / 4, bg, share: bg / (d.length / 4) };
  });
  const snap = () => p.evaluate(() => {
    const T = window.atlasTree, R = T.st.atlas.report(), L = T.treeLayers();
    const free = L.nodes.filter((n) => n.leaf && !n.used).map((n) => n.w * n.h);
    return { live: T.st.live.length, fill: R.fill, leaves: R.leaves, freeLeaves: R.freeLeaves,
      largestShare: R.largestShare, largestFree: R.largestFree,
      tiny: free.filter((x) => x <= 256).length, small: free.filter((x) => x <= 1024).length,
      minFree: free.length ? Math.min(...free) : 0, freeArea: R.freeArea, usedArea: R.usedArea };
  });

  try {
    // ① 先加 140 块 → 基线（此时没删，空间还很整）
    await p.goto(BASE + '?auto=0&steps=140&seed=7');
    await p.waitForFunction(() => window.atlasTree && window.atlasTree.st.live.length > 130);
    await p.screenshot({ path: 'artifacts/coverage/atlas-remove-filled-r155.png' });
    const before = await snap(), holeBefore = await holes();
    out.before = before;

    // ② 打开删除，混合 60 步（页面里约 45% 走删除分支）→ 空间变碎
    const mix = await p.evaluate(() => {
      const T = window.atlasTree; T.st.removing = true;
      let add = 0, rem = 0;
      for (let i = 0; i < 60; i++) { const n0 = T.st.live.length; T.step(); if (T.st.live.length < n0) rem++; else if (T.st.live.length > n0) add++; }
      T.draw();
      return { add, rem };
    });
    await p.screenshot({ path: 'artifacts/coverage/atlas-remove-frag-r155.png' });
    const after = await snap(), holeAfter = await holes();
    out.mix = mix; out.mixed = after; out.holes = { before: holeBefore };
    assert.ok(mix.rem >= 15, '混合段里必须真的删掉 ≥15 块');
    assert.ok(mix.add >= 10, '混合段里也要继续加块（不是只删）');

    // ③ 单纯删 30 块（不补）：这才看得出「空间越删越碎」
    const rmOnly = await p.evaluate(() => {
      const T = window.atlasTree, A = T.st.atlas;
      let freed = 0;
      for (let i = 0; i < 30; i++) {
        const k = Math.floor(T.st.live.length * 0.5);   // 从中间往后挑，避免总删同一头
        const s = T.st.live[k]; if (!s) break;
        if (A.free(s)) { T.st.live.splice(k, 1); freed++; }
      }
      T.draw();
      return { freed, live: T.st.live.length };
    });
    const frag = await snap(), holeFrag = await holes();
    out.rmOnly = rmOnly; out.frag = frag; out.holes.frag = holeFrag;
    await p.screenshot({ path: 'artifacts/coverage/atlas-remove-holes-r155.png' });
    assert.equal(rmOnly.freed, 30, '30 次删除必须全部成功');
    assert.ok(frag.freeLeaves > before.freeLeaves, '删多了空闲叶数量上升（空间变碎）');
    assert.ok(frag.tiny > before.tiny + 5, '≤16×16 的小空洞变多（碎片化）');
    assert.ok(frag.largestShare < 0.2, '最大空闲块占空闲面积的比例很小（拼不到一起）');
    assert.ok(holeFrag.share - holeBefore.share > 0.03, "画面上的空白（洞）占比必须真的变大（>3 个百分点）");

    // ③ 碎了以后仍然塞得进（still packs tight）：关掉删除，继续加 40 块
    const tight = await p.evaluate(() => {
      const T = window.atlasTree; T.st.removing = false;
      const n0 = T.st.live.length, fill0 = T.st.atlas.report().fill;
      let ok = 0;
      for (let i = 0; i < 40; i++) { const l0 = T.st.live.length; T.step(); if (T.st.live.length > l0) ok++; }
      const R = T.st.atlas.report();
      return { tried: 40, placed: ok, live0: n0, live1: T.st.live.length, fill0, fill1: R.fill, used: R.usedArea, free: R.freeArea };
    });
    out.tight = tight;
    assert.ok(tight.placed >= 36, '碎片化后继续放 40 块，至少 36 块必须放得进去');
    assert.ok(tight.fill1 > tight.fill0, '继续放之后占用率要回升（不是无解）');

    // ④ 只在「两子全空」时向上合并：64×64 切成两半，逐块释放 → 最后一次释放才合并回根
    const coal = await p.evaluate(() => {
      const A = window.atlasTree.st.atlas.constructor, a = new A(64, 64);
      const x = a.allocate(32, 64), y = a.allocate(32, 64);
      const s0 = a.report().leaves; a.free(x); const s1 = a.report().leaves;
      a.free(y); const R = a.report();
      // 非兄弟的连锁：左边一整条 + 右边上下两块，先放两块小的再放大的
      const c = new A(64, 64), L = c.allocate(32, 64), T = c.allocate(32, 32), Bo = c.allocate(32, 32);
      const t0 = c.report().leaves; c.free(T); const t1 = c.report().leaves; c.free(Bo); const t2 = c.report().leaves;
      c.free(L); const t3 = c.report();
      return { s0, s1, s2: R.leaves, freeArea: R.freeArea, largest: R.largestFree,
        chain: [t0, t1, t2, t3.leaves], chainFree: t3.freeArea, chainLargest: t3.largestFree };
    });
    out.coalesce = coal;
    assert.equal(coal.s0, 2, '两块各占一半时叶子 2 片');
    assert.equal(coal.s1, 2, '只放掉一半时不能合并（兄弟还占着）');
    assert.equal(coal.s2, 1, '两块都放掉后必须合并回根（1 片叶）');
    assert.equal(coal.freeArea, 64 * 64, '合并后整块板都空出来');
    assert.deepEqual(coal.chain, [3, 3, 2, 1], '自底向上逐级合并：3 → 3 → 2 → 1');
    assert.equal(coal.chainFree, 64 * 64, '连锁释放后同样整块空出');

    // ⑤ 重复 / 伪造 / 跨实例释放必须被拒，存活块坐标不动
    const guard = await p.evaluate(() => {
      const A = window.atlasTree.st.atlas.constructor;
      const a = new A(64, 64), other = new A(64, 64), h = a.allocate(16, 16), hi = other.allocate(16, 16);
      const rectsOf = (x) => JSON.stringify(x.rects());
      const first = a.free(h);
      const r0 = rectsOf(a);                       // 合法释放之后的状态，后面不许再变
      const twice = [first, a.free(h)];
      const forged = a.free({ x: 0, y: 0, w: 16, h: 16 });
      const foreign = a.free(hi);
      return { twice, forged, foreign, unchanged: rectsOf(a) === r0, otherAlive: other.rects().length };
    });
    out.guard = guard;
    assert.deepEqual(guard.twice, [true, false], '同一 handle 只能释放一次');
    assert.equal(guard.forged, false, '伪造的 handle 不能释放');
    assert.equal(guard.foreign, false, '别的实例的 handle 不能释放');
    assert.ok(guard.unchanged, '被拒的释放不许改动存活块');
    assert.equal(guard.otherAlive, 1);

    // ⑥ 页面读数与树结构自洽
    const stText = await p.locator('#st').innerText();
    out.stText = stText;
    assert.match(stText, /块 · 占用 \d/);
    assert.match(stText, /空闲叶 \d+\/\d+/);
    assert.deepEqual(errors, []);
    fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
    console.log('PASS remove works + fragmented space + still packs tight + sibling-only coalescing + stale/foreign release rejected');
    console.log(JSON.stringify({ before: { live: before.live, fill: before.fill, freeLeaves: before.freeLeaves, tiny: before.tiny },
      mixed: { live: after.live, fill: after.fill, freeLeaves: after.freeLeaves },
      frag: { live: frag.live, fill: frag.fill, freeLeaves: frag.freeLeaves, tiny: frag.tiny, largestShare: frag.largestShare, minFree: frag.minFree },
      holes: { beforeShare: holeBefore.share, fragShare: holeFrag.share }, mix, rmOnly, tight, coalesce: out.coalesce, guard: out.guard, stText }, null, 1));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });

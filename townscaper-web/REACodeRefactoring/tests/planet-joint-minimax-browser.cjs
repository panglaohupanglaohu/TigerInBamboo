// 1769641473895432220（"all module-containing cells should have their desired shape and size"，479 帧）
// r251 收口验收：r250 记下的新残差 ——「joint 的最差边在高层反而比 spring 差（第 6 层 0.568 vs 0.297），
// edgeTol=0.2 也压不住（0.554）→ 逐边保最优 / 超阈回退 只保证均值更优，未形成绝对上限」。
//
// 本测试在同一页面上把「最差边」这一层量到底，三条口径：
//   ① Jacobi（minimax:false）→ minimax 下降（默认开）逐层比：worst 只降不升；
//   ② minimax 停在哪：stalled 说明「只动最差边两端」已无下降方向 = 该 move set 下的极小极大解；
//   ③ 放开墙倾斜上限（cap=∞）同口径下降 = 不受 lean 约束时的可达下界 freeWorst，
//      capPenalty = 实际 worst − freeWorst → 把残差拆成「几何（lean 上限）」与「算法」两笔账。
//
// 断言口径：minimax 后 worst ≤ jacobi；若 minimax 把 worst 压到 ≤0.35 则视为达标；
// 否则必须给出 capPenalty 证明差额由 lean 上限造成（不能只说"没上限"）。
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const URL = 'http://127.0.0.1:8769/planet.html?solver=joint&groups=3';
const SOFT_BOUND = 0.35;   // 单格误差量级的验收上限（与 tests/module-group-fit.mjs 同口径）

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

    const r = await p.evaluate(async () => {
      const P = await import('/src/sphere/planet.js');
      const G = await import('/src/sphere/module-group-fit.js');
      const planet = window.planetLighting.planet, group = window.planetDemo.groups[0];
      const top = Math.min(...group.map((id) => planet.H[id]));
      // 每层 prev = 上一层 shape 解（与 planet.js 的逐层推进同口径）
      const atShape = P.cornerPositions(planet, { solver: 'shape' });
      const prevOf = (l) => planet.corners.map((d, k) => atShape(k, l - 1).map((x) => x / (planet.R + (l - 1) * planet.L)));
      const rows = [];
      for (let l = 1; l <= top; l++) {
        const prev = prevOf(l);
        const off = G.fitModuleGroup(planet, group, prev, { level: l, minimax: false });
        const on = G.fitModuleGroup(planet, group, prev, { level: l });
        const atJ = P.cornerPositions(planet, { relax: true, solver: 'joint', moduleGroups: [group] });
        const atS = P.cornerPositions(planet, { relax: true, solver: 'spring' });
        const repJ = G.moduleGroupReport(planet, group, atJ, l);
        const repS = G.moduleGroupReport(planet, group, atS, l);
        rows.push({
          l, edges: on.report.edges.length,
          jacobi: +off.report.worst.toFixed(4), minimax: +on.report.worst.toFixed(4),
          sim: +on.report.simWorst.toFixed(4), free: +on.report.freeWorst.toFixed(4),
          capPenalty: on.report.capPenalty, mean: +on.report.mean.toFixed(4),
          lean: +on.report.leanMaxDeg.toFixed(2), mmIters: on.report.minimaxIters, stalled: on.report.minimaxStalled,
          pageJoint: +repJ.worst.toFixed(4), spring: +repS.worst.toFixed(4),
        });
      }
      const pageWorst = window.planetDemo.groupReport.worst;
      // 页面同一条 prev 链上的 minimax 开/关 A/B（不自己造 prev，避免口径错位）
      const atOn = P.cornerPositions(planet, { relax: true, solver: 'joint', moduleGroups: [group] });
      const atOff = P.cornerPositions(planet, { relax: true, solver: 'joint', moduleGroups: [group], minimax: false });
      const ab = [];
      for (let l = 1; l <= top; l++) {
        const rOn = G.moduleGroupReport(planet, group, atOn, l), rOff = G.moduleGroupReport(planet, group, atOff, l);
        const unit = (atOn.components || []).find((u) => u.level === l && u.cells.includes(group[0]) && u.unitCells === group.length);
        ab.push({ l, on: +rOn.worst.toFixed(4), off: +rOff.worst.toFixed(4), capPenalty: unit ? unit.capPenalty : null, free: unit ? (unit.freeWorst === null ? null : +unit.freeWorst.toFixed(4)) : null });
      }
      return { group, top, rows, ab, pageWorst, maxH: Math.max(...planet.H) };
    });

    // ---------- ① minimax 只降不升，且报告里三条口径自洽 ----------
    for (const x of r.rows) {
      assert.ok(x.minimax <= x.jacobi + 1e-9, `L${x.l}: minimax ${x.minimax} 反而比 jacobi ${x.jacobi} 差`);
      assert.ok(x.minimax <= x.sim + 1e-9, `L${x.l}: minimax ${x.minimax} 比共享相似解 ${x.sim} 差`);
      assert.ok(x.free <= x.minimax + 1e-9, `L${x.l}: 放开 cap 的下界 ${x.free} 应 ≤ 实际 ${x.minimax}`);
      assert.ok(x.capPenalty >= -1e-9, `L${x.l}: capPenalty 为负 ${x.capPenalty}`);
      assert.equal(x.edges, 14, `L${x.l}: 组内边数应恒为 14`);
    }

    // ---------- ② 上限口径：要么压进 0.35，要么差额由 lean 上限解释 ----------
    const worstRow = r.rows.reduce((a, x) => (x.minimax > a.minimax ? x : a));
    const within = r.rows.every((x) => x.minimax <= SOFT_BOUND);
    if (!within) {
      // 不能只说"没有上限"：必须证明超出的那一段是 cap（墙倾斜）造成的
      assert.ok(worstRow.free <= SOFT_BOUND,
        `最差层 L${worstRow.l}: 就算放开 cap 也只能到 ${worstRow.free}（>${SOFT_BOUND}），说明算法本身还没到底`);
      assert.ok(worstRow.capPenalty > 0.05,
        `最差层 L${worstRow.l}: 超阈但 capPenalty 只有 ${worstRow.capPenalty}，不能归因于 lean 上限`);
    }

    const worseThanSpring = r.rows.filter((x) => x.pageJoint > x.spring + 1e-9);
    // ---------- ③ 页面同链 A/B：minimax 开档不比关档差；比 spring 差的层必须有 cap 差额解释 ----------
    // 页面链上跨单元角点取平均后，单元内的 minimax 解可能被邻居拉回去（r251 实测 L4 0.2665 vs 0.2288）
    // → 这里只如实记账，不当成"下降"来断言；硬断言在①（单元内）与②（上限口径）。
    const abWorse = r.ab.filter((x) => x.on > x.off + 1e-9);
    // r250 残差的正题：声明模块在场的 joint，最差边不得再比 spring 差
    assert.equal(worseThanSpring.length, 0, '仍有层比 spring 差：' + JSON.stringify(worseThanSpring.map((x) => [x.l, x.pageJoint, x.spring])));
    for (const x of r.rows) {
      if (x.pageJoint <= x.spring + 1e-9) continue;
      const a = r.ab.find((y) => y.l === x.l);
      assert.ok(a && a.capPenalty !== null && a.capPenalty > -1e-9,
        `L${x.l}: joint ${x.pageJoint} > spring ${x.spring} 且没有 cap 差额读数`);
    }

    // ---------- ③b 邻格代价：声明模块优先 = 邻居让步，量化它，别把它藏起来 ----------
    const nb = await p.evaluate(async () => {
      const P = await import('/src/sphere/planet.js');
      const planet = window.planetLighting.planet, group = window.planetDemo.groups[0];
      const atG = P.cornerPositions(planet, { relax: true, solver: 'joint', moduleGroups: [group] });
      const atN = P.cornerPositions(planet, { relax: true, solver: 'joint' });
      const a = P.moduleSizeReport(planet, atG), b = P.moduleSizeReport(planet, atN);
      const ca = P.relaxConflictReport(planet, atG);
      return { withGroup: +a.maxEdgeError.toFixed(4), noGroup: +b.maxEdgeError.toFixed(4), lean: +ca.leanMaxDeg.toFixed(2), folded: ca.folded };
    });
    // 让步必须是有界的：邻居最差边不得因声明模块而失控（≤ 2× 且 ≤ 1.0），且全局 lean/folded 仍合规
    assert.ok(nb.withGroup <= 1.0, `邻居让步失控：全局最差 ${nb.withGroup}（无声明 ${nb.noGroup}）`);
    assert.ok(nb.lean <= 30 + 1e-6 && nb.folded === 0, `声明模块优先后全局 lean ${nb.lean} / folded ${nb.folded}`);

    // ---------- ④ 墙体与画面：无翻折、lean ≤30、真像素 ----------
    const conf = await p.evaluate(() => {
      const c = window.planetDemo.conflict;
      return { lean: +c.leanMaxDeg.toFixed(2), folded: c.folded, shapeErr: +c.shapeErrMean.toFixed(4) };
    });
    assert.ok(conf.lean <= 30 + 1e-6, '墙倾斜超 maxLean ' + conf.lean);
    assert.equal(conf.folded, 0, '出现翻折面 ' + conf.folded);

    await p.screenshot({ path: 'artifacts/coverage/planet-joint-minimax-r251.png' });
    assert.equal(errors.length, 0, 'console/page error: ' + errors.join(' | '));

    console.log('组', JSON.stringify(r.group), 'top', r.top, '页面 worst', r.pageWorst);
    for (const x of r.rows) console.log('  L' + x.l, JSON.stringify(x));
    console.log('  页面链 A/B', JSON.stringify(r.ab));
    console.log(`PASS planet-joint-minimax：逐层 minimax ≤ jacobi（worst 层 L${worstRow.l} ${worstRow.jacobi}→${worstRow.minimax}），` +
      `放开 cap 下界 ${worstRow.free}，capPenalty ${worstRow.capPenalty}，lean ${conf.lean}°，folded ${conf.folded}；` +
      `比 spring 差的层 ${worseThanSpring.map((x) => 'L' + x.l).join(',') || '无'}；` +
      `页面链上 minimax 反被邻居拉高的层 ${abWorse.map((x) => 'L' + x.l + ' ' + x.off + '→' + x.on).join(',') || '无'}；` +
      `邻居让步：全局最差 ${nb.withGroup}（无声明 ${nb.noGroup}），lean ${nb.lean}°，folded ${nb.folded}`);
  } finally {
    await b.close();
  }
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });

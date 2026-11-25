// 第 129 轮 · 1205416648397721601（"New prop placement system! It tries to place as many props as
// it can without overlap. I use it for doors and windows too, which means they are no longer skewed
// when placed on skewed tiles"）的运行验收。
// note 从 r? 起挂着「完整家具贪心摆放仍缺」，r56 核实 placeProps 早已接进 buildings.js 的真实后院格 ——
// 本测从页面量四件事，不读 build 日志的说法：
//   ① 尽量多放：改 tries 重跑同一个 World，道具数单调不减且会饱和；
//   ② 不重叠：placeProps 交出的真实 footprint 逐对 SAT（props×props、props×树冠障碍）；
//   ③ 不贴边：每个道具角到格边的余量 ≥ pad；
//   ④ 斜格上仍是正矩形：格歪斜 >3° 的格子里，框的直角偏差 0°、门窗框水平边与墙边夹角 0°，
//      并用「按格子首边斜基画」的反向对照证明这个量具能判出歪斜。
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const BASE = 'http://localhost:8769';

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 640 } });
  const errors = [];
  page.setDefaultTimeout(60000);
  page.on('pageerror', (e) => { errors.push(e.message); console.log('PAGEERROR', e.message); });
  page.on('console', (m) => { if (m.type() === 'error') { errors.push(m.text()); console.log('CONSOLE', m.text()); } });
  const report = {};
  try {
    // 混合网格（三角 + 四边）：斜格最多，正是片子里「skewed tiles」那种
    await page.goto(`${BASE}/openings-r56.html?scene=town&grid=mixed&seed=3&flags=yardProps,yardPropArt&clean=1`);
    await page.waitForFunction(() => window.r56propProbe && window.r56world.view.worldMesh.build);
    await page.waitForTimeout(400);

    const p = await page.evaluate(() => window.r56propProbe());
    console.log('PROBE', JSON.stringify({ ...p, perCell: undefined }, null, 1));

    // ① 尽量多放：饱和曲线
    assert.ok(p.cells > 0, `has yard cells (${p.cells})`);
    assert.ok(p.props > 0, `props actually placed (${p.props})`);
    assert.equal(p.flags.yardProps, true, 'yardProps flag on');
    assert.equal(p.flags.yardPropArt, true, 'prop art on (table / crate / planter)');
    assert.ok(p.sat.length === 4, 'saturation curve measured at 4 try budgets');
    for (let i = 1; i < p.sat.length; i++) assert.ok(p.sat[i].props >= p.sat[i - 1].props, `props monotone in tries: ${JSON.stringify(p.sat.map((s) => s.tries + '→' + s.props))}`);
    for (const s of p.sat) assert.equal(s.overlaps, 0, `no overlap at any try budget (tries=${s.tries})`);
    assert.ok(p.sat[3].props > p.sat[0].props, `more tries really place more props (${p.sat[0].props} → ${p.sat[3].props})`);
    assert.ok(p.sat[3].coverage > p.sat[0].coverage, `more tries really fill more area (${p.sat[0].coverage} → ${p.sat[3].coverage})`);
    assert.ok(p.sat[3].maxCoverage > 0.2, `the busiest yard is packed to ${p.sat[3].maxCoverage} of its cell`);

    // ② 不重叠 ③ 不贴边
    assert.ok(p.dyads > 60, `enough prop pairs tested (${p.dyads})`);
    assert.equal(p.overlaps, 0, 'no two props overlap (SAT)');
    assert.equal(p.obstacleHits, 0, 'no prop overlaps a reserved tree crown');
    assert.ok(p.minPad >= 0.0199, `every prop corner keeps the pad from the cell edge (min ${p.minPad})`);
    assert.ok(p.coverageAvg > 0.1, `yards are really filled (avg coverage ${p.coverageAvg})`);

    // ④ 斜格上仍是正矩形
    assert.ok(p.maxCellSkew > 3, `world really contains skewed cells (max interior-angle deviation ${p.maxCellSkew}°)`);
    assert.ok(p.skewedYardCells > 0, `skewed cells among yard cells (${p.skewedYardCells})`);
    assert.ok(p.frameDevMax < 1e-6, `every prop frame is a rigid right rectangle on skewed cells (max dev ${p.frameDevMax}°)`);
    assert.ok(p.kinds.table > 0 && p.kinds.crate > 0 && p.kinds.planter > 0, `three prop kinds drawn: ${JSON.stringify(p.kinds)}`);

    // 门窗：框的水平边必须与墙边平行（不跟着格轴歪），竖边必须竖直
    assert.ok(p.openings > 0, `openings drawn (${p.openings})`);
    assert.ok(p.openOnSkewed > 0, `openings sit on skewed cells (${p.openOnSkewed}, max skew ${p.maxOpenSkew}°)`);
    assert.ok(p.openYawErrDeg < 1e-6, `opening frame is parallel to its wall edge, not to the cell axis (${p.openYawErrDeg}°)`);
    assert.ok(p.openRightAngleDev < 1e-6, `opening frame corners are 90° (${p.openRightAngleDev}°)`);
    // 反向对照：同一个开口若按格子首边（斜基）画，夹角就是可判出的非零值
    assert.ok(p.shearRightAngleDev > 5, `control: a 40% sheared window would be caught by the same metric (${p.shearRightAngleDev}°)`);
    assert.ok(p.skewYawErrDeg > 3, `control: a cell-axis frame is measurably off the wall edge (${p.skewYawErrDeg}°)`);

    report.probe = { cells: p.cells, props: p.props, dyads: p.dyads, overlaps: p.overlaps, obstacleHits: p.obstacleHits, minPad: p.minPad, frameDevMax: p.frameDevMax, coverageAvg: p.coverageAvg, maxCellSkew: p.maxCellSkew, skewedYardCells: p.skewedYardCells, kinds: p.kinds, sat: p.sat, openYawErrDeg: p.openYawErrDeg, skewYawErrDeg: p.skewYawErrDeg, openOnSkewed: p.openOnSkewed, shearRightAngleDev: p.shearRightAngleDev };

    // 画面：整岛俯视 + 近景（后院里的桌 / 箱 / 盆栽）
    await page.screenshot({ path: 'artifacts/coverage/prop-placement-r129-town.png' });
    const aim = await page.evaluate(() => {
      const { view, grid } = window.r56world;
      const list = view.worldMesh.build.yardProps || [];
      // 挑道具最多的一格做近景
      const best = list.slice().sort((a, b) => b.count - a.count)[0];
      const c = grid.cells[best.cell];
      view.target.set(c.cx, 0.58, c.cz); view.distance = 3.4; view.pitch = 0.92; view.yaw = 0.8; view.updateCamera();
      view.render(0);
      return { cell: best.cell, count: best.count, coverage: +best.coverage.toFixed(4) };
    });
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'artifacts/coverage/prop-placement-r129-yards.png' });
    report.aim = aim;

    // 像素 A/B（同机位、同状态两帧底噪 0）：关掉道具 → 后院空出来；关掉美术 → 只剩统一木盒
    const ab = await page.evaluate(() => {
      const { world, view } = window.r56world;
      const r = view.renderer, gl = r.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
      const grab = () => { const px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };
      const set = (on, art) => { world.yardProps = on; world.yardPropArt = art; world.touch(); view.worldMesh.invalidate(); view.render(0); view.render(0); return grab(); };
      const on = set(true, true), again = set(true, true), off = set(false, true), box = set(true, false);
      set(true, true);
      const diff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 12) n++; return n; };
      return { W, H, noise: diff(on, again), onVsOff: diff(on, off), artVsBox: diff(on, box) };
    });
    console.log('AB', JSON.stringify(ab));
    assert.equal(ab.noise, 0, `same-state noise floor is 0 (got ${ab.noise})`);
    assert.ok(ab.onVsOff > 500, `turning yardProps off empties the yards (${ab.onVsOff} px)`);
    assert.ok(ab.artVsBox > 200, `prop art (table/crate/planter) differs from the plain boxes (${ab.artVsBox} px)`);
    report.ab = ab;

    // 关掉开关后的对照截图
    await page.evaluate(() => { const { world, view } = window.r56world; world.yardProps = false; world.touch(); view.worldMesh.invalidate(); view.render(0); });
    await page.screenshot({ path: 'artifacts/coverage/prop-placement-r129-yards-off.png' });

    assert.deepEqual(errors, [], `0 console/page errors (got ${errors.length})`);
    console.log('PASS prop placement: ' + JSON.stringify(report));
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });

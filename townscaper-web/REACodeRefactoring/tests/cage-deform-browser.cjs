// 1579478470098243584 运行时验收：「对 cell 做激进 cage deformation，让崖面更有机」。
//
// 两件机制 r56 C09-D 就落在 src/terrain/cage-c09.js（文件头署本片 ID），但一直只有 node 测试
// （tests/c09-terrain-d.mjs），data.js 里这条挂了 60 多轮「完整原cage/3D碰撞仍缺」；页面 cage.html
// 的提示语还写着「未实现任意扭曲壁面内部插值/形变后精确碰撞」——旧账（r114 教训：页面提示语也会变成假账）。
// 本轮补的是页面入口 + 运行验收，判据：
//   A. cage.html「笼碰撞探针」：形变壁面内部点（cageWallPoint）与 terrainmesh 实际发出的墙四边形
//      在 (u,v) 网格上逐点重合（<1e-9）——这是「壁面内部插值」区别于「只插角点」的唯一几何证据；
//      塞进岩石 0.08 的探针（红）经 cageCollider.pushOut 推出来（绿）后不在岩石里、离墙 ≥ r，
//      并且 terrain-collide（按实际画出的墙碰撞）对推出位置认同。
//   B. island-build-c09.html?mode=cage：片子的时间结构 = 格笼线框一点点长出来 → 着色时笼线还叠着 →
//      转镜 → 笼线退掉，走的是主场景同一个 World / WorldMesh。
const { chromium } = require('playwright');
const fs = require('fs');

const OUT = 'artifacts/coverage';
const BASE = 'http://127.0.0.1:8769';

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const errors = [];
  const samples = {};
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    const fail = (m) => { throw new Error(m + ' :: ' + JSON.stringify(samples)); };

    // ─────────── A. 形变壁面内部插值 + 3D 笼碰撞（cage.html） ───────────
    const probes = {};
    for (const grid of ['mixed', 'quad']) {
      await page.goto(BASE + '/cage.html', { timeout: 90000 });
      if (grid === 'quad') await page.selectOption('#grid', 'quad');
      await page.waitForFunction((g) => window.cageReview?.api.gridKind === g, grid, { polling: 200, timeout: 120000 });
      if (await page.evaluate(() => window.cageProbe)) fail('探针默认必须是关的（不能一进页面就改 World 状态）');

      await page.check('#probe');
      await page.waitForFunction(() => !!window.cageProbe, null, { polling: 100, timeout: 60000 });
      const st = await page.evaluate(() => {
        const p = window.cageProbe, c = window.cageReview.cell;
        return { ...p, corners: c.n, cellId: c.id, grid: window.cageReview.api.gridKind };
      });
      probes[grid] = st;

      if (!(st.walls > 0)) fail(`${grid}: 该格在层 ${st.level} 没有暴露墙，探针量不到东西`);
      if (st.samples !== st.walls * 15) fail(`${grid}: 每个墙四边形应采 5×3=15 点（${st.walls} 墙 → ${st.samples} 点）`);
      if (!(st.maxDev < 1e-9)) fail(`${grid}: 笼壁内部点与实际墙四边形最大偏差 ${st.maxDev}（应当重合）`);
      if (st.sliceVerts !== st.corners) fail(`${grid}: 连续截面角点数 ${st.sliceVerts} ≠ 格角数 ${st.corners}`);
      if (!(st.bent > 0.02)) fail(`${grid}: 竖向笼边不弯（bent ${st.bent}），说明形变没生效`);
      const pr = st.probe;
      if (!pr) fail(`${grid}: 没跑推出`);
      if (!pr.insideCageBefore) fail(`${grid}: 探针应先落在形变格笼内（insideCage）`);
      if (pr.outInside) fail(`${grid}: 推出后仍在岩石里`);
      if (!(pr.clearance >= st.radius - 1e-6)) fail(`${grid}: 推出后离墙 ${pr.clearance} < r ${st.radius}`);
      if (pr.agreeInside) fail(`${grid}: terrain-collide 认为推出位置仍在岩石内`);
      if (!(pr.agreeClearance >= st.radius - 1e-3)) fail(`${grid}: terrain-collide 量的余量 ${pr.agreeClearance} < r`);
      if (!(pr.contacts >= 1)) fail(`${grid}: 推出应当至少接触一次墙`);

      // 取证：藏掉 index 的 HUD、把机位拉到该格这一层（红点=陷进岩石、绿点=推出位置、青点=壁面采样）
      const frame = page.frames().find((f) => f.url().includes('index.html'));
      await frame.evaluate(() => {
        const st = document.createElement('style');
        st.textContent = 'body *{visibility:hidden!important}#view,#view *{visibility:visible!important}';
        document.head.appendChild(st);
      });
      await page.evaluate((lv) => {
        const { api, cell } = window.cageReview, v = api.view;
        v.target.set(cell.cx, lv * v.levelHeight, cell.cz);
        v.distance = 4.2; v.pitch = 0.12; v.updateCamera(); v.render(0);
      }, st.level);
      await page.waitForTimeout(300);
      await page.locator('#scene').screenshot({ path: `${OUT}/cage-deform-${grid}-probe.png` });
      await page.screenshot({ path: `${OUT}/cage-deform-${grid}-page.png` });

      // 关掉探针 → 量具清空（页面不许留着上一轮的读数当假账）
      await page.uncheck('#probe');
      if (await page.evaluate(() => window.cageProbe)) fail(`${grid}: 关掉探针后 window.cageProbe 必须为 null`);
      const txt = await page.locator('#probeStatus').textContent();
      if (txt.trim() !== '') fail(`${grid}: 关掉探针后状态行必须清空（实际 "${txt}"）`);
    }

    // 页面提示语不许再写「未实现」（r114 教训）
    const headerText = await page.locator('header').innerText();
    if (/未实现任意扭曲壁面内部插值/.test(headerText)) fail('页面还写着「未实现壁面内部插值」——与代码不符');

    // ─────────── B. 片子的时间结构（island-build-c09.html?mode=cage） ───────────
    await page.goto(BASE + '/island-build-c09.html?mode=cage', { timeout: 90000 });
    await page.waitForFunction(() => !!window.buildReel, null, { polling: 200, timeout: 120000 });
    const meta = await page.evaluate(() => ({ phases: window.buildReel.phases, roundLen: window.buildReel.roundLen, preset: window.buildReel.preset }));
    samples.reel = { phases: meta.phases, roundLen: meta.roundLen, lines: meta.preset.lines, seeds: meta.preset.seeds, overlay: meta.preset.overlay, orbit: meta.preset.orbit };
    if (JSON.stringify(meta.phases.map((p) => p[0])) !== JSON.stringify(['wire', 'hold', 'color'])) fail('阶段顺序必须是 线框 → 停住 → 着色');
    if (meta.preset.lines !== 'cage') fail('这一片的线框必须是「格笼」而不是网格特征边（lines=' + meta.preset.lines + '）');
    const info = (ph, n) => page.evaluate(([ph, n]) => { const b = window.buildReel; b.pause(); b.seek(b.timeOf(0, ph, n)); return b.info; }, [ph, n]);

    const grow = [];
    for (const n of [0.05, 0.35, 0.7, 0.98]) { const i = await info('wire', n); grow.push({ n, drawn: i.drawnSegments, segs: i.segments, ratio: i.ratio, world: i.worldVisible }); }
    samples.grow = grow;
    if (grow.some((g) => g.world)) fail('线框段世界必须隐藏（只留格笼线）');
    for (let i = 1; i < grow.length; i++) if (grow[i].drawn < grow[i - 1].drawn) fail('线框段已画线段回退');
    if (!(grow[0].drawn < grow[3].drawn * 0.3)) fail('开头必须是零散几笔（' + grow[0].drawn + ' vs ' + grow[3].drawn + '）');
    if (!(grow[3].ratio > 0.99 && grow[3].drawn === grow[3].segs)) fail('线框段末必须画满（' + grow[3].drawn + '/' + grow[3].segs + '）');
    if (!(grow[3].segs > 1000)) fail('格笼线段太少（' + grow[3].segs + '）');

    const cEarly = await info('color', 0.05), cLate = await info('color', 0.95);
    samples.color = { early: { world: cEarly.worldVisible, overlay: cEarly.overlay, drawn: cEarly.drawnSegments }, late: { world: cLate.worldVisible, overlay: cLate.overlay, drawn: cLate.drawnSegments } };
    if (!cEarly.worldVisible) fail('着色段世界必须可见');
    if (!cEarly.overlay) fail('刚着色时笼线还应叠在上面（overlay）');
    if (cLate.overlay) fail('着色段末尾笼线应当退掉（overlay 仍 true）');

    // 转镜：着色段 yaw 必须真的在转（原片 071–215 一直在转）
    const yaws = await page.evaluate(() => {
      const b = window.buildReel, f = document.querySelector('#scene').contentWindow, out = [];
      for (const n of [0.02, 0.5, 0.95]) { b.seek(b.timeOf(0, 'color', n)); out.push(+f.rea.view.yaw.toFixed(4)); }
      return out;
    });
    samples.yaws = yaws;
    if (!(Math.abs(yaws[2] - yaws[0]) > 0.2)) fail('着色段应当在转镜（yaw ' + yaws.join(' → ') + '）');

    const stage = page.locator('#scene');
    for (const [name, ph, n] of [['wire-mid', 'wire', 0.55], ['color-overlay', 'color', 0.2], ['color-end', 'color', 0.95]]) {
      await page.evaluate(([ph, n]) => { const b = window.buildReel; b.pause(); b.seek(b.timeOf(0, ph, n)); }, [ph, n]);
      await page.waitForTimeout(400);
      await stage.screenshot({ path: `${OUT}/cage-deform-reel-${name}.png` });
    }

    if (errors.length) fail('页面报错：' + errors.join(' | '));
    if (!fs.existsSync(`${OUT}/cage-deform-mixed-probe.png`)) fail('截图没落盘');
    console.log('PASS cage deform 1579478470098243584');
    for (const g of ['mixed', 'quad']) {
      const s = probes[g];
      console.log(`  [${g}] 格 ${s.cellId} 层 ${s.level} y=${s.y} · 暴露墙 ${s.walls} · 壁面点 ${s.samples} 最大偏差 ${s.maxDev} · 截面 ${s.sliceVerts} 角 弯曲 ${s.bent}`);
      console.log(`        探针 笼内=${s.probe.insideCageBefore} → 推出后 inside=${s.probe.outInside} 余量=${s.probe.clearance} 接触=${s.probe.contacts} · terrain-collide: inside=${s.probe.agreeInside} 余量=${s.probe.agreeClearance}`);
    }
    console.log(`  [reel] 阶段 ${meta.phases.map((p) => p[0]).join('→')} 单轮 ${meta.roundLen}s · 线段 ${grow[3].segs} · 线框累积 ${grow.map((g) => g.drawn).join(' → ')}`);
    console.log(`        着色 overlay ${cEarly.overlay} → ${cLate.overlay} · 转镜 yaw ${yaws.join(' → ')}`);
    await browser.close();
  } catch (e) {
    console.error('FAIL cage deform:', e.message);
    await browser.close();
    process.exit(1);
  }
})();

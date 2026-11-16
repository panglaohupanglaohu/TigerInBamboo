// 1448039167057879048 运行时验收：岛屿生成分阶段计时可视化（island-stages-c09.html?mode=talk）。
//
// 片子里那一屏不是"换图"，是四条机制叠在一根时间轴上：
//   ① 三角剖分的"帐篷"层：Bowyer–Watson 插点过程中，每个顶点都有线连到超级三角形的高点（原片 0001–0013 的竖棒/尖刺）；
//   ② 共享边稀疏线网层：三角面的边**只画一次**（内边被两个面共用），逐笔铺开 → 先稀疏后稠密；
//   ③ 自动计时推进：不用手点，时间轴自己往前走（每层 1.6–5s）；
//   ④ 每轮换一座岛：4 轮 4 个种子。
// 判据全部来自页面真跑出来的像素与状态，不看代码猜。
const { chromium } = require('playwright');
const fs = require('fs');

const OUT = 'artifacts/coverage';
const LAYERS = ['tent', 'lattice', 'strokes', 'net', 'contour', 'color'];

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const errors = [];
  let samples = {};
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

    await page.goto('http://127.0.0.1:8769/island-stages-c09.html?mode=talk');
    await page.waitForFunction(() => !!window.islandStages?.info, null, { polling: 50 });
    const fail = (m) => { throw new Error(m + ' :: ' + JSON.stringify(samples)); };

    // ── 0. 时间轴形状
    const tl = await page.evaluate(() => window.islandStages.timeline);
    samples.timeline = tl;
    if (JSON.stringify(tl.layers) !== JSON.stringify(LAYERS)) fail('层序应当是 ' + LAYERS.join('→'));
    if (tl.roundLength !== 17.5) fail('单轮时长应当是 6 层之和 17.5s');
    if (tl.total !== 70) fail('4 轮总时长应当是 70s');

    // ── 1. 四轮四座岛 + 每层状态
    const rounds = [], layersInfo = [];
    for (let r = 0; r < 4; r++) {
      const isl = await page.evaluate((r) => { window.islandStages.at(r, 'tent', 0); return window.islandStages.island(); }, r);
      rounds.push(isl);
      for (const layer of LAYERS) {
        const info = await page.evaluate(([r, l]) => window.islandStages.at(r, l, 0.98), [r, layer]);
        const ink = await page.evaluate(() => window.islandStages.inkPixels());
        layersInfo.push({ r, layer, ink, seed: info.seed, tris: info.tris, edges: info.edges, superEdges: info.superEdges, netStrokes: info.netStrokes, strokes: info.strokes, drawn: info.drawn });
      }
    }
    samples.rounds = rounds.map((x) => ({ seed: x.seed, faces: x.faces, n: x.n, cliffs: x.cliffs }));
    samples.layers = layersInfo;

    const seeds = rounds.map((x) => x.seed);
    if (new Set(seeds).size !== 4) fail('4 轮必须有 4 个不同种子（每轮换一座岛），实际 ' + seeds.join(','));
    if (!rounds.every((x) => x.faces > 200 && x.n > 100)) fail('每轮都应当是完整岛（200+ 面）');

    // ── 2. 帐篷层：每个顶点都连到超级三角形高点（原片 0001–0013 的竖棒）
    for (let r = 0; r < 4; r++) {
      const t = layersInfo.find((x) => x.r === r && x.layer === 'tent');
      const l = layersInfo.find((x) => x.r === r && x.layer === 'lattice');
      if (!(t.superEdges > 0)) fail(`第 ${r} 轮帐篷层没有连向超级三角形的边（superEdges=${t.superEdges}）`);
      if (l.superEdges !== 0) fail(`第 ${r} 轮平板层不该再有超级三角形边（superEdges=${l.superEdges}）`);
      if (!(l.edges > 300)) fail(`第 ${r} 轮平板层边数太少（${l.edges}）`);
      if (!(t.ink > 20000)) fail(`第 ${r} 轮帐篷层墨迹过少（${t.ink}）—— 应当是一张满屏线框`);
    }

    // ── 3. 共享边线网层：线数 = 三角面共享一次的边数，逐笔铺开（稀疏 → 稠密）
    const netGrow = [];
    for (const n of [0.15, 0.45, 0.75, 0.98]) {
      const info = await page.evaluate((n) => { window.islandStages.at(1, 'net', n); return window.islandStages.info; }, n);
      netGrow.push({ n, drawn: info.drawn, ink: await page.evaluate(() => window.islandStages.inkPixels()) });
    }
    samples.netGrow = netGrow;
    for (let i = 1; i < netGrow.length; i++) {
      if (netGrow[i].drawn < netGrow[i - 1].drawn - 1e-9) fail('线网层画出比例回退');
      if (netGrow[i].ink < netGrow[i - 1].ink - 60) fail('线网层墨迹回退（应当只增不减）');
    }
    if (!(netGrow[0].drawn < 0.5)) fail('线网层开头必须是稀疏的');
    if (!(netGrow[3].drawn > 0.99)) fail('线网层结尾必须铺满');
    if (!(netGrow[3].ink > netGrow[0].ink * 3)) fail('线网从稀疏到稠密应当有明显覆盖增长');
    // 共享边只画一次：线网笔数 ≤ 三角面边数（3F），且明显少于"每面各描一遍"（3F）
    const netRow = layersInfo.find((x) => x.r === 1 && x.layer === 'net');
    if (!(netRow.netStrokes > 0 && netRow.netStrokes < netRow.tris * 3)) fail('线网笔画数应当少于逐面描边');

    // ── 4. 逐笔线稿层：墨迹随进度单调增长，结尾画满
    const grow = [];
    for (const n of [0.05, 0.3, 0.6, 0.95]) {
      const info = await page.evaluate((n) => { window.islandStages.at(2, 'strokes', n); return window.islandStages.info; }, n);
      grow.push({ n, ink: await page.evaluate(() => window.islandStages.inkPixels()), drawn: info.drawn, started: info.started, strokes: info.strokes });
    }
    samples.strokesGrow = grow;
    for (let i = 1; i < grow.length; i++) {
      if (grow[i].ink < grow[i - 1].ink - 60) fail('线稿层墨迹回退');
      if (grow[i].drawn < grow[i - 1].drawn - 1e-9) fail('线稿层已描比例回退');
      if (grow[i].started < grow[i - 1].started) fail('线稿层已开笔数回退');
    }
    if (!(grow[0].ink < grow[3].ink * 0.5)) fail('线稿层开头必须是零散几笔');
    if (grow[3].drawn !== 1) fail('线稿层结尾必须画满');
    if (grow[3].started !== grow[3].strokes) fail('线稿层结尾所有笔都要开过');

    // ── 5. 自动计时推进：不点任何按钮，时间自己走，跨层
    await page.evaluate(() => { window.islandStages.seek(0); window.islandStages.play(); });
    await page.waitForTimeout(2600);
    const auto1 = await page.evaluate(() => window.islandStages.info);
    await page.waitForTimeout(1800);
    const auto2 = await page.evaluate(() => window.islandStages.info);
    await page.evaluate(() => window.islandStages.pause());
    samples.auto = { auto1: { t: auto1.time, layer: auto1.layer }, auto2: { t: auto2.time, layer: auto2.layer } };
    if (!(auto1.time > 1.2)) fail('自动推进 2.6s 后时间应已走过 1.2s（实际 ' + auto1.time + '）');
    if (!(auto2.time > auto1.time + 0.8)) fail('自动推进应当持续（第二段没有前进）');
    if (auto1.layer === 'tent' && auto2.layer === 'tent') fail('4.4s 内应当已经跨过帐篷层（1.6s）进入下一层');

    // ── 6. 截图：第 1 轮六层 + 第 3 轮同两层（换岛对照）
    if (!fs.existsSync(OUT)) throw new Error('缺少 ' + OUT);
    const shot = async (name, r, layer, norm) => {
      await page.evaluate(([r, l, n]) => window.islandStages.at(r, l, n), [r, layer, norm]);
      await page.waitForTimeout(120);
      await page.locator('#c').screenshot({ path: `${OUT}/island-stages-talk-r108-${name}.png` });
    };
    await shot('r0-tent', 0, 'tent', 0.99);
    await shot('r0-lattice', 0, 'lattice', 0.99);
    await shot('r0-strokes-mid', 0, 'strokes', 0.45);
    await shot('r0-net', 0, 'net', 0.6);
    await shot('r0-contour', 0, 'contour', 0.99);
    await shot('r0-color', 0, 'color', 0.5);
    await shot('r2-color', 2, 'color', 0.5);
    await shot('r2-net', 2, 'net', 0.6);

    if (errors.length) fail('页面报错：' + errors.join(' | '));
    console.log('PASS island-stages talk: 4 轮 4 种子 ' + seeds.join('/') + '，层序 ' + LAYERS.join('→'));
    console.log('  帐篷层 superEdges ' + layersInfo.filter((x) => x.layer === 'tent').map((x) => x.superEdges).join('/') +
      ' · 线网笔画 ' + layersInfo.filter((x) => x.layer === 'net').map((x) => x.netStrokes).join('/'));
    console.log('  线网稀疏→稠密 drawn ' + netGrow.map((x) => x.drawn.toFixed(2)).join(' → ') + ' / ink ' + netGrow.map((x) => x.ink).join(' → '));
    console.log('  线稿 ink ' + grow.map((x) => x.ink).join(' → ') + ' · 自动推进 ' + auto1.time.toFixed(2) + 's → ' + auto2.time.toFixed(2) + 's（' + auto1.layer + ' → ' + auto2.layer + '）');
    await browser.close();
  } catch (e) {
    console.error('FAIL island-stages talk:', e.message);
    await browser.close();
    process.exit(1);
  }
})();

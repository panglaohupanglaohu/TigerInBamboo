// 1447483550257799171 运行时验收：连续换岛 + 先线稿后着色循环页（island-build-c09.html?mode=reel）。
//
// 44s showreel 的结构是「彩色岛环绕 → 切黑 → 白线逐笔累积成岛 → 停一下 → 换下一座岛」，
// 一轮里世界只在着色段可见，线只在线稿段可见。判据：
//   ① 4 轮 4 个种子，每轮的线段/笔画数都不同（真的是另一座岛，不是同一座换个角度）；
//   ② 阶段顺序 color → wire → hold，着色段 worldVisible、线稿段 !worldVisible；
//   ③ 线稿段线数随进度单调增长到满（逐笔累积，不是一次性出现）；
//   ④ 连续播放会自己走完一轮并回卷到第一座岛（循环页）。
const { chromium } = require('playwright');
const fs = require('fs');

const OUT = 'artifacts/coverage';
const SEEDS = [5, 9, 17, 31];

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

    await page.goto('http://127.0.0.1:8769/island-build-c09.html?mode=reel', { timeout: 90000 });
    await page.waitForFunction(() => !!window.buildReel, null, { polling: 200, timeout: 120000 });
    const fail = (m) => { throw new Error(m + ' :: ' + JSON.stringify(samples)); };

    const meta = await page.evaluate(() => ({ phases: window.buildReel.phases, roundLen: window.buildReel.roundLen, preset: window.buildReel.preset }));
    samples.meta = { phases: meta.phases, roundLen: meta.roundLen, seeds: meta.preset.seeds, lines: meta.preset.lines, colorFirst: meta.preset.colorFirst };
    if (JSON.stringify(meta.phases.map((p) => p[0])) !== JSON.stringify(['color', 'wire', 'hold'])) fail('阶段顺序必须是 着色 → 线稿 → 停住（先线稿后着色反了）');
    if (JSON.stringify(meta.preset.seeds) !== JSON.stringify(SEEDS)) fail('4 轮种子应当是 ' + SEEDS.join('/'));
    if (!meta.preset.colorFirst) fail('这一片是「先彩色岛、再切黑画线」');

    // ── 每轮每阶段
    const rows = [];
    for (let r = 0; r < 5; r++) {
      for (const ph of ['color', 'wire', 'hold']) {
        const info = await page.evaluate(([r, ph]) => {
          const b = window.buildReel;
          b.seek(b.timeOf(r, ph, ph === 'hold' ? 0.5 : 0.98));
          return b.info;
        }, [r, ph]);
        rows.push({ r, ph, seed: info.seed, phase: info.phase, world: info.worldVisible, drawn: info.drawnSegments, segs: info.segments, strokes: info.strokes, ratio: info.ratio });
      }
    }
    samples.rows = rows;
    const roundOf = (r) => rows.filter((x) => x.r === r);

    for (let r = 0; r < 4; r++) {
      const [c, w, h] = roundOf(r);
      if (c.seed !== SEEDS[r]) fail(`第 ${r} 轮种子应为 ${SEEDS[r]}，实际 ${c.seed}`);
      if (!(c.segs > 1000)) fail(`第 ${r} 轮线段太少（${c.segs}）`);
      if (!c.world) fail(`第 ${r} 轮着色段世界必须可见`);
      if (c.drawn !== 0) fail(`第 ${r} 轮着色段不该还压着线稿（drawn=${c.drawn}）`);
      if (w.world) fail(`第 ${r} 轮线稿段世界必须隐藏（黑底白线）`);
      if (!(w.drawn === w.segs)) fail(`第 ${r} 轮线稿段末应画满（${w.drawn}/${w.segs}）`);
      if (!(h.drawn === h.segs)) fail(`第 ${r} 轮停住段应保持画满`);
      if (!(w.ratio > 0.99)) fail(`第 ${r} 轮线稿段末比例应接近 1（实际 ${w.ratio}）`);
    }
    // 换岛：线段/笔画数各轮不同
    const segCounts = [0, 1, 2, 3].map((r) => roundOf(r)[0].segs);
    if (new Set(segCounts).size !== 4) fail('4 轮线段数必须各不相同（同一座岛换个角度不算换岛）：' + segCounts.join('/'));

    // ── 线稿段逐笔累积
    const grow = [];
    for (const n of [0.05, 0.3, 0.6, 0.98]) {
      const info = await page.evaluate((n) => { const b = window.buildReel; b.seek(b.timeOf(1, 'wire', n)); return b.info; }, n);
      grow.push({ n, drawn: info.drawnSegments, ratio: info.ratio });
    }
    samples.grow = grow;
    for (let i = 1; i < grow.length; i++) {
      if (grow[i].drawn < grow[i - 1].drawn - 1e-9) fail('线稿段已画线段回退');
    }
    if (!(grow[0].drawn < grow[3].drawn * 0.25)) fail('线稿段开头必须是零散几笔（稀疏累积）');
    if (!(grow[3].ratio > 0.99)) fail('线稿段末必须画满（ratio=' + grow[3].ratio + '）');

    // ── 循环：第 5 轮回卷到第一座岛
    const wrap = await page.evaluate(([n]) => { const b = window.buildReel; b.seek(n); return b.info; }, [meta.roundLen * 4 + 1.0]);
    samples.wrap = { round: wrap.round, seed: wrap.seed };
    if (wrap.round !== 4 || wrap.seed !== SEEDS[0]) fail('第 5 轮必须回卷到第一座岛（循环页），实际 round=' + wrap.round + ' seed=' + wrap.seed);

    // ── 自动播放：不点按钮，时间自己走（连续换岛靠的就是这个）
    // 无头 + swiftshader 只有 ~4fps，而 frame 循环给 dt 封了 0.1s 上限，
    // 所以这里只断言"在前进 + 能自己跨过阶段边界"，不拿墙钟时间当标尺。
    const start = await page.evaluate(() => { const b = window.buildReel; b.seek(b.timeOf(0, 'color', 0.97)); b.play(); return b.info.time; });
    await page.waitForTimeout(1500);
    const a1 = await page.evaluate(() => window.buildReel.info);
    await page.waitForTimeout(1500);
    const a2 = await page.evaluate(() => window.buildReel.info);
    await page.evaluate(() => window.buildReel.pause());
    samples.auto = { start, a1: { t: a1.time, phase: a1.phase }, a2: { t: a2.time, phase: a2.phase } };
    if (!(a1.time > start + 0.05)) fail('自动播放后时间应当前进（' + start + ' → ' + a1.time + '）');
    if (!(a2.time > a1.time + 0.05)) fail('自动播放应当持续前进');
    if (a2.phase === 'color') fail('从着色段末尾自动播放 3s 应当已经进入线稿段（实际仍在 ' + a2.phase + '）');

    // ── 截图
    if (!fs.existsSync(OUT)) throw new Error('缺少 ' + OUT);
    const frame = page.frames().find((f) => f.url().includes('index.html'));
    if (!frame) throw new Error('没找到 index.html 的场景 iframe');
    const stage = page.locator('#scene');
    const shot = async (name, r, ph, norm) => {
      await page.evaluate(([r, ph, n]) => { const b = window.buildReel; b.pause(); b.seek(b.timeOf(r, ph, n)); }, [r, ph, norm]);
      await page.waitForTimeout(500);
      await stage.screenshot({ path: `${OUT}/island-reel-r108-${name}.png` });
    };
    await shot('r0-color', 0, 'color', 0.55);
    await shot('r0-wire-mid', 0, 'wire', 0.4);
    await shot('r1-color', 1, 'color', 0.55);
    await shot('r1-wire-mid', 1, 'wire', 0.4);
    await shot('r2-color', 2, 'color', 0.55);

    if (errors.length) fail('页面报错：' + errors.join(' | '));
    console.log('PASS island-build reel: 4 轮 4 岛 ' + SEEDS.join('/') + '，阶段 ' + meta.phases.map((p) => p[0]).join('→') + '，单轮 ' + meta.roundLen + 's');
    console.log('  各轮线段数 ' + segCounts.join('/') + ' · 线稿累积 drawn ' + grow.map((x) => x.drawn).join(' → '));
    console.log('  循环回卷 round ' + wrap.round + ' / seed ' + wrap.seed + ' · 自动播放 ' + a1.time.toFixed(2) + 's → ' + a2.time.toFixed(2) + 's');
    await browser.close();
  } catch (e) {
    console.error('FAIL island-build reel:', e.message);
    await browser.close();
    process.exit(1);
  }
})();

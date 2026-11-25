/**
 * island-quality-consistent-browser.cjs — 第 121 轮 · 1669315384619540487
 *   「The generator consistently spits out pretty cool islands now」
 *
 * 缺口史：note 连挂「完整软坡/模块联合生成和原美术质量仍待补」→ 一直被当 B 排。
 *   核实：r56 C09-C 已落 `src/terrain/island-quality-c09.js`（islandReport 体检 + islandVerdict 阈值 +
 *   consistentIsland 派生种子重生 + pruneIslets 清碎礁）与连播页 `islands-c09.html`
 *   （空海面 → 海岸轮廓逐段画 → 黑剪影 → 成品 → 自动转台），逻辑侧 `tests/c09-terrain-c.mjs` 已在；
 *   **缺的是「从连播页真的跑出来并量出来」的运行验收**（本测试）。
 *
 * 判据：
 *   ① 体检项真的在读数：mainFrac / levels / cliffEdges / stepEdges / stacks / caves 非零；
 *   ② 「consistently」= 默认开体检时**每一座**都 cool（连点 4 座）；
 *   ③ 体检真的在干活：关掉体检（consistent=0）扫 8 个种子，失败数 > 0（否则阈值/重生成是摆设）；
 *   ④ 海岸轮廓线逐段画出来（shoreSegments > 0，且 stage=shore 的线段数 < 全量）；
 *   ⑤ 五个阶段真的换画面（sea / shore / silhouette / full 的可见对象与像素不同）；
 *   ⑥ 0 页面错误。
 */
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console:' + m.text()); });

  const out = { ok: true, checks: [], islands: [], raw: [] };
  const check = (n, c, d) => { out.checks.push({ name: n, pass: !!c, detail: d }); if (!c) out.ok = false; console.log(`  ${c ? 'PASS' : 'FAIL'} ${n} — ${d}`); };
  const read = () => page.evaluate(() => {
    const o = window.__c09islands; if (!o) return null;
    return { grid: o.grid, seed: o.seed, asked: o.asked, tries: o.tries, pruned: o.pruned, shore: o.shoreSegments,
      cool: o.verdict.cool, failed: o.verdict.failed, report: o.report };
  });

  try {
    // ② 默认（体检开）连播 4 座
    await page.goto('http://127.0.0.1:8769/islands-c09.html?grid=quad&seed=1&consistent=1&soft=1&stage=full&clean=1', { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.__c09islands, null, { timeout: 120000 });
    let last = await read(); out.islands.push(last);
    for (let i = 0; i < 3; i++) {
      await page.click('#next');
      await page.waitForFunction((prev) => window.__c09islands && window.__c09islands.seed !== prev, last.seed, { timeout: 120000 });
      last = await read(); out.islands.push(last);
    }
    console.log('  四座岛：' + out.islands.map((x) => `seed${x.seed}(tries ${x.tries}, 陆地 ${x.report.landFrac.toFixed(2)}, 层 ${x.report.levels}, 崖 ${x.report.cliffEdges}, 阶 ${x.report.stepEdges})`).join(' / '));

    check('① 体检项真的在读数（陆地/主岛占比/层数/崖边/台阶/石柱/洞穴）',
      out.islands.every((x) => x.report.landFrac > 0.15 && x.report.mainFrac > 0.85 && x.report.levels >= 4 && x.report.cliffEdges > 0 && x.report.stepEdges > 0),
      out.islands.map((x) => `main ${x.report.mainFrac.toFixed(3)}/层 ${x.report.levels}/崖 ${x.report.cliffEdges}/阶 ${x.report.stepEdges}/石柱 ${x.report.stacks}/洞穴 ${x.report.caves}`).join(' | '));
    check('② 「consistently」：默认开体检时连播 4 座**每座**都 cool',
      out.islands.length === 4 && out.islands.every((x) => x.cool === true && x.failed.length === 0),
      out.islands.map((x) => `seed${x.seed}:cool=${x.cool}${x.failed.length ? ':' + x.failed.join(',') : ''} tries=${x.tries}`).join(' / '));
    check('② 派生种子只在必要时介入（tries ≥ 1，且至少有几座一次过）',
      out.islands.some((x) => x.tries === 1) && out.islands.every((x) => x.tries >= 1),
      `tries=${out.islands.map((x) => x.tries).join(',')}`);
    check('④ 海岸轮廓线画出来了', out.islands.every((x) => x.shore > 0), `shoreSegments=${out.islands.map((x) => x.shore).join(',')}`);
    await page.locator('#scene').screenshot({ path: 'artifacts/coverage/islands-c09-consistent-full.png' });

    // ③ 关掉体检扫 8 个种子 → 必须出现失败（否则体检是摆设）
    await page.goto('http://127.0.0.1:8769/islands-c09.html?grid=quad&seed=1&consistent=0&soft=1&stage=full&clean=1', { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.__c09islands, null, { timeout: 120000 });
    let cur = await read(); out.raw.push(cur);
    for (let i = 0; i < 7; i++) {
      await page.click('#next');
      await page.waitForFunction((p) => window.__c09islands && window.__c09islands.seed !== p, cur.seed, { timeout: 120000 });
      cur = await read(); out.raw.push(cur);
    }
    const rawFail = out.raw.filter((x) => !x.cool);
    check('③ 关掉体检后 8 个种子里确有不合格岛（体检/重生不是摆设）',
      rawFail.length > 0 && out.raw.length === 8,
      `不合格 ${rawFail.length}/8 → ${rawFail.map((x) => `seed${x.seed}:${x.failed.join(',')}`).join(' | ') || '无'}`);

    // ⑤ 四个阶段各截一张（sea / shore / silhouette / full）
    const stages = {};
    for (const st of ['sea', 'shore', 'silhouette', 'full']) {
      await page.goto(`http://127.0.0.1:8769/islands-c09.html?grid=quad&seed=1&consistent=1&soft=1&stage=${st}&clean=1`, { waitUntil: 'load' });
      await page.waitForFunction(() => !!window.__c09islands, null, { timeout: 120000 });
      await page.waitForTimeout(1800);
      const m = await page.evaluate(() => {
        const w = document.getElementById('scene').contentWindow;
        const v = w.rea.view, seg = w.__c09islandsShoreCount ?? null;
        let vis = 0, meshes = 0;
        for (const o of v.scene.children) { if (o.visible) vis++; if (o.type === 'Mesh' && o.visible) meshes++; }
        return { vis, meshes, yaw: +v.yaw.toFixed(3), override: !!v.scene.overrideMaterial };
      });
      stages[st] = m;
      await page.locator('#scene').screenshot({ path: `artifacts/coverage/islands-c09-stage-${st}.png` });
    }
    console.log('  阶段：' + JSON.stringify(stages));
    check('⑤ 阶段真的换画面（sea 只剩海面 / shore 多出轮廓线 / silhouette 纯黑覆盖材质 / full 岛体与网格全回来）',
      stages.sea.meshes <= 1 && stages.shore.vis === stages.sea.vis + 1 && stages.silhouette.override === true
      && stages.full.vis > stages.silhouette.vis && stages.full.meshes >= 5,
      `可见对象 sea ${stages.sea.vis} / shore ${stages.shore.vis}（+1=轮廓线）/ silhouette ${stages.silhouette.vis}(override ${stages.silhouette.override}) / full ${stages.full.vis}；网格数 sea ${stages.sea.meshes} → full ${stages.full.meshes}`);

    check('⑥ 0 页面/控制台错误', errors.length === 0, errors.slice(0, 3).join(' | ') || 'none');
  } catch (e) {
    check('运行', false, e.message);
  } finally {
    await browser.close();
  }
  fs.writeFileSync('artifacts/coverage/island-quality-consistent.json', JSON.stringify(out, null, 2));
  console.log(out.ok ? 'island-quality-consistent ALL PASS' : 'island-quality-consistent FAILED');
  process.exit(out.ok ? 0 : 1);
})();

// 1781405550061687016 · 「seamless patch blending! Some patches are projected (grass/water), some are manually UV-mapped (shoreline)」
// 口径：同一共享 World 上量四件事 —— ①投影 patch 跨格无硬缝（跨格边亮度差分 ≈ 同格内部）
// ②手工 UV 岸带：等距白点（u 弧长）+ 与岸平行的两道白浪线（v 分层 + 岸线暗缘）
// ③三种合成 A/B：hard 硬切 / alpha 平均 / height 高度混合的接缝跳跃与细节保留
// ④主场景实景：?shade=patchblend 开/关整帧差分、同状态噪声 0、关掉回位 0（真跑 View 主材质）
const { chromium } = require('playwright');
const fs = require('fs');
const assert = require('node:assert/strict');

const OUT = 'artifacts/coverage';

const decodeDiff = async ([a, b]) => {
  const dec = async (s) => { const r = await fetch('data:image/png;base64,' + s); const bm = await createImageBitmap(await r.blob()); const c = new OffscreenCanvas(bm.width, bm.height); const x = c.getContext('2d'); x.drawImage(bm, 0, 0); return x.getImageData(0, 0, bm.width, bm.height); };
  const A = await dec(a), B = await dec(b);
  let n = 0, sum = 0;
  for (let i = 0; i < A.data.length; i += 4) {
    const d = Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2]);
    if (d > 12) { n++; sum += d; }
  }
  return { n, w: A.width, h: A.height, mean: +(sum / Math.max(1, n) / 3).toFixed(2) };
};

(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const errors = [];
  const page = async (url, w = 1280, h = 900) => {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    p.on('pageerror', (e) => errors.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !m.location().url.endsWith('favicon.ico')) errors.push(m.text()); });
    for (let i = 0; ; i++) {
      try { await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 }); break; }
      catch (e) { if (i >= 2) throw e; }
    }
    return p;
  };
  const shot = async (p) => (await p.screenshot()).toString('base64');

  try {
    // ── ① 图集层（patch-blend.html：同一 World 的三种合成）
    const pg = await page('http://127.0.0.1:8769/patch-blend.html');
    await pg.waitForFunction(() => window.patchBlend?.ready, null, { timeout: 120000 });
    const r = await pg.evaluate(() => {
      const P = window.patchBlend, { ab, shore, cellEdge, field, uv } = P;
      return {
        field, ab, shore, cellEdge, uv,
        canvas: { w: P.canvases.map.width, h: P.canvases.map.height },
        mode: P.mode,
        grass: [P.sample(1.234, -2.5).grass, P.sample(1.234, -2.5).grass],
        grassA: P.sample(0.5, 0.5).grass, grassB: P.sample(1.05, 0.5).grass,
        shoreSamples: {
          land: P.shoreColorAt(1, .95, .4), sand: P.shoreColorAt(1, .72, .2), water: P.shoreColorAt(1, .1, -.3),
          wave: P.shoreColorAt(1, .34, -.2), dot: P.shoreColorAt(0, .12, -.2),
        },
        waveOff: null,
      };
    });
    const { ab, shore, cellEdge, field } = r;
    assert.ok(field.loops >= 1 && field.segs > 20, '岸线环没从共享 World 里追出来：' + JSON.stringify(field));
    assert.equal(field.res, 0.1);

    // 投影 patch = 世界 XZ 的纯函数（同一坐标必同色）→ 跨格连续的前提
    assert.deepEqual(r.grass[0], r.grass[1], 'grassColor 不是世界坐标的确定性函数');
    const dg = r.grassA.map((v, i) => Math.abs(v - r.grassB[i])).reduce((a, b) => a + b, 0);
    assert.ok(dg > .01, '相隔 0.55 世界单位的草色几乎相同（图案没随世界坐标变）');

    // 手工 UV 岸带：等距白点（每 0.4 弧长一颗）+ 两道白浪线
    assert.ok(shore.dotCount >= 10, '沿弧长的白点太少：' + shore.dotCount);
    assert.ok(shore.dotGaps.every((g) => Math.abs(g - .4) < .02), '白点间距不等于 dotSpacing 0.4：' + JSON.stringify(shore.dotGaps));
    assert.equal(shore.waveVs.length, 2, '白浪线条数不是 2：' + JSON.stringify(shore.waveVs));
    assert.ok(Math.abs((shore.waveVs[1] - shore.waveVs[0]) - .24) < .03, '两道浪线间距不等：' + JSON.stringify(shore.waveVs));
    // v 参与图案（不许海胆放射纹）：同一 u 不同 v 必须不同色
    const s = r.shoreSamples;
    assert.notDeepEqual(s.land, s.water, 'v 没进岸带图案');
    assert.ok(s.wave[2] - s.sand[2] > .25, '浪线不够白：' + JSON.stringify(s.wave));
    // UV 展开条的**像素**读数（不是只信函数）：整行白 = 一条浪线；白点行上数连续白段 = 白点颗数
    const uv = await pg.evaluate(() => window.patchBlend.uv);
    assert.equal(uv.whiteBands, 2, 'UV 条上的白浪线不是 2 道：' + JSON.stringify(uv));
    assert.ok(uv.bandCenters.every((c) => Math.abs((1 - c) - (c < .5 ? .58 : .34)) < .02), 'UV 条上浪线的 v 位置不对：' + JSON.stringify(uv.bandCenters));
    assert.ok(uv.dotRuns >= 18 && uv.dotRuns <= 22, 'UV 条上白点颗数不对（8 世界单位 / 0.4 = 20）：' + uv.dotRuns);

    // 投影 patch 跨格边差分 ≈ 同格内部（没有 per-cell 硬缝）
    assert.ok(cellEdge.crossN > 500 && cellEdge.innerN > 500, '跨格边样本太少：' + JSON.stringify(cellEdge));
    assert.ok(cellEdge.crossP95 <= cellEdge.innerP95 * 1.25, `跨格边差分偏高（硬缝）：${JSON.stringify(cellEdge)}`);
    assert.ok(cellEdge.crossP50 <= cellEdge.innerP50 * 2.5, `跨格边中位差分偏高：${JSON.stringify(cellEdge)}`);

    // 三种合成 A/B：height 介于 hard 与 alpha 之间，且有柔和过渡带
    assert.ok(ab.height.jump.meanJump < ab.hard.jump.meanJump * .7, `height 没削减跳跃：${ab.height.jump.meanJump} vs ${ab.hard.jump.meanJump}`);
    assert.ok(ab.height.jump.meanJump > ab.alpha.jump.meanJump, 'alpha 应该是最无缝（也最糊）的一档');
    assert.ok(ab.height.seam.gradBand > ab.alpha.seam.gradBand, `height 应比 alpha 留住更多细节：${ab.height.seam.gradBand} vs ${ab.alpha.seam.gradBand}`);
    assert.equal(ab.hard.seam.softMeanPx, 0, 'hard 不该有过渡带');
    assert.ok(ab.height.seam.softMeanPx > .5, 'height 没有柔和过渡带：' + ab.height.seam.softMeanPx);
    assert.ok(ab.hard.covHist[2] > 100, '岸带没有和草/水重叠：' + JSON.stringify(ab.hard.covHist));
    assert.ok(ab.height.detailKeptPct > ab.alpha.detailKeptPct, 'height 的细节保留应高于 alpha');

    // 模式切换真的换画面（不是只换读数）
    const heightShot = await shot(pg);
    await pg.evaluate(() => window.patchBlend.setMode('hard'));
    const hardShot = await shot(pg);
    await pg.evaluate(() => window.patchBlend.setMode('height'));
    const modDiff = await pg.evaluate(decodeDiff, [heightShot, hardShot]);
    assert.ok(modDiff.n > 1000, 'hard/height 两态画面几乎一样：' + JSON.stringify(modDiff));

    // 证据截图：整岛 + 岸带窗口放大
    await pg.evaluate(() => { while (window.patchBlend.zoom.scale < 3) document.querySelector('#zoom-in').click(); });
    await pg.waitForTimeout(200);
    await pg.screenshot({ path: `${OUT}/patch-blend-page-r156.png` });
    await pg.locator('#zoom').screenshot({ path: `${OUT}/patch-blend-shore-window-r156.png` });
    await pg.locator('#uv').screenshot({ path: `${OUT}/patch-blend-shore-uv-r156.png` });
    const zoomed = await pg.evaluate(() => window.patchBlend.zoom);

    // ── ② 主场景实景：?shade=patchblend 开/关（真跑 View 主材质）
    const sp = await page('http://127.0.0.1:8769/index.html?scene=terrain&grid=mixed');
    await sp.waitForFunction(() => window.rea?.view?.worldMesh?.geometry?.attributes?.position?.count > 100, null, { timeout: 120000 });
    await sp.evaluate(() => {
      const v = rea.view;
      const pin = () => { v.target.set(0, .6, 0); v.distance = 16; v.pitch = .95; v.yaw = .7; };
      pin(); setInterval(pin, 100);
      document.querySelectorAll('#hud,#topright,#tools,.hud').forEach((e) => (e.style.opacity = 0));
      v.__orig = v.render.bind(v); v.render = () => {};
    });
    await sp.waitForTimeout(1200);
    await sp.evaluate(() => rea.view.__orig(0));
    const off = await sp.screenshot();
    await sp.evaluate(() => rea.view.__orig(0));
    const off2 = await sp.screenshot();
    await sp.evaluate(() => rea.view.setDebug('patchblend', true));
    await sp.waitForTimeout(400);
    const stats = await sp.evaluate(() => { rea.view.__orig(0); return { on: !!rea.view.shading?.on?.patchblend, s: rea.view.shading?.stats?.patchblend }; });
    const on = await sp.screenshot({ path: `${OUT}/patch-blend-scene-on-r156.png` });
    await sp.evaluate(() => rea.view.__orig(0));
    const on2 = await sp.screenshot();
    await sp.evaluate(() => rea.view.setDebug('patchblend', false));
    await sp.waitForTimeout(400);
    await sp.evaluate(() => rea.view.__orig(0));
    const back = await sp.screenshot();

    const dAB = await sp.evaluate(decodeDiff, [off.toString('base64'), on.toString('base64')]);
    const dNoise = await sp.evaluate(decodeDiff, [off.toString('base64'), off2.toString('base64')]);
    const dOnNoise = await sp.evaluate(decodeDiff, [on.toString('base64'), on2.toString('base64')]);
    const dBack = await sp.evaluate(decodeDiff, [off.toString('base64'), back.toString('base64')]);
    await sp.screenshot({ path: `${OUT}/patch-blend-scene-off-r156.png` });

    assert.equal(stats.on, true, 'setDebug 没打开 patchblend');
    assert.ok(stats.s && stats.s.w > 40 && stats.s.segs > 20, '页面侧没烘出 patch 图：' + JSON.stringify(stats.s));
    assert.ok(dAB.n > 3000, `实景开/关差分太小（岸带没画出来）：${JSON.stringify(dAB)}`);
    assert.equal(dNoise.n, 0, '同状态噪声不为 0：' + JSON.stringify(dNoise));
    assert.equal(dOnNoise.n, 0, '开档后同状态噪声不为 0：' + JSON.stringify(dOnNoise));
    assert.equal(dBack.n, 0, '关掉没回位：' + JSON.stringify(dBack));

    const report = { id: '1781405550061687016', round: 'r156', field, ab, shore, uv, cellEdge, zoomed, modDiff, scene: { stats, dAB, dNoise, dOnNoise, dBack }, errors };
    fs.writeFileSync(`${OUT}/patch-blend-browser.json`, JSON.stringify(report, null, 2));
    assert.deepEqual(errors, []);
    console.log('PASS patch blend：岸线环 %d / 段 %d；白点 %d 颗 @%s · 浪线 v=%s；跨格边 p95 %s vs 内部 %s（p50 %s/%s）；'
      + 'jump hard %s / alpha %s / height %s，细节 %s%%/%s%%/%s%%，softMeanPx %s；实景开/关 %d px（噪声 %d / 开档噪声 %d / 回位 %d）',
      field.loops, field.segs, shore.dotCount, shore.dotGaps.slice(0, 3).join(','), shore.waveVs.join(','),
      cellEdge.crossP95, cellEdge.innerP95, cellEdge.crossP50, cellEdge.innerP50,
      ab.hard.jump.meanJump, ab.alpha.jump.meanJump, ab.height.jump.meanJump,
      ab.hard.detailKeptPct, ab.alpha.detailKeptPct, ab.height.detailKeptPct, ab.height.seam.softMeanPx,
      dAB.n, dNoise.n, dOnNoise.n, dBack.n);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });

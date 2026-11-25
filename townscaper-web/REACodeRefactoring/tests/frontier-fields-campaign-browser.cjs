// 1097458505315946496 第 4–5 步的运行验收：两侧场（ear-clip 三角）真的铺在页面上、多条前线是墨色虚线、
// 最终地图有地名 / 阶段数字 / 航路箭头 / 场内波纹纹样。判据全部来自真实渲染像素（两张截图在页面内解码后逐像素差分，
// 只把小结果传回 Node —— 整幅 ImageData 过 CDP 会被截断，第一版就是因为这个假通过）。
const { chromium } = require('playwright');
const fs = require('fs');
const assert = require('node:assert/strict');

const URL = (q) => `http://localhost:8769/campaign.html?${q}`;
const shot = async (p) => (await p.screenshot()).toString('base64');

// 页面内解码两张 PNG，按给定的矩形框统计差异像素，并给出若干取样点的平均色
const DIFF = `async ([a, b, boxes, probes]) => {
  const dec = async (s) => { const r = await fetch('data:image/png;base64,' + s); const bmp = await createImageBitmap(await r.blob());
    const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height; const g = c.getContext('2d'); g.drawImage(bmp, 0, 0);
    return { d: g.getImageData(0, 0, bmp.width, bmp.height).data, w: bmp.width, h: bmp.height }; };
  const A = await dec(a), B = await dec(b);
  const d3 = (d, e, i) => Math.abs(d[i] - e[i]) + Math.abs(d[i + 1] - e[i + 1]) + Math.abs(d[i + 2] - e[i + 2]);
  let total = 0;
  for (let i = 0; i < A.d.length; i += 4) if (d3(A.d, B.d, i) > 12) total++;
  const out = boxes.map(([x0, y0, x1, y1]) => {
    let n = 0;
    for (let y = Math.max(0, Math.round(y0)); y < Math.min(A.h, Math.round(y1)); y++)
      for (let x = Math.max(0, Math.round(x0)); x < Math.min(A.w, Math.round(x1)); x++) {
        const i = (y * A.w + x) * 4; if (d3(A.d, B.d, i) > 12) n++;
      }
    return n;
  });
  // 取样点用 A 的原始色（判「两侧场是不是两种色调」必须看渲染值，不是差分值）
  const means = probes.map(([x, y, r]) => {
    const s = [0, 0, 0]; let n = 0;
    for (let yy = Math.round(y) - r; yy <= Math.round(y) + r; yy++) for (let xx = Math.round(x) - r; xx <= Math.round(x) + r; xx++) {
      if (xx < 0 || yy < 0 || xx >= A.w || yy >= A.h) continue;
      const i = (yy * A.w + xx) * 4; s[0] += A.d[i]; s[1] += A.d[i + 1]; s[2] += A.d[i + 2]; n++;
    }
    return s.map((v) => +(v / n).toFixed(1));
  });
  return { total, boxes: out, means, size: [A.w, A.h] };
}`;

(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
  const errors = [];
  const open = async (q) => {
    const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    p.on('pageerror', (e) => errors.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await p.goto(URL(q));
    await p.waitForFunction(() => typeof window.campaign === 'function');
    await p.waitForTimeout(400);
    return p;
  };
  const compare = (p, b64a, b64b, boxes = [], probes = []) =>
    p.evaluate(new Function('return ' + DIFF)(), [b64a, b64b, boxes, probes]);

  const report = {};
  try {
    // ── 1. 有场 + 墨层：数据面
    const on = await open('fields=1');
    const C = await on.evaluate(() => campaign());
    const bands = await on.evaluate(() => campaignBands());
    const names = await on.evaluate(() => campaignNames());
    assert.equal(C.fields.okCount, 3, 'three frontier steps');
    assert.deepEqual(C.fieldPos, [-6, 0, 6]);
    assert.equal(C.fields.conflicts.length, 0, 'ordered steps do not cross');
    assert.equal(C.fields.triangles, C.fields.frontiers.reduce((n, f) => n + f.belowTris + f.aboveTris, 0), 'fields partition the padded rect');
    assert(C.fields.frontiers.every((f) => f.areaError < 1e-9), 'area conserved per frontier');
    assert.equal(Object.values(C.fields.bands).reduce((a, b) => a + b, 0), C.nodes, 'every island owns a band');
    assert.deepEqual(Object.keys(C.fields.bands).sort(), ['0', '1', '2', '3'], 'four bands for three frontiers');
    assert.equal(C.ink.on, true);
    assert.equal(C.ink.frontiers, 3, 'three dashed frontier curves');
    assert.equal(C.ink.frontierLabels, 3);
    assert.equal(C.ink.names, C.used, 'one place name per used island');
    assert.equal(C.ink.stageMarks, C.main, 'one numeral per route stage');
    assert.equal(C.ink.arrows, C.edges, 'one arrow-head per route edge');
    assert(C.ink.patterns >= 20, 'field wave pattern strokes ' + C.ink.patterns);
    assert.equal(new Set(names.map((n) => n.name)).size, names.length, 'names are distinct');
    assert(names.every((n) => /^[A-Z][a-z]+( [A-Z][a-z]+)?$/.test(n.name)), 'names look hand-lettered');
    report.counts = { used: C.used, edges: C.edges, main: C.main, triangles: C.fields.triangles, bands: C.fields.bands, ink: C.ink };
    report.bands = bands;

    // 同 URL 重载两次 = 同状态噪声底（页面静态、岛快照确定性）
    const again = await open('fields=1');
    const noise = await compare(on, await shot(on), await shot(again));
    assert.equal(noise.total, 0, 'same page twice must be pixel identical, got ' + noise.total);
    await again.close();

    // ── 2. 墨层 A/B：?ink=0
    const inkOff = await open('fields=1&ink=0');
    const offInfo = await inkOff.evaluate(() => campaign());
    assert.equal(offInfo.ink.on, false);
    const boxes = [];
    for (const a of C.ink.nameAnchors) boxes.push([a.x - 80, a.y - 11, a.x + 12, a.y + 11]);
    boxes.push([C.ink.arrowAnchor.x - 16, C.ink.arrowAnchor.y - 16, C.ink.arrowAnchor.x + 16, C.ink.arrowAnchor.y + 16]);
    const fa = C.ink.frontierAnchors[1];
    boxes.push([fa.x - 14, fa.y - 12, fa.x + 14, fa.y + 12]);
    const dInk = await compare(on, await shot(on), await shot(inkOff), boxes);
    assert(dInk.total > 8000, 'ink layer changes the picture, got ' + dInk.total);
    const [n1, n2, n3, arrowPx, labelPx] = dInk.boxes;
    assert(n1 > 30 && n2 > 30 && n3 > 30, 'place-name anchors really carry ink: ' + [n1, n2, n3].join('/'));
    assert(arrowPx > 15, 'arrow-head anchor changes, got ' + arrowPx);
    assert(labelPx > 8, 'frontier numeral anchor changes, got ' + labelPx);
    await inkOff.close();

    // ── 3. 两侧场 A/B：?fields=0（同 seed、同阶段）
    const noFields = await open('fields=0');
    const probes = bands.map((b) => [b.cx, b.cy, 4]);
    const dF = await compare(on, await shot(on), await shot(noFields), [], probes);
    assert(dF.total > 20000, 'tessellated fields change the picture, got ' + dF.total);
    const tints = dF.means;
    const spread = Math.max(...tints.map((t) => Math.hypot(t[0] - tints[0][0], t[1] - tints[0][1], t[2] - tints[0][2])));
    assert(tints.length === 4 && spread > 3, 'the two sides of the frontier are tinted differently, spread ' + spread.toFixed(2));
    report.tints = tints; report.spread = +spread.toFixed(2);
    await noFields.close();

    // ── 4. 视觉证据：最终地图 + 关掉墨层的同一机位
    await on.click('[data-s="5"]'); await on.waitForTimeout(200);
    await on.screenshot({ path: 'artifacts/coverage/campaign-frontier-ink-r149.png' });
    const off2 = await open('fields=1&ink=0');
    await off2.click('[data-s="5"]'); await off2.waitForTimeout(150);
    await off2.screenshot({ path: 'artifacts/coverage/campaign-frontier-ink-off-r149.png' });
    await off2.close();
    await on.close();

    assert.equal(errors.length, 0, errors.join('\n'));
    fs.writeFileSync('artifacts/coverage/frontier-fields-campaign-browser.json', JSON.stringify({
      ...report, inkPx: dInk.total, fieldPx: dF.total, noisePx: noise.total,
      namePx: [n1, n2, n3], arrowPx, labelPx, errors }, null, 2));
    console.log('PASS campaign frontier fields + ink', {
      used: C.used, inkPx: dInk.total, fieldPx: dF.total, noisePx: noise.total,
      namePx: [n1, n2, n3], arrowPx, labelPx, spread: report.spread, patterns: C.ink.patterns });
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });

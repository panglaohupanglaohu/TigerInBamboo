// 1478114309263839244 · "I quite like how the radial (instead of directional) size-sorting looks.
// Gonna make for some visually pleasing textures with that big coherent chunk in the middle."
// 验收：UV 分片（朝上面合并成一大片 + 崖柱脚印成洞）/ 径向按大小排布（大块在中间、碎片向外）/ 逐片放置 /
//       棋盘格贴回同一座岛 / 1482346496460828674 的三角反差色（对比边不同色、同类边收敛）。
// 判据全部来自页面真实渲染像素与页面读数（page.tri 逐像素三角号 + canvas 像素），不看「代码里应该有」。
const { chromium } = require('playwright'), fs = require('fs'), assert = require('node:assert/strict');
const OUT = 'artifacts/coverage';

const LAUNCH = {
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
};

// 页面内：从 page.tri（每像素三角号，-1=图块外）做 4 邻域连通块 → 每个连通块就是一片 UV 分片
const COMPONENTS = () => {
  const R = window.uvRadial, { size, tri } = R.page;
  const lab = new Int32Array(size * size).fill(-1), stack = new Int32Array(size * size);
  const comps = [];
  for (let o = 0; o < tri.length; o++) {
    if (tri[o] < 0 || lab[o] >= 0) continue;
    const id = comps.length; let sp = 0, n = 0, sx = 0, sy = 0, minX = 1e9, maxX = -1, minY = 1e9, maxY = -1;
    stack[sp++] = o; lab[o] = id;
    while (sp) {
      const q = stack[--sp], x = q % size, y = (q - x) / size; n++; sx += x; sy += y;
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (x > 0 && tri[q - 1] >= 0 && lab[q - 1] < 0) { lab[q - 1] = id; stack[sp++] = q - 1; }
      if (x < size - 1 && tri[q + 1] >= 0 && lab[q + 1] < 0) { lab[q + 1] = id; stack[sp++] = q + 1; }
      if (y > 0 && tri[q - size] >= 0 && lab[q - size] < 0) { lab[q - size] = id; stack[sp++] = q - size; }
      if (y < size - 1 && tri[q + size] >= 0 && lab[q + size] < 0) { lab[q + size] = id; stack[sp++] = q + size; }
    }
    comps.push({ px: n, cx: sx / n, cy: sy / n, w: maxX - minX + 1, h: maxY - minY + 1 });
  }
  comps.sort((a, b) => b.px - a.px);
  const covered = tri.reduce((s, t) => s + (t >= 0 ? 1 : 0), 0);
  const c = size / 2, dist = (k) => Math.hypot(k.cx - c, k.cy - c) / size;
  // 面积名次 vs 离页心距离：Spearman（负 = 越大越靠中）
  const n = comps.length, rank = (arr) => { const idx = arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]); const r = new Array(arr.length); idx.forEach(([, i], k) => { r[i] = k + 1; }); return r; };
  const ra = rank(comps.map((k) => k.px)), rd = rank(comps.map(dist));
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length, ma = mean(ra), md = mean(rd);
  let num = 0, da = 0, dd = 0;
  for (let i = 0; i < n; i++) { num += (ra[i] - ma) * (rd[i] - md); da += (ra[i] - ma) ** 2; dd += (rd[i] - md) ** 2; }
  return {
    components: comps.length, covered, fill: +(covered / (size * size)).toFixed(4),
    largest: +(comps[0].px / covered).toFixed(4), largestDist: +dist(comps[0]).toFixed(4),
    largestBox: [comps[0].w, comps[0].h], median: comps[Math.floor(comps.length / 2)].px,
    spearman: +(num / Math.sqrt(da * dd)).toFixed(4),
    px: comps.slice(0, 6).map((k) => [k.px, +dist(k).toFixed(3)]),
  };
};

// 页面内：canvas 像素统计（底色 #98a8ae 之外的染色占比 + 色相种数）
const CANVAS_STATS = (sel) => {
  const cv = document.querySelector(sel), ctx = cv.getContext('2d');
  const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
  let ink = 0, tint = 0, n = 0; const hues = new Set();
  for (let i = 0; i < d.length; i += 4) {
    n++;
    const r = d[i], g = d[i + 1], b = d[i + 2];
    if (Math.abs(r - 152) + Math.abs(g - 168) + Math.abs(b - 174) > 24) ink++;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx - mn > 22) { tint++; hues.add(Math.round((mx === r ? ((g - b) / (mx - mn) + 6) % 6 : mx === g ? (b - r) / (mx - mn) + 2 : (r - g) / (mx - mn) + 4) * 30)); }
  }
  return { ink: +(ink / n).toFixed(4), tint: +(tint / n).toFixed(4), hueBins: hues.size, data: cv.toDataURL('image/png').split(',')[1] };
};

(async () => {
  const b = await chromium.launch(LAUNCH);
  const p = await b.newPage({ viewport: { width: 1080, height: 1040 }, deviceScaleFactor: 1 });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico')) errors.push(m.text()); });
  const go = async (q) => {
    await p.goto('http://127.0.0.1:8769/uv-radial.html' + q, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => !!window.uvRadial && !!window.uvRadial.page, null, { timeout: 90000 });
    await p.waitForTimeout(150);
  };
  const save = (name, b64) => { fs.writeFileSync(`${OUT}/${name}`, Buffer.from(b64, 'base64')); return `${OUT}/${name}`; };

  try {
    // ---------- ① 朝上面合并（本片口径）：一大片在中间 + 崖柱脚印成洞 ----------
    await go('?mode=wire&charting=top&spin=0&step=9999');
    const top = await p.evaluate(() => ({ ...window.uvRadial.state, chartsExact: window.uvRadial.pack.placements.length, biggest: window.uvRadial.pack.placements[0].chart }));
    console.log('top state', JSON.stringify({ tris: top.tris, charts: top.charts, topCharts: top.topCharts, centerShare: top.centerShare, holes: top.centerHoles, spearman: top.spearman, fill: top.fill, overlaps: top.overlaps }));
    assert.ok(top.tris > 1200, '三角数 ' + top.tris);
    assert.ok(top.charts > 100, '分片数 ' + top.charts);
    assert.ok(top.topCharts >= 1, '应有朝上面合并出的大片：' + top.topCharts);
    assert.ok(top.centerShare > 0.2, '中心片应占全部面积 20% 以上（r55 夹角分片只有 4%）：' + top.centerShare);
    assert.equal(top.centerHoles, 1, '中心片应有一个洞（崖柱/拱洞脚印）：' + top.centerHoles);
    assert.equal(top.overlaps, 0, '装箱不应重叠：' + top.overlaps);
    assert.ok(top.fill > 0.25, 'UV 页填充率 ' + top.fill);
    assert.ok(top.spearman < -0.3, '面积名次~距离应为负相关（大的靠中）：' + top.spearman);

    const comp = await p.evaluate(COMPONENTS);
    console.log('components(top)', JSON.stringify(comp));
    // 一片 UV 分片在页面上是连续一块，但「朝上面合并」后再竖直投影，个别分片在夹点处被压成零宽
    // → 光栅化时裂成 2 块（这是投影口径，不是装箱错）。所以连通块数略多于分片数：0.8–1.6 倍。
    assert.ok(comp.components >= 0.8 * top.charts && comp.components <= 1.6 * top.charts, `连通块数应≈分片数：${comp.components} vs ${top.charts}`);
    assert.ok(comp.largest > 0.2, '最大连通块应占已覆盖像素 20% 以上：' + comp.largest);
    assert.ok(comp.largestDist < 0.18, '最大块应靠近页心（径向排布）：' + comp.largestDist);
    assert.ok(comp.spearman < -0.3, '像素口径的面积~距离 Spearman（裂块会稀释，模型口径 -0.634）：' + comp.spearman);
    assert.ok(Math.abs(comp.fill - top.pageFill) < 0.02, `canvas 覆盖与 page.fill 应一致：${comp.fill} vs ${top.pageFill}`);

    const wire = await p.evaluate(CANVAS_STATS, '#page');
    save('uv-radial-r140-wire-page.png', wire.data);
    assert.ok(wire.ink > 0.05, '线框页墨量 ' + wire.ink);

    // ---------- ② 逐片放置：step 小 = 只有大块，step 满 = 全部 ----------
    const inkAt = async (step) => (await p.evaluate((s) => {
      const cv = document.querySelector('#page'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      let ink = 0; for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - 152) + Math.abs(d[i + 1] - 168) + Math.abs(d[i + 2] - 174) > 24) ink++;
      return ink;
    }, step));
    await go('?mode=wire&charting=top&spin=0&step=6');
    const inkStep6 = await inkAt(6), st6 = await p.evaluate(() => window.uvRadial.state.step);
    await go('?mode=wire&charting=top&spin=0&step=9999');
    const inkAll = await inkAt(9999);
    console.log('placement', JSON.stringify({ inkStep6, inkAll, st6 }));
    assert.ok(inkStep6 > 0 && inkStep6 < inkAll * 0.6, `逐片放置：前 6 片应明显少于全部（${inkStep6} vs ${inkAll}）`);

    // ---------- ③ 棋盘格：同一个 UV 页贴回同一座岛 ----------
    await go('?mode=checker&charting=top&spin=0&step=9999');
    const checkStats = await p.evaluate(() => {
      const R = window.uvRadial, { size, tri } = R.page;
      let a = 0, b = 0;
      for (let o = 0; o < tri.length; o++) if (tri[o] >= 0) { const x = o % size, y = (o - x) / size; (Math.floor(x / size * 40) + Math.floor(y / size * 40)) & 1 ? a++ : b++; }
      return { cells: 40, dark: a, light: b, covered: a + b };
    });
    assert.ok(checkStats.covered > 0.25 * 512 * 512, '棋盘格应覆盖 UV 页 ' + checkStats.covered);
    assert.ok(Math.abs(checkStats.dark - checkStats.light) / (checkStats.dark + checkStats.light) < 0.15, '棋盘两色应接近各半：' + JSON.stringify(checkStats));
    const viewCheck = await (async () => { const el = p.locator('#view'); return (await el.screenshot()).toString('base64'); })();
    save('uv-radial-r140-checker-view.png', viewCheck);
    const pageCheck = await p.evaluate(CANVAS_STATS, '#page');
    save('uv-radial-r140-checker-page.png', pageCheck.data);
    assert.ok(pageCheck.tint > 0.2, '棋盘页染色占比 ' + pageCheck.tint);

    // 3D 视图：线框 ↔ 棋盘格 必须变（同一座岛换了 UV 贴图）
    await go('?mode=wire&charting=top&spin=0&step=9999');
    const vWire = await p.locator('#view').screenshot();
    fs.writeFileSync(`${OUT}/uv-radial-r140-wire-view.png`, vWire);
    await go('?mode=checker&charting=top&spin=0&step=9999');
    const vCheck = await p.locator('#view').screenshot();
    const diff = await p.evaluate(async ([a, c]) => {
      const load = (b64) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = 'data:image/png;base64,' + b64; });
      const [ia, ic] = await Promise.all([load(a), load(c)]);
      const mk = (im) => { const cv = new OffscreenCanvas(im.width, im.height), x = cv.getContext('2d'); x.drawImage(im, 0, 0); return x.getImageData(0, 0, cv.width, cv.height).data; };
      const da = mk(ia), dc = mk(ic); let n = 0;
      for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - dc[i]) + Math.abs(da[i + 1] - dc[i + 1]) + Math.abs(da[i + 2] - dc[i + 2]) > 18) n++;
      return n;
    }, [vWire.toString('base64'), vCheck.toString('base64')]);
    console.log('wire vs checker view diff px', diff);
    assert.ok(diff > 8000, '线框与棋盘格 3D 视图应显著不同：' + diff + ' px');

    // ---------- ④ 反差色（1482346496460828674）：对比边不同色 / 同类边收敛 / 逐轮迭代 ----------
    await go('?mode=contrast&charting=top&spin=0&step=9999&iter=220');
    const ctr = await p.evaluate(() => ({ ...window.uvRadial.state, before: window.uvRadial.state.before, after: window.uvRadial.state.measure, iter: window.uvRadial.sim.iter }));
    console.log('contrast', JSON.stringify(ctr));
    assert.ok(ctr.after.contrastDE > 3 * Math.max(ctr.after.sameDE, 0.2), `对比边 ΔE 应远大于同类边：${ctr.after.contrastDE} vs ${ctr.after.sameDE}`);
    // 随机初值下两类边都很散（contrastDE≈32.7 / sameDE≈31.8）；迭代要做的是「同类边收敛、对比边保持」，
    // 不是把 contrastDE 往上拉（那是纯随机噪声，本来就更散）。所以判据是比值不是绝对值。
    assert.ok(ctr.after.contrastDE > 15, '对比边 ΔE 应保持在高位：' + ctr.after.contrastDE);
    assert.ok(ctr.after.contrastDE / ctr.after.sameDE > 20, `对比边/同类边 ΔE 比应拉开：${ctr.after.contrastDE} / ${ctr.after.sameDE}`);
    assert.ok(ctr.after.sameDE < ctr.before.sameDE * 0.2, `同类边应被迭代压下去：${ctr.before.sameDE} → ${ctr.after.sameDE}`);
    assert.ok(ctr.after.minContrastDE > 6, '最小对比边 ΔE ' + ctr.after.minContrastDE);
    const stripStats = await p.evaluate(() => {
      const cs = [...document.querySelectorAll('#strip canvas')];
      return cs.map((c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let ink = 0; for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - 127) + Math.abs(d[i + 1] - 140) + Math.abs(d[i + 2] - 144) > 24) ink++; return +(ink / (d.length / 4)).toFixed(3); });
    });
    console.log('strip ink', JSON.stringify(stripStats));
    assert.equal(stripStats.length, 3, '顶部应有三张调试图');
    assert.ok(stripStats.every((v) => v > 0.1), '三张调试图都应有内容：' + JSON.stringify(stripStats));
    const ctrPage = await p.evaluate(CANVAS_STATS, '#page');
    save('uv-radial-r140-contrast-page.png', ctrPage.data);
    save('uv-radial-r140-contrast-view.png', await p.locator('#view').screenshot().then((x) => x.toString('base64')));
    const stripShot = await p.locator('#strip').screenshot();
    fs.writeFileSync(`${OUT}/uv-radial-r140-strip.png`, stripShot);
    assert.ok(ctrPage.tint > 0.2, '反差色 UV 页染色占比 ' + ctrPage.tint);
    assert.ok(ctrPage.hueBins > 6, '反差色应有连续渐变（色相种数）：' + ctrPage.hueBins);

    // 迭代轮数可回放：iter=40 时应比 220 轮更差（单调推进，不是一次性算完）
    await go('?mode=contrast&charting=top&spin=0&step=9999&iter=40');
    const early = await p.evaluate(() => ({ ...window.uvRadial.state.measure, iter: window.uvRadial.sim.iter }));
    console.log('iter40', JSON.stringify(early));
    assert.ok(early.sameDE > ctr.after.sameDE, `少迭代应更差：iter40 sameDE ${early.sameDE} vs iter220 ${ctr.after.sameDE}`);

    // ---------- ⑤ 对照：r55 法线夹角分片（不做朝上合并）----------
    // 实测如实口径：同一座测试岛上两种分片的最大片面积份额都是 30.7% —— 「夹角分片中心片只占 4%」是 r56 注释里
    // 实景岛的读数，不适用于这个与片子同构的小岛（顶面本来就一整片）。真正的差别是分片身份：topCharts 66 vs 0、
    // 最大片 chart id 2 vs 20、装箱读数也不同。所以只断言「确实换了一套分片」，不编造面积差。
    await go('?mode=wire&charting=angle&spin=0&step=9999');
    const ang = await p.evaluate(() => ({ ...window.uvRadial.state, biggest: window.uvRadial.pack.placements[0].chart }));
    const angComp = await p.evaluate(COMPONENTS);
    console.log('angle state', JSON.stringify({ charts: ang.charts, topCharts: ang.topCharts, centerShare: ang.centerShare, holes: ang.centerHoles, spearman: ang.spearman, fill: ang.fill, biggest: ang.biggest }));
    console.log('components(angle)', JSON.stringify(angComp));
    assert.equal(ang.topCharts, 0, '夹角分片不做朝上合并：' + ang.topCharts);
    assert.notEqual(ang.biggest, top.biggest, `两种分片的最大片应是不同的片：${ang.biggest} vs ${top.biggest}`);
    assert.ok(ang.charts >= 0.8 * top.charts, '夹角分片数应与朝上合并同量级：' + ang.charts);
    save('uv-radial-r140-angle-page.png', await p.evaluate(CANVAS_STATS, '#page').then((s) => s.data));

    assert.deepEqual(errors, [], '页面不应有 console error / pageerror：' + errors.join(' | '));
    console.log('PASS uv-radial-atlas-browser', JSON.stringify({
      tris: top.tris, charts: top.charts, topCharts: top.topCharts, centerShare: top.centerShare, holes: top.centerHoles,
      spearman: top.spearman, fill: top.fill, overlaps: top.overlaps,
      comps: comp.components, largest: comp.largest, largestDist: comp.largestDist, compSpearman: comp.spearman,
      inkStep6, inkAll, viewDiff: diff, contrastDE: ctr.after.contrastDE, sameDE: ctr.after.sameDE, iter40Same: early.sameDE,
      angleBiggest: ang.biggest, angleTopCharts: ang.topCharts,
    }));
  } finally { await b.close(); }
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });

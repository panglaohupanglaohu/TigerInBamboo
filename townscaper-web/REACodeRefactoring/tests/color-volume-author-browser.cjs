// 1710031224838771027 运行验收：五特征色容体作者面板（color-volume-lab.html）在真浏览器里点得动。
// 片里是 Unity Inspector：5 行特征各一段 H/S/L 范围 + 逐轴格数 + 12 格色带；本页是同一形制的可运行面板。
// 验：① 五行九控件齐全、每行 12 格色带；② 真实 input 事件改范围 → 画布重画，且变化像素全落在该特征掩膜内；
//     ③ 逐轴格数改连续档 → 色数上升、仍零泄漏；④ Roof 只动自己的色带、不动地形预览；
//     ⑤ 同参重载逐像素一致（确定性）；⑥ 0 console error；⑦ 截图留证。
const { chromium } = require('playwright'), fs = require('fs'), crypto = require('crypto');
const ART = 'artifacts/coverage';
const URL = process.env.REA_CV_URL || 'http://localhost:8769/color-volume-lab.html';
(async () => {
  const b = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const errors = [], fail = [], A = (ok, msg) => { if (!ok) fail.push(msg); };
  let report = {};
  try {
    const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
    p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource:')) errors.push('console: ' + m.text()); });
    const load = async () => { await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 }); await p.waitForFunction(() => !!window.colorVolumeLab, null, { polling: 50, timeout: 30000 }); };
    await load();

    // ---- a) 面板结构：五行 × (H起/止 S起/止 L起/止 + 格数 H/S/L) + 每行 12 格色带 ----
    const dom = await p.evaluate(() => {
      const rows = [...document.querySelectorAll('#rows tr[data-row]')].map((tr) => tr.dataset.row);
      const inputsPer = Object.fromEntries(rows.map((f) => [f, [...document.querySelectorAll(`#rows input[data-f="${f}"]`)].map((i) => i.dataset.k)]));
      const strips = Object.fromEntries(rows.map((f) => [f, document.querySelectorAll(`[data-strip="${f}"] .strip i`).length]));
      return { rows, inputsPer, strips, status: document.querySelector('#status').textContent };
    });
    A(dom.rows.join() === 'Grass,Roof,Cliff,Beach,Flowers', '五行不齐: ' + dom.rows.join());
    for (const f of dom.rows) A(dom.inputsPer[f].join() === 'h0,h1,s0,s1,l0,l1,n0,n1,n2', f + ' 控件不全: ' + dom.inputsPer[f].join());
    for (const f of dom.rows) A(dom.strips[f] === 12, f + ' 色带不是 12 格: ' + dom.strips[f]);

    const hashOf = (px) => crypto.createHash('sha256').update(Buffer.from(px)).digest('hex');
    const baseline = await p.evaluate(() => ({ px: window.colorVolumeLab.pixels(), mask: window.colorVolumeLab.mask(), used: window.colorVolumeLab.last.used, strips: window.colorVolumeLab.strips() }));
    A(baseline.px.length === 300 * 300 * 4, '画布尺寸不对: ' + baseline.px.length);
    const maskOf = (name) => { const s = new Set(); for (let i = 0; i < baseline.mask.length; i++) if (baseline.mask[i] === name) s.add(i); return s; };
    const masks = Object.fromEntries(['Grass', 'Cliff', 'Beach', 'Flowers'].map((f) => [f, maskOf(f)]));
    for (const f of Object.keys(masks)) A(masks[f].size > 100, f + ' 掩膜太小: ' + masks[f].size);

    // ---- 工具：真实 input 事件 → 与「上一步」画布差分（增量，不跟基线比，避免前一步的改动被算进来）----
    await p.evaluate(({ px, mask, used }) => {
      window.__base = px; window.__mask = mask; window.__maskUniq = used;
      window.__prev = window.colorVolumeLab.pixels().slice();
      window.__edit = (sel, value) => { const el = document.querySelector(sel); if (!el) throw new Error('no ' + sel); el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); };
      window.__diff = () => {
        const px = window.colorVolumeLab.pixels(), prev = window.__prev, out = { total: 0, by: {} };
        for (let i = 0; i < prev.length / 4; i++) if (px[i * 4] !== prev[i * 4] || px[i * 4 + 1] !== prev[i * 4 + 1] || px[i * 4 + 2] !== prev[i * 4 + 2]) { out.total++; const f = window.__mask[i]; out.by[f] = (out.by[f] || 0) + 1; }
        window.__prev = px.slice();
        return out;
      };
      window.__uniq = () => { const px = window.colorVolumeLab.pixels(), s = new Set(); for (let i = 0; i < px.length / 4; i++) s.add((px[i * 4] << 16) | (px[i * 4 + 1] << 8) | px[i * 4 + 2]); return s.size; };
    }, baseline);

    // ---- b) 改 Grass 的 H 范围 → 只有 Grass 像素变 ----
    const grass = await p.evaluate(() => {
      window.__edit('#cv-Grass-h0', '0.95'); window.__edit('#cv-Grass-h1', '0.99');
      const d = window.__diff();
      return { total: d.total, by: d.by, strips: window.colorVolumeLab.strips().Grass.map((c) => c.map((x) => Math.round(x * 255)).join(',')) };
    });
    A(grass.total > 500, '改 Grass 范围后画布几乎没变: ' + grass.total);
    A(Object.keys(grass.by).join() === 'Grass', 'Grass 改动泄漏到别的特征: ' + JSON.stringify(grass.by));
    A(new Set(grass.strips).size > 1, 'Grass 色带没跟着变');

    // ---- c) 改 Cliff 的 L 上限 → 只有 Cliff 像素变 ----
    const cliff = await p.evaluate(() => { window.__edit('#cv-Cliff-l1', '0.95'); const d = window.__diff(); return { total: d.total, by: d.by }; });
    A(cliff.total > 100, '改 Cliff 范围后画布几乎没变: ' + cliff.total);
    A(Object.keys(cliff.by).join() === 'Cliff', 'Cliff 改动泄漏: ' + JSON.stringify(cliff.by));

    // ---- d) 逐轴格数改连续档（Grass 5/3/3 → 0）→ 色数上升，仍零泄漏 ----
    const cont = await p.evaluate(() => {
      const before = window.__uniq();
      for (const id of ['#cv-Grass-n0', '#cv-Grass-n1', '#cv-Grass-n2']) window.__edit(id, '0');
      const d = window.__diff();
      return { before, after: window.__uniq(), total: d.total, by: d.by };
    });
    A(cont.after > cont.before, `改连续档色数没上升: ${cont.before} → ${cont.after}`);
    A(Object.keys(cont.by).join() === 'Grass', '格数改动泄漏: ' + JSON.stringify(cont.by));

    // ---- e) Roof 只动自己的色带，不动地形预览 ----
    const roof = await p.evaluate(() => {
      const px0 = window.colorVolumeLab.pixels(), s0 = window.colorVolumeLab.strips().Roof;
      window.__edit('#cv-Roof-h0', '0.45'); window.__edit('#cv-Roof-h1', '0.55');
      const px1 = window.colorVolumeLab.pixels(), s1 = window.colorVolumeLab.strips().Roof;
      let diff = 0; for (let i = 0; i < px0.length; i++) if (px0[i] !== px1[i]) diff++;
      return { canvasDiff: diff, stripChanged: JSON.stringify(s0) !== JSON.stringify(s1) };
    });
    A(roof.canvasDiff === 0, 'Roof 改动影响了地形预览: ' + roof.canvasDiff + ' 分量');
    A(roof.stripChanged, 'Roof 色带没变');

    // ---- f) 复位 → 与基线逐像素一致 ----
    const resetOk = await p.evaluate(() => {
      window.colorVolumeLab.reset();
      const px = window.colorVolumeLab.pixels();
      let diff = 0; for (let i = 0; i < px.length; i++) if (px[i] !== window.__base[i]) diff++;
      return { diff, rows: document.querySelectorAll('#rows tr[data-row]').length, strips: document.querySelectorAll('[data-strip] .strip i').length };
    });
    A(resetOk.diff === 0, '复位后没有回到基线: ' + resetOk.diff + ' 分量');
    A(resetOk.strips === 60, '色带格数合计不是 60（5×12）: ' + resetOk.strips);

    // ---- g) 确定性：默认态同参重载逐像素一致（重载后再截图，保证两张截图都是默认面板）----
    const h1 = hashOf(await p.evaluate(() => window.colorVolumeLab.pixels()));
    await load();
    const h2 = hashOf(await p.evaluate(() => window.colorVolumeLab.pixels()));
    A(h1 === h2, '同参重载不一致: ' + h1.slice(0, 12) + ' vs ' + h2.slice(0, 12));

    // ---- h) 截图（默认面板 + 改 Grass 后面板）----
    fs.mkdirSync(ART, { recursive: true });
    await p.screenshot({ path: `${ART}/color-volume-author-baseline.png` });
    await p.evaluate(() => { const el = document.querySelector('#cv-Grass-h0'); el.value = '0.95'; el.dispatchEvent(new Event('input', { bubbles: true })); const e2 = document.querySelector('#cv-Grass-h1'); e2.value = '0.99'; e2.dispatchEvent(new Event('input', { bubbles: true })); });
    await p.screenshot({ path: `${ART}/color-volume-author-grass.png`, clip: { x: 0, y: 0, width: 780, height: 420 } });

    report = { dom, maskPx: Object.fromEntries(Object.entries(masks).map(([k, v]) => [k, v.size])), used: baseline.used, grass, cliff, cont, roof, resetDiff: resetOk.diff, hashes: { default: h1.slice(0, 16), reload: h2.slice(0, 16) }, errors };
    A(errors.length === 0, 'console/page errors: ' + JSON.stringify(errors));
  } catch (e) {
    fail.push('exception: ' + (e && e.stack || e));
  } finally {
    fs.writeFileSync(`${ART}/color-volume-author-browser.json`, JSON.stringify({ pass: fail.length === 0, fail, report }, null, 1));
    await b.close();
  }
  console.log(JSON.stringify({ fail, report }, null, 1));
  if (fail.length) { console.error('FAIL ' + fail.length); process.exit(1); }
  console.log('PASS 色容体作者面板：5 行×9 控件、每行 12 格色带、单特征改动零泄漏、连续档色数上升、Roof 只动色带、复位归零、0 error');
})();

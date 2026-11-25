/**
 * tests/directional-volume-mega-browser.cjs
 * 1580845127207387137「1st texture = sdf volume（A 距离 / RG = mega texture UV）；2nd = baked 6 directional light
 * volume，raycast against the sdf，命中处按 UV 取 mega texture；3rd = the lit mega texture」运行验收（第 137 轮）。
 *
 * 判据全部来自真页面（megatexture-gi.html）/ 真 View / 真实 canvas 像素：
 *   ① 三张图都在且不是空白 —— ② 六向图必须是 3×2 六个面板，面板亮度彼此可分（+Y 天光面板最亮）；
 *   ② 换太阳方位（滑杆真事件）→ 逐 lobe 能量矢量跟着转，且与「背光方向」对齐（射线朝太阳走撞的是背光面）；
 *   ③ 第 3 张 = 被照亮的 mega texture：反弹 0 → 3 时它必须变化（间接光写回图集），且页头报 SDF-UV 命中率；
 *   ④ 换「贴图字段」下拉（出射光/反照率/直射/间接）→ 第 3 张图像素必须变（同一图集的四种读出）。
 */
const { chromium } = require('playwright');
const fs = require('fs');

const OUT = 'artifacts/coverage';
const url = (p) => 'http://127.0.0.1:8769/' + p;

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const errors = [], report = {}, fail = [];
  try {
    const p = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    p.on('pageerror', (e) => errors.push('mega: ' + e.message));
    await p.goto(url('megatexture-gi.html'), { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => window.megaReview?.stats && window.megaPage?.gi, null, { timeout: 300000, polling: 300 });
    await p.waitForFunction(() => !document.getElementById('bake').disabled, null, { timeout: 120000 });

    /* ---------- 页头读数 ---------- */
    report.status = await p.evaluate(() => ({ text: document.getElementById('status').textContent, stats: window.megaReview.stats }));

    /* ---------- 三张画布：面板结构 + 非空白 ---------- */
    const canvases = await p.evaluate(() => {
      const read = (id) => { const c = document.getElementById(id); return { w: c.width, h: c.height, d: c.getContext('2d').getImageData(0, 0, c.width, c.height).data }; };
      const lv = read('c-lv'), sdf = read('c-sdf'), mega = read('c-mega');
      // 六向图布局：3 列 × 2 行面板（debug 用 PW/PH 排），每面板 = lny 的 y 切片平铺
      const PW = lv.w / 3, PH = lv.h / 2, panels = [];
      for (let d = 0; d < 6; d++) {
        const px = (d >> 1) * PW, py = (d & 1) * PH; let s = 0, n = 0, ink = 0;
        for (let y = py; y < py + PH; y++) for (let x = px; x < px + PW; x++) {
          const i = (y * lv.w + x) * 4, bgp = lv.d[i] === 32 && lv.d[i + 1] === 52 && lv.d[i + 2] === 60;
          if (bgp) continue; ink++; s += (lv.d[i] + lv.d[i + 1] + lv.d[i + 2]) / 3;
        }
        panels.push({ mean: +(s / Math.max(1, ink)).toFixed(1), inkShare: +(ink / (PW * PH)).toFixed(3) });
      }
      const summarize = (cv) => {
        const set = new Set(); let ink = 0, darkRed = 0, magenta = 0;
        for (let i = 0; i < cv.d.length; i += 4) {
          const r = cv.d[i], g = cv.d[i + 1], b = cv.d[i + 2];
          set.add(r + ',' + g + ',' + b); if (r + g + b > 24) ink++;
          if (r > 60 && r < 190 && g < 40 && b < 60) darkRed++;            // SDF 实心（暗红）
          if (r > 90 && b > 90 && g < r - 20 && g < b - 20) magenta++;      // RG = UV（紫/品红族）
        }
        return { w: cv.w, h: cv.h, colors: set.size, inkShare: +(ink / (cv.d.length / 4)).toFixed(3), darkRed, magenta };
      };
      return { lvPanels: panels, lvSum: summarize(lv), sdf: summarize(sdf), mega: summarize(mega) };
    });
    report.canvases = canvases;

    /* ---------- ② 换太阳方位：逐 lobe 能量矢量跟着转 ---------- */
    const lobeVec = () => p.evaluate(() => {
      const r = window.megaPage.view.megaGI, E = [0, 0, 0, 0, 0, 0]; let cells = 0;
      for (let k = 0; k < r.stats.lvCells; k++) {
        if (r.lsolid[k]) continue; cells++;
        for (let d = 0; d < 6; d++) { const o = (k * 6 + d) * 3; E[d] += r.lv[o] + r.lv[o + 1] + r.lv[o + 2]; }
      }
      E.forEach((x, i) => { E[i] = +(x / Math.max(1, cells)).toFixed(4); });
      return { E, cells };
    });
    const setAz = async (az) => {
      await p.evaluate((v) => { const el = document.getElementById('az'); el.value = String(v); el.dispatchEvent(new Event('change')); }, az);
      await p.waitForTimeout(1500);
      await p.waitForFunction(() => !document.getElementById('bake').disabled, null, { timeout: 120000 });
    };
    await setAz(40);
    const L40 = await lobeVec();
    const grab = () => p.evaluate(() => ({ lv: document.getElementById('c-lv').toDataURL(), sdf: document.getElementById('c-sdf').toDataURL(), mega: document.getElementById('c-mega').toDataURL() }));
    const C40 = await grab();
    await setAz(130);
    const L130 = await lobeVec();
    const C130 = await grab();
    const hor = (E) => { const v = [E[0] - E[1], E[4] - E[5]], n = Math.hypot(...v) || 1; return v.map((x) => x / n); };
    const h40 = hor(L40.E), h130 = hor(L130.E);
    const anti = (h, az) => { const s = [Math.sin(az * Math.PI / 180), Math.cos(az * Math.PI / 180)]; return -(h[0] * s[0] + h[1] * s[1]); };
    // 原片同口径（213 帧逐帧量）：SDF 图帧间差异 0.000%，六向图最高 7.06%（f90），mega 图最高 47.75%（f90），f180 后回位
    report.sun = {
      az40: L40.E, az130: L130.E, anti40: +anti(h40, 40).toFixed(3), anti130: +anti(h130, 130).toFixed(3),
      lvCanvasChanged: C40.lv !== C130.lv, sdfCanvasChanged: C40.sdf !== C130.sdf, megaCanvasChanged: C40.mega !== C130.mega,
    };

    /* ---------- ③ 反弹 0 → 3：第 3 张图必须重写 ---------- */
    const setBounces = async (n) => {
      await p.evaluate((v) => { const el = document.getElementById('bounces'); el.value = String(v); el.dispatchEvent(new Event('change')); }, n);
      await p.waitForTimeout(1800);
      await p.waitForFunction(() => !document.getElementById('bake').disabled, null, { timeout: 120000 });
      return p.evaluate(() => ({ url: document.getElementById('c-mega').toDataURL(), stats: window.megaReview.stats }));
    };
    const b0 = await setBounces(0), b3 = await setBounces(3);
    report.bounces = { b0: { uvMatchRate: b0.stats.uvMatchRate }, b3: { uvMatchRate: b3.stats.uvMatchRate, rel: (b3.stats.bounceStats || []).map((x) => +x.relativeChange.toFixed(4)) }, megaChanged: b0.url !== b3.url };

    /* ---------- ④ 第 3 张图的四种读出（出射光 / 反照率 / 直射 / 间接） ---------- */
    const fieldUrl = async (v) => {
      await p.evaluate((f) => { const el = document.getElementById('megaField'); el.value = f; el.dispatchEvent(new Event('change')); }, v);
      await p.waitForTimeout(400);
      return p.evaluate(() => document.getElementById('c-mega').toDataURL());
    };
    const fields = {};
    for (const f of ['exitance', 'albedo', 'direct', 'indirect']) fields[f] = await fieldUrl(f);
    report.fields = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.length]));
    report.fieldsDistinct = new Set(Object.values(fields)).size;

    /* ---------- 截图（页头 + 三张图；六向图单独放大） ---------- */
    await p.evaluate(() => { document.getElementById('megaField').value = 'exitance'; document.getElementById('megaField').dispatchEvent(new Event('change')); });
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${OUT}/directional-volume-r137-page.png`, clip: { x: 0, y: 0, width: 1400, height: 330 } });
    const lvBox = await p.evaluate(() => { const r = document.getElementById('c-lv').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
    await p.screenshot({ path: `${OUT}/directional-volume-r137-six-lobes.png`, clip: lvBox });
    await p.evaluate(() => { const c = document.getElementById('c-lv'); c.style.width = c.clientWidth * 3 + 'px'; });
    await p.waitForTimeout(300);
    const lvBox2 = await p.evaluate(() => { const r = document.getElementById('c-lv').getBoundingClientRect(); return { x: Math.max(0, r.x), y: r.y, width: Math.min(1400, r.width), height: r.height }; });
    await p.screenshot({ path: `${OUT}/directional-volume-r137-six-lobes-3x.png`, clip: lvBox2 });
    await p.close();

    /* ---------- 断言 ---------- */
    const st = report.status.stats, cv = report.canvases, sun = report.sun, bo = report.bounces;
    if (!(st.lvEmpty > 1000 && st.lvCells > st.lvEmpty)) fail.push(`光体积格数异常 ${st.lvEmpty}/${st.lvCells}`);
    if (st.raysPerLobe !== 5) fail.push(`每 lobe 射线数 ${st.raysPerLobe} != 5`);
    if (!(st.uvMatchRate > .6)) fail.push(`SDF-UV 命中率 ${st.uvMatchRate} 太低（RG 没指向真实命中面）`);
    if (!/空格 × 6 lobe/.test(report.status.text) || !/SDF-UV 命中纹素/.test(report.status.text)) fail.push('页头读数缺六向/SDF-UV 口径：' + report.status.text.slice(0, 90));
    if (cv.lvPanels.length !== 6) fail.push('六向图不是 6 个面板');
    if (!cv.lvPanels.every((x) => x.inkShare > .5)) fail.push('六向图有空白面板 ' + JSON.stringify(cv.lvPanels));
    if (!(cv.lvPanels[2].mean > cv.lvPanels[3].mean)) fail.push(`+Y 面板不比 −Y 亮：${cv.lvPanels[2].mean} vs ${cv.lvPanels[3].mean}`);
    if (!(new Set(cv.lvPanels.map((x) => x.mean)).size >= 4)) fail.push('六个面板亮度几乎相同 ' + cv.lvPanels.map((x) => x.mean).join('/'));
    if (!(cv.sdf.magenta > 2000 && cv.sdf.darkRed > 200)) fail.push(`SDF 图缺 RG=UV 紫族 ${cv.sdf.magenta} 或实心暗红 ${cv.sdf.darkRed}`);
    if (!(cv.mega.colors > 200 && cv.mega.inkShare > .3)) fail.push('mega texture 图近乎空白 ' + JSON.stringify(cv.mega));
    if (!(sun.anti40 > .85 && sun.anti130 > .85)) fail.push(`换太阳后 lobe 能量矢量没指向背光侧 ${sun.anti40} / ${sun.anti130}`);
    if (!sun.lvCanvasChanged) fail.push('换太阳后六向图没变');
    if (sun.sdfCanvasChanged) fail.push('换太阳后 SDF 图变了（SDF/UV 与光照无关，原片帧间差异 0.000%）');
    if (!sun.megaCanvasChanged) fail.push('换太阳后被照亮的 mega texture 没变（原片 f90 有 47.75% 像素变化）');
    if (!bo.megaChanged) fail.push('反弹 0 → 3 时 mega texture 图没变（间接光没写回）');
    if (!(report.fieldsDistinct === 4)) fail.push(`四种贴图读出只有 ${report.fieldsDistinct} 种画面`);
    if (errors.length) fail.push('pageerror: ' + errors.join(' | '));

    fs.writeFileSync(`${OUT}/directional-volume-browser.json`, JSON.stringify({ report, errors, fail }, null, 2));
    if (fail.length) { console.error('FAIL\n - ' + fail.join('\n - ')); console.error(JSON.stringify(report, null, 1)); process.exitCode = 1; }
    else console.log('PASS 1580845127207387137 三张图 / 六向体积运行验收\n'
      + `  光体积 ${st.lvEmpty}/${st.lvCells} 空格 × 6 lobe × ${st.raysPerLobe} 射线 · 纹素 ${st.texels}（图集 ${st.atlas.join('×')}，${st.charts} 片）· SDF-UV 命中 ${(100 * st.uvMatchRate).toFixed(1)}%\n`
      + `  六面板亮度 ${cv.lvPanels.map((x) => x.mean).join(' / ')}（+Y ${cv.lvPanels[2].mean} > −Y ${cv.lvPanels[3].mean}）\n`
      + `  换太阳 40°→130°：lobe 能量矢量对背光方向对齐 ${sun.anti40} / ${sun.anti130}，六向图 ${sun.lvCanvasChanged ? '已变' : '未变'} / SDF 图 ${sun.sdfCanvasChanged ? '变了（错）' : '未变（对）'} / mega 图 ${sun.megaCanvasChanged ? '已变' : '未变'}\n`
      + `  反弹 0→3：mega texture 图 ${bo.megaChanged ? '已变' : '未变'}，相对变化 ${(bo.b3.rel || []).map((x) => (100 * x).toFixed(2) + '%').join(' → ')}\n`
      + `  第 3 张图四种读出 ${report.fieldsDistinct}/4 种画面 · SDF 图 紫族 ${cv.sdf.magenta}px 暗红 ${cv.sdf.darkRed}px`);
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });

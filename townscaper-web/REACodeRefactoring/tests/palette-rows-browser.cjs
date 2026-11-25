// 1371460793032716290 运行验收（第 227 轮）：Palette.png 多行贴图 —— 两行都能当墙色槽。
// 片中：Photoshop 里 Palette.png @3200%（16×2，96 B），上行一直是参考鲜艳色、下行被逐格涂浅；
// 保存后游戏左侧色槽与墙面一起变成「下行」的颜色。所以「哪一行是墙色」必须可换，且两行都要看得见。
// 本测：① 页面读图后把两行 16 格色块都画出来并高亮当前墙色行；② 行选择器把 &paletteRow= 透传给实景 iframe；
//       ③ 直接用选择器产出的 URL 分别起两页，墙色整组换成对应行，顶点色也跟着换。
const { chromium } = require('playwright'), fs = require('fs'), path = require('path'), zlib = require('zlib'), { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'artifacts/coverage');
const FIX = path.join(OUT, 'palette-rows-r227.png');
const SHOT = path.join(OUT, 'palette-rows-page-r227.png');
const FIXURL = '/artifacts/coverage/palette-rows-r227.png';
const makePng = (mode, file) => execFileSync('python3', [path.join(ROOT, 'tools/palette-png.py'), mode, file]);

// 读测试图（16×2 RGB8、非隔行）：行色直接来自 PNG，不靠生成脚本里那份颜色表反推
const readPngRows = (file) => {
  const d = fs.readFileSync(file); let i = 8, w = 0, h = 0; const idat = [];
  while (i < d.length) {
    const len = d.readUInt32BE(i), type = d.toString('ascii', i + 4, i + 8), body = d.subarray(i + 8, i + 8 + len);
    if (type === 'IHDR') { w = body.readUInt32BE(0); h = body.readUInt32BE(4); if (body[8] !== 8 || body[9] !== 2 || body[12] !== 0) throw Error('fixture 不是 8bit RGB 非隔行'); }
    else if (type === 'IDAT') idat.push(body); else if (type === 'IEND') break;
    i += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * 3 + 1, rows = [];
  for (let y = 0; y < h; y++) {
    const o = y * stride, row = [];
    for (let x = 0; x < w; x++) { const k = o + 1 + x * 3; row.push('#' + [raw[k], raw[k + 1], raw[k + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')); }
    rows.push(row);
  }
  return rows;
};
const eq = (a, b) => a.length === b.length && a.every((c, i) => String(c).toLowerCase() === String(b[i]).toLowerCase());

(async () => {
  const b = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--disable-dev-shm-usage'],
  });
  const errors = [], report = {};
  const watch = (p, tag) => {
    p.on('pageerror', (e) => { errors.push(`${tag} pageerror: ${e.message}`); });
    p.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource:')) errors.push(`${tag} console: ${m.text()}`); });
  };
  const step = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);
  // 高负载下 swiftshader 首帧偶发拖过窗口：换一张新页（新 GL 上下文）重试；不 reload（会把页面状态清掉）
  const open = async (url, tag, probe) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const p = await b.newPage({ viewport: { width: 1180, height: 940 } });
      watch(p, tag);
      await p.goto(url, { timeout: 90000, waitUntil: 'domcontentloaded' });
      try { await p.waitForFunction(probe, null, { timeout: 120000, polling: 150 }); return p; }
      catch (e) { step(`retry ${tag}#${attempt + 1} — ${e.message.split('\n')[0]}`); await p.close(); }
    }
    throw Error(tag + ' 首帧起不来（两次）');
  };
  const sceneReady = () => !!(window.wallPalette?.api?.view?.worldMesh?.geometry?.attributes?.color?.count > 0);
  const pngSettled = () => {
    const w = window.wallPalette;
    if (!w || !(w.pngState()?.version >= 1)) return false;
    const s = w.slotValues(), c = w.api.world.palette.colors;
    return s.length === c.length && s.every((x, i) => x.toLowerCase() === String(c[i]).toLowerCase());
  };

  try {
    makePng('rows', FIX);
    const fixRows = readPngRows(FIX);
    report.fixture = { file: path.basename(FIX), bytes: fs.statSync(FIX).size, w: fixRows[0].length, h: fixRows.length, rowsDiffer: fixRows[0].filter((c, i) => c !== fixRows[1][i]).length };
    if (fixRows.length !== 2 || fixRows[0].length !== 16) throw Error('测试图不是 16×2');
    if (!report.fixture.rowsDiffer) throw Error('测试图两行相同，换行不可判');

    // ---------- A. 页面：两行色块画出来 + 行选择器把行号透传给实景 ----------
    // 打开热更新 = iframe 二次加载，本机高负载下偶发起不来：整段换新页重试（最多 2 次）
    let p = null, r1 = null, town = null;
    for (let attempt = 0; attempt < 2 && !r1; attempt++) {
      p = await open('http://localhost:8769/wall-palette.html', 'page' + attempt, sceneReady);
      await p.evaluate(() => localStorage.removeItem('rea.wallPalette.v1'));
      town = await p.evaluate(() => [...window.wallPalette.initial]);
      await p.fill('#pngUrl', FIXURL);
      await p.check('#pngOn');
      try { await p.waitForFunction(pngSettled, null, { timeout: 90000, polling: 150 }); }
      catch (e) { step(`retry png-settle#${attempt + 1} — ${e.message.split('\n')[0]}`); await p.close(); p = null; continue; }
      r1 = await p.evaluate(() => ({
        slots: window.wallPalette.slotValues(), world: [...window.wallPalette.api.world.palette.colors],
        rows: window.wallPalette.pngRows?.length, iframeSrc: document.querySelector('#scene').src,
        info: document.querySelector('#pngRowInfo').textContent, pngInfo: document.querySelector('#pngInfo').textContent,
        strips: [...document.querySelectorAll('#pngRows .strip')].map((s) => ({ row: s.dataset.row, on: s.classList.contains('on'), cells: s.children.length })),
      }));
    }
    if (!r1) throw Error('热更新启用后页面没稳定（两次）');
    report.row1 = r1;
    if (r1.rows !== 2) throw Error('watcher 读到的行数不是 2：' + r1.rows);
    if (!r1.iframeSrc.includes('paletteRow=1')) throw Error('默认行号没透传：' + r1.iframeSrc);
    if (!eq(r1.slots, fixRows[1].slice(0, r1.slots.length))) throw Error('下行没成为墙色：' + JSON.stringify(r1.slots.slice(0, 4)) + ' vs ' + JSON.stringify(fixRows[1].slice(0, 4)));
    if (!eq(r1.slots, r1.world)) throw Error('页面色槽 ≠ World 墙色');
    if (r1.strips.length !== 2 || r1.strips.some((s) => s.cells !== 16)) throw Error('页面没画两行 16 格色块：' + JSON.stringify(r1.strips));
    if (!r1.strips[1].on || r1.strips[0].on) throw Error('高亮行不是当前墙色行：' + JSON.stringify(r1.strips.map((s) => s.on)));
    if (!/行数：2/.test(r1.info)) throw Error('行数没写进页面：' + r1.info);

    // 换行：行号立刻进 iframe URL、页面高亮跟着换（不等 iframe 首帧）
    await p.evaluate(() => { const s = document.querySelector('#pngRow'); s.value = '0'; s.dispatchEvent(new Event('change')); });
    await p.waitForTimeout(500);
    report.switchDom = await p.evaluate(() => ({
      iframeSrc: document.querySelector('#scene').src, info: document.querySelector('#pngRowInfo').textContent,
      strips: [...document.querySelectorAll('#pngRows .strip')].map((s) => ({ row: s.dataset.row, on: s.classList.contains('on'), cells: s.children.length })),
    }));
    if (!report.switchDom.iframeSrc.includes('paletteRow=0')) throw Error('换行后行号没进 iframe：' + report.switchDom.iframeSrc);
    if (!report.switchDom.strips[0].on || report.switchDom.strips[1].on) throw Error('换行后高亮没跟着换：' + JSON.stringify(report.switchDom.strips));
    if (!/第 1 行/.test(report.switchDom.info)) throw Error('换行后行号没写进页面：' + report.switchDom.info);
    await p.screenshot({ path: SHOT, fullPage: true });
    await p.close(); p = null;            // 关掉再开新页：同进程里多个 GL 上下文并存会把下次导航拖死（r227 实测）

    // ---------- B. 两行各自起实景页：墙色整组变成该行，顶点色也跟着换 ----------
    const scene = async (row) => {
      const url = `http://localhost:8769/index.html?scene=town&grid=mixed&palettePng=${encodeURIComponent(FIXURL)}&paletteRow=${row}`;
      const q = await open(url, 'row' + row, () => !!(window.rea?.view?.worldMesh?.geometry?.attributes?.color?.count > 0));
      // 首帧到了不等于图解码完：等轮询把这行真的推上墙（version≥1 且首槽已变成该行色）
      await q.waitForFunction((want) => { const c = window.rea?.world?.palette?.colors; return !!(window.rea?.palettePng?.state?.version >= 1 && c && c[0].toLowerCase() === want); },
        fixRows[row][0].toLowerCase(), { timeout: 90000, polling: 150 });
      // changed() 只置 dirty，重建在下一帧：等两帧 + dirty 清掉，否则读到的是旧墙色
      await q.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => r())))));
      await q.waitForTimeout(800);
      const out = await q.evaluate(() => {
        const { world, view } = window.rea;
        const col = view.worldMesh.geometry.attributes.color.array;
        const hist = {};                                     // 顶点色多重集：墙色 × 烘焙光 → 换行必换
        for (let i = 0; i < col.length; i += 3) {
          const k = [col[i], col[i + 1], col[i + 2]].map((v) => v.toFixed(4)).join(',');
          hist[k] = (hist[k] || 0) + 1;
        }
        return { colors: [...world.palette.colors], verts: col.length / 3, hist };
      });
      await q.close();
      return out;
    };
    const s0 = await scene(0), s1 = await scene(1);
    report.row0scene = { colors: s0.colors.slice(0, 4), verts: s0.verts };
    if (!eq(s0.colors, fixRows[0].slice(0, s0.colors.length))) throw Error('paletteRow=0 没把上行当墙色：' + JSON.stringify(s0.colors.slice(0, 4)));
    if (!eq(s1.colors, fixRows[1].slice(0, s1.colors.length))) throw Error('paletteRow=1 没把下行当墙色：' + JSON.stringify(s1.colors.slice(0, 4)));
    const only0 = Object.keys(s0.hist).filter((k) => !s1.hist[k]).reduce((n, k) => n + s0.hist[k], 0);
    const only1 = Object.keys(s1.hist).filter((k) => !s0.hist[k]).reduce((n, k) => n + s1.hist[k], 0);
    report.vertexSplit = { verts: s0.verts, onlyRow0: only0, onlyRow1: only1, shared: Object.keys(s0.hist).filter((k) => s1.hist[k]).length };
    if (!only0 || !only1) throw Error('两行顶点色没有分开：' + JSON.stringify(report.vertexSplit));
    if (only0 / s0.verts < 0.2 || only1 / s1.verts < 0.2) throw Error('换行只影响少数顶点，不像整面墙换色：' + JSON.stringify(report.vertexSplit));

    if (errors.length) throw Error(errors.join('\n'));
    fs.writeFileSync(path.join(OUT, 'palette-rows-browser-r227.json'), JSON.stringify({ report, errors }, null, 2));
    console.log('PASS palette.png multi-row', JSON.stringify({
      fixture: report.fixture, rows: r1.rows, strips: r1.strips.map((s) => s.cells), town0: town[0],
      row1: r1.slots.slice(0, 3), row0: s0.colors.slice(0, 3), slotDiffRows: r1.slots.filter((c, i) => c !== s0.colors[i]).length,
      vertexSplit: report.vertexSplit,
    }));
  } finally { await b.close(); }
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });

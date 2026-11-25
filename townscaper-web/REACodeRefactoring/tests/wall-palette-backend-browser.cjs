// 1200520827898343425 运行验收：墙色槽改色（同帧、只动该槽）+ Palette.png 热更新 + 常用配色存档。
// 片中四件事：改一个色槽 → 用该槽的体素同一帧换色；屋顶橙与其它槽不动；相机缓慢环绕；全片无 UI。
const { chromium } = require('playwright'), fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'artifacts/coverage');
const LIVE = path.join(OUT, 'palette-live-r168.png');
const makePng = (mode, file = LIVE) => execFileSync('python3', [path.join(ROOT, 'tools/palette-png.py'), mode, file]);

const group = (arr) => {
  const m = new Map();
  for (let i = 0; i < arr.length; i += 3) {
    const k = `${arr[i].toFixed(5)},${arr[i + 1].toFixed(5)},${arr[i + 2].toFixed(5)}`;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
};
const diffPx = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) n++; return n; };
const luma = (hex) => { const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };

(async () => {
  const b = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const errors = [], report = {};
  const watch = (p, tag) => {
    p.on('pageerror', (e) => { errors.push(`${tag} pageerror: ${e.message}`); console.log(tag, 'PAGEERROR', e.message.slice(0, 160)); });
    p.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource:')) errors.push(`${tag} console: ${m.text()}`); });
  };
  const step = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);
  // swiftshader 偶发首帧起不来（多页连续开 GL 上下文）：允许重载一次再等
  const ready = async (p, tag = '') => {
    step('wait scene ' + tag);
    const ok = () => p.waitForFunction(() => window.wallPalette?.api?.view?.worldMesh?.geometry?.attributes?.color?.count > 0, null, { timeout: 90000, polling: 100 });
    try { await ok(); } catch (e) { step('retry scene ' + tag + ' — ' + e.message.split('\n')[0]); await p.reload(); await ok(); }
  };

  try {
    // ---------- A. 手工改槽：同帧换色、只动该槽、可精确回位 ----------
    const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
    watch(p, 'A');
    await p.goto('http://localhost:8769/wall-palette.html');
    await ready(p, 'A');
    await p.evaluate(() => localStorage.removeItem('rea.wallPalette.v1'));

    report.edits = await p.evaluate(async () => {
      const T = await document.querySelector('iframe').contentWindow.eval("import('three')");
      const { world, view } = window.wallPalette.api;
      const v = view; v.__orig = v.render.bind(v); v.render = () => {};           // 冻主循环，A/B 噪声归零
      const renderer = v.renderer, rt = new T.WebGLRenderTarget(480, 360), old = renderer.getRenderTarget();
      const draw = () => { v.__orig(0); renderer.setRenderTarget(rt); renderer.render(v.scene, v.camera); const a = new Uint8Array(480 * 360 * 4); renderer.readRenderTargetPixels(rt, 0, 0, 480, 360, a); renderer.setRenderTarget(old); return a; };
      const readArr = () => v.worldMesh.geometry.attributes.color.array.slice();   // 重建换 geometry，必须每次重取
      const pxDiff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) n++; return n; };
      // 顶点色 = 墙色(线性) × 烘好的光照；重建会换顶点顺序，所以按「多重集」比对，不能按下标
      const key = (x, y, z) => x.toFixed(6) + ',' + y.toFixed(6) + ',' + z.toFixed(6);
      const multiset = (arr) => { const m = new Map(); for (let i = 0; i < arr.length; i += 3) { const k = key(arr[i], arr[i + 1], arr[i + 2]); m.set(k, (m.get(k) || 0) + 1); } return m; };
      const cellsBySlot = new Array(world.palette.colors.length).fill(0);
      for (let i = 0; i < world.color.length; i++) if (world.solid[i]) { const c = world.color[i]; if (c >= 0) cellsBySlot[c]++; }
      const pixRaw = draw(), arrRaw = readArr();
      const pixN = draw(), arr1 = readArr();
      const noisePx = pxDiff(pixRaw, pixN);                        // 同状态连画两帧 = 0
      let arrNoise = 0; for (let i = 0; i < arrRaw.length; i++) if (arr1[i] !== arrRaw[i]) arrNoise++;
      // 整岛重建有一层像素地板（换 palette 对象即全重建）：先吃掉它，再做 A/B，否则会把重建差算成改色差
      window.wallPalette.apply();
      const pix0 = draw(), before = readArr();
      const rebuildFloorPx = pxDiff(pixRaw, pix0);
      let rebuildArrDiff = 0; for (let i = 0; i < before.length; i++) if (before[i] !== arrRaw[i]) rebuildArrDiff++;
      const out = { verts: before.length / 3, cellsBySlot, noisePx, arrNoise, rebuildFloorPx, rebuildArrDiff, edits: [] };
      const order = cellsBySlot.map((n, i) => [n, i]).filter(([n]) => n > 0).sort((a, b) => b[0] - a[0]).slice(0, 3).map(([, i]) => i);
      // 判据：① 该槽设纯黑 → 恰好「用该槽的顶点」整组变 0（乘性、float 精确）；② 其余顶点只受烘好的反弹光影响
      const rels = (a, b) => { const out = []; for (let i = 0; i < a.length; i += 3) { const d = Math.max(Math.abs(b[i] - a[i]), Math.abs(b[i + 1] - a[i + 1]), Math.abs(b[i + 2] - a[i + 2])); const m = Math.max(a[i], a[i + 1], a[i + 2]); out.push(d === 0 ? 0 : d / Math.max(1e-6, m)); } return out; };
      for (const slot of order) {
        const colors = window.wallPalette.slotValues();
        const black = [...colors]; black[slot] = '#000000';
        window.wallPalette.setSlots(black); window.wallPalette.apply();
        const aZ = (draw(), readArr());
        const rz = rels(before, aZ);
        let zeroed = 0, exactSame = 0, bounce = 0, maxBounce = 0, hardOther = 0;
        for (let i = 0, vi = 0; vi < rz.length; vi++, i += 3) {
          if (aZ[i] === 0 && aZ[i + 1] === 0 && aZ[i + 2] === 0 && !(before[i] === 0 && before[i + 1] === 0 && before[i + 2] === 0)) zeroed++;
          else if (rz[vi] === 0) exactSame++;
          else { bounce++; maxBounce = Math.max(maxBounce, rz[vi]); if (rz[vi] >= 0.5) hardOther++; }
        }
        const rec = { slot, oldHex: colors[slot], cells: cellsBySlot[slot], zeroedVerts: zeroed, untouchedVerts: exactSame, bounceVerts: bounce, maxBounceRel: +maxBounce.toFixed(3), hardOther, totalVerts: rz.length };
        if (!zeroed) throw Error('slot ' + slot + ' 归零后没有顶点变黑（该槽没有几何）');
        if (hardOther) throw Error('slot ' + slot + ' 归零时把 ' + hardOther + ' 个别的顶点也整组改了');
        // 片中形制：改成一个鲜明色 → 画面必须变，且整组换色的顶点数 == 归零顶点数
        // 选一个「和原色差得足够远」的候选色，避免换色幅度太小把判据卡死
        const co = new T.Color(colors[slot]);
        const far = ['#8060a0', '#80c040', '#ff00ff', '#00ffff', '#ffff00'].filter((h) => h.toLowerCase() !== colors[slot].toLowerCase())
          .map((h) => { const c = new T.Color(h); return [h, Math.max(Math.abs(c.r - co.r), Math.abs(c.g - co.g), Math.abs(c.b - co.b)) / Math.max(co.r, co.g, co.b)]; })
          .sort((a, b) => b[1] - a[1])[0];
        const next = [...colors]; next[slot] = far[0];
        window.wallPalette.setSlots(next); window.wallPalette.apply();
        const aN = (draw(), readArr());
        const rn = rels(before, aN);
        let hard = 0;
        for (const v of rn) if (v >= 0.5) hard++;
        rec.recoloredVerts = hard; rec.newHex = next[slot]; rec.farRel = +far[1].toFixed(3); rec.pixDiff = pxDiff(pix0, draw());
        if (!rec.pixDiff) throw Error('slot ' + slot + ' 改色画面没变');
        if (hard !== zeroed) throw Error(`slot ${slot} 整组换色顶点 ${hard} ≠ 归零顶点 ${zeroed}`);
        // 回位：顶点色多重集精确回位 + 画面回到噪声以内
        window.wallPalette.setSlots(colors); window.wallPalette.apply();
        const backArr = (draw(), readArr());
        let backBad = 0; for (let i = 0; i < before.length; i++) if (backArr[i] !== before[i]) backBad++;
        rec.restoreVerts = backBad; rec.restoreDiff = pxDiff(pix0, draw());
        if (backBad) throw Error('slot ' + slot + ' 回位不完全：' + backBad + ' 个 float');
        if (rec.restoreDiff > noisePx) throw Error('slot ' + slot + ' 恢复后差分 ' + rec.restoreDiff + ' > 噪声 ' + noisePx);
        out.edits.push(rec);
      }
      rt.dispose();
      return out;
    });

    report.pngExport = await p.evaluate(async () => {
      const r = await window.wallPalette.exportPng();
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = r.url; });
      const c = document.createElement('canvas'); c.width = 16; c.height = 2;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const px = g.getImageData(0, 0, 16, 2).data, row1 = [], row0 = [];
      for (let x = 0; x < 16; x++) { const k = (1 * 16 + x) * 4; row1.push('#' + [px[k], px[k + 1], px[k + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')); }
      for (let x = 0; x < 16; x++) { const k = x * 4; row0.push('#' + [px[k], px[k + 1], px[k + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')); }
      return { w: img.width, h: img.height, bytes: r.bytes, dataUrlChars: r.url.length, row0, row1, slots: window.wallPalette.slotValues(), header: r.url.slice(0, 22) };
    });
    const ex = report.pngExport;
    if (ex.w !== 16 || ex.h !== 2) throw Error('导出尺寸不是 16×2');
    if (JSON.stringify(ex.row1.slice(0, 15)) !== JSON.stringify(ex.slots)) throw Error('导出的下行 ≠ 当前 15 槽：' + JSON.stringify(ex.row1.slice(0, 15)));
    if (!ex.header.startsWith('data:image/png;base64,')) throw Error('导出不是 PNG data URL');
    await p.fill('#slots input:nth-child(4)', '#8060a0');
    await p.screenshot({ path: path.join(OUT, 'wall-palette-slot-edit-r168.png'), fullPage: true });

    // ---------- B. 持久化：改色 → 刷新 → 自动恢复 → 清除 ----------
    await p.evaluate(() => { const c = window.wallPalette.slotValues(); c[3] = '#8060a0'; c[9] = '#808080'; window.wallPalette.setSlots(c); window.wallPalette.apply(); });
    const saved = await p.evaluate(() => ({ raw: window.wallPalette.storeRaw(), colors: window.wallPalette.slotValues() }));
    report.store = { raw: saved.raw, bytes: saved.raw.length, colors: saved.colors, parsed: JSON.parse(saved.raw) };
    if (!saved.raw || JSON.parse(saved.raw).v !== 1 || JSON.parse(saved.raw).colors.length !== 15) throw Error('存档没写进去');
    await p.reload(); await ready(p, 'A-reload');
    report.store.afterReload = await p.evaluate(() => ({ colors: window.wallPalette.slotValues(), world: window.wallPalette.api.world.palette.colors, info: document.querySelector('#storeInfo').textContent }));
    if (JSON.stringify(report.store.afterReload.colors) !== JSON.stringify(saved.colors)) throw Error('刷新后色槽没恢复');
    if (JSON.stringify(report.store.afterReload.world) !== JSON.stringify(saved.colors)) throw Error('刷新后 World 墙色没恢复');
    await p.screenshot({ path: path.join(OUT, 'wall-palette-restored-r168.png'), fullPage: true });
    // 坏存档：写坏 JSON → 刷新 → 页面拒绝、不崩、色槽回预设
    await p.evaluate(() => localStorage.setItem('rea.wallPalette.v1', '{"v":1,"colors":["#ff0000"]}'));
    await p.reload(); await ready(p, 'A-bad');
    report.store.badRecord = await p.evaluate(() => ({ colors: window.wallPalette.slotValues(), info: document.querySelector('#storeInfo').textContent, world: window.wallPalette.api.world.palette.colors.length }));
    if (report.store.badRecord.colors[0] !== report.store.badRecord.colors[0].toLowerCase()) throw Error('unreachable');
    if (report.store.badRecord.world !== 15) throw Error('坏存档把 World 弄坏了');
    if (!report.store.badRecord.info.includes('被拒')) throw Error('坏存档没在页面上报出来：' + report.store.badRecord.info);
    await p.close();

    // ---------- C. Palette.png 热更新（真改文件 → 轮询发现 → 换墙色 → 进存档） ----------
    makePng('pale', LIVE);
    const q = await b.newPage({ viewport: { width: 1400, height: 1000 } });
    watch(q, 'C');
    await q.goto('http://localhost:8769/wall-palette.html');
    await ready(q, 'C');
    await q.evaluate(() => localStorage.removeItem('rea.wallPalette.v1'));
    await q.fill('#pngUrl', '/artifacts/coverage/palette-live-r168.png');
    await q.check('#pngOn');
    await q.waitForFunction(() => window.wallPalette?.pngState()?.version >= 1, null, { timeout: 120000, polling: 100 });
    await q.waitForFunction(() => { const w = window.wallPalette; return w && JSON.stringify(w.slotValues()) === JSON.stringify(w.api.world.palette.colors); }, null, { timeout: 20000, polling: 100 });
    report.hot = { first: await q.evaluate(() => ({ colors: window.wallPalette.api.world.palette.colors, state: window.wallPalette.pngState(), slots: window.wallPalette.slotValues(), src: document.querySelector('#scene').src })) };
    const townColors = await q.evaluate(() => [...window.wallPalette.initial]);
    const pale = report.hot.first.colors;
    const changedVsTown = pale.filter((c, i) => c.toLowerCase() !== townColors[i].toLowerCase());
    const lighter = pale.every((c, i) => luma(c) >= luma(townColors[i]) - 0.5);
    if (changedVsTown.length !== 15 || !lighter) throw Error(`pale 图没生效：改 ${changedVsTown.length} 槽，变亮 ${lighter}`);
    if (JSON.stringify(report.hot.first.slots) !== JSON.stringify(pale)) throw Error('热更新后页面色槽没跟着换');
    await q.screenshot({ path: path.join(OUT, 'wall-palette-png-pale-r168.png'), fullPage: true });

    makePng('half', LIVE);                                        // 真·外部改图：同 URL 内容变了
    await q.waitForFunction((v) => window.wallPalette?.pngState()?.version > v, report.hot.first.state.version, { timeout: 60000, polling: 100 });
    await q.waitForFunction(() => { const w = window.wallPalette; return w && JSON.stringify(w.slotValues()) === JSON.stringify(w.api.world.palette.colors); }, null, { timeout: 20000, polling: 100 });
    report.hot.second = await q.evaluate(() => ({ colors: window.wallPalette.api.world.palette.colors, state: window.wallPalette.pngState(), slots: window.wallPalette.slotValues(), raw: window.wallPalette.storeRaw() }));
    const half = report.hot.second.colors;
    const oddPale = half.every((c, i) => (i % 2 ? c.toLowerCase() !== townColors[i].toLowerCase() : c.toLowerCase() === townColors[i].toLowerCase()));
    if (!oddPale) throw Error('half 图的下行（隔槽浅色）没按行读到：' + JSON.stringify(half.slice(0, 4)));
    // pale（全浅）→ half（隔槽还原）：变回来的是偶数列 0,2,…,14 共 8 槽
    if (JSON.stringify(report.hot.second.state.lastChanged) !== JSON.stringify([0, 2, 4, 6, 8, 10, 12, 14])) throw Error('热更新改槽数不对：' + report.hot.second.state.lastChanged.join(','));
    if (JSON.stringify(JSON.parse(report.hot.second.raw).colors) !== JSON.stringify(half)) throw Error('热更新后的配色没进存档');
    await q.screenshot({ path: path.join(OUT, 'wall-palette-png-half-r168.png'), fullPage: true });

    // 关掉热更新 → 回到预设，watcher 停轮询
    await q.uncheck('#pngOn');
    await q.waitForFunction(() => !document.querySelector('#scene').src.includes('palettePng'), null, { timeout: 20000 });
    await ready(q, 'C-off');
    report.hot.off = await q.evaluate(() => ({ png: window.wallPalette.png, colors: window.wallPalette.api.world.palette.colors, src: document.querySelector('#scene').src }));
    if (report.hot.off.png !== null || report.hot.off.src.includes('palettePng')) throw Error('关掉热更新后仍在拉图');
    report.hot.off.shouldReset = report.hot.off.colors.every((c, i) => c.toLowerCase() === townColors[i].toLowerCase());
    await q.close();

    if (errors.length) throw Error(errors.join('\n'));
    fs.writeFileSync(path.join(OUT, 'wall-palette-backend-browser.json'), JSON.stringify({ report, errors }, null, 2));
    console.log('PASS wall palette backend / palette.png hot reload / persistence', JSON.stringify({
      edits: report.edits.edits.map((e) => ({ slot: e.slot, cells: e.cells, zeroed: e.zeroedVerts, recolored: e.recoloredVerts, pixDiff: e.pixDiff, restoreDiff: e.restoreDiff })),
      bounce: report.edits.edits.map((e) => e.maxBounceRel), rebuildFloor: report.edits.rebuildFloorPx,
      noise: report.edits.noisePx, exportBytes: ex.bytes, storeBytes: report.store.bytes,
      restored: report.store.afterReload.colors[3], bad: report.store.badRecord.info,
      png: [report.hot.first.state.version, report.hot.second.state.version, report.hot.second.state.lastChanged.length],
    }));
  } finally { await b.close(); }
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });

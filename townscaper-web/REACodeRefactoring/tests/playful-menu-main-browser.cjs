/**
 * playful-menu-main-browser.cjs —— 1242824460325052417（383 帧 / 29.83fps / 12.84s）
 * "Finally making some proper UI. Turns out you can make a boring list of buttons playful by just tilting them slightly."
 *
 * 片内三段（由面板区奶油底色逐帧判开合，见证据 r199）：0–77 关（右上 ≡）、78–332 开（✕ + 面板）、333–358 关、359–382 开。
 * 512×512 帧实测几何：面板贴右缘、宽 167（视口 32.6%）、行宽 152（左留 4 / 右留 11）；
 * 主行动 New/Open 高 60 / 次级 Quit·Save·Load 高 36 / Undo·Redo 双联 74×65 / Grid 45；
 * 行倾角 −2.01…+2.03°（minAreaRect 逐行量）；颜色按功能固定（绿 / 红粉 / 奶油 / 浅蓝），不是色相坡。
 *
 * 本测在**真实主场景**（index.html?gameui=1&scene=town）里验：开合、几何比例、倾角区间与确定性、
 * 未旋转命中槽不重叠、Undo/Redo 深度读数是真栈、Grid 双圆、以及「菜单叠在活城镇上」的像素 A/B。
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'artifacts/coverage');
const URL = 'http://127.0.0.1:8769/index.html?gameui=1&scene=town&seed=7';

function decodePng(buf) {
  let pos = 8, w = 0, h = 0, colorType = 6;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.slice(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); colorType = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  let q = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[q++];
    const line = raw.slice(q, q + stride); q += stride;
    const prev = y ? out.slice((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    const cur = out.slice(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, bb = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      if (f === 1) v += a;
      else if (f === 2) v += bb;
      else if (f === 3) v += (a + bb) >> 1;
      else if (f === 4) {
        const pp = a + bb - c, pa = Math.abs(pp - a), pb = Math.abs(pp - bb), pc = Math.abs(pp - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? bb : c);
      }
      cur[i] = v & 255;
    }
  }
  return { w, h, bpp, data: out };
}

const fails = [];
const ok = (cond, msg, detail) => { console.log(`${cond ? '  ok  ' : ' FAIL '} ${msg}${detail !== undefined ? ' :: ' + detail : ''}`); if (!cond) fails.push(msg + (detail !== undefined ? ' :: ' + detail : '')); };
const near = (v, want, tol) => Math.abs(v - want) <= tol;

(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.rea?.view && document.querySelector('#gameui-c06 .gclose'), null, { timeout: 90000 });
  await page.waitForTimeout(1200);
  // 冻时间轴：主循环每帧 view.render(dt) 会推 uTime，同状态两帧差分不为 0
  await page.evaluate(() => { const v = window.rea.view; if (!v.__frozen) { const o = v.render.bind(v); v.render = () => o(0); v.__frozen = true; } });

  const closed = await page.evaluate(() => {
    const c = document.querySelector('#gameui-c06 .gclose'), m = document.querySelector('#gameui-c06 .gmenu');
    const r = c.getBoundingClientRect();
    return { glyph: c.textContent, menuHidden: m.classList.contains('hidden'), x: r.x, right: innerWidth - r.right, w: r.width, h: r.height };
  });
  ok(closed.menuHidden === true, '初始态：菜单关闭', closed.menuHidden);
  ok(closed.glyph === '≡', '关闭态右上角是 ≡（片 0000–0077）', closed.glyph);
  ok(near(closed.right, 8, 4), '关闭态 ≡ 贴右缘（片 0338 右上角）', closed.right.toFixed(1));

  // 真实点击打开
  await page.click('#gameui-c06 .gclose');
  await page.waitForTimeout(180);
  const geo = await page.evaluate(() => {
    const m = document.querySelector('#gameui-c06 .gmenu'), r = m.getBoundingClientRect();
    const rows = [...m.querySelectorAll('button')].map((b) => {
      const q = b.getBoundingClientRect(); const tf = getComputedStyle(b).transform;
      let rot = 0; if (tf && tf !== 'none') { const n = tf.match(/matrix\(([^)]+)\)/); if (n) { const [a, bb] = n[1].split(',').map(Number); rot = Math.atan2(bb, a) * 180 / Math.PI; } }
      return { key: b.dataset.key, g: b.dataset.g, x: q.x, y: q.y, w: b.offsetWidth, h: b.offsetHeight, slotY: b.offsetTop, rot };
    });
    const c = document.querySelector('#gameui-c06 .gclose');
    return { panel: { x: r.x, y: r.y, w: r.width, h: r.height, right: innerWidth - r.right }, rows, glyph: c.textContent, uw: innerWidth };
  });
  ok(geo.glyph === '✕', '打开态角标变 ✕（片 0078+）', geo.glyph);
  ok(near(geo.panel.right, 0, 1.5), '面板贴右缘（片 x 345–512）', geo.panel.right.toFixed(1));
  ok(near(geo.panel.y, 0, 1.5), '面板贴顶（片 y 0 起）', geo.panel.y.toFixed(1));
  ok(near(geo.panel.w / geo.uw, 167 / 512, 0.02), '面板宽 = 视口 32.6%（片 167/512）', (geo.panel.w / geo.uw).toFixed(3));

  const by = Object.fromEntries(geo.rows.map((r) => [r.key, r]));
  const HEIGHT = { new: 60, open: 60, quit: 36, save: 36, load: 36, undo: 65, redo: 65, grid: 45 };
  for (const [k, want] of Object.entries(HEIGHT)) ok(near(by[k].h, want, 4), `行高 ${k} = ${want}（片实测）`, by[k].h.toFixed(1));
  ok(near(by.new.w / geo.panel.w, 152 / 167, 0.03), '行宽 = 面板 91%（片 152/167）', (by.new.w / geo.panel.w).toFixed(3));
  ok(near(by.undo.w, 74, 6) && near(by.redo.w, 74, 6), 'Undo/Redo 双联各 74 宽（片 74×65）', `${by.undo.w.toFixed(1)}/${by.redo.w.toFixed(1)}`);
  ok(by.new.x < by.undo.x, '双联两钮并排（同一行）', `${by.new.x.toFixed(0)} vs ${by.undo.x.toFixed(0)}`);

  // 颜色按功能固定（片内 绿 / 红粉 / 奶油 / 浅蓝）
  const colors = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#gameui-c06 .gmenu button')].map((b) => [b.dataset.key, getComputedStyle(b).backgroundColor])));
  const rgb = (s) => s.match(/\d+/g).map(Number);
  const near3 = (s, want, tol) => { const v = rgb(s); return v.length >= 3 && v.slice(0, 3).every((x, i) => Math.abs(x - want[i]) <= tol); };
  ok(near3(colors.new, [198, 240, 181], 12) && near3(colors.open, [198, 240, 181], 12), 'New/Open = 片内绿 rgb(198,240,181)', colors.new);
  ok(near3(colors.quit, [241, 181, 175], 12) && near3(colors.undo, [241, 181, 175], 12), 'Quit/Undo/Redo = 片内红粉 rgb(241,181,175)', colors.quit);
  ok(near3(colors.save, [241, 223, 192], 12) && near3(colors.load, [241, 223, 192], 12), 'Save/Load = 片内奶油 rgb(241,223,192)', colors.save);
  ok(near3(colors.grid, [180, 201, 225], 12), 'Grid = 片内浅蓝 rgb(180,201,225)', colors.grid);

  // 倾角：片内 −2.01…+2.03°，方向有正有负
  const rots = geo.rows.map((r) => r.rot);
  ok(rots.every((r) => Math.abs(r) >= 0.2 && Math.abs(r) <= 2.4), '逐行倾角都在 0.2–2.4°（片内绝对值 0.38–2.29）', rots.map((r) => r.toFixed(2)).join(','));
  ok(rots.some((r) => r > 0.3) && rots.some((r) => r < -0.3), '倾角有正有负（不是整列同向）', '');
  // 命中槽（未旋转 AABB）不重叠：相邻行按 y 排序后间隙 ≥ 0
  const sorted = [...geo.rows].sort((a, b) => a.slotY - b.slotY).filter((r, i, a) => i === 0 || Math.abs(r.slotY - a[i - 1].slotY) > 1);
  let minSep = Infinity, overlaps = 0;
  for (let i = 1; i < sorted.length; i++) { const sep = sorted[i].slotY - (sorted[i - 1].slotY + sorted[i - 1].h); minSep = Math.min(minSep, sep); if (sep < -0.5) overlaps++; }
  ok(overlaps === 0, '未旋转命中槽相邻行不重叠（倾斜只改视觉层，gap·0.45 约束）', `minSep=${minSep.toFixed(2)} overlaps=${overlaps}`);

  // 确定性：重载后同一组倾角逐字复现
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.rea?.view && document.querySelector('#gameui-c06 .gclose'), null, { timeout: 90000 });
  await page.waitForTimeout(600);
  await page.evaluate(() => { const v = window.rea.view; if (!v.__frozen) { const o = v.render.bind(v); v.render = () => o(0); v.__frozen = true; } });
  await page.click('#gameui-c06 .gclose');
  await page.waitForTimeout(150);
  const rots2 = await page.evaluate(() => [...document.querySelectorAll('#gameui-c06 .gmenu button')].map((b) => {
    const n = getComputedStyle(b).transform.match(/matrix\(([^)]+)\)/); if (!n) return 0;
    const [a, bb] = n[1].split(',').map(Number); return Math.atan2(bb, a) * 180 / Math.PI;
  }));
  ok(rots.every((r, i) => Math.abs(r - rots2[i]) < 1e-6), '重载后倾角逐字复现（固定种子）', rots2.map((r) => r.toFixed(2)).join(','));

  // Undo/Redo 深度读数是真栈
  const depth = await page.evaluate(() => {
    const s = window.rea.gameUI.state;
    const t = [...document.querySelectorAll('#gameui-c06 .gcount span')].map((e) => e.textContent);
    return { t, depth: s.actState?.depth, redoDepth: s.actState?.redoDepth };
  });
  ok(String(depth.depth) === depth.t[0], 'Undo 计数 == 真实栈深（片内数字 = 深度）', `${depth.t[0]} vs ${depth.depth}`);
  ok(String(depth.redoDepth ?? 0) === depth.t[1], 'Redo 计数 == 真实重做栈深', `${depth.t[1]} vs ${depth.redoDepth}`);

  // Grid 双圆：点行 → 第一枚亮 + view debug grid 真打开；点第二枚 → gridregular 单独亮
  const gridState = await page.evaluate(() => {
    const row = document.querySelector('#gameui-c06 .gmenu button[data-key="grid"]');
    row.click();
    const k1 = row.querySelector('[data-knob="grid"]').classList.contains('on');
    const g1 = window.rea.view.debugState?.grid;
    row.querySelector('[data-knob="regular"]').click();
    const k2 = row.querySelector('[data-knob="regular"]').classList.contains('on');
    const g2 = window.rea.view.debugState?.gridregular;
    return { k1, g1, k2, g2, count: row.querySelectorAll('.knob').length };
  });
  ok(gridState.count === 2, 'Grid 行两枚圆点（片内两个蓝圈）', gridState.count);
  ok(gridState.k1 === true && gridState.g1 === true, '点行 → 圆点亮 + 真开网格', JSON.stringify(gridState));
  ok(gridState.k2 === true && gridState.g2 === true, '点第二枚 → 只开 gridregular', JSON.stringify(gridState));

  // 像素 A/B：菜单叠在活城镇上，差异必须落在面板矩形内（>=95%），左侧城镇仍在
  await page.evaluate(() => { const s = window.rea.gameUI.state; s.grid = false; window.rea.view.setDebug('grid', false); window.rea.view.setDebug('gridregular', false); s.setMenu(false); });
  await page.waitForTimeout(220);
  const shotA = await page.screenshot();
  await page.click('#gameui-c06 .gclose');
  await page.waitForTimeout(220);
  const shotB = await page.screenshot();
  const A = decodePng(shotA), B = decodePng(shotB);
  const closeRect = await page.evaluate(() => { const r = document.querySelector('#gameui-c06 .gclose').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  let diff = 0, inPanel = 0; const panelX = Math.round(Math.min(geo.panel.x, closeRect.x));
  for (let y = 0; y < A.h; y++) for (let x = 0; x < A.w; x++) {
    const i = y * A.bpp * A.w + x * A.bpp;
    if (Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2]) > 24) { diff++; if (x >= panelX - 4) inPanel++; }
  }
  ok(diff > 5000, '开/关差分不为 0（菜单真的画出来）', diff + 'px');
  ok(inPanel / Math.max(1, diff) > 0.95, '差分 ≥95% 落在面板矩形内（=叠在城镇上，不是换页）', (100 * inPanel / Math.max(1, diff)).toFixed(1) + '%');
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'playful-menu-open-r199.png'), shotB);
  fs.writeFileSync(path.join(OUT, 'playful-menu-closed-r199.png'), shotA);

  // 同状态噪声：同状态连拍两帧
  const shot2 = await page.screenshot();
  const C = decodePng(shot2); let noise = 0, nx0 = 1e9, nx1 = -1, ny0 = 1e9, ny1 = -1;
  for (let y = 0; y < B.h; y++) for (let x = 0; x < B.w; x++) { const i = y * B.bpp * B.w + x * B.bpp; if (Math.abs(B.data[i] - C.data[i]) + Math.abs(B.data[i + 1] - C.data[i + 1]) + Math.abs(B.data[i + 2] - C.data[i + 2]) > 24) { noise++; nx0 = Math.min(nx0, x); nx1 = Math.max(nx1, x); ny0 = Math.min(ny0, y); ny1 = Math.max(ny1, y); } }
  // 场景已冻（view.render(dt)→render(0)）；残余抖动只在面板内 = 旋转标签在 swiftshader 下的重新光栅化
  ok(noise / (B.w * B.h) < 0.005 && nx0 >= panelX - 4, '同状态差分 ≤0.5% 且全落在面板内（场景冻结；残余 = 旋转文字光栅抖动）', `${noise}px bbox ${nx0},${ny0}-${nx1},${ny1}`);
  const realErrs = errs.filter((e) => !/VALIDATE_STATUS false/.test(e) && !/^\s*$/.test(e) && !/Program Info Log/.test(e));
  ok(realErrs.length === 0, '0 真实 console error（swiftshader VALIDATE_STATUS 空日志为环境已知）', realErrs.slice(0, 3).join(' | '));

  await browser.close();
  console.log(fails.length ? `\nFAILED ${fails.length}\n` + fails.join('\n') : '\nALL PASS');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('TEST ERROR', e); process.exit(2); });

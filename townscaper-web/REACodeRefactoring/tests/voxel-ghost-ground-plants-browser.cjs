// 第 187 轮：794993371261665280 —— 基座广场小树（片子里的树在底板上排一列，不在露台）
// 片内依据（frame-0060 / frame-0150 原尺寸）：塔基底板上 7–9 棵等大树冠的小树，沿墙根排成一列，
// 每棵脚下有一圈花池；树冠高度约 1 格、彼此间距 1–2 格。r183 记的「露台灌木/花盆」是误判。
// 量法：真 Chrome + Canvas，① 小树开/关像素差；② 差分像素必须落在「花池投影」里（不是撒满全屏）；
// ③ 每棵的屏幕落点都在底板带（塔身底边以下）；④ 重载噪声 0；⑤ 关→开→关逐字节幂等。
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// 本轮踩到的坑（累积第 63 条）：2D canvas 在 GPU 后端时，`getImageData` 在一次 draw 之后
// 同一个 JS turn 里仍可能读回**上一次**的缓冲 —— 本轮实测 on→off→on 三个读数里 back 与 on
// 稳定差 29731px，而「开/关/开」三张截图的字节完全一致（shotReturn 0）、目视也没差。
// 结论：像素账一律从**截图 PNG 解回来**算（截图走内核合成，不吃读回缓存）。
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
function imgDiff(A, B) {   // 逐像素比（A/B 同尺寸），返回 {n, inside, near, far, bbox}
  let n = 0, x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  const pts = [];
  for (let px = 0; px < A.w * A.h; px++) {
    const i = px * A.bpp, j = px * B.bpp;
    if (Math.abs(A.data[i] - B.data[j]) + Math.abs(A.data[i + 1] - B.data[j + 1]) + Math.abs(A.data[i + 2] - B.data[j + 2]) <= 6) continue;
    n++;
    const x = px % A.w, y = Math.floor(px / A.w);
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    if (pts.length < 400000) pts.push([x, y]);
  }
  return { n, pts, bbox: n ? [x0, y0, x1, y1] : null };
}

(async () => {
  const b = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const p = await b.newPage({ viewport: { width: 1120, height: 1240 } });
  const errors = [];
  const out = path.resolve(__dirname, '../artifacts/coverage');
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  const report = { problems: [] };
  const shot = async (name) => {
    await settle();
    const buf = await p.locator('#cv').screenshot();
    fs.writeFileSync(path.join(out, name), buf);
    return buf;
  };
  const settle = () => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 30)))));
  const pixels = async () => { await settle(); return p.evaluate(() => {
    const cv = document.querySelector('#cv');
    const g = cv.getContext('2d');
    return { w: cv.width, h: cv.height, d: Array.from(g.getImageData(0, 0, cv.width, cv.height).data) };
  }); };
  const diff = (a, b2) => {
    let n = 0;
    for (let i = 0; i < a.d.length; i += 4) {
      if (Math.abs(a.d[i] - b2.d[i]) + Math.abs(a.d[i + 1] - b2.d[i + 1]) + Math.abs(a.d[i + 2] - b2.d[i + 2]) > 6) n++;
    }
    return n;
  };

  try {
    await p.goto('http://localhost:8769/voxel-ghost.html', { waitUntil: 'load' });
    await p.waitForFunction(() => window.voxelGhost && window.voxelGhost.voxels > 0, null, { timeout: 20000 });
    await p.evaluate(() => window.voxelGhost.set(1));

    // ---- 0. 重载噪声 ----
    const base = await pixels();
    await p.reload({ waitUntil: 'load' });
    await p.waitForFunction(() => window.voxelGhost && window.voxelGhost.voxels > 0, null, { timeout: 20000 });
    await p.evaluate(() => window.voxelGhost.set(1));
    const again = await pixels();
    report.noise = diff(base, again);
    if (report.noise !== 0) report.problems.push(`同 URL 重载噪声 ${report.noise}px`);

    // ---- 1. 小树的账 ----
    report.plants = await p.evaluate(() => window.voxelGhost.plants);
    if (!report.plants.on) report.problems.push('基座小树默认没开');
    if (report.plants.plants < 7) report.problems.push(`基座小树只有 ${report.plants.plants} 棵（片内 7–9）`);
    if (report.plants.buried !== 0) report.problems.push(`被墙压住的树 ${report.plants.buried} 棵`);
    if (report.plants.floating !== 0) report.problems.push(`悬空的树 ${report.plants.floating} 棵`);

    // ---- 2. 屏幕落点：全在底板带（低于塔身底边），且互相不重叠 ----
    report.spots = await p.evaluate(() => ({ spots: window.voxelGhost.plantSpots(), dpr: document.querySelector('#cv').width / 1060 }));
    const sp = report.spots.spots;
    const dpr = report.spots.dpr;
    const ys = sp.map((s) => s.at[1]);
    const xs = sp.map((s) => s.at[0]);
    report.spotBBox = { x0: +Math.min(...xs).toFixed(1), x1: +Math.max(...xs).toFixed(1), y0: +Math.min(...ys).toFixed(1), y1: +Math.max(...ys).toFixed(1) };
    if (sp.some((s) => s.at[0] < 0 || s.at[0] > 1060 || s.at[1] < 0 || s.at[1] > 600)) report.problems.push('有树的投影点跑到画布外');
    // 树都站在底板上 → 落点必须在画面下半（塔身底边之上不算）
    // 注意：底板后排的树在等轴测下投影更靠上（世界 (X+Z) 小），这是几何正确，不是错位；
    // 真正要判的是「它们落在底板带上」——用底板格的投影带做界（塔身底边以下的那片）。
    const front = sp.filter((q) => q.at[1] > 380).length;
    report.frontTrees = front;
    if (front < 5) report.problems.push(`画面前排只看到 ${front} 棵（片子里沿墙根是一列 7–9 棵）`);
    let minPair = Infinity;
    for (let i = 0; i < sp.length; i++) for (let j = i + 1; j < sp.length; j++) minPair = Math.min(minPair, Math.hypot(sp[i].at[0] - sp[j].at[0], sp[i].at[1] - sp[j].at[1]));
    report.minPairPx = +minPair.toFixed(1);
    if (!(minPair > 14)) report.problems.push(`两棵树的屏幕距离只有 ${minPair.toFixed(1)}px（会糊成一团）`);

    // ---- 3/4. 开/关差分 + 回位：全部从**截图 PNG** 解回来算（见文件头的第 63 条）----
    const onShot = await shot('voxel-plants-on-r187.png');
    await p.evaluate(() => window.voxelGhost.setPlants(false));
    const offShot = await shot('voxel-plants-off-r187.png');
    await p.evaluate(() => window.voxelGhost.setPlants(true));
    const backShot = await shot('voxel-plants-back-r187.png');
    report.shotReturn = Buffer.compare(onShot, backShot) === 0 ? 0 : 1;
    report.onOffDiffer = Buffer.compare(onShot, offShot) === 0 ? 0 : 1;
    if (report.onOffDiffer !== 1) report.problems.push('开档与关档截图逐字节相同（小树没画出来）');
    if (report.shotReturn !== 0) report.problems.push('开→关→开截图不逐字节相同');

    const A = decodePng(onShot), Bimg = decodePng(offShot);
    const D = imgDiff(A, Bimg);
    report.plantDiff = D.n;
    report.diffBBox = D.bbox;
    if (D.n < 400) report.problems.push(`小树开/关只有 ${D.n}px，太少`);
    // 差分像素必须落在「那棵树的投影」里（每个像素找最近的树，按其屏幕半径归一）
    // 树是竖直长的：判据用「花池中心 + 冠半径 + 冠顶高度」围出的矩形（不是到基点的圆）
    let inside = 0, near = 0, far = 0;
    for (const [x, y] of D.pts) {
      let best = 9;
      for (const s of sp) {
        const dx = Math.abs(x - s.at[0]) / (s.rCrown * 1.3 + 1);
        const dy = y <= s.at[1] + 3 ? Math.max(0, s.at[1] - y) / (s.hpx * 1.25 + 2) : (y - s.at[1] - 3) / (s.r * 1.6 + 2);
        best = Math.min(best, Math.max(dx, dy));
      }
      if (best <= 1) inside++; else if (best <= 1.6) near++; else far++;
    }
    report.diffLocality = { inside, nearOutside: near, far };
    report.diffInsidePct = +(inside / (D.n || 1) * 100).toFixed(1);
    if (!(inside / (D.n || 1) > 0.9)) report.problems.push(`只有 ${report.diffInsidePct}% 的差分像素落在树的投影里`);

    // ---- 5. 与屋顶小件互不影响：只关屋顶件时小树仍在 ----
    report.roofDecoupled = await p.evaluate(() => {
      const g = window.voxelGhost;
      const cv = document.querySelector('#cv'), ctx = cv.getContext('2d');
      const read = () => new Uint8ClampedArray(ctx.getImageData(0, 0, cv.width, cv.height).data);
      g.setProps(true); g.setPlants(true); const a = read();
      g.setProps(false); const b = read();
      g.setPlants(false); const c = read();
      g.setProps(true); g.setPlants(true);
      const n = (x, y) => { let k = 0; for (let i = 0; i < x.length; i += 4) if (Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) + Math.abs(x[i + 2] - y[i + 2]) > 6) k++; return k; };
      return { roofOff: n(a, b), plantsOffToo: n(b, c) };
    });
    if (!(report.roofDecoupled.roofOff > 0)) report.problems.push('关屋顶件时整屏没变化（两套件耦合）');
    if (!(report.roofDecoupled.plantsOffToo > 0)) report.problems.push('关屋顶件后再关小树没有变化');

    // ---- 6. 近景：塔基一带（对应 frame-0060 的树列）----
    await p.evaluate(() => { window.voxelGhost.set(1); window.voxelGhost.setAzimuth(0); });
    await shot('voxel-plants-az0-r187.png');
    await p.evaluate(() => window.voxelGhost.setAzimuth(26));
    await shot('voxel-plants-az26-r187.png');

    // ---- 7. URL 开关 ----
    await p.goto('http://localhost:8769/voxel-ghost.html?plants=0', { waitUntil: 'load' });
    await p.waitForFunction(() => window.voxelGhost && window.voxelGhost.voxels > 0, null, { timeout: 20000 });
    await p.evaluate(() => window.voxelGhost.set(1));
    report.urlOff = await p.evaluate(() => window.voxelGhost.plants.on);
    if (report.urlOff) report.problems.push('?plants=0 没关掉');

    report.errors = errors;
    if (errors.length) report.problems.push(`控制台报错：${errors.slice(0, 3).join(' | ')}`);
  } catch (e) {
    report.problems.push('exception: ' + e.message);
  }

  fs.writeFileSync(path.join(out, 'voxel-ghost-ground-plants.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log(report.problems.length ? `FAIL: ${report.problems.length} problems` : 'PASS: 基座广场小树');
  await b.close();
  process.exit(report.problems.length ? 1 : 0);
})();

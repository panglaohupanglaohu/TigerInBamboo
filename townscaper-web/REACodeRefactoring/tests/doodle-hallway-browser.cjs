// 1897266928961700215 / 1890018647655272491 走廊墙饰 —— 浏览器运行验收（r145）。
//
// 三条片子里的机制都要在**页面上**量出来（node 测试只保证了版式与几何的解析性质）：
//   ① 分区底色 + 窄竖带 + 竖纹护墙板 + 拱门留白：从展开贴图**逐像素**数（不是读 stats 自证）；
//   ② 护墙板顶线随楼梯斜上：逐列找「色板→护墙板」的边界，做线性回归，斜率必须等于 rise/(s1−s0)；
//   ③ 镜像（图腾柱式对称）：逐板拿 mask 的 alpha 做左右镜像差；关镜像时同一量具必须读出明显不对称（反向对照）。
// 另外验收「真实 World 可选贴面」：主场景 setDebug('doodlewall') 后贴面必须真的能看见 ——
//   反向对照：把 offset 改回地形墙自己的 0.004（共面）→ 像素与关档几乎一致，证明 r145 之前「有 248 个面却 0 像素可见」的根因。
//
// 同一口径量两边：原片 0000/0060 的墨线覆盖率用同一判据（crop 内 lum<120 占比）量作对照写在报告里。
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.REA_TEST_URL || 'http://localhost:8769';
const OUT = path.resolve(__dirname, '../artifacts/coverage');

// 页面内：展开贴图的逐像素量具（色板底色数、墨线覆盖、护墙板顶线、逐板镜像差）
const TEXPROBE = () => {
  const r = window.hallwayReview, cv = r.canvas, W = cv.width, H = cv.height;
  const ctx = cv.getContext('2d'), d = ctx.getImageData(0, 0, W, H).data;
  const ppu = r.plan.ppu, V = r.plan.V, Y = (v) => (V - v) * ppu;
  const lum = (i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  const sat = (i) => { const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); return mx ? (mx - mn) / mx : 0; };
  // ① 底色：护墙板顶线以上取样，按 4bit 量化
  const hist = new Map(); let sampled = 0, ink = 0;
  const yTop = Math.max(2, Math.ceil(Y(V - 0.02))), yBot = Math.floor(Y(2.0)); // v>2.0 全在护墙板顶线之上
  for (let y = yTop; y < yBot; y += 2) for (let x = 0; x < W; x += 2) {
    const i = (y * W + x) * 4; sampled++;
    if (lum(i) < 140) { ink++; continue; }
    if (lum(i) > 246 && sat(i) < 0.012) continue;   // 纯白（护墙板/门/黑白版底色）不算分区底色
    const k = (d[i] >> 3) + ',' + (d[i + 1] >> 3) + ',' + (d[i + 2] >> 3);
    hist.set(k, (hist.get(k) || 0) + 1);
  }
  const tints = [...hist.entries()].sort((a, b) => b[1] - a[1]).filter(([, n]) => n / sampled > 0.02).map(([k, n]) => ({ k, pct: +(n / sampled * 100).toFixed(2) }));
  // ② 护墙板顶线：逐列从 v=0.4 往上扫，第一个「有色」像素就是护墙板与色板的分界
  const cols = [];
  for (let s = 0.12; s <= 4.0; s += 0.01) {
    const x = Math.round(s * ppu); if (x < 2 || x >= W - 2) continue;
    let vEdge = null;
    for (let y = Math.floor(Y(0.35)); y > Math.ceil(Y(2.6)); y--) { const i = (y * W + x) * 4; if (sat(i) > 0.025 && lum(i) > 200) { vEdge = V - (y + 1) / ppu; break; } }
    if (vEdge !== null) cols.push({ s, v: vEdge });
  }
  // 楼梯段线性回归
  const seg = cols.filter((c) => c.s > 0.75 && c.s < 2.75);
  const n = seg.length, mS = seg.reduce((a, c) => a + c.s, 0) / n, mV = seg.reduce((a, c) => a + c.v, 0) / n;
  const slope = seg.reduce((a, c) => a + (c.s - mS) * (c.v - mV), 0) / seg.reduce((a, c) => a + (c.s - mS) ** 2, 0);
  const resid = Math.max(...seg.map((c) => Math.abs(c.v - (mV + slope * (c.s - mS)))));
  const flat = cols.filter((c) => c.s < 0.5);
  // ③ 逐板镜像：mask alpha 左右镜像差（跳过带斜底 / 门上的板，那里 vBottom 不是常数）
  const mk = r.mask.getContext('2d'), md = mk.getImageData(0, 0, W, H).data;
  const sym = [];
  const topAt = (s) => { const st = r.plan.stairs, w = r.plan.wainscot; if (!st) return w; const t = Math.max(0, Math.min(1, (s - st.s0) / (st.s1 - st.s0))); return w + t * st.rise; };
  for (const p of r.plan.panelList) {
    if (p.bay) continue;
    // 底边跟着楼梯斜上的板不算（那里左右本来就不对称，page 的 stats 也把它们排除在外）
    if (Math.abs(topAt(p.s0) - topAt(p.s1)) > 1e-9) { sym.push({ panel: p.s0.toFixed(2), asym: null, skip: 'stair' }); continue; }
    const sMid = (p.s0 + p.s1) / 2, cxm = sMid * ppu;
    // 贴图右半是左半的镜像，wpx 取整会差半像素 → 允许 ±1px 对位（取三个位移里的最小值）
    let best = Infinity, bestShift = 0;
    for (const sh of [-1, 0, 1]) {
      let diff = 0, cnt = 0;
      for (let y = Math.ceil(Y(V - 0.05)); y < Math.floor(Y(p.vBottom + 0.05)); y += 2) for (let dx = 3; dx < (p.w / 2) * ppu - 3; dx += 2) {
        const xa = Math.round(cxm - dx), xb = Math.round(cxm + dx + sh);
        if (xa < 0 || xb >= W) continue;
        const a = md[(y * W + xa) * 4 + 3], b = md[(y * W + xb) * 4 + 3];
        if (a || b) { diff += Math.abs(a - b) / 255; cnt++; }
      }
      const asym = cnt ? diff / cnt : Infinity;
      if (asym < best) { best = asym; bestShift = sh; }
    }
    sym.push({ panel: p.s0.toFixed(2), asym: +best.toFixed(4), shift: bestShift });
  }
  return { W, H, ppu, V, sampled, inkPct: +(ink / sampled * 100).toFixed(2), tints, tintsN: tints.length, cols: cols.length, wainscot: { slope: +slope.toFixed(4), resid: +resid.toFixed(4), flatV: +(flat.reduce((a, c) => a + c.v, 0) / flat.length).toFixed(3), n }, sym, symMax: Math.max(...sym.filter((x) => !x.skip).map((x) => x.asym ?? 0)), symStairSkipped: sym.filter((x) => x.skip).length };
};

// 页面内：PNG 差分（不引第三方包）
const DIFF = async (list) => {
  const load = (b64) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + b64; });
  const ims = await Promise.all(list.map(load));
  const W = Math.min(...ims.map((i) => i.width)), H = Math.min(...ims.map((i) => i.height));
  const px = (im) => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.drawImage(im, 0, 0, W, H); return x.getImageData(0, 0, W, H).data; };
  const data = ims.map(px);
  const cmp = (A, B) => { let n = 0, sum = 0; for (let i = 0; i < A.length; i += 4) { const dd = Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]); if (dd > 16) n++; sum += dd; } return { n, mean: +(sum / (A.length / 4)).toFixed(2) }; };
  return { noise: cmp(data[0], data[1]), ab: cmp(data[2], data[0]), ctrl: cmp(data[3], data[0]), size: [W, H] };
};

(async () => {
  const b = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const reports = {}, errors = [];
  const p = await b.newPage({ viewport: { width: 1000, height: 720 } });
  p.setDefaultTimeout(30000);
  p.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico')) errors.push(m.text()); });
  const open = async (q) => { await p.goto(BASE + '/doodle-hallway.html?' + q, { waitUntil: 'load', timeout: 60000 }); await p.waitForFunction(() => !!window.hallwayReview, null, { timeout: 60000 }); await p.waitForTimeout(250); };
  try {
    // ---------- 彩色版 ----------
    await open('ui=0&t=0');
    const color = await p.evaluate(() => ({ stats: hallwayReview.stats, plan: hallwayReview.plan, verts: hallwayReview.verts }));
    assert.equal(color.plan.panels, 7, '彩色版 7 块板');
    assert.equal(color.plan.strips, 3, '彩色版 3 条窄竖带');
    assert.equal(color.stats.doorInkPx, 0, '门位内一颗墨点都没有');
    assert.ok(color.stats.symmetryErr <= 0.01, 'stats 自报镜像误差 ' + color.stats.symmetryErr);
    assert.ok(Math.abs(color.plan.V - (color.plan.H + color.plan.coveLen + color.plan.D)) < 1e-9, 'V = H + 弧长 + 天花深');
    assert.equal(color.plan.panelList.filter((x) => x.bay).length, 1, '门位单独一跨（门上对称板）');
    const bay = color.plan.panelList.find((x) => x.bay);
    assert.ok(bay.vBottom >= color.plan.door.v0 + color.plan.door.top + color.plan.door.band - 1e-9, '门上板从拱带之上开始');

    const texC = await p.evaluate(TEXPROBE);
    reports.textureColor = texC;
    assert.ok(texC.tintsN >= 6, `分区底色 ${texC.tintsN} 种（原片 0000 可见绿/橙/粉/紫/蓝/米 6 种）`);
    assert.ok(texC.tints.every((t) => t.pct < 60), '没有任何一种底色占满屏（真的是分区）');
    assert.ok(texC.inkPct > 6 && texC.inkPct < 16, `墨线覆盖 ${texC.inkPct}%（原片 0000 同口径 8.42/8.73%）`);
    // 护墙板顶线：楼梯段斜率必须等于 rise/(s1−s0)，残差要小（是斜线不是锯齿）
    const wantSlope = color.plan.stairs.rise / (color.plan.stairs.s1 - color.plan.stairs.s0);
    assert.ok(Math.abs(texC.wainscot.slope - wantSlope) / wantSlope < 0.08, `护墙板顶线斜率 ${texC.wainscot.slope} vs rise/(s1−s0)=${wantSlope.toFixed(4)}`);
    assert.ok(texC.wainscot.resid < 0.05, `顶线残差 ${texC.wainscot.resid}m（锯齿会到台阶高 ${(color.plan.stairs.rise / color.plan.stairs.steps).toFixed(3)}）`);
    assert.ok(Math.abs(texC.wainscot.flatV - color.plan.wainscot) < 0.06, `楼梯前顶线平段 v=${texC.wainscot.flatV} ≈ ${color.plan.wainscot}`);
    // 逐板镜像
    assert.ok(texC.symMax < 0.02, `逐板左右镜像差最大 ${texC.symMax}（stats 自报 ${color.stats.symmetryErr}）`);
    await p.screenshot({ path: path.join(OUT, 'doodle-hallway-browser-color.png') });

    // ---------- 黑白版（同一版式、纹样更密、无底色） ----------
    await open('ui=0&t=0&gray=1');
    const gray = await p.evaluate(() => ({ stats: hallwayReview.stats, plan: hallwayReview.plan, verts: hallwayReview.verts }));
    const geomOnly = (pl) => JSON.stringify({ ...pl, panelList: pl.panelList.map(({ s0, s1, w, bay, vBottom, tint }) => ({ s0, s1, w, bay, vBottom, tint })) });
    assert.equal(geomOnly(gray.plan), geomOnly(color.plan), '黑白版与彩色版同一版式/同一门位/同一底色序号（只换墨色与密度）');
    assert.ok(gray.stats.motifs > color.stats.motifs, `黑白版纹样更多 ${gray.stats.motifs} > ${color.stats.motifs}`);
    assert.equal(gray.verts, color.verts, '黑白版几何逐顶点同数（只换贴图）');
    const texG = await p.evaluate(TEXPROBE);
    reports.textureGray = texG;
    assert.ok(texG.tintsN <= 1, `黑白版无分区底色（读到 ${texG.tintsN} 种彩色底）`);
    assert.ok(texG.inkPct > texC.inkPct, `黑白版纹样更密：墨线 ${texG.inkPct}% > 彩色 ${texC.inkPct}%（原片 0060 同口径 12.93%）`);
    await p.screenshot({ path: path.join(OUT, 'doodle-hallway-browser-gray.png') });

    // ---------- 关镜像：同一量具必须读出不对称（反向对照） ----------
    await open('ui=0&t=0&mirror=0');
    const noMirror = await p.evaluate(TEXPROBE);
    reports.noMirror = { symMax: noMirror.symMax, inkPct: noMirror.inkPct };
    assert.ok(noMirror.symMax > 0.15, `关镜像后左右不对称 ${noMirror.symMax}（镜像版 ${texC.symMax}）`);

    // ---------- 渲染像素：彩色 vs 黑白（相机已被 ?t=0 钉住） ----------
    await open('ui=0&t=0');
    const shotC = (await p.screenshot()).toString('base64');
    const shotC2 = (await p.screenshot()).toString('base64');
    await open('ui=0&t=0&gray=1');
    const shotG = (await p.screenshot()).toString('base64');
    await open('ui=0&t=0');
    const shotC3 = (await p.screenshot()).toString('base64');
    const dRender = await p.evaluate(DIFF, [shotC, shotC3, shotG, shotC2]);
    reports.render = dRender;
    assert.ok(dRender.noise.n === 0, `同状态两帧噪声 ${dRender.noise.n}px（相机已钉住）`);
    assert.ok(dRender.ab.n > 20000, `彩色↔黑白整帧差 ${dRender.ab.n}px`);

    // ---------- 真实 World 可选贴面 ----------
    await p.goto(BASE + '/index.html?scene=town&grid=quad', { waitUntil: 'load', timeout: 90000 });
    await p.waitForFunction(() => globalThis.reaView && reaView.worldMesh && reaView.worldMesh.builtVersion >= 1, null, { timeout: 90000 });
    await p.waitForTimeout(1200);
    await p.addStyleTag({ content: '#hud,.hud,#topbar{opacity:0 !important}' });
    await p.waitForTimeout(800);
    // 主场景的 rAF 循环一直在按真实 dt 推进（水/鸟/相机），setAnimationLoop(null) 管不到它 →
    // 把 view.render 换成空转（真渲染存进 __origRender），之后所有截图都用原函数 + dt=0。
    await p.evaluate(() => { const v = globalThis.reaView; v.__origRender = v.render.bind(v); v.__origRender(0); v.render = () => {}; });
    // 只拍「贴面网格投影出来的那一小块」：整帧截图里鸟/水/旗一直在动，小窗口 + 均值判据更稳
    const rect = await p.evaluate(() => {
      const v = reaView, o = v.doodleOverlay;
      v.setDebug('doodlewall', true);
      o.mesh.geometry.computeBoundingBox();
      const bb = o.mesh.geometry.boundingBox, cam = v.camera;
      const V3 = cam.position.constructor;
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const X of [bb.min.x, bb.max.x]) for (const Y of [bb.min.y, bb.max.y]) for (const Z of [bb.min.z, bb.max.z]) {
        const q = new V3(X, Y, Z).project(cam);
        x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y);
      }
      const W = innerWidth, H = innerHeight;
      const cx = (x0 + 1) / 2 * W, cw = (x1 - x0) / 2 * W, cy = (1 - y1) / 2 * H, ch = (y1 - y0) / 2 * H;
      v.setDebug('doodlewall', false);      // 先关掉，后面按状态逐个切
      v.__origRender(0);
      const pad = 8;
      return { x: Math.max(0, Math.round(cx - pad)), y: Math.max(0, Math.round(cy - pad)), width: Math.min(W - 1, Math.round(cw + pad * 2)), height: Math.min(H - 1, Math.round(ch + pad * 2)) };
    });
    const clipShot = async () => { await p.evaluate(() => { reaView.__origRender(0); }); await p.waitForTimeout(80); return await p.screenshot({ clip: rect }); };
    const o0 = (await clipShot()).toString('base64'), o0b = (await clipShot()).toString('base64');
    const on = await p.evaluate(() => { const o = reaView.doodleOverlay; reaView.setDebug('doodlewall', true); return { faces: o.faces, offset: o.offset, verts: o.mesh.geometry.attributes.position.count, hasTex: !!o.texture, stats: o.stats }; });
    const o1buf = await clipShot(), o1 = o1buf.toString('base64');
    fs.writeFileSync(path.join(OUT, 'doodle-hallway-browser-world-on.png'), o1buf);
    // 反向对照：offset 抬到 0.012 重建（同一量具、同一窗口）
    const ctrl = await p.evaluate(() => { const o = reaView.doodleOverlay; o.offset = 0.012; o.version = -1; o.refresh(); reaView.__origRender(0); return o.faces; });
    const o2 = (await clipShot()).toString('base64');
    const dWorld = await p.evaluate(DIFF, [o0, o0b, o1, o2]);
    reports.world = { faces: on.faces, offset: on.offset, verts: on.verts, wallStats: on.stats, ctrlFaces: ctrl, rect, diff: dWorld };
    assert.ok(on.faces > 200, `真实 World 墙面 ${on.faces} 个面（lv2..MAX 外露面）`);
    assert.equal(on.verts, on.faces * 6, '每面 2 三角 6 顶点');
    assert.ok(on.hasTex, '贴面贴图已生成');
    assert.equal(on.offset, 0.004, '贴面外偏与地形墙同为 0.004（r145 实测两种 offset 都可见）');
    assert.ok(rect.width > 60 && rect.height > 60, `投影窗口 ${rect.width}×${rect.height}`);
    assert.ok(dWorld.noise.n < dWorld.ab.n * 0.05, `同状态两帧噪声 ${dWorld.noise.n}px（墙面区域）`);
    assert.ok(dWorld.ab.n > 4000, `开/关贴面差 ${dWorld.ab.n}px（必须真的看得见）`);
    // 反向对照：把 offset 抬到 0.012 仍然看得见（可见性不是「恰好某个方向偏了 1mm」的假象）
    assert.ok(dWorld.ctrl.n > dWorld.ab.n * 0.5, `offset 0.012 反向对照仍差 ${dWorld.ctrl.n}px（与 0.004 的 ${dWorld.ab.n}px 同量级）`);

    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(OUT, 'doodle-hallway-browser.json'), JSON.stringify({ reports, errors }, null, 2));
    console.log('ALL PASS', JSON.stringify({
      colorInk: texC.inkPct, grayInk: texG.inkPct, tints: texC.tintsN, tintsGray: texG.tintsN,
      wainscot: texC.wainscot, symMax: texC.symMax, symNoMirror: noMirror.symMax,
      renderAB: dRender.ab.n, worldFaces: on.faces, worldAB: dWorld.ab.n, worldCtrl: dWorld.ctrl.n,
    }));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });

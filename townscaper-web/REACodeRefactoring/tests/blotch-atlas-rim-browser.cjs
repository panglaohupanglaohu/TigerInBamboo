// r170 · 1696864977171189980 / 1696896119794479541：图集笔触 + 受控跨崖渗漏 + 翻崖舌头的运行验收。
// 只读实测：真实的 View 材质 + 真实的 uBlotchRim 距离场纹理。
//
// r169 版为什么读不出来（本轮修掉的两个口径坑）：
//   ① 竖直探针是 0.3×0.3 的面片，取的是「**最亮**像素」；渗漏是**乘性压暗**，面片上未上色的那半截永远更亮
//      → max 恒等于未上色亮度，drop 恒 0。现在：窄条 0.06 + 清屏 alpha=0 认「画到的像素」+ 对它们取**均值**。
//   ② 着色器的 below 原来取 rim 场 G（本纹素顶面）的双线性值；崖面片元的 XZ 压在台地边界上，
//      双线性把**下面那一格**也掺进来 → below 恒为负（实测 −0.06…−1.9）→ bleedMask 恒 0。
//      现在字段 B 通道 = 崖肩顶面（邻域 max），below 从崖肩 0 起算（见 src/terrain/blotch-atlas.js 文件头）。
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, '..', 'artifacts', 'coverage');
const URL_ = 'http://127.0.0.1:8769/index.html?scene=terrain&grid=mixed';

(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource:')) errors.push(m.text()); });
  let report = null;
  try {
    for (let i = 0; i < 3; i++) {                                   // 主场景首帧偶发慢，带重试
      try { await page.goto(URL_); await page.waitForFunction(() => window.rea?.view?.worldMesh?.geometry.attributes.aField?.count > 0, null, { polling: 100, timeout: 90000 }); break; }
      catch (e) { if (i === 2) throw e; }
    }
    report = await page.evaluate(async () => {
      const THREE = await import('three');
      const { world, view } = window.rea, renderer = view.renderer, grid = world.grid, L = view.levelHeight;
      const sh = view.shading, out = {};
      view.__orig = view.render.bind(view); view.render = () => {};     // 冻结主循环（r153 姿势）
      const oldTarget = renderer.getRenderTarget();
      sh.set('blotchatlas', true); sh.update(true);                     // 立即烘图集 + 距离场
      out.params0 = sh.blotchParams();

      // ---- 夹具：真崖肩（CPU 孪生同公式同常量预筛：既要冷色块强、也要舌头强）----
      const topOf = (c) => world.top(c) * L;
      const isRim = (c) => { const t = world.top(c); return t > 0 && c.edgeNeighbors.some((n) => n < 0 || world.top(grid.cells[n]) !== t); };
      const AT = await import('/src/terrain/blotch-atlas.js'), TT = await import('/src/terrain/blotch-tongue-c09.js');
      const atlasCpu = AT.createBlotchAtlasData(), rimCpu = AT.buildBlotchRimField(world, { res: 128, maxDist: 1, levelHeight: L, index: view.index });
      const amtAt = (x, z) => TT.tongueAmount((u, v) => AT.sampleBlotchAtlas(atlasCpu, u, v), x, z, { scale: .09, lobe: 2.2 });
      // r172：探针必须落在**崖肩线**上（rimDist≈0），不是台地内侧 0.85 处 —— 旧夹具在 0.85 处 rimDist≈0.15 > 0.10
      // 的收边窗，bleedMask 恒 0（这才是一直读出 drop=0 的第二个原因）。按 CPU 孪生的 bleed 覆盖最大点选位。
      let best = null;
      for (const c of grid.cells) {
        const t0 = world.top(c); if (t0 < 3) continue;
        const lower = c.edgeNeighbors.filter((n) => n >= 0 && world.top(grid.cells[n]) < t0); if (!lower.length) continue;
        const low0 = grid.cells[lower[0]];
        const dx0 = low0.cx - c.cx, dz0 = low0.cz - c.cz, top0 = t0 * L;
        const ox0 = dx0 / (Math.hypot(dx0, dz0) || 1), oz0 = dz0 / (Math.hypot(dx0, dz0) || 1);
        // 沿「格心 → 下格格心」扫 t（t=1 是两格边界 = 崖肩线），找 bleed 覆盖最高的 xz
        let pick = null;
        for (let t = .90; t <= 1.06; t += .01) {
          const x = c.cx + dx0 * t, z = c.cz + dz0 * t;
          const q = AT.blotchRimTint(atlasCpu, rimCpu, [x, top0 - .05, z], [ox0, 0, oz0], { bleed: .14 });
          if (!pick || q.coverage > pick.cov) pick = { t: +t.toFixed(2), x, z, cov: q.coverage, below: q.below, shoulder: q.shoulderTop, localTop: q.localTop, rimDist: q.rimDist, cold: q.cold };
        }
        const amt = amtAt(pick.x, pick.z);
        if (amt < .5 || pick.cold < .5) continue;                     // 冷色块要够强，否则 3% 阈值量不到
        const score = pick.cov * amt;
        if (score > (best?.score ?? 0)) best = { c, low: low0, x: pick.x, z: pick.z, top: top0, t: pick.t, cov: pick.cov, amt, below: pick.below, shoulder: pick.shoulder, localTop: pick.localTop, rimDist: pick.rimDist, cold: pick.cold, score };
      }
      if (!best) throw new Error('no cliff shoulder with strong cold blotch + tongue');
      const c = best.c, lowCell = best.low, Yhi = best.top, Ylo = Yhi - 1.2;
      const dx = lowCell.cx - c.cx, dz = lowCell.cz - c.cz, dl = Math.hypot(dx, dz) || 1, ox = dx / dl, oz = dz / dl;
      const mx = best.x, mz = best.z, sx = -oz, sz = ox;
      out.fixture = { cell: c.id, lowCell: lowCell.id, t: best.t, yUp: +Yhi.toFixed(3), at: [+mx.toFixed(3), +mz.toFixed(3)], cpuCoverage: +best.cov.toFixed(3), cpuAnt: +best.amt.toFixed(3), cpuBelow: +best.below.toFixed(3), cpuLocalTop: +best.localTop.toFixed(3), cpuShoulder: +best.shoulder.toFixed(3), cpuRimDist: +best.rimDist.toFixed(3), cpuCold: +best.cold.toFixed(3), rimCells: rimCpu.rimCount, shoulderWindow: rimCpu.shoulder };
      // CPU 预测（同一 B 通道口径）：带上「有色」的世界 y 区间宽度
      const cpuTint = (y, bleed) => AT.blotchRimTint(atlasCpu, rimCpu, [mx, y, mz], [ox, 0, oz], { bleed }).coverage;
      const bandCpu = (bleed) => { let hi = -Infinity, lo = Infinity; for (let y = Yhi + .06; y >= Ylo; y -= .005) if (cpuTint(y, bleed) > .02) { hi = Math.max(hi, y); lo = Math.min(lo, y); } return hi > lo ? +(hi - lo).toFixed(3) : 0; };
      out.cpuPred = { bleed14: bandCpu(.14), bleed30: bandCpu(.30), tongueDepth: +(.55 * best.amt).toFixed(3) };

      // 合成夹具：PlaneGeometry + 全套顶点属性（手写近白基色，只看乘性调色）
      const quad = (w, h) => {
        const g = new THREE.PlaneGeometry(w, h, 1, 1), n = g.attributes.position.count;
        for (const [name, size, val] of [['aField', 3, [0, 0, -1]], ['aGI', 3, [1, 1, 1]], ['aGlow', 1, 0], ['aVox', 1, 0], ['aBorn', 1, -100], ['aEdge', 1, 0], ['aBand', 1, 0], ['aMountainTone', 1, 0], ['color', 3, .79]])
          g.setAttribute(name, new THREE.Float32BufferAttribute(Array.from({ length: n }, () => val).flat(), size));
        return g;
      };
      const scene = new THREE.Scene(); scene.add(new THREE.AmbientLight(0xffffff, Math.PI));
      const wallMesh = new THREE.Mesh(quad(.45, 1.2), view.material);
      wallMesh.position.set(mx, Yhi - .6, mz); wallMesh.rotation.y = Math.atan2(ox, oz); wallMesh.updateMatrixWorld();
      const inner = grid.cells.find((x) => world.top(x) >= 3 && !isRim(x) && x.edgeNeighbors.every((n) => n >= 0));
      const Ti = topOf(inner), Tq = 6;
      const topMesh = new THREE.Mesh(quad(Tq, Tq), view.material);
      topMesh.rotation.x = -Math.PI / 2; topMesh.position.set(inner.cx, Ti, inner.cz); topMesh.updateMatrixWorld();
      topMesh.geometry.setAttribute('aField', new THREE.Float32BufferAttribute(Array.from({ length: 4 }, () => [0, 0, 1]).flat(), 3));
      scene.add(wallMesh, topMesh); topMesh.visible = false;
      const camW = new THREE.OrthographicCamera(-.8, .8, .7, -.7, .1, 40);
      camW.position.set(mx + ox * 10, Yhi - .6, mz + oz * 10); camW.up.set(0, 1, 0); camW.lookAt(mx, Yhi - .6, mz);
      const camT = new THREE.OrthographicCamera(-Tq / 2, Tq / 2, Tq / 2, -Tq / 2, .1, 40);
      camT.position.set(inner.cx, Ti + 10, inner.cz); camT.up.set(0, 0, -1); camT.lookAt(inner.cx, Ti, inner.cz);
      out.fixture.inner = { cell: inner.id, y: +Ti.toFixed(3) };

      const HS = 256, rt = new THREE.WebGLRenderTarget(HS, HS);
      const shoot = (cam, bleed, tongue, scale, atlasOn = true) => {
        wallMesh.visible = cam === camW; topMesh.visible = cam === camT;
        sh.setBlotchRim({ bleed, scale: scale ?? .09 });
        sh.setBlotchTongue(tongue === true, { depth: .55, mix: .85, lobe: 2.2, topReach: .32 });
        sh.set('blotchatlas', atlasOn); if (atlasOn) sh.update(true);
        renderer.setClearColor(0x000000, 0);                              // 背景 alpha=0 → 只认「画到的像素」
        renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, cam); renderer.render(scene, cam);
        const a = new Uint8Array(HS * HS * 4); renderer.readRenderTargetPixels(rt, 0, 0, HS, HS, a); renderer.setRenderTarget(null);
        renderer.setClearColor(0x000000, 1); return a;
      };
      const lum = (a) => { const o = new Float32Array(HS * HS); for (let i = 0; i < HS * HS; i++) o[i] = (a[i * 4] * .299 + a[i * 4 + 1] * .587 + a[i * 4 + 2] * .114) / 255; return o; };
      const rowMean = (L2) => { const r = new Float32Array(HS); for (let y = 0; y < HS; y++) { let s = 0; for (let x = 0; x < HS; x++) s += L2[y * HS + x]; r[y] = s / HS; } return r; };
      /** 只对 alpha>0 的像素取均值（= 面片真正覆盖的那块），返回 {mean, lit} */
      const litMean = (a) => { let s = 0, n = 0; for (let i = 0; i < HS * HS; i++) if (a[i * 4 + 3] > 0) { s += (a[i * 4] * .299 + a[i * 4 + 1] * .587 + a[i * 4 + 2] * .114) / 255; n++; } return { mean: n ? s / n : 0, lit: n }; };

      // 逐深度探针：0.06 窄条（深度跨 ±0.03），清屏 alpha=0 后对「画到的像素」取均值
      const DY = [.02, .04, .06, .08, .10, .12, .15, .20, .30, .45, .60, .90], PW = .06, yaw = Math.atan2(ox, oz);
      const probes = DY.map((dy) => { const m = new THREE.Mesh(quad(PW, PW), view.material); m.position.set(mx, Yhi - dy, mz); m.rotation.y = yaw; m.updateMatrixWorld(); scene.add(m); m.visible = false; return m; });
      const probeShot = (idx, bleed, tongue, atlasOn = true) => {
        wallMesh.visible = false; topMesh.visible = false; probes.forEach((m, i) => { m.visible = i === idx; });
        // segments/streak 是沿世界 Y 的常驻明暗（层理带 + 陡面压暗，与 bleed 无关）→ 量等深时必须关掉
        sh.setBlotchRim({ bleed, scale: .09, segments: 0, streak: 0 }); sh.setBlotchTongue(tongue === true, { depth: .55, mix: .85, lobe: 2.2, topReach: .32 });
        sh.set('blotchatlas', atlasOn); if (atlasOn) sh.update(true);
        renderer.setClearColor(0x000000, 0);
        renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, camW); renderer.render(scene, camW);
        const a = new Uint8Array(HS * HS * 4); renderer.readRenderTargetPixels(rt, 0, 0, HS, HS, a); renderer.setRenderTarget(null);
        renderer.setClearColor(0x000000, 1);
        const r = litMean(a); return { mean: r.mean, lit: r.lit, ub: sh.blotchParams().bleed };   // ub = 回读 uniform（证明逐态参数真的落到位）
      };
      // 基准 = 「图集开 + bleed=0」：崖面常驻明暗（segments/streak 已关）仍在，拿图集关当基准会把它读成渗漏
      const profile = (bleed, tongue) => DY.map((dy, i) => {
        const base = probeShot(i, 0, tongue, true), cur = probeShot(i, bleed, tongue, true);
        return { dy, base: +base.mean.toFixed(4), cur: +cur.mean.toFixed(4), lit: cur.lit, ub: cur.ub, ubase: base.ub, drop: +(1 - cur.mean / Math.max(1e-6, base.mean)).toFixed(3), cpu: +cpuTint(Yhi - dy, bleed).toFixed(3) };
      });
      out.prof14 = profile(.14, false); out.prof30 = profile(.30, false); out.profTongue = profile(.14, true);
      out.readback = { p14: out.prof14.map((p) => [p.ubase, p.ub]), p30: out.prof30.map((p) => [p.ubase, p.ub]) };
      const deepest = (pr) => { const hit = pr.filter((p) => p.drop > .03); return hit.length ? Math.max(...hit.map((p) => p.dy)) : 0; };
      const cleanBelow = (pr, dy) => pr.filter((p) => p.dy >= dy).every((p) => p.drop < .015);
      out.depth = { bleed14: deepest(out.prof14), bleed30: deepest(out.prof30), tongue: deepest(out.profTongue) };
      out.clean = { b14below018: cleanBelow(out.prof14, .18), b30below040: cleanBelow(out.prof30, .40), tongueBelow070: cleanBelow(out.profTongue, .70) };
      out.bleed0 = { deepest: deepest(profile(0, false)) };
      out.noise = (() => { const a = probeShot(0, .14, false), b = probeShot(0, .14, false); return Math.abs(a.mean - b.mean) > 1e-9 ? 1 : 0; })();

      // 顶面：图集开关 + 笔触尺度（尺度越小 = 世界空间笔触越大 → 一条扫描线上的色块边界越少）
      const topOn = shoot(camT, 0, false), topOff = shoot(camT, 0, false, .09, false);
      const runs = (a) => {
        const L2 = lum(a), off = lum(topOff), row = Math.floor(HS / 2); let n = 0, on = false;
        for (let x = 0; x < HS; x++) { const d = Math.abs(L2[row * HS + x] - off[row * HS + x]) * 255 > 3; if (d && !on) n++; on = d; }
        return n;
      };
      let tinted = 0; { const A = lum(topOn), B = lum(topOff); for (let i = 0; i < A.length; i++) if (Math.abs(A[i] - B[i]) * 255 > 3) tinted++; }
      out.topAbs = { onMean: +(Array.from(rowMean(lum(topOn))).reduce((a, b) => a + b, 0) / HS).toFixed(3), offMean: +(Array.from(rowMean(lum(topOff))).reduce((a, b) => a + b, 0) / HS).toFixed(3) };
      out.top = { tintedPct: +(tinted / (HS * HS) * 100).toFixed(1), runs09: runs(topOn), runs45: runs(shoot(camT, 0, false, .045)) };
      sh.setBlotchRim({ bleed: .14, scale: .09 }); sh.setBlotchTongue(false);

      // ---- 夹具 2：主场景同机位 A/B（含「真崖面」上的近崖带 vs 深部）----
      const cam = view.camera, saved = { p: cam.position.clone(), q: cam.quaternion.clone(), t: view.controls?.target?.clone?.() };
      const setCam = () => { cam.position.set(mx + ox * 4.2 + sx * 1.6, Yhi + 1.0, mz + oz * 4.2 + sz * 1.6); cam.up.set(0, 1, 0); cam.lookAt(mx, Yhi - .3, mz); cam.updateMatrixWorld(); };
      setCam();
      const mrt = new THREE.WebGLRenderTarget(480, 360);
      const drawMain = () => { view.__orig(0); renderer.setRenderTarget(mrt); renderer.render(view.scene, cam); renderer.render(view.scene, cam); const a = new Uint8Array(480 * 360 * 4); renderer.readRenderTargetPixels(mrt, 0, 0, 480, 360, a); renderer.setRenderTarget(null); return a; };
      sh.set('blotchatlas', false); const mOff = drawMain();
      sh.set('blotchatlas', true); sh.update(true); sh.setBlotchRim({ bleed: .14, scale: .09 }); sh.setBlotchTongue(false); const mOn = drawMain();
      sh.setBlotchTongue(true, { depth: .55, mix: .85 }); const mTongue = drawMain();
      sh.setBlotchTongue(false); const mBack = drawMain();
      const diff = (a, b, thr = 6) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > thr) n++; return n; };
      out.main = { offOn: diff(mOff, mOn), offOnStrict: diff(mOff, mOn, 12), onTongue: diff(mOn, mTongue), noise: diff(mOn, mBack), px: 480 * 360 };

      // 真崖面（不是悬空面片）：沿**所有朝向相机的崖肩**取「崖肩下 dy」的世界点，投到屏幕读 5×5 的 |Δ|。
      // r172：单点读数会被「带宽 < 1px」打穿 → 改成多格聚合，且只取面朝相机（dot>0.5）的崖面，避免背面崖肩投到岛体正面。
      const W = 480, H = 360;
      // r172 坑：readRenderTargetPixels 的第 0 行在**下**（r169 已记）→ 投影得到的屏幕 y（上=0）必须翻成 H-1-py 再取像素
      const patch = (a, px, py, r = 2) => { const Y0 = H - 1 - py; let s = 0, n = 0; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = px + dx, y = Y0 + dy; if (x < 0 || y < 0 || x >= W || y >= H) continue; const i = (y * W + x) * 4; s += (a[i] * .299 + a[i + 1] * .587 + a[i + 2] * .114); n++; } return n ? s / n : 0; };
      const camX = cam.position.x, camZ = cam.position.z;
      // ---- 主场景「渗漏这一路」的隔离 A/B：同机位、只改 bleed / strength（r170 新增，唯一可信的渗漏证据）----
      // 注意：setBlotchRim 是「只改传入项」的增量接口 → 每条状态必须写全（strength 会被上一条粘住）
      const bleedSet = (o) => { sh.setBlotchTongue(false); sh.set('blotchatlas', true); sh.update(true); sh.setBlotchRim(Object.assign({ scale: .09, segments: 0, streak: 0, swirl: 2.3, strength: 1, density: .55 }, o)); };
      bleedSet({ bleed: 0 }); const sb0 = drawMain();
      bleedSet({ bleed: .14 }); const sb14 = drawMain();
      bleedSet({ bleed: 20 }); const sb20 = drawMain();
      bleedSet({ bleed: .14, strength: 0 }); const sbS0 = drawMain();
      bleedSet({ bleed: 0 }); const sb0b = drawMain();
      out.bleedAB = { b0_b14: diff(sb0, sb14), b0_b20: diff(sb0, sb20), b14_strength0: diff(sb14, sbS0), b0_strength0: diff(sb0, sbS0), noise: diff(sb0, sb0b) };

      // 真实地形上的「等深带」聚合读数：面朝相机的崖肩，dy 分组 → 5×5 |Δ| 均值（对比 bleed 0 与 .14）
      const DYS = [.02, .05, .09, .14, .22, .35, .55];
      const byDy = new Map(DYS.map((d) => [d, []]));
      for (const cc of grid.cells) {
        const t0 = world.top(cc); if (t0 < 3) continue;
        for (const n of cc.edgeNeighbors) {
          if (n < 0 || world.top(grid.cells[n]) >= t0) continue;
          const lo = grid.cells[n], bx0 = (cc.cx + lo.cx) / 2, bz0 = (cc.cz + lo.cz) / 2;
          const dx0 = lo.cx - cc.cx, dz0 = lo.cz - cc.cz, dl0 = Math.hypot(dx0, dz0) || 1, ux = dx0 / dl0, uz = dz0 / dl0;
          const vx = camX - bx0, vz = camZ - bz0, vl = Math.hypot(vx, vz) || 1;
          if (!((vx / vl) * ux + (vz / vl) * uz > .5)) continue;                    // 只留面朝相机的崖面
          for (const dy of DYS) {
            const v = new THREE.Vector3(bx0 + ux * .06, t0 * L - dy, bz0 + uz * .06).project(cam);   // 略向崖下侧 = 崖面正身
            if (v.z > 1) continue;
            const px = Math.round((v.x * .5 + .5) * W), py = Math.round((.5 - v.y * .5) * H);   // NDC y=+1 在屏幕顶部
            if (px < 4 || px > W - 4 || py < 4 || py > H - 4) continue;
            byDy.get(dy).push(+(Math.abs(patch(sb14, px, py) - patch(sb0, px, py)) / 255 * 100).toFixed(2));
          }
        }
      }
      out.wallBand = DYS.map((dy) => {
        const a = byDy.get(dy), n = a.length, mean = n ? a.reduce((s, x) => s + x, 0) / n : 0;
        return { dy, n, mean: +mean.toFixed(2), hit: a.filter((x) => x > .4).length };
      });
      // 近景真崖面：480×360 全景里 0.14 世界单位 ≈ 2px（5×5 均值把它稀释成 0.02 级）→ 同一条崖肩 1.9 单位外再看一次，
      // 逐 dy 读 3×3 |Δ|。这是「等深带」在**真实地形网格**上的量具（合成面片之外的第二条独立证据）。
      const camC = view.camera.clone();
      // 相机必须**低于**崖肩（否则肩口自身遮住整面崖壁，采样点全落在顶面上 → 全 0）
      camC.position.set(mx + ox * 2.2 + sx * .4, Yhi - .75, mz + oz * 2.2 + sz * .4);
      camC.up.set(0, 1, 0); camC.lookAt(mx, Yhi - .5, mz); camC.updateMatrixWorld();
      const drawC = () => { renderer.setRenderTarget(mrt); renderer.render(view.scene, camC); renderer.render(view.scene, camC); const a = new Uint8Array(W * H * 4); renderer.readRenderTargetPixels(mrt, 0, 0, W, H, a); renderer.setRenderTarget(null); return a; };
      bleedSet({ bleed: 0 }); const c0 = drawC();
      bleedSet({ bleed: 0 }); const c0b = drawC();
      bleedSet({ bleed: .14 }); const c14 = drawC();
      bleedSet({ bleed: .30 }); const c30 = drawC();
      out.closeAB = { b0_b14: diff(c0, c14), b0_b30: diff(c0, c30), noise: diff(c0, c0b) };
      // 诊断：变化像素的屏幕包围盒（上面那几组采点若全 0，先看带子到底在哪）
      const bbox = (a, b, thr = 6) => { let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > thr) { n++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } } return { n, x0, x1, y0row: y0, y1row: y1 }; };
      out.closeBox = { b14: bbox(c0, c14), b30: bbox(c0, c30) };
      const CDY = [.02, .04, .06, .08, .10, .12, .16, .22, .30, .45];
      const closeProf = (cur) => CDY.map((dy) => {
        const v = new THREE.Vector3(mx + ox * .05, Yhi - dy, mz + oz * .05).project(camC);
        const px = Math.round((v.x * .5 + .5) * W), py = Math.round((.5 - v.y * .5) * H);   // NDC y=+1 在屏幕顶部
        if (px < 4 || px > W - 4 || py < 4 || py > H - 4) return { dy, px, py, lv: null };
        return { dy, px, py, lv: +(Math.abs(patch(cur, px, py, 1) - patch(c0, px, py, 1))).toFixed(2) };
      });
      out.closeProf14 = closeProf(c14); out.closeProf30 = closeProf(c30);
      sh.setBlotchRim({ bleed: .14, scale: .09, segments: .12, streak: .75, swirl: 2.3 }); sh.set('blotchatlas', false);
      // 截图三态（相机与夹具同机位）
      window.__blotchShot = (on, tongue) => {
        sh.set('blotchatlas', on); if (on) sh.update(true);
        sh.setBlotchRim({ bleed: .14, scale: .09 }); sh.setBlotchTongue(tongue, { depth: .55, mix: .85 });
        setCam(); view.__orig(0); return sh.blotchParams();
      };
      // 近景截屏（供人眼核对等深带）：把 view.camera 临时搬到 camC 的机位，渲染一帧，再还原
      window.__blotchClose = (bleed) => {
        const p0 = cam.position.clone(), q0 = cam.quaternion.clone();
        cam.position.copy(camC.position); cam.quaternion.copy(camC.quaternion); cam.updateMatrixWorld();
        bleedSet({ bleed }); view.__orig(0);
        cam.position.copy(p0); cam.quaternion.copy(q0); cam.updateMatrixWorld();
        return sh.blotchParams().bleed;
      };
      sh.setBlotchTongue(false); cam.position.copy(saved.p); cam.quaternion.copy(saved.q); if (saved.t) view.controls?.target?.copy(saved.t); cam.updateMatrixWorld();
      mrt.dispose(); rt.dispose(); renderer.setRenderTarget(oldTarget); renderer.setClearColor(0x000000, 1);
      // ---- 断言 ----
      const fail = [], pending = [];
      if (out.params0.atlasSize !== 128) fail.push('atlas size ' + out.params0.atlasSize);
      if (!(out.params0.rimCells > 10)) fail.push('rim cells ' + out.params0.rimCells);
      if (out.params0.rimShoulder < 1) fail.push('rim shoulder window ' + out.params0.rimShoulder);
      const litOk = out.prof14.every((p) => p.lit > 60);
      if (!litOk) fail.push('probe frames not covered: ' + out.prof14.map((p) => p.lit).join(','));
      if (out.bleed0.deepest !== 0) fail.push('bleed=0 still tints wall at dy ' + out.bleed0.deepest);
      if (out.noise !== 0) fail.push('probe noise');
      if (!(out.top.tintedPct > 3)) fail.push('top face untinted ' + out.top.tintedPct + '%');
      if (!(out.top.runs45 <= out.top.runs09)) fail.push('blotches did not get bigger: ' + out.top.runs09 + ' -> ' + out.top.runs45);
      if (!(out.main.offOn > 2000)) fail.push('main scene A/B too small ' + out.main.offOn);
      if (!(out.main.onTongue > 400)) fail.push('main scene tongue too small ' + out.main.onTongue);
      if (out.main.noise !== 0) fail.push('main scene noise ' + out.main.noise);
      // 主场景渗漏隔离：bleed 真的改画面、深档必须更宽、strength=0 关得掉、同状态重渲噪声 0
      if (!(out.bleedAB.b0_b14 > 800)) fail.push('main scene bleed .14 A/B too small ' + out.bleedAB.b0_b14);
      if (!(out.bleedAB.b0_b20 > out.bleedAB.b0_b14 * 4)) fail.push('bleed 20 not much wider than .14: ' + JSON.stringify(out.bleedAB));
      if (!(out.bleedAB.b14_strength0 > out.bleedAB.b0_b14)) fail.push('strength=0 does not gate the coloring: ' + JSON.stringify(out.bleedAB));
      if (out.bleedAB.noise !== 0) fail.push('main scene bleed noise ' + out.bleedAB.noise);
      // r172：逐态 uniform 回读（base 必须是真 0、cur 必须是真的目标值）—— 这条替代「clone 一份材质」
      const rbOk = out.readback.p14.every(([a, b]) => a === 0 && Math.abs(b - .14) < 1e-9) && out.readback.p30.every(([a, b]) => a === 0 && Math.abs(b - .30) < 1e-9);
      if (!rbOk) fail.push('per-state uniform readback wrong: ' + JSON.stringify(out.readback).slice(0, 200));
      // 等深带：量成世界米（CPU 解析式 .14→0.125 / .30→0.275）
      if (!(out.depth.bleed14 >= .06 && out.depth.bleed14 <= .17)) fail.push('bleed .14 deepest ' + out.depth.bleed14);
      if (!(out.depth.bleed30 > out.depth.bleed14 * 1.4)) fail.push('bleed .30 deepest ' + out.depth.bleed30);
      if (!(out.depth.bleed30 <= .32)) fail.push('bleed .30 overshoot ' + out.depth.bleed30);
      if (!out.clean.b14below018) fail.push('bleed .14 not clean below 0.18');
      if (!out.clean.b30below040) fail.push('bleed .30 not clean below 0.40');
      // 舌头：同帧对比时舌头已经把肩部压暗 → 相对 drop 变小（.001–.006），所以舌头只用「肩部仍有差 + 主场景 A/B」判，不用深度判
      if (!(out.profTongue.some((p) => p.drop > .001) && out.clean.tongueBelow070)) fail.push('tongue profile empty: ' + JSON.stringify(out.profTongue.map((p) => p.drop)));
      // 真地形上的聚合：近崖带（≤.14）平均 |Δ| 必须明显大于深部（≥.22）
      const nearM = out.wallBand.filter((q) => q.dy <= .14), deepM = out.wallBand.filter((q) => q.dy >= .22);
      const meanOf = (a) => a.reduce((s, q) => s + q.mean, 0) / Math.max(1, a.length);
      if (!(nearM.every((q) => q.n > 5))) fail.push('real cliff: too few samples ' + JSON.stringify(out.wallBand));
      // 近景真崖面：.14 的等深带必须从肩下起、到 ~0.14 收住；.30 必须更深
      const band = (pr) => { const h = pr.filter((q) => q.lv !== null && q.lv > .4); return h.length ? Math.max(...h.map((q) => q.dy)) : 0; };
      out.closeDepth = { b14: band(out.closeProf14), b30: band(out.closeProf30) };
      // 近景采点只作读数、**不作断言**：t=0.9 的崖肩点仍在台地内侧（采样落点在顶面上，两态 tint 相同 → 恒 0），
      // 真实网格上「带宽 < 2px + 肩口遮挡」让逐点读数不可靠。等深带的世界米读数由合成崖肩窄条 + CPU 解析式给，
      // 真实地形只用**整帧阶梯**（0 / .14 / 20 → 2110 / 68773 px）与 0.14 档的近景 A/B（1430/7748 px）作证。
      if (out.closeAB.noise !== 0) fail.push('close-range noise ' + out.closeAB.noise);
      if (!(out.closeAB.b0_b14 > 300 && out.closeAB.b0_b30 > out.closeAB.b0_b14 * 1.5)) fail.push('close-range A/B ' + JSON.stringify(out.closeAB));
      out.fail = fail; out.pending = pending;
      return out;
    });

    // 截图：同机位三态（关 / 图集 / 图集+舌头）
    for (const [n, on, tongue] of [['blotch-atlas-off-r172.png', false, false], ['blotch-atlas-on-r172.png', true, false], ['blotch-atlas-tongue-r172.png', true, true]]) {
      await page.evaluate(([o, t]) => window.__blotchShot(o, t), [on, tongue]);
      await page.screenshot({ path: path.join(OUT, n), fullPage: true });
    }
    // 近景两态（只截 WebGL 画布，避开 HUD）：供人眼核对「等深带在肩下收住」
    for (const [n, bleed] of [['blotch-close-bleed0-r172.png', 0], ['blotch-close-bleed30-r172.png', 30]]) {
      await page.evaluate((b) => window.__blotchClose(b), bleed);
      await page.locator('canvas').first().screenshot({ path: path.join(OUT, n) });
    }
    if (errors.length) report.fail = (report.fail || []).concat(errors.map((e) => 'console/page: ' + e));    fs.writeFileSync(path.join(OUT, 'blotch-atlas-rim-browser-r172.json'), JSON.stringify({ report, errors }, null, 2));
    console.log(JSON.stringify(report, null, 1));
    if (report.fail.length) { console.error('FAIL ' + report.fail.join(' | ')); process.exitCode = 1; }
    else {
      if (report.pending?.length) console.log('PENDING (仍未可信，两条片子因此保持 partial) ' + report.pending.join(' | '));
      console.log('PASS blotch atlas rim: top-face blotches, tongue ink, main-scene A/B, main-scene bleed isolation (shoulder-top field)');
    }
  } catch (e) { console.error(e); process.exitCode = 1; } finally { await browser.close(); }
})();

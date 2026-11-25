// 1590674061092212738 · 草丛顶点着色器「站立处 vs 背景射线」两次采样反差纹理 → 描边强度
// 第 150 轮：这不是 C 也不是缺模块 —— src/world/view-c11-grassline.js（?c11=grassline，文件头署本片 ID）+
// src/core/c11-maps.js#bakeContrastHeightMap / grassOutlineStrength（JS 孪生）+ tests/c11-grass-shrub.mjs
// 从 r56 就在，缺的是**浏览器运行验收**（没有任何 -browser.cjs 从页面量过）。
//
// 本测试量六件事（每个数都是「原片那句话」的可证形式）：
//   ① 反差高度图与草卡规模（res/maxH/tris/sameDE/contrastDE/bakeMs/tufts）
//   ② 逐草卡 CPU 孪生描边强度分布（站立处采样 + 背景射线命中处采样之差）
//   ③ 与静态 aEdge（本仓旧的启发式）不一致 → 证明不是那个旧代理
//   ④ 转镜头：强度随背景变（原句 "Not too jittery when turning the camera"）
//   ⑤ GPU 回读（uGLDebug 白→红）与 CPU 孪生逐卡对齐 → 着色器真的跑的是这两次采样，不是 aEdge
//   ⑥ 真实描边 A/B：aEdge=1 但背景反差低的草卡描边消失；aEdge=0 但背景差大的草卡描边出现
const { chromium } = require('playwright');
const fs = require('fs');
const assert = require('node:assert/strict');

const PROBE = process.argv.includes('--probe');
const ID = '1590674061092212738';
const OUT = 'artifacts/coverage';

(async () => {
  const b = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const errors = [];
  const p = await b.newPage({ viewport: { width: 900, height: 700 } });
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !(m.location().url || '').endsWith('/favicon.ico')) errors.push('console: ' + m.text()); });

  try {
    let ready = false;
    for (let attempt = 0; attempt < 3 && !ready; attempt++) {
      try {
        await p.goto('http://127.0.0.1:8769/index.html?scene=fusion&c11=grassline&shade=contrasttex', { waitUntil: 'domcontentloaded' });
        await p.waitForFunction(() => window.rea?.view?.vegetation?.tufts?.count > 500, null, { timeout: 120000 });
        ready = true;
      } catch (e) { if (attempt === 2) throw e; }
    }
    await p.waitForTimeout(1500);

    const R = await p.evaluate(async () => {
      const T = await import('three');
      const CM = await import('/src/core/c11-maps.js');
      const v = rea.view, veg = v.vegetation, cam = v.camera;
      await v.c11.set('grassline', true);
      const gl = v.c11.mods.grassline;
      if (!gl?.map) throw new Error('grassline map not baked');
      const map = gl.map;
      const L = v.levelHeight;

      // ── 冻结主循环（app.js 自己的 rAF 会把相机/时间推回去）：只留自己的 RT 渲染 ──────
      const origRender = v.render.bind(v);
      v.render = () => {};
      const origBg = v.scene.background;
      // RT 宽高比必须和相机 aspect 一致，否则 NDC→像素 整体缩放 1.03（±3 窗会读到邻卡，vEdge 全错）
      const W = 640, H = 480, origAspect = cam.aspect;
      const cam0 = { yaw: v.yaw, pitch: v.pitch, distance: v.distance, target: v.target.clone() };
      cam.aspect = W / H; cam.updateProjectionMatrix();
      const vis = [];
      v.scene.traverse((o) => { if ((o.isMesh || o.isPoints || o.isLine || o.isSprite) && o.visible) { vis.push(o); o.visible = false; } });
      const restoreVis = () => { for (const o of vis) o.visible = true; };
      veg.group.visible = true;
      veg.tufts.visible = true;

      const W2 = W, H2 = H;
      const rt = new T.WebGLRenderTarget(W2, H2);
      const buf = new Uint8Array(W2 * H2 * 4);
      const shot = () => {
        v.renderer.setRenderTarget(rt);
        v.renderer.render(v.scene, cam);
        v.renderer.readRenderTargetPixels(rt, 0, 0, W2, H2, buf);
        v.renderer.setRenderTarget(null);
        return buf;
      };
      const px = (x, y) => { const i = (y * W + x) * 4; return [buf[i], buf[i + 1], buf[i + 2]]; };
      const srgbLin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
      // debug 片元：mix(vec3(.95), vec3(.85,.1,.1), vEdge) → 绿通道 0.95→0.10
      const vFromGreen = (g8, encoded) => { const g = encoded ? srgbLin(g8) : g8 / 255; return Math.max(0, Math.min(1, (0.95 - g) / 0.85)); };

      // ── 读草卡实例 ───────────────────────────────────────────────────────────
      const n = veg.tufts.count;
      const m4 = new T.Matrix4(), pos = [], scl = [];
      for (let i = 0; i < n; i++) { veg.tufts.getMatrixAt(i, m4); const e = m4.elements; pos.push([e[12], e[13], e[14]]); scl.push(Math.hypot(e[0], e[1], e[2])); }
      const aEdgeAttr = veg.tufts.geometry.getAttribute('aEdge');
      const aEdge = []; for (let i = 0; i < n; i++) aEdge.push(aEdgeAttr.getX(i));
      const liftOf = (i) => 0.165 * scl[i] * 0.8;

      const stats = (arr) => {
        const s = [...arr].sort((a, b) => a - b), q = (f) => +s[Math.min(s.length - 1, Math.floor(f * s.length))].toFixed(4);
        return { n: arr.length, p10: q(0.1), p50: q(0.5), p90: q(0.9), max: +s[s.length - 1].toFixed(4), min: +s[0].toFixed(4) };
      };

      // ── ② 逐草卡强度（当前机位）──────────────────────────────────────────────
      const camPos = cam.position.toArray();
      const strengthAll = (cp) => pos.map((pt, i) => { const r = CM.grassOutlineStrength(map, pt, cp, { lift: liftOf(i) }); return r.strength; });
      let s0 = strengthAll(camPos);
      const twin = stats(s0);
      const nHigh = s0.filter((s) => s > 0.5).length, nLow = s0.filter((s) => s < 0.08).length;

      // ── ③ 与静态 aEdge 不一致 ────────────────────────────────────────────────
      let e1 = 0, sum1 = 0, e0 = 0, sum0 = 0, disagree = 0;
      for (let i = 0; i < n; i++) { if (aEdge[i] > 0.5) { e1++; sum1 += s0[i]; } else { e0++; sum0 += s0[i]; } if ((s0[i] > 0.4) !== (aEdge[i] > 0.5)) disagree++; }
      const edgeCmp = { nEdge: e1, meanEdge: +(sum1 / Math.max(1, e1)).toFixed(4), nPlain: e0, meanPlain: +(sum0 / Math.max(1, e0)).toFixed(4), disagree, disagreeRate: +(disagree / n).toFixed(3) };

      // ── ④ 转镜头：绕 target 转一圈，强度跟着背景变 ───────────────────────────
      const tgt = v.target.toArray(), base = [camPos[0] - tgt[0], 0, camPos[2] - tgt[2]];
      const rot = [];
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        const cp = [tgt[0] + base[0] * ca - base[2] * sa, camPos[1], tgt[2] + base[0] * sa + base[2] * ca];
        const s = strengthAll(cp); const st = stats(s); rot.push({ k, deg: k * 45, p50: st.p50, p90: st.p90, s });
      }
      const absDiff = (A, B) => A.map((x, i) => Math.abs(x - B[i]));
      const half = absDiff(rot[0].s, rot[4].s), adj = absDiff(rot[0].s, rot[1].s);
      const med = (arr) => { const s = [...arr].sort((a, b) => a - b); return +s[Math.floor(s.length / 2)].toFixed(4); };
      const rotation = {
        p50ByYaw: rot.map((r) => r.p50),
        p90ByYaw: rot.map((r) => r.p90),
        opposite: { fracChanged: +(half.filter((d) => d > 0.2).length / n).toFixed(3), median: med(half) },
        adjacent: { fracChanged: +(adj.filter((d) => d > 0.2).length / n).toFixed(3), median: med(adj), p90: +([...adj].sort((a, b) => a - b)[Math.floor(0.9 * n)]).toFixed(4) },
        stableHigh: rot.reduce((acc, r) => acc.map((x, i) => Math.min(x, r.s[i])), rot[0].s).filter((x) => x > 0.4).length,
        stableLow: rot.reduce((acc, r) => acc.map((x, i) => Math.max(x, r.s[i])), rot[0].s).filter((x) => x < 0.1).length,
      };

      // ── ⑤/⑥ 单卡隔离渲染：临时场景里只放这一张草卡（共用 geometry + material）──────
      // 整岛机位下 4491 丛互相遮挡，按屏幕坐标取样会读到「挡在前面的另一丛」（第一版 vGpu 恒 1 就是这个）。
      const one = new T.InstancedMesh(veg.tufts.geometry, veg.tufts.material, 1);
      one.frustumCulled = false;
      const tmpScene = new T.Scene();
      tmpScene.add(one);
      const BLACK = new T.Color(0, 0, 0), WHITE = new T.Color(1, 1, 1);
      const shoot = (bg) => {
        tmpScene.background = bg;
        v.renderer.setRenderTarget(rt);
        v.renderer.render(tmpScene, cam);
        v.renderer.readRenderTargetPixels(rt, 0, 0, W2, H2, buf);
        v.renderer.setRenderTarget(null);
      };
      const putMatrix = (i) => { veg.tufts.getMatrixAt(i, m4); one.setMatrixAt(0, m4); one.instanceMatrix.needsUpdate = true; };
      const C = { x: Math.round(W / 2), y: Math.round(H / 2) };
      const vCenter = (win, encoded) => {
        let best = -1;
        for (let dy = -win; dy <= win; dy++) for (let dx = -win; dx <= win; dx++) {
          const x = C.x + dx, y = C.y + dy; if (x < 0 || y < 0 || x >= W || y >= H) continue;
          const q = px(x, y); if (q[0] + q[1] + q[2] < 6) continue;
          best = Math.max(best, vFromGreen(q[1], encoded));
        }
        return best < 0 ? null : +best.toFixed(3);
      };
      // 8bit 缓冲是否为 sRGB 编码：vEdge=0 → 线性 0.95 → sRGB 249（线性则是 242）
      const encoded = Math.abs(vFromGreen(249, true)) < Math.abs(vFromGreen(249, false));

      const off = (pt, dist, yaw, pitch) => [pt[0] + Math.sin(yaw) * Math.cos(pitch) * dist, pt[1] + Math.sin(pitch) * dist, pt[2] + Math.cos(yaw) * Math.cos(pitch) * dist];
      const DIST = 1.7, PITCH = 0.40, YAW = 0.7;
      const setCam = (pt, cp) => {
        v.target.set(pt[0], pt[1] + 0.075, pt[2]);
        const dx = cp[0] - v.target.x, dy = cp[1] - v.target.y, dz = cp[2] - v.target.z;
        v.distance = Math.hypot(dx, dy, dz); v.pitch = Math.asin(dy / v.distance); v.yaw = Math.atan2(dx, dz);
        v.updateCamera();
      };
      const lumAt = (x, y) => { const q = px(x, y); return 0.2126 * q[0] + 0.7152 * q[1] + 0.0722 * q[2]; };
      /** 墨线/内部对比：以中心 5×5（内部色）为基准，< 0.62× 记墨；
       *  ring = 贴着白底的草卡像素（−2px 带内），外轮廓就画在这一圈上。 */
      const inkStats = (win) => {
        let base = 0, n0 = 0;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { base += lumAt(C.x + dx, C.y + dy); n0++; }
        base /= n0;
        const cut = base * 0.62, bg = (x, y) => lumAt(x, y) > 240;
        let dark = 0, bgPx = 0, ring = 0, ringDark = 0, ringSum = 0, sum = 0, pxN = 0;
        for (let dy = -win; dy <= win; dy++) for (let dx = -win; dx <= win; dx++) {
          const x = C.x + dx, y = C.y + dy; if (x < 0 || y < 0 || x >= W || y >= H) continue;
          const l = lumAt(x, y); pxN++; sum += l;
          if (l > 240) { bgPx++; continue; }
          if (l < cut) dark++;
          let near = false;
          for (let ey = -2; ey <= 2 && !near; ey++) for (let ex = -2; ex <= 2; ex++) {
            const x2 = x + ex, y2 = y + ey; if (x2 < 0 || y2 < 0 || x2 >= W || y2 >= H || bg(x2, y2)) { near = true; break; }
          }
          if (near) { ring++; ringSum += l; if (l < cut) ringDark++; }
        }
        return { dark, bg: bgPx, base: +base.toFixed(1), px: pxN, meanLum: +(sum / pxN).toFixed(1),
          ring, ringDark, ringDarkFrac: ring ? +(ringDark / ring).toFixed(3) : 0, ringLum: ring ? +(ringSum / ring).toFixed(1) : 0 };
      };
      const png = (bufNow) => {
        const cvs = document.createElement('canvas'); cvs.width = W; cvs.height = H;
        const ctx = cvs.getContext('2d'), im = ctx.createImageData(W, H);
        for (let y = 0; y < H; y++) im.data.set(bufNow.subarray(y * W * 4, (y + 1) * W * 4), (H - 1 - y) * W * 4);
        ctx.putImageData(im, 0, 0); return cvs.toDataURL('image/png').split(',')[1];
      };

      // ⑤ GPU 回读 vs CPU 孪生（逐卡，同一机位、单卡隔离）
      const gpu = { encoded, samples: [] };
      const step = Math.max(1, Math.floor(n / 80));
      for (let i = 0; i < n && gpu.samples.length < 48; i += step) {
        const pt = pos[i], cp = off(pt, DIST, YAW, PITCH);
        const cpu = CM.grassOutlineStrength(map, pt, cp, { lift: liftOf(i) }).strength;
        setCam(pt, cp); putMatrix(i);
        gl.u.uGL.value = 1; gl.u.uGLDebug.value = 1; shoot(BLACK);
        const g = vCenter(4, encoded); if (g === null) continue;
        gpu.samples.push({ i, vGpu: g, vCpu: +cpu.toFixed(3), aEdge: aEdge[i] });
      }
      const diffs = gpu.samples.map((s) => Math.abs(s.vGpu - s.vCpu));
      gpu.n = diffs.length;
      gpu.maxDiff = diffs.length ? +Math.max(...diffs).toFixed(3) : null;
      gpu.meanDiff = diffs.length ? +(diffs.reduce((a, c) => a + c, 0) / diffs.length).toFixed(3) : null;

      // ⑥ 真实描边 A/B：A = 静态 aEdge=1 但背景反差低；B = 静态 aEdge=0 但背景反差高
      const candA = [], candB = [];
      for (let i = 0; i < n; i++) {
        if (pos[i][1] < 1.2) continue;
        const cp = off(pos[i], DIST, YAW, PITCH);
        const s = CM.grassOutlineStrength(map, pos[i], cp, { lift: liftOf(i) }).strength;
        if (aEdge[i] > 0.5 && s < 0.12) candA.push({ i, s, cp });
        if (aEdge[i] < 0.5 && s > 0.55) candB.push({ i, s, cp });
      }
      candA.sort((a, b) => a.s - b.s); candB.sort((a, b) => b.s - a.s);

      const ink = {};
      const shots = {};
      const runCase = (name, cand) => {
        if (!cand) return null;
        setCam(pos[cand.i], cand.cp); putMatrix(cand.i);
        gl.u.uGL.value = 1; gl.u.uGLDebug.value = 1; shoot(BLACK);
        const vGpu = vCenter(4, encoded);
        gl.u.uGLDebug.value = 0;
        gl.u.uGL.value = 0; shoot(WHITE); const offS = inkStats(30); const pngOff = png(buf);
        gl.u.uGL.value = 1; shoot(WHITE); const onS = inkStats(30); const pngOn = png(buf);
        gl.u.uGL.value = 1; shoot(WHITE); const onS2 = inkStats(30);         // 同状态两帧噪声
        shots[name] = { off: pngOff, on: pngOn };
        return { i: cand.i, aEdge: aEdge[cand.i], vCpu: +cand.s.toFixed(3), vGpu, off: offS, on: onS, noise: Math.abs(onS.dark - onS2.dark) };
      };
      ink.A = runCase('A', candA[0]);
      ink.B = runCase('B', candB[0]);
      ink.candA = candA.length; ink.candB = candB.length;
      tmpScene.remove(one); one.dispose();

      // ── 整岛对照图（片子那种底色：反差纹理配色 + 草卡真实描边）────────────────
      restoreVis(); veg.tufts.visible = true;
      v.scene.background = origBg;
      v.yaw = cam0.yaw; v.pitch = cam0.pitch; v.distance = cam0.distance; v.target.copy(cam0.target);
      v.updateCamera();
      gl.u.uGL.value = 1; gl.u.uGLDebug.value = 1;
      const ctPrev = v.shading?.on?.contrasttex ?? false;
      v.setDebug('contrasttex', true);
      // 冻结期间 view.render（含 shading.update）不会跑，反差纹理不会上材质 → 必须自己调一次
      v.shading.update(true);
      shot(); shot(); const islandDebug = png(buf);          // 第一帧在编着色器，第二帧才算数
      gl.u.uGLDebug.value = 0; shot(); shot(); const islandInk = png(buf);
      v.setDebug('contrasttex', ctPrev);
      shot();

      // 还原
      v.render = origRender;
      v.scene.background = origBg;
      cam.aspect = origAspect; cam.updateProjectionMatrix();
      gl.u.uGL.value = 1; gl.u.uGLDebug.value = 0;
      v.renderer.setRenderTarget(null);

      return {
        shape: { cells: v.town.cells.length, tufts: n, levelHeight: L, map: { res: map.res, tris: map.tris, maxH: +map.maxH.toFixed(2), span: +map.span.toFixed(2), sameDE: +map.after.sameDE.toFixed(2), contrastDE: +map.after.contrastDE.toFixed(2), bakeMs: gl.stats().bakeMs } },
        twin, nHigh, nLow, edgeCmp, rotation, gpu, ink,
        island: { debug: islandDebug, ink: islandInk, state: { contrasttexOn: !!v.shading?.on?.contrasttex, uShCT: v.shading?.u?.uShCT?.value, c11Debug: !!gl.u.uGLDebug.value } },
        shots,
      };
    });

    if (PROBE) {
      console.log(JSON.stringify({ ...R, island: Object.keys(R.island), shots: Object.keys(R.shots) }, null, 1));
    } else {
      console.log('shape     ', JSON.stringify(R.shape));
      console.log('twin      ', JSON.stringify(R.twin), 'high>0.5', R.nHigh, 'low<0.08', R.nLow);
      console.log('aEdge cmp ', JSON.stringify(R.edgeCmp));
      console.log('rotation  ', JSON.stringify(R.rotation));
      console.log('gpu       ', JSON.stringify({ encoded: R.gpu.encoded, n: R.gpu.n, maxDiff: R.gpu.maxDiff, meanDiff: R.gpu.meanDiff, samples: R.gpu.samples.slice(0, 8) }));
      console.log('ink       ', JSON.stringify(R.ink));
    }

    // 截图落盘
    const write = (name, b64) => fs.writeFileSync(`${OUT}/${name}-r150.png`, Buffer.from(b64, 'base64'));
    write('grassline-island-debug', R.island.debug);
    write('grassline-island-ink', R.island.ink);
    if (R.shots.A) { write('grassline-tuftA-ink-off', R.shots.A.off); write('grassline-tuftA-ink-on', R.shots.A.on); }
    if (R.shots.B) { write('grassline-tuftB-ink-off', R.shots.B.off); write('grassline-tuftB-ink-on', R.shots.B.on); }

    assert.equal(R.shape.map.res, 256, 'map res');
    assert.ok(R.shape.tufts > 3000, 'tufts scale');
    assert.ok(R.shape.map.contrastDE > 10 && R.shape.map.sameDE < 1, 'contrast vs same edge DE');
    assert.ok(R.nHigh > 0 && R.nLow > 0, 'both high and low outline strength exist');
    assert.ok(R.edgeCmp.disagreeRate > 0.1, 'sampled strength is NOT the static aEdge proxy');
    assert.ok(R.rotation.adjacent.median < R.rotation.opposite.median, 'bkg sampling varies slower per step than across half orbit');
    assert.ok(R.rotation.opposite.fracChanged > 0.2, 'turning the camera changes outline strength');
    assert.ok(R.gpu.n >= 30, 'gpu sample count');
    assert.ok(R.gpu.maxDiff === null || R.gpu.maxDiff < 0.08, 'GPU readback matches JS twin per tuft');
    assert.ok(R.ink.A && R.ink.A.aEdge === 1 && R.ink.A.vGpu !== null && R.ink.A.vGpu < 0.15, 'case A: static edge flag but low sampled contrast');
    assert.ok(R.ink.A.on.ringDarkFrac < R.ink.A.off.ringDarkFrac * 0.75, 'case A: silhouette ink collapses once it samples the background');
    assert.ok(R.ink.A.on.ringLum > R.ink.A.off.ringLum + 10, 'case A: silhouette band brightens (= no outline)');
    assert.ok(R.ink.B && R.ink.B.aEdge === 0 && R.ink.B.vGpu > 0.5, 'case B: no static edge flag but high sampled contrast');
    assert.ok(R.ink.B.on.ringDarkFrac >= R.ink.B.off.ringDarkFrac, 'case B: silhouette ink thickens from the background difference');
    assert.ok(R.ink.B.on.dark > R.ink.B.off.dark * 1.1, 'case B: ink area grows (+10% at least)');
    assert.ok(R.ink.B.on.ringLum < R.ink.B.off.ringLum, 'case B: silhouette band darkens');
    assert.ok(R.ink.A.noise <= 2 && R.ink.B.noise <= 2, 'same-state noise');
    assert.deepEqual(errors, [], 'no console errors');

    console.log('PASS grassline contrast-texture sampling', JSON.stringify({
      A: { aEdge: R.ink.A.aEdge, vGpu: R.ink.A.vGpu, ringDarkFrac: [R.ink.A.off.ringDarkFrac, R.ink.A.on.ringDarkFrac], ringLum: [R.ink.A.off.ringLum, R.ink.A.on.ringLum] },
      B: { aEdge: R.ink.B.aEdge, vGpu: R.ink.B.vGpu, ringDarkFrac: [R.ink.B.off.ringDarkFrac, R.ink.B.on.ringDarkFrac], ringLum: [R.ink.B.off.ringLum, R.ink.B.on.ringLum] },
      gpu: { n: R.gpu.n, maxDiff: R.gpu.maxDiff, meanDiff: R.gpu.meanDiff },
    }));
  } finally {
    await b.close();
  }
})();

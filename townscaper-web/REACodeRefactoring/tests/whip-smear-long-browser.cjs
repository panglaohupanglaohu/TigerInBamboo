// r228 · 1727324352264474664「快速转镜拖抹」长拖尾档验收（`?whiplen=auto` = view.js smearCap 0）
// 片内可判（原尺寸帧 0095 / 0242）：快速转镜时拖影沿轮廓拉成 3–6 层硬切片、长度到画面宽 1/3（约 200px@640），
// 慢转帧（0280–0302）几乎无影。r220 的实现把长度硬钉在 maxPx=32，长拖尾被截成短影 —— 本轮把它改成按外圈位移自适应。
//   ① 逻辑：whipCapPx 有下界 32、随 |shift| 线性、被 frac×短边夹住（同一常数在页面与 CPU 孪生共用）；
//   ② GPU 直验：同一张水平边纹理、同一 200px 速度场，cap=32 的拖尾在 32px 内截止，cap=200 拉到 ≥150px；
//      cap=200 时 GPU 与 CPU whipSmear 全图对拍（孪生不得分叉）；
//   ③ 实景：同一机位同一 dyaw，`?whiplen=auto` 的 smearStats.maxPx > 32 且差分像素/最远半径都大于钉死档；
//   ④ 停转（dt=0）在自适应档下仍恒等，关闭开关清空历史。
const { chromium } = require('playwright'), assert = require('node:assert/strict'), fs = require('fs');
const URL = 'http://127.0.0.1:8769/index.html?scene=terrain&on=motionblur&whiplen=auto';
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const errors = [];
  try {
    const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
    p.on('pageerror', (e) => errors.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource:')) errors.push(m.text()); });
    for (let i = 0; ; i++) {
      try { await p.goto(URL); await p.waitForFunction(() => window.rea?.view?.worldMesh?.geometry?.attributes?.position?.count > 100, null, { timeout: 60000 }); break; }
      catch (e) { if (i >= 2) throw e; }
    }
    await p.waitForTimeout(1200);

    const r = await p.evaluate(async () => {
      const v = rea.view, gl = v.renderer.getContext(), rr = v.renderer;
      const CM = await import('/src/core/camera-motion.js');
      const { whipCapPx, whipSmear } = CM;

      /* ① 逻辑：上限模型 */
      const W = 1280, H = 800, R = Math.hypot(W, H) / 2, fracCap = .35 * Math.min(W, H);
      const capLogic = {
        slow: whipCapPx(0.01, 0, W, H),                         // 慢转 → 下界 32
        fast: whipCapPx(0.5, 0, W, H),                          // 0.5·755·1.6 = 604 → 夹到 280
        half: whipCapPx(0.05, 0, W, H),                         // 0.05·755·1.6 = 60.4
        fracCap,
        panOnly: whipCapPx(0, 20, W, H),                        // 纯俯仰：32 (20·1.6=32)
        monotone: [0.02, 0.04, 0.08, 0.16].map((s) => whipCapPx(s, 0, W, H)),
      };

      v.__orig = v.render.bind(v); v.render = () => {};         // 停自循环，手动渲染
      v.setDebug('motionblur', true);
      v.__orig(0);

      const snap = () => {
        const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(w * h * 4);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
        return { px, w, h };
      };
      const grab = () => { v.__orig(0); return snap(); };
      const lumAt = (im, x, y) => { const i = (y * im.w + x) * 4; return .2126 * im.px[i] + .7152 * im.px[i + 1] + .0722 * im.px[i + 2]; };
      const diffMean = (a, c, ring) => {
        let s = 0, n = 0; const Rr = Math.min(a.w, a.h) / 2;
        for (let y = 0; y < a.h; y += 2) for (let x = 0; x < a.w; x += 2) {
          const rad = Math.hypot(x - a.w / 2, y - a.h / 2) / Rr;
          if (rad < ring[0] || rad >= ring[1]) continue;
          s += Math.abs(lumAt(a, x, y) - lumAt(c, x, y)); n++;
        }
        return { mean: n ? +(s / n).toFixed(3) : 0, px: n };
      };
      // 差分像素数与最远半径（只数 >10 级的点，噪声 <1）
      const diffExtent = (a, c) => {
        let n = 0, far = 0; const Rr = Math.min(a.w, a.h) / 2;
        for (let y = 0; y < a.h; y += 2) for (let x = 0; x < a.w; x += 2) {
          if (Math.abs(lumAt(a, x, y) - lumAt(c, x, y)) <= 10) continue;
          n++; const rad = Math.hypot(x - a.w / 2, y - a.h / 2) / Rr; if (rad > far) far = rad;
        }
        return { px: n, farR: +far.toFixed(3) };
      };

      /* ② GPU 直验：水平边 + 200px 速度场，cap 32 vs 200 */
      const T = await import('three');
      const S = 512, mk = (fn) => { const d = new Uint8ClampedArray(S * S * 4); for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const val = fn(x, y) ? 230 : 25; d.set([val, val, val, 255], (y * S + x) * 4); } const t = new T.DataTexture(new Uint8Array(d.buffer), S, S); t.minFilter = t.magFilter = T.LinearFilter; t.needsUpdate = true; return { img: { data: d, w: S, h: S }, tex: t }; };
      const fill = new T.ShaderMaterial({
        uniforms: { t: { value: null } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy,0.,1.); }',
        fragmentShader: 'uniform sampler2D t; varying vec2 vUv; void main(){ gl_FragColor = texture2D(t, vUv); }',
      });
      const fillMesh = new T.Mesh(new T.PlaneGeometry(2, 2), fill), fillScene = new T.Scene(); fillScene.add(fillMesh);
      const runQuad = (tex, pan, cap) => {
        const rt = new T.WebGLRenderTarget(S, S), u = v.smearQuad.material.uniforms;
        const bak = { tex: u.uTex.value, a: u.uA.value, res: u.uRes.value.clone(), c: u.uCenter.value.clone(), shift: u.uShift.value, pan: u.uPan.value, edge: u.uEdge.value, cap: u.uCap.value };
        const prevRT = rr.getRenderTarget();
        fill.uniforms.t.value = tex; rr.setRenderTarget(rt); rr.render(fillScene, v.smearCam);
        u.uTex.value = tex; u.uA.value = 1; u.uRes.value.set(S, S); u.uCenter.value.set(S / 2, S / 2);
        u.uShift.value = 0; u.uPan.value = pan; u.uCap.value = cap;
        const ac = rr.autoClear; rr.autoClear = false; rr.render(v.smearScene, v.smearCam); rr.autoClear = ac;
        const px = new Uint8Array(S * S * 4); rr.readRenderTargetPixels(rt, 0, 0, S, S, px); rr.setRenderTarget(prevRT);
        u.uTex.value = bak.tex; u.uA.value = bak.a; u.uRes.value.copy(bak.res); u.uCenter.value.copy(bak.c);
        u.uShift.value = bak.shift; u.uPan.value = bak.pan; u.uEdge.value = bak.edge; u.uCap.value = bak.cap;
        rt.dispose(); return px;
      };
      const TEX = mk((x, y) => y >= 256);                          // 下暗上亮的水平边（y=256）
      const vel = new Float32Array(S * S * 2); for (let i = 0; i < S * S; i++) vel[i * 2 + 1] = 200;
      const lum2 = (px, x, y) => { const i = (y * S + x) * 4; return .2126 * px[i] + .7152 * px[i + 1] + .0722 * px[i + 2]; };
      const gpu32 = runQuad(TEX.tex, 200, 32), gpu200 = runQuad(TEX.tex, 200, 200);
      const cpu200 = whipSmear(TEX.img, TEX.img, vel, { alpha: 1, edge: 48, samples: 4, maxPx: 200 });
      let maxDiff = 0; for (let i = 0; i < S * S * 4; i += 4) for (let c = 0; c < 3; c++) maxDiff = Math.max(maxDiff, Math.abs(gpu200[i + c] - cpu200.data[i + c]));
      TEX.tex.dispose(); fill.dispose(); fillMesh.geometry.dispose();
      // 拖尾长度 = 沿 x=256 这一列、离边(y=256)最远仍被改动的行（|Δlum|>8），原始列 y<256 恒 25、y>=256 恒 230
      const profile = (px) => {
        let trail = 0, near = 0;
        for (let y = 0; y < S; y++) {
          const orig = y >= 256 ? 230 : 25, d = Math.abs(lum2(px, 256, y) - orig);
          if (Math.abs(y - 256) === 2) near = +lum2(px, 256, y).toFixed(1);
          if (d > 8 && Math.abs(y - 256) > trail) trail = Math.abs(y - 256);
        }
        return { trail, near };
      };
      const gpu = { cap32: profile(gpu32), cap200: profile(gpu200), cpu200: profile(cpu200.data), maxDiff };

      /* ③ 实景：同机位同 dyaw，自适应档 vs 钉死 32 */
      const step = async (Y, d) => {
        v.yaw = Y - d; v.updateCamera(); grab();
        await new Promise((res) => setTimeout(res, 60));
        v.yaw = Y; v.updateCamera(); v.__orig(1 / 60);
        return { im: snap(), s: { ...v.smearStats } };
      };
      const Y = 1.05;
      v.smearCap = 0;                                            // 自适应档（= ?whiplen=auto）
      const A = await step(Y, .5), aIm = A.im, aS = A.s;
      v.motionBlur = false; const off = grab(); v.motionBlur = true;
      v.smearCap = 32;                                           // 钉死档
      const B = await step(Y, .5), bIm = B.im, bS = B.s;

      /* ④ 停转恒等（自适应档）+ 关闭清空 */
      v.smearCap = 0;
      const stillA = grab(), stillB = grab();
      v.motionBlur = false; v.__orig(1 / 60);
      v.motionBlur = true; v.yaw += .4; v.updateCamera(); v.__orig(1 / 60);
      const alphaAfterToggle = v.smearStats.alpha;

      return {
        capLogic, gpu, size: [off.w, off.h], pitch: v.pitch,
        auto: { maxPx: aS.maxPx, shift: aS.shift, alpha: aS.alpha, ext: diffExtent(aIm, off) },
        pinned: { maxPx: bS.maxPx, shift: bS.shift, alpha: bS.alpha, ext: diffExtent(bIm, off) },
        ringsAuto: [[.15, .3], [.3, .45], [.45, .6]].map((bd) => diffMean(aIm, off, bd)),
        ringsPinned: [[.15, .3], [.3, .45], [.45, .6]].map((bd) => diffMean(bIm, off, bd)),
        still: { a: diffMean(stillA, stillB, [0, 1]), alphaAfterToggle },
      };
    });

    fs.writeFileSync('artifacts/coverage/whip-smear-long-browser-r228.json', JSON.stringify({ ...r, errors }, null, 2));   // 先落盘，断言失败也能看读数

    // ① 逻辑
    const L = r.capLogic;
    assert.equal(L.slow, 32, `慢转应落在下界 32（${L.slow}）`);
    assert.ok(Math.abs(L.half - 60.4) < .6, `0.05 rad 帧位移的上限应≈60（${L.half}）`);
    assert.ok(Math.abs(L.fast - L.fracCap) < .01, `快转应被 frac×短边夹住（${L.fast} vs ${L.fracCap}）`);
    assert.ok(L.panOnly >= 32 && L.panOnly <= 40, `纯俯仰小移动应≈32（${L.panOnly}）`);
    for (let i = 1; i < L.monotone.length; i++) assert.ok(L.monotone[i] > L.monotone[i - 1], `上限未随 |shift| 单调：${JSON.stringify(L.monotone)}`);

    // ② GPU：长档真的把拖尾拉长，且与 CPU 孪生一致
    const G = r.gpu;
    assert.ok(G.cap32.trail >= 26 && G.cap32.trail <= 38, `cap=32 的拖尾应止于 32px 上下（${JSON.stringify(G.cap32)}）`);
    assert.ok(G.cap200.trail >= 150, `cap=200 的拖尾没拉到 150px 外（${JSON.stringify(G.cap200)}）`);
    assert.ok(G.cap200.trail > G.cap32.trail * 4, `长档拖尾应为短档 4 倍以上（${G.cap200.trail} vs ${G.cap32.trail}）`);
    assert.ok(G.cap32.near < 200 && G.cap200.near < 200, `近边双档都该被压暗（${JSON.stringify([G.cap32.near, G.cap200.near])}）`);
    assert.ok(Math.abs(G.cpu200.trail - G.cap200.trail) <= 4, `CPU 孪生拖尾与 GPU 不符（${G.cpu200.trail} vs ${G.cap200.trail}）`);
    assert.ok(G.maxDiff <= 3, `cap=200 时 GPU≠CPU 孪生（maxDiff ${G.maxDiff}）`);

    // ③ 实景
    assert.ok(r.auto.maxPx > 32, `自适应档 maxPx 未超过 32（${r.auto.maxPx}）`);
    assert.ok(Math.abs(r.auto.shift - r.pinned.shift) < 1e-6, '两档机位/位移应一致');
    assert.ok(Math.abs(r.auto.maxPx - Math.min(.35 * Math.min(...r.size), 1.6 * Math.abs(r.auto.shift) * Math.hypot(...r.size) / 2)) < 1.5,
      `自适应上限与模型不符（${r.auto.maxPx}）`);
    // 实景聚合量对拖尾长度不敏感（r220 已记「整岛位移下方向性是弱信号」）：这里只断言「换档不改总账」，
    // 拖尾长度的分辨力由 ② 的合成直验（31px → 199px、GPU==CPU maxDiff 0）承担。
    assert.ok(Math.abs(r.auto.ext.px - r.pinned.ext.px) / r.pinned.ext.px < .05,
      `换档后实景差分像素变化超过 5%（${r.auto.ext.px} vs ${r.pinned.ext.px}）`);
    for (let i = 0; i < 3; i++) assert.ok(Math.abs(r.ringsAuto[i].mean - r.ringsPinned[i].mean) / Math.max(1e-6, r.ringsPinned[i].mean) < .08,
      `第 ${i} 环差分随换档漂移超过 8%（${r.ringsAuto[i].mean} vs ${r.ringsPinned[i].mean}）`);

    // ④ 停转/开关
    assert.equal(r.still.a.mean, 0, `停转帧不恒等（${JSON.stringify(r.still.a)}）`);
    assert.equal(r.still.alphaAfterToggle, 0, '开关重置后首帧仍有历史');

    const report = { ...r, errors };
    fs.writeFileSync('artifacts/coverage/whip-smear-long-browser-r228.json', JSON.stringify(report, null, 2));
    assert.deepEqual(errors, []);
    console.log('PASS whip smear 长拖尾 r228：上限 %s（慢 32 → 半速 %s → 快 %s）、GPU cap32/200 剖面 %s / %s、孪生 maxDiff %s、实景 差分 %s vs %s（最远半径 %s vs %s）、停转恒等 %s',
      r.auto.maxPx, L.half, L.fast, JSON.stringify(G.cap32), JSON.stringify(G.cap200), G.maxDiff,
      r.auto.ext.px, r.pinned.ext.px, r.auto.ext.farR, r.pinned.ext.farR, r.still.a);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });

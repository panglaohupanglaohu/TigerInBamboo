// r220 · 1727324352264474664「快速转镜拖抹」运行验收（index.html?scene=terrain&on=motionblur = view.js #smear）
// 片内可判（camera-wall-review.md，帧95）：轮廓沿旋转方向被强拉长、停转清晰。
// r220 把「同位置半透明重影」升级为轮廓加权方向性历史拖尾（whipSmear，CPU 孪生在 core/camera-motion.js）：
//   ① GPU 直验（合成纹理注入 smearQuad + RT 回读，确定性）：水平边 + 竖直 pan → 边只沿 y 被拉宽 ≈pan px；
//     竖直边 + 竖直 pan（拖尾∥轮廓）→ 整图近似恒等；轮廓中心像素的混比高于边缘外像素（轮廓加权）；
//   ② 实景转镜：轮廓带差分 ≫ 平区、∝半径、随 |shift|=|dyaw|·sin(pitch) 单调；
//   ③ 停转/关开关 → 历史失效，同机位恒等（无残留重影）；
//   ④ 既有口径回归：±π 包裹速度、开关重置、stats 字段齐全（resize 释放由 camera-wall-browser 覆盖）。
const { chromium } = require('playwright'), assert = require('node:assert/strict'), fs = require('fs');
const URL = 'http://127.0.0.1:8769/index.html?scene=terrain&on=motionblur';
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
      const v = rea.view, gl = v.renderer.getContext(), r = v.renderer;
      v.__orig = v.render.bind(v); v.render = () => {};              // 停自循环，手动渲染
      v.setDebug('motionblur', true);                                // DEFAULT_ON 勾选不触发 setToggle，显式打开
      v.__orig(0);                                                   // 建历史纹理一帧
      const grab = () => {
        v.__orig(0);                                                 // dt=0：动画不推进，同机位两次渲染逐像素可比
        const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(w * h * 4);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
        return { px, w, h };
      };
      const snap = () => {
        const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(w * h * 4);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
        return { px, w, h };
      };
      const lumAt = (im, x, y) => { const i = (y * im.w + x) * 4; return .2126 * im.px[i] + .7152 * im.px[i + 1] + .0722 * im.px[i + 2]; };
      const edgeOf = (im, x, y) => Math.hypot((lumAt(im, x + 1, y) - lumAt(im, x - 1, y)) * .5, (lumAt(im, x, y + 1) - lumAt(im, x, y - 1)) * .5);
      const diffByEdge = (a, c, eMin, eMax, ring) => {
        let s = 0, n = 0; const R = Math.min(a.w, a.h) / 2;
        for (let y = 2; y < a.h - 2; y += 2) for (let x = 2; x < a.w - 2; x += 2) {
          const rr = Math.hypot(x - a.w / 2, y - a.h / 2) / R;
          if (rr < ring[0] || rr >= ring[1]) continue;
          const e = edgeOf(a, x, y); if (e < eMin || e >= eMax) continue;
          s += Math.abs(lumAt(a, x, y) - lumAt(c, x, y)); n++;
        }
        return { mean: n ? +(s / n).toFixed(3) : 0, px: n };
      };
      const diffMean = (a, c, ring) => {
        let s = 0, n = 0; const R = Math.min(a.w, a.h) / 2;
        for (let y = 0; y < a.h; y += 2) for (let x = 0; x < a.w; x += 2) {
          const rr = Math.hypot(x - a.w / 2, y - a.h / 2) / R;
          if (rr < ring[0] || rr >= ring[1]) continue;
          s += Math.abs(lumAt(a, x, y) - lumAt(c, x, y)); n++;
        }
        return +(s / n).toFixed(3);
      };

      /* ① GPU==CPU 孪生直验：合成纹理喂进 smearQuad（uTex），先把同图铺进 RT 作底（模拟当前帧），
         再渲 smearQuad（历史拖尾）回读，与 CPU whipSmear 全图对拍。
         texH = 水平边（y=32 下暗上亮）；uPan=6 → 竖直拖尾：边只沿 y 被拉宽 ≈6px、x 向均匀；
         texV = 竖直边（x=32 左暗右亮）：拖尾∥轮廓 → 整图近似恒等（方向选择性）。 */
      const T = await import('three');
      const { whipSmear } = await import('/src/core/camera-motion.js');
      const S = 64;
      const mk = (fn) => { const d = new Uint8ClampedArray(S * S * 4); for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const v = fn(x, y) ? 230 : 25; d.set([v, v, v, 255], (y * S + x) * 4); } const t = new T.DataTexture(new Uint8Array(d.buffer), S, S); t.minFilter = t.magFilter = T.LinearFilter; t.needsUpdate = true; return { img: { data: d, w: S, h: S }, tex: t }; };
      const fill = new T.ShaderMaterial({
        uniforms: { t: { value: null } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy,0.,1.); }',
        fragmentShader: 'uniform sampler2D t; varying vec2 vUv; void main(){ gl_FragColor = texture2D(t, vUv); }',
      });
      const fillMesh = new T.Mesh(new T.PlaneGeometry(2, 2), fill);
      const fillScene = new T.Scene(); fillScene.add(fillMesh);
      const runQuad = (tex, shift, pan) => {
        const rt = new T.WebGLRenderTarget(S, S), u = v.smearQuad.material.uniforms;
        const bak = { tex: u.uTex.value, a: u.uA.value, res: u.uRes.value.clone(), c: u.uCenter.value.clone(), shift: u.uShift.value, pan: u.uPan.value, edge: u.uEdge.value };
        const prevRT = r.getRenderTarget();
        fill.uniforms.t.value = tex; r.setRenderTarget(rt); r.render(fillScene, v.smearCam);          // 底 = 当前帧
        u.uTex.value = tex; u.uA.value = 1; u.uRes.value.set(S, S); u.uCenter.value.set(S / 2, S / 2); u.uShift.value = shift; u.uPan.value = pan;
        const ac = r.autoClear; r.autoClear = false; r.render(v.smearScene, v.smearCam); r.autoClear = ac;   // 叠历史拖尾（同实机不清屏）
        const px = new Uint8Array(S * S * 4); r.readRenderTargetPixels(rt, 0, 0, S, S, px); r.setRenderTarget(prevRT);
        u.uTex.value = bak.tex; u.uA.value = bak.a; u.uRes.value.copy(bak.res); u.uCenter.value.copy(bak.c); u.uShift.value = bak.shift; u.uPan.value = bak.pan; u.uEdge.value = bak.edge;
        rt.dispose(); return px;
      };
      const cmpGPU = (px, cpu) => { let mx = 0, sum = 0; for (let i = 0; i < S * S * 4; i += 4) { for (let c = 0; c < 3; c++) { const d = Math.abs(px[i + c] - cpu.data[i + c]); if (d > mx) mx = d; sum += d; } } return { maxDiff: mx, meanDiff: +(sum / (S * S * 3)).toFixed(3) }; };
      const H = mk((x, y) => y >= 32), V = mk((x) => x >= 32);
      const velUp = new Float32Array(S * S * 2); for (let i = 0; i < S * S; i++) velUp[i * 2 + 1] = 6;  // (0,6)px 竖直速度场
      const outH = runQuad(H.tex, 0, 6), cpuH = whipSmear(H.img, H.img, velUp, { alpha: 1, edge: 48, samples: 4, maxPx: 32 });
      const outV = runQuad(V.tex, 0, 6), cpuV = whipSmear(V.img, V.img, velUp, { alpha: 1, edge: 48, samples: 4, maxPx: 32 });
      const lum2 = (px, x, y) => { const i = (y * S + x) * 4; return .2126 * px[i] + .7152 * px[i + 1] + .0722 * px[i + 2]; };
      const gpu = {
        cmpH: cmpGPU(outH, cpuH), cmpV: cmpGPU(outV, cpuV),
        hGhost: [lum2(outH, 48, 33), lum2(outH, 48, 35)],   // 边上方 1/3px 拖尾压暗
        hFar: lum2(outH, 48, 44),                           // 拖尾上限外回到亮
        hUniform: Math.abs(lum2(outH, 20, 35) - lum2(outH, 48, 35)),
        hEdgeVsOff: [lum2(outH, 48, 32), lum2(outH, 48, 33)],
        vDiffRow32: lum2(outV, 30, 32) - 25,                 // ∥轮廓拖尾：暗侧不增亮
      };
      H.tex.dispose(); V.tex.dispose(); fill.dispose(); fillMesh.geometry.dispose();

      /* ② 实景转镜 */
      const step = async (Y, d) => {
        v.yaw = Y - d; v.updateCamera(); grab();
        await new Promise((r) => setTimeout(r, 60));
        v.yaw = Y; v.updateCamera(); v.__orig(1 / 60);
        return { im: snap(), s: { ...v.smearStats } };
      };
      const Y = 1.05;
      const r1 = await step(Y, .5), B1 = r1.im, s1 = r1.s;
      v.motionBlur = false; const A = grab();
      const A2 = grab();
      v.motionBlur = true; const C = grab();
      await new Promise((r) => setTimeout(r, 60)); const C2 = grab();
      const r05 = await step(Y, .25), B05 = r05.im, s05 = r05.s;
      const r2 = await step(Y, 1.0), B2 = r2.im, s2 = r2.s;
      v.motionBlur = false; v.__orig(1 / 60);
      v.motionBlur = true; v.yaw += .4; v.updateCamera(); v.__orig(1 / 60);
      const alphaAfterToggle = v.smearStats.alpha;
      return {
        size: [A.w, A.h], pitch: v.pitch, stats: [s05, s1, s2], alphaAfterToggle, gpu,
        noise: diffMean(A2, A, [0, 1]), identity: diffMean(C, A, [0, 1]), identity2: diffMean(C2, C, [0, 1]),
        edgeBuckets: { edge: diffByEdge(B1, A, 24, 1e9, [.2, .9]), flat: diffByEdge(B1, A, 0, 4, [.2, .9]) },
        rings: [[0, .15], [.15, .3], [.3, .45], [.45, .6]].map((bd) => ({ band: bd, d: diffMean(B1, A, bd) })),
        omegaGain: { b05: diffMean(B05, A, [.15, .6]), b1: diffMean(B1, A, [.15, .6]), b2: diffMean(B2, A, [.15, .6]) },
      };
    });

    // ① GPU==CPU 孪生 + 方向性 + 轮廓加权（确定性，合成纹理）
    const g = r.gpu;
    assert.ok(g.cmpH.maxDiff <= 3 && g.cmpV.maxDiff <= 3, `GPU≠CPU 孪生（H ${JSON.stringify(g.cmpH)} V ${JSON.stringify(g.cmpV)}）`);
    assert.ok(g.hGhost[0] < 200 && g.hGhost[1] < 225, `水平边上方拖尾没出现（${JSON.stringify(g.hGhost)}）`);
    assert.ok(g.hFar > 225, `拖尾该在 pan=6px 内结束（远点 ${g.hFar}）`);
    assert.ok(g.hUniform < 12, `水平拖尾 x 向不均匀（${g.hUniform}）`);
    assert.ok(g.hEdgeVsOff[0] < g.hEdgeVsOff[1] - 40, `轮廓像素混比未高于边外（${JSON.stringify(g.hEdgeVsOff)}）`);
    assert.ok(Math.abs(g.vDiffRow32) < 8, `竖直边+竖直拖尾（∥轮廓）暗侧被污染：${g.vDiffRow32}`);

    // ④ stats 全指标：speed/alpha + r220 的 shift/pan/center/taps/maxPx/edge
    for (const s of r.stats) {
      for (const k of ['speed', 'alpha', 'shift', 'pan', 'center', 'taps', 'maxPx', 'edge']) assert.ok(k in s, 'smearStats 缺 ' + k);
      assert.ok(s.alpha > 0, '转镜时历史留存应为正');
      assert.equal(s.taps, 4); assert.equal(s.maxPx, 32);
    }
    assert.ok(Math.abs(r.stats[1].shift - .5 * Math.sin(r.pitch)) < .02, `shift≠dyaw·sin(pitch)：${r.stats[1].shift} vs ${(.5 * Math.sin(r.pitch)).toFixed(3)}`);
    assert.ok(Math.abs(r.stats[2].shift) > Math.abs(r.stats[0].shift), '|shift| 应随 dyaw 递增');
    assert.equal(r.alphaAfterToggle, 0, '开关重置后首帧仍有历史');

    // ② 轮廓加权实景：轮廓带差分 ≫ 平区；∝半径；随 |shift| 单调
    assert.ok(r.edgeBuckets.edge.px > 100 && r.edgeBuckets.flat.px > 100, '分桶像素不足');
    assert.ok(r.edgeBuckets.edge.mean > r.edgeBuckets.flat.mean * 2,
      `轮廓带差分 ${r.edgeBuckets.edge.mean} 未显著大于平区 ${r.edgeBuckets.flat.mean}`);
    assert.ok(r.omegaGain.b05 > 0 && r.omegaGain.b1 > r.omegaGain.b05 && r.omegaGain.b2 > r.omegaGain.b1,
      `差分未随 |shift| 单调：${JSON.stringify(r.omegaGain)}`);
    assert.ok(r.rings[0].d < r.rings[2].d, `内带 ${r.rings[0].d} 不应大于外带 ${r.rings[2].d}`);

    // ③ 停转恒等：dt=0 帧与无拖抹参照一致；开关重置后无残留
    assert.ok(r.identity < 4, `停转帧不恒等（${r.identity}）`);
    assert.equal(r.identity2, 0, '停转连渲两帧不一致（历史残留）');
    assert.equal(r.noise, 0, '同状态噪声不为 0');

    const report = { ...r, errors };
    fs.writeFileSync('artifacts/coverage/whip-smear-browser-r220.json', JSON.stringify(report, null, 2));
    assert.deepEqual(errors, []);
    console.log('PASS whip smear r220 浏览器验收：GPU直验 %s、轮廓带/平区差分 %s/%s、0.5/1/2×差分 %s、恒等 %s/%s、开关alpha %s',
      JSON.stringify(r.gpu), r.edgeBuckets.edge.mean, r.edgeBuckets.flat.mean,
      JSON.stringify(r.omegaGain), r.identity, r.identity2, r.alphaAfterToggle);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });

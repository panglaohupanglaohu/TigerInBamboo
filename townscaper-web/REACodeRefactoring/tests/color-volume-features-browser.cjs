// 1710031224838771027 残差「浏览器实景验收」：view.js mode-3（uColorVolumeOn>2.5）
// 在真实消费者页 index.html?scene=fusion 上跑真实 GPU（本机 Chrome + swiftshader），
// 证明：a) shader 真编译进 uColorVolumeOn 分支、0 console error；
//       b) ground/roof/cliff 三特征分桶真实生效且互不串色（marker 掩膜 + 区域像素差统计）；
//       c) steps 离散采样在 GPU 上出阶梯色带（textureOnly 下唯一颜色数 ≈ 格点数）；
//       d) 同参重截逐像素一致（确定性，含跨页面重载）。
// 证据：artifacts/coverage/color-volume-features-browser.json + color-volume-feat-*.png
const { chromium } = require('playwright'), fs = require('fs');
(async () => {
  const b = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const errors = [];
  try {
    const url = process.env.REA_TEST_URL || 'http://localhost:8769/index.html?scene=fusion&punch=0';
    const pageRender = async (p) => {
      await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await p.waitForFunction(() => window.rea?.view?.worldMesh?.geometry?.attributes?.aField?.count > 0, null, { polling: 100, timeout: 60000 });
    };
    const p = await b.newPage({ viewport: { width: 1400, height: 950 } });
    p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource:')) errors.push('console: ' + m.text()); });
    await pageRender(p);

    const r = await p.evaluate(async () => {
      const { world, view } = window.rea;
      const T = await import('three');
      const renderer = view.renderer;
      const version0 = world.version, geo0 = view.worldMesh.geometry;

      // ---- a) 捕获真编译的 fragment shader：强制重编译，验 mode-3 分支与数组 uniform 在位 ----
      let captured = null;
      const orig = view.material.onBeforeCompile;
      view.material.onBeforeCompile = (s) => { orig(s); captured = s; };
      view.material.needsUpdate = true;

      const W = 640, H = 400;
      const rt = new T.WebGLRenderTarget(W, H);
      const oldRt = renderer.getRenderTarget();
      // 只留世界网格 + 灯光：水/鸟/植被/轮廓等动态层不参与验收（确定性 + 掩膜口径只量世界网格）
      const hidden = [];
      for (const ch of view.scene.children) if (ch !== view.mesh && !ch.isLight && ch !== view.sun.target && ch.visible) { ch.visible = false; hidden.push(ch); }
      // shadowMap.autoUpdate=false：阴影图只在 sunDir/target 变化时重画，首帧可能烘在半成品几何上（跨重载亮度差的根因）。
      // 每次 capture 前强制重画 → 阴影图始终来自最终几何，跨重载逐像素一致。
      const render = () => { renderer.shadowMap.needsUpdate = true; renderer.setRenderTarget(rt); renderer.render(view.scene, view.camera); const a = new Uint8Array(W * H * 4); renderer.readRenderTargetPixels(rt, 0, 0, W, H, a); renderer.setRenderTarget(oldRt); return a; };
      const diff = (a, b) => { const idx = []; for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) idx.push(i / 4); return idx; };
      const uniqIn = (a, mask) => { const s = new Set(); for (const px of mask) s.add((a[px * 4] << 16) | (a[px * 4 + 1] << 8) | a[px * 4 + 2]); return s; };
      render(); // 触发重编译
      const shader = {
        hasMode3: !!captured && captured.fragmentShader.includes('uColorVolumeOn>2.5'),
        hasFeatSample: !!captured && captured.fragmentShader.includes('featVolumeSample'),
        hasCvQuant: !!captured && captured.fragmentShader.includes('cvQuant'),
        featVolMinLen: captured?.uniforms?.uFeatVolMin?.value?.length ?? -1,
        featVolMaxLen: captured?.uniforms?.uFeatVolMax?.value?.length ?? -1,
        programDiagnostics: renderer.info.programs.filter((pr) => pr.diagnostics).map((pr) => pr.name + ':' + pr.diagnostics.programLog),
      };

      // pop 全部过期：headless 下 uTime 可能冻结在半途位姿，"帧一致"会假绿（跨重载数千 px 差异根因）
      view.pop.uniforms.uPops.value.forEach((v) => { v.w = -1e9; });
      // ---- 稳定等待：world.version 停涨 + 连续两帧逐像素一致（pop/阴影/异步烘焙 settle）----
      let stable = 0; { let prev = render(), pv = world.version, still = 0; for (let i = 0; i < 40; i++) { await new Promise((r2) => setTimeout(r2, 300)); const cur = render(); const same = diff(prev, cur).length === 0; still = (world.version === pv && same) ? still + 1 : 0; pv = world.version; prev = cur; if (still >= 2) { stable = i + 1; break } } }

      // ---- 正交调制器中性化：surfaceShadow(0.55)/shrubtex/cloudShadow 默认开且会乘 diffuseColor ----
      // 它们不是色容体的一部分：表面阴影/灌木按强度缩放已采样色、云影随 uTime 漂移 → 会让阶梯/确定性量测失真。
      // 记录原值、量化测量在中性态做，最后再按默认态复核一次分桶隔离并还原。
      const mods = { surfaceShadow: view.groundSurfaceShadow.strength.value, shrubtex: view.shrubOn.value, cloudShadow: view.cloudShadow.enabled };
      view.setDebug('surfaceshadow', false); view.setDebug('shrubtex', false); view.setDebug('cloudshadow', false);
      view.pop.uniforms.uPops.value.forEach((v) => { v.w = -1e9; });   // pop 全部过期：headless 下 uTime 可能冻结，pop 半途位姿会冒充"已稳定"（跨重载 6117px 差异根因）
      { let prev = render(); for (let i = 0; i < 10; i++) { await new Promise((r2) => setTimeout(r2, 200)); const cur = render(); if (diff(prev, cur).length === 0) break; prev = cur; } }

      const RED = { h: [0, 0], s: [1, 1], l: [.5, .5] }, GREEN = { h: [.333, .333], s: [1, 1], l: [.5, .5] };
      const GREY = { h: [.6, .6], s: [0, 0], l: [.55, .55] };
      const base = {
        ground: { h: [.22, .38], s: [.4, .7], l: [.3, .6] },
        roof: { h: [.02, .08], s: [.5, .85], l: [.4, .7] },
        cliff: { h: [.58, .66], s: [.05, .2], l: [.35, .55] },
      };
      const withVol = (k, v) => { const m = { ...base }; m[k] = v; return m; };
      const shot = (map, opts) => { view.setFeatureColorVolumes(map, opts); return render(); };

      // ---- b) 特征掩膜：每特征轮流换 marker 色（RED↔GREEN），变化像素 = 该桶真实落点 ----
      const masks = {};
      for (const f of ['ground', 'roof', 'cliff']) {
        const a = shot(withVol(f, RED)), c = shot(withVol(f, GREEN));
        masks[f] = new Set(diff(a, c));
      }
      const overlap = (s1, s2) => { let n = 0; for (const x of s1) if (s2.has(x)) n++; return n; };

      // mode-3 开关与 uniform 实况
      view.setFeatureColorVolumes(base);
      const modeState = { on: view.colorVolumeOn.value, featOn: view.featVolOn.value.toArray(), steps: view.colorVolumeSteps.value };
      const off = shot(null); const b0 = shot(base);
      const mode3Effect = diff(off, b0).length;

      // 改 roof 只影响屋顶桶 / 改 cliff 只影响崖面桶 / 改 ground 只影响顶面桶
      const isol = {};
      const probe = { roof: { h: [.55, .62], s: [.6, .9], l: [.3, .5] }, cliff: { h: [.95, .02], s: [.7, .95], l: [.35, .6] }, ground: { h: [.75, .85], s: [.3, .6], l: [.5, .75] } };
      for (const f of ['roof', 'cliff', 'ground']) {
        const b1 = shot(withVol(f, probe[f]));
        const changed = diff(b0, b1), out = changed.filter((px) => !masks[f].has(px));
        const other = ['ground', 'roof', 'cliff'].filter((x) => x !== f);
        const leaked = other.reduce((n, g) => n + changed.filter((px) => masks[g].has(px)).length, 0);
        isol[f] = { changed: changed.length, maskPx: masks[f].size, outsideMask: out.length, leakedIntoOtherFeatureMasks: leaked };
      }

      // ---- c) steps 离散采样：textureOnly 直出 albedo，数掩膜内唯一颜色 ----
      view.setDebug('textureonly', true);
      const unionMask = new Set([...masks.ground, ...masks.roof, ...masks.cliff]);
      const s0 = shot(base);                       // steps=0 连续
      const uniq0 = uniqIn(s0, unionMask).size;
      const s4 = shot(base, { steps: 4 });
      const uniq4 = uniqIn(s4, unionMask).size;
      const uniq4per = Object.fromEntries(['ground', 'roof', 'cliff'].map((f) => [f, uniqIn(s4, masks[f]).size]));
      const s12 = shot(base, { steps: 12 });
      const uniq12 = uniqIn(s12, unionMask).size;
      view.setDebug('textureonly', false);

      // ---- d) 确定性：同参重渲 + 重设同参，逐像素一致；留 SHA-256 供跨重载比对 ----
      shot(base); const d1 = render(), d2 = render(); shot(base); const d3 = render();
      const determinism = { reRender: diff(d1, d2).length, reSet: diff(d1, d3).length };
      const dHashBuf = await crypto.subtle.digest('SHA-256', d1.buffer);
      const baselineHash = [...new Uint8Array(dHashBuf)].map((x) => x.toString(16).padStart(2, '0')).join('');
      const baselinePx = Array.from(d1);   // 临时：跨重载 diff 诊断

      // ---- 默认态复核：还原正交调制器后，改 roof 仍只影响 roof 桶（发货配置下同样不串色）----
      view.groundSurfaceShadow.set({ strength: mods.surfaceShadow, receivers: 'all' });
      view.setDebug('shrubtex', !!mods.shrubtex); view.setDebug('cloudshadow', mods.cloudShadow);
      { let prev = render(); for (let i = 0; i < 10; i++) { await new Promise((r2) => setTimeout(r2, 200)); const cur = render(); if (diff(prev, cur).length === 0) break; prev = cur; } }
      const b0d = shot(base), b1d = shot(withVol('roof', probe.roof));
      const defChanged = diff(b0d, b1d), defOut = defChanged.filter((px) => !masks.roof.has(px));
      const defaultState = { mods, roofChanged: defChanged.length, roofOutsideMask: defOut.length };

      const worldIntact = world.version === version0 && view.worldMesh.geometry === geo0;
      view.setFeatureColorVolumes(null);
      hidden.forEach((ch) => { ch.visible = true; });
      renderer.setRenderTarget(oldRt); rt.dispose();
      return { shader, stable, modeState, mode3Effect, baselineHash, baselinePx, defaultState, maskPx: Object.fromEntries(Object.entries(masks).map(([k, v]) => [k, v.size])),
        maskOverlap: { groundRoof: overlap(masks.ground, masks.roof), groundCliff: overlap(masks.ground, masks.cliff), roofCliff: overlap(masks.roof, masks.cliff) },
        isol, steps: { unionMaskPx: unionMask.size, uniq0, uniq4, uniq4per, uniq12 }, determinism, worldIntact };
    });

    const fail = [];
    const A = (ok, msg) => { if (!ok) fail.push(msg); };
    A(r.shader.hasMode3 && r.shader.hasFeatSample && r.shader.hasCvQuant, 'compiled fragment missing mode-3/featVolumeSample/cvQuant');
    A(r.shader.featVolMinLen === 3 && r.shader.featVolMaxLen === 3, 'feat uniform arrays not length 3');
    A(r.shader.programDiagnostics.length === 0, 'program diagnostics: ' + JSON.stringify(r.shader.programDiagnostics));
    A(r.stable > 0, 'render never stabilized');
    A(r.modeState.on === 3 && r.modeState.featOn.join() === '1,1,1', 'mode-3 uniforms not set: ' + JSON.stringify(r.modeState));
    A(r.mode3Effect > 1000, 'mode-3 vs off changed too few px: ' + r.mode3Effect);
    for (const f of ['roof', 'cliff', 'ground']) {
      const s = r.isol[f];
      A(s.maskPx > 100, f + ' mask too small: ' + s.maskPx);
      A(s.changed > 100, f + ' volume change affected too few px: ' + s.changed);
      A(s.outsideMask === 0, f + ' changed px outside own bucket mask: ' + s.outsideMask);
      A(s.leakedIntoOtherFeatureMasks === 0, f + ' leaked into other features: ' + s.leakedIntoOtherFeatureMasks);
    }
    A(r.maskOverlap.groundRoof === 0 && r.maskOverlap.groundCliff === 0 && r.maskOverlap.roofCliff === 0, 'feature masks overlap: ' + JSON.stringify(r.maskOverlap));
    A(r.steps.uniq4 < r.steps.uniq0 / 4 && r.steps.uniq4 <= 80, 'steps=4 not banded: uniq0=' + r.steps.uniq0 + ' uniq4=' + r.steps.uniq4);
    // steps=12：u,v,w 各 12 档 × 3 特征桶，合法上界 12³=1728；显著低于连续档(uniq0)且显著高于 steps=4 即可
    A(r.steps.uniq12 > r.steps.uniq4 && r.steps.uniq12 < r.steps.uniq0 * 0.5 && r.steps.uniq12 <= 1728, 'steps=12 count off: ' + r.steps.uniq12);
    A(r.determinism.reRender === 0 && r.determinism.reSet === 0, 'non-deterministic render: ' + JSON.stringify(r.determinism));
    A(r.worldIntact, 'world mutated by volume calls');
    A(r.defaultState.roofChanged > 100 && r.defaultState.roofOutsideMask === 0, 'default-state roof isolation: ' + JSON.stringify(r.defaultState));

    // ---- 截图证据（恢复全场景、页面自渲染）----
    const shotPng = async (name, fn) => { await p.evaluate(fn); await p.evaluate(() => window.rea.view.changed()); await p.waitForTimeout(700); await p.screenshot({ path: 'artifacts/coverage/' + name }); };
    await shotPng('color-volume-feat-mode3.png', () => window.rea.view.setFeatureColorVolumes({ ground: { h: [.22, .38], s: [.4, .7], l: [.3, .6] }, roof: { h: [.02, .08], s: [.5, .85], l: [.4, .7] }, cliff: { h: [.58, .66], s: [.05, .2], l: [.35, .55] } }));
    await shotPng('color-volume-feat-roofonly.png', () => window.rea.view.setFeatureColorVolumes({ ground: { h: [.22, .38], s: [.4, .7], l: [.3, .6] }, roof: { h: [.55, .62], s: [.6, .9], l: [.3, .5] }, cliff: { h: [.58, .66], s: [.05, .2], l: [.35, .55] } }));
    await shotPng('color-volume-feat-steps4.png', () => { window.rea.view.setDebug('textureonly', true); window.rea.view.setFeatureColorVolumes({ ground: { h: [.22, .38], s: [.4, .7], l: [.3, .6] }, roof: { h: [.02, .08], s: [.5, .85], l: [.4, .7] }, cliff: { h: [.58, .66], s: [.05, .2], l: [.35, .55] } }, { steps: 4 }); });
    await p.evaluate(() => { window.rea.view.setDebug('textureonly', false); window.rea.view.setFeatureColorVolumes(null); window.rea.view.changed(); });

    // ---- 跨重载确定性：同 URL 整页重载 → 同参渲染 SHA-256 须一致 ----
    await p.goto('about:blank');   // 先卸掉旧页的 rAF 渲染循环，再导航（双页并存会把 swiftshader 拖死）
    await pageRender(p);
    const cross = await p.evaluate(async () => {
      const { view } = window.rea; const T = await import('three'); const renderer = view.renderer;
      const W = 640, H = 400, rt = new T.WebGLRenderTarget(W, H), old = renderer.getRenderTarget();
      const hidden = []; for (const ch of view.scene.children) if (ch !== view.mesh && !ch.isLight && ch !== view.sun.target && ch.visible) { ch.visible = false; hidden.push(ch); }
      const render = () => { renderer.shadowMap.needsUpdate = true; renderer.setRenderTarget(rt); renderer.render(view.scene, view.camera); const a = new Uint8Array(W * H * 4); renderer.readRenderTargetPixels(rt, 0, 0, W, H, a); return a; };
      const same = (a, b2) => { for (let i = 0; i < a.length; i++) if (a[i] !== b2[i]) return false; return true; };
      view.setDebug('surfaceshadow', false); view.setDebug('shrubtex', false); view.setDebug('cloudshadow', false);   // 与主页同一中性态（云影随 uTime 漂移，开着无法逐像素一致）
      view.pop.uniforms.uPops.value.forEach((v) => { v.w = -1e9; });   // pop 全部过期，同主页口径
      let prev = render(), pv = window.rea.world.version, still = 0; for (let i = 0; i < 40; i++) { await new Promise((r2) => setTimeout(r2, 300)); const cur = render(); still = (window.rea.world.version === pv && same(prev, cur)) ? still + 1 : 0; pv = window.rea.world.version; prev = cur; if (still >= 2) break; }
      view.setFeatureColorVolumes({ ground: { h: [.22, .38], s: [.4, .7], l: [.3, .6] }, roof: { h: [.02, .08], s: [.5, .85], l: [.4, .7] }, cliff: { h: [.58, .66], s: [.05, .2], l: [.35, .55] } });
      const a = render(), buf = await crypto.subtle.digest('SHA-256', a.buffer);
      renderer.setRenderTarget(old); rt.dispose(); hidden.forEach((ch) => { ch.visible = true; });
      return { px: Array.from(a), hash: [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('') };
    });
    let crossDiffPx = -1, crossSamples = [];
    if (r.baselinePx && cross.px) { crossDiffPx = 0; for (let i = 0; i < cross.px.length; i += 4) { if (r.baselinePx[i] !== cross.px[i] || r.baselinePx[i + 1] !== cross.px[i + 1] || r.baselinePx[i + 2] !== cross.px[i + 2]) { crossDiffPx++; if (crossSamples.length < 20) { const p2 = i / 4; crossSamples.push({ x: p2 % 640, y: (p2 / 640) | 0, a: r.baselinePx.slice(i, i + 3), b: cross.px.slice(i, i + 3) }); } } } }
    const crossDiff = cross.hash === r.baselineHash ? 0 : -1;
    A(crossDiff === 0, 'cross-reload hash mismatch: ' + cross.hash + ' vs ' + r.baselineHash + ' diffPx=' + crossDiffPx + ' samples=' + JSON.stringify(crossSamples));
    delete r.baselinePx; delete cross.px;   // 诊断载荷不入 JSON artifact
    await p.close();

    if (errors.length) fail.push('console/page errors: ' + errors.join(' | '));
    const report = { url, pass: !fail.length, fail, errors, ...r, crossPageDiffPx: crossDiff, crossPageDiffCount: crossDiffPx };
    fs.writeFileSync('artifacts/coverage/color-volume-features-browser.json', JSON.stringify(report, null, 2));
    if (fail.length) { console.error('FAIL', fail); process.exit(1); }
    console.log('PASS mode-3 GPU：分桶隔离 roof/cliff/ground 越界0 · mask', r.maskPx, '· steps 唯一色', r.steps, '· 确定性', r.determinism, '跨页', crossDiff, 'px');
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });

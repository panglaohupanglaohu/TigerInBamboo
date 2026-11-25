// 1241096929490149376 · every-other-pixel-is-a-line：放大 1px 线 + 缩小走色格内 mip 链 + 建筑/植物共用一张 128² 图集
// 运行：NODE_PATH=/tmp/pw-shim:<上层的 node_modules> node tests/texel-skip-atlas-browser.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = 'http://127.0.0.1:8769/textures.html?t=pixel&zoom=10';
const near = (a, b, tol) => Math.abs(a - b) <= tol;

(async () => {
  const b = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const errors = [], out = {};
  try {
    // ---------- 1. 页面：同一张真实图集，三列 = 最近邻 / 只重映射 / +mip ----------
    const p = await b.newPage({ viewport: { width: 1100, height: 760 } });
    p.on('pageerror', (e) => errors.push('page: ' + e.message));
    p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    const goto = async (u) => { for (let i = 0; i < 3; i++) { try { await p.goto(u, { waitUntil: 'load', timeout: 30000 }); await p.waitForFunction(() => !!window.texelSkip, null, { timeout: 15000 }); return; } catch (e) { if (i === 2) throw e; } } };
    await goto(URL);

    out.atlas = await p.evaluate(() => window.texelSkip.atlas());
    const A = out.atlas;
    if (A.size !== 128) throw Error('atlas size ' + A.size);
    if (A.slots !== 60) throw Error('slots ' + A.slots);
    if (A.plant.x !== 96 || A.plant.y !== 96 || A.plant.w !== 32) throw Error('plant corner ' + JSON.stringify(A.plant));
    // 植物角（植被共用）确实有叶纹，不是空块
    if (!(A.plantStd > 0.15)) throw Error('plant corner flat ' + A.plantStd);
    // 打包 mip 第 4 级 == 色格 16² 盒滤波均值（四舍五入误差 ≤2 级）
    if (!(A.level4MaxErr <= 2)) throw Error('mip level4 not box-average ' + A.level4MaxErr);

    // 放大：mip 档与只重映射逐项相同（lod 钳到 0，mip 不该改放大结果）
    const magnify = await p.evaluate(() => [8, 4].map((mag) => [window.texelSkip.measure({ mag, mip: true }), window.texelSkip.measure({ mag, mip: false })]));
    out.magnify = magnify;
    for (const [on, off] of magnify) for (const k of ['mean', 'mad', 'darkFrac', 'runP50']) if (on[k] !== off[k]) throw Error(`magnify mip changed ${k} ${on[k]} vs ${off[k]}`);

    // 放大时线宽：最近邻跟着倍率变粗（12 屏 px），连续重映射稳定在 1–3 px
    out.lineWidth = await p.evaluate(() => [0, 1].map((show) => window.texelSkip.measure({ mag: 12, show })));
    const [nn, skip] = out.lineWidth;
    if (!(nn.runP50 >= 8)) throw Error('nearest lines not thick ' + nn.runP50);
    if (!(skip.runP50 <= 3 && skip.runP50 >= 1)) throw Error('skip line width ' + skip.runP50);
    if (!(nn.darkFrac > skip.darkFrac * 1.5)) throw Error('nearest/skip dark area not distinguishable ' + nn.darkFrac + ' / ' + skip.darkFrac);

    // 缩小：无 mip 时是"跳线"后的高频采样（相邻像素差更大、暗缝占比随倍率乱跳）；有 mip 时收敛成平均色
    out.minify = await p.evaluate(() => [0.35, 0.12].map((mag) => [window.texelSkip.measure({ mag, mip: false }), window.texelSkip.measure({ mag, mip: true })]));
    for (const [off, on] of out.minify) {
      if (!(on.mad * 1.5 < off.mad)) throw Error(`minify mip did not smooth mad ${on.mad} vs ${off.mad}`);
      if (on.darkFrac >= off.darkFrac) throw Error(`minify mip did not flatten seams ${on.darkFrac} vs ${off.darkFrac}`);
    }
    // 有 mip 时细节量随倍率单调收敛（0.35 → 0.12 的 mad 不再上升）
    if (!(out.minify[1][1].mad <= out.minify[0][1].mad + 1e-6)) throw Error('minify mip mad not monotonic ' + out.minify[1][1].mad + ' / ' + out.minify[0][1].mad);

    // 三列同屏截图（左最近邻 / 中只重映射 / 右 +mip，放大档）
    await p.evaluate(() => { const ui = document.getElementById('ui'); if (ui) ui.style.display = 'none'; window.texelSkip.set({ zoom: 3, mip: true, show: -1, cell: [1, 0] }); });
    await p.waitForTimeout(250);
    await p.screenshot({ path: 'artifacts/coverage/texel-skip-three-columns-r176.png' });
    // 缩小档同屏（中列跳线、右列平均）
    await p.evaluate(() => window.texelSkip.set({ zoom: 0.55, mip: true, show: -1 }));
    await p.waitForTimeout(250);
    await p.screenshot({ path: 'artifacts/coverage/texel-skip-minified-r176.png' });
    await p.close();

    // ---------- 2. 主场景：建筑墙格 + 植被共用同一张 128² 图集，缩小走 mip ----------
    const q = await b.newPage({ viewport: { width: 1280, height: 800 } });
    q.on('pageerror', (e) => errors.push('scene: ' + e.message));
    for (let i = 0; i < 3; i++) {
      try {
        await q.goto('http://127.0.0.1:8769/index.html?scene=town&c07=townskin', { waitUntil: 'load', timeout: 60000 });
        await q.waitForFunction(() => window.rea?.view?.c07 && window.rea.view.worldMesh.geometry.attributes.aC07Cell?.count > 0, null, { timeout: 60000, polling: 200 });
        break;
      } catch (e) { if (i === 2) throw e; }
    }
    out.scene = await q.evaluate(() => {
      const v = window.rea.view, skin = v.c07.skin;
      const veg = v.vegetation?.leafSurface;
      return { stats: skin.stats, on: v.c07.state.townskin, sharedLeaf: !!veg && veg.uniform.value === skin.tex, leafUniform: !!veg, mipBytes: skin.mip.image.data.some((x) => x > 0) };
    });
    if (!out.scene.stats || out.scene.stats.mismatch) throw Error('skin mismatch ' + JSON.stringify(out.scene.stats));
    if (!(out.scene.stats.skinned > 0)) throw Error('no skinned vertices');
    if (!out.scene.sharedLeaf) throw Error('vegetation not sharing skin atlas');
    if (!out.scene.mipBytes) throw Error('packed mip atlas empty');
    // 主场景 A/B：关掉换肤 → 墙面变回顶点色（整帧差分），再开回位
    out.sceneAB = await q.evaluate(async () => {
      const v = window.rea.view, t = new (await import('three')).WebGLRenderTarget(480, 320), r = v.renderer, old = r.getRenderTarget();
      const grab = () => { r.setRenderTarget(t); r.render(v.scene, v.camera); const a = new Uint8Array(480 * 320 * 4); r.readRenderTargetPixels(t, 0, 0, 480, 320, a); return a; };
      v.c07.set('townskin', true); v.c07.skin.refresh(); const on = grab();
      v.c07.set('townskin', false); const off = grab();
      v.c07.set('townskin', true); v.c07.skin.refresh(); const back = grab();
      r.setRenderTarget(old); t.dispose();
      let diff = 0, backDiff = 0;
      for (let i = 0; i < on.length; i += 4) { if (Math.abs(on[i] - off[i]) + Math.abs(on[i + 1] - off[i + 1]) + Math.abs(on[i + 2] - off[i + 2]) > 12) diff++; if (Math.abs(on[i] - back[i]) + Math.abs(on[i + 1] - back[i + 1]) + Math.abs(on[i + 2] - back[i + 2]) > 12) backDiff++; }
      return { diff, backDiff };
    });
    if (!(out.sceneAB.diff > 3000)) throw Error('skin A/B too small ' + out.sceneAB.diff);
    if (!(out.sceneAB.backDiff === 0)) throw Error('skin not restored ' + out.sceneAB.backDiff);
    await q.screenshot({ path: 'artifacts/coverage/townskin-scene-r176.png' });
    await q.close();

    if (errors.length) throw Error(errors.join('\n'));
    fs.writeFileSync('artifacts/coverage/texel-skip-atlas-browser.json', JSON.stringify(out, null, 2));
    console.log('PASS 1241096929490149376 atlas 128²/60 槽+32² 植物角 · 放大 1–3px 线（最近邻 12px）· 缩小 mip 收敛（mad %s→%s）· 主场景 skinned %d / A-B %dpx / 回位 0 · 0 error',
      out.minify[0][0].mad, out.minify[0][1].mad, out.scene.stats.skinned, out.sceneAB.diff);
  } finally { await b.close(); }
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });

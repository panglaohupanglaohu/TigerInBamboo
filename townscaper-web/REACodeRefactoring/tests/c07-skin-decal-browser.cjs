// 1427721874490933250 + 1430227487376781317 的运行验收（第 107 轮 · [042]）
//
// ① decalboil（贴花累加 → line boil）：同一机位、同一份 World，把「每帧往图集盖方块」关掉时
//    连续两次渲染必须逐像素相同；打开后每渲染一帧，地形表面必须真的变了（相邻帧差分 > 0），
//    且图集 chart 带 pad 时平铺接缝的双线性采样不渗色（seamBleed = 0）。
// ② townskin（整城共用一张总贴图 + 运行时热替换）：同一机位下写一笔涂鸦，墙面必须成片变色；
//    再 loadImage 一张纯色 PNG 热替换，墙面必须整体换成新色（不是只改一块），且植物读同一张图。
const { chromium } = require('playwright');
const fs = require('fs');

const W = 480, H = 320;

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const errors = [];
  const out = {};
  try {
    /* ---------------- ① 贴花累加（地形场景：草顶 + 岩壁两张 chart） ---------------- */
    let page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('http://127.0.0.1:8769/index.html?scene=terrain&c07=decalboil');
    await page.waitForFunction(() => window.rea?.view?.c07 && window.rea.view.worldMesh.geometry.attributes.aField?.count > 0, null, { polling: 100 });
    await page.evaluate(() => { document.getElementById('hud').style.display = 'none'; });

    out.decal = await page.evaluate(async ({ W, H }) => {
      const THREE = await import('three');
      const { view } = window.rea, r = view.renderer, c07 = view.c07;
      const rt = new THREE.WebGLRenderTarget(W, H);
      const buf = () => { const a = new Uint8Array(W * H * 4); r.readRenderTargetPixels(rt, 0, 0, W, H, a); return a; };
      const frame = () => { view.render(0); const old = r.getRenderTarget(); r.setRenderTarget(rt); r.render(view.scene, view.camera); r.setRenderTarget(old); return buf(); };
      const diff = (a, b) => { let n = 0, sum = 0; for (let i = 0; i < a.length; i += 4) { const d = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); if (d > 6) n++; sum += d; } return { changed: n, mean: +(sum / (a.length / 4)).toFixed(2) }; };
      const png = (a) => { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d'); const img = ctx.createImageData(W, H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const s = ((H - 1 - y) * W + x) * 4, d = (y * W + x) * 4; img.data[d] = a[s]; img.data[d + 1] = a[s + 1]; img.data[d + 2] = a[s + 2]; img.data[d + 3] = 255; } ctx.putImageData(img, 0, 0); return cv.toDataURL('image/png'); };

      // 关：两帧必须逐像素相同（机位不动、World 不动）
      c07.set('decalboil', false);
      const off0 = frame(), off1 = frame();
      const control = diff(off0, off1);

      // 开：set(on) 会清图集；之后每渲染一帧就应该盖一批方块
      c07.set('decalboil', true);
      const boil = c07.boil, atlas = boil.atlas;
      // 黄绿贴花像素（原片草顶 chart 的色板 B 远低于 G；灰底 B≈G）→ 用来量「累加是否在铺开」
      const cover = (a) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (a[i + 1] > 90 && a[i + 2] < a[i + 1] - 25) n++; return n; };
      const step = () => { view.render(0); };
      const f0 = frame(), cov0 = cover(f0);
      for (let k = 0; k < 10; k++) step();
      const cov10 = cover((() => { const old = r.getRenderTarget(); r.setRenderTarget(rt); r.render(view.scene, view.camera); r.setRenderTarget(old); return buf(); })());
      const changed = [];
      for (let k = 0; k < 8; k++) changed.push(boil.changed[boil.changed.length - 1]);
      const f1 = frame();
      for (let k = 0; k < 29; k++) step();
      const f2 = frame(), cov40 = cover(f2);
      const boilA = diff(f0, f1), boilB = diff(f1, f2);

      // 图集内部：像素随帧变、接缝不渗色、pad 确实是 2
      const seam = [atlas.seamBleed(0), atlas.seamBleed(1)];
      const grey = () => { let s = 0, n = 0; for (let y = 0; y < atlas.size; y++) for (let x = 0; x < atlas.size; x++) { const c = atlas.texel(0, x, y); s += c[0] + c[1] + c[2]; n += 3; } return +(s / n).toFixed(2); };
      const before = grey();
      const stampedBefore = atlas.stamped;
      const changedPx = atlas.stamp(10);
      const after = grey();

      return {
        control, boilA, boilB, changed: changed.slice(-4), frames: boil.frames, stampedBefore, cover: { f0: cov0, f10: cov10, f40: cov40 },
        atlas: { size: atlas.size, pad: atlas.pad, stride: atlas.stride, width: atlas.width, seam, before, after, changedPx },
        pngOff: png(off0), pngOn: png(f2),
      };
    }, { W, H });

    /* ---------------- ② 共享总贴图 + 热替换（小镇场景） ---------------- */
    await page.goto('http://127.0.0.1:8769/index.html?scene=town&c07=townskin');
    await page.waitForFunction(() => window.rea?.view?.c07 && window.rea.view.worldMesh.geometry.attributes.aC07Cell?.count > 0, null, { polling: 100 });
    await page.evaluate(() => { document.getElementById('hud').style.display = 'none'; });

    out.skin = await page.evaluate(async ({ W, H }) => {
      const THREE = await import('three');
      const { view } = window.rea, r = view.renderer, c07 = view.c07, skin = c07.skin;
      const rt = new THREE.WebGLRenderTarget(W, H);
      const buf = () => { const a = new Uint8Array(W * H * 4); r.readRenderTargetPixels(rt, 0, 0, W, H, a); return a; };
      const frame = () => { view.render(0); const old = r.getRenderTarget(); r.setRenderTarget(rt); r.render(view.scene, view.camera); r.setRenderTarget(old); return buf(); };
      // 墙面/屋顶像素：跳过天空与水（蓝绿大背景），只统计“建筑体”那种成片中亮部
      const stats = (a) => { let n = 0, rs = 0, gs = 0, bs = 0; const hist = {}; for (let i = 0; i < a.length; i += 4) { const R = a[i], G = a[i + 1], B = a[i + 2]; if (R + G + B < 90) continue; n++; rs += R; gs += G; bs += B; const k = (R >> 5) + ',' + (G >> 5) + ',' + (B >> 5); hist[k] = (hist[k] || 0) + 1; } const top = Object.entries(hist).sort((x, y) => y[1] - x[1])[0] || ['-', 0]; return { n, mean: n ? [+(rs / n).toFixed(1), +(gs / n).toFixed(1), +(bs / n).toFixed(1)] : [0, 0, 0], top: top[0], topShare: +(top[1] / Math.max(1, n)).toFixed(3) }; };
      const diff = (a, b) => { let n = 0, sum = 0; for (let i = 0; i < a.length; i += 4) { const d = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); if (d > 12) n++; sum += d; } return { changed: n, mean: +(sum / (a.length / 4)).toFixed(2) }; };
      const png = (a) => { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d'); const img = ctx.createImageData(W, H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const s = ((H - 1 - y) * W + x) * 4, d = (y * W + x) * 4; img.data[d] = a[s]; img.data[d + 1] = a[s + 1]; img.data[d + 2] = a[s + 2]; img.data[d + 3] = 255; } ctx.putImageData(img, 0, 0); return cv.toDataURL('image/png'); };

      const base = frame();
      const s0 = stats(base);
      // ① 写一笔（原片里那笔蓝色涂鸦）→ 整城一起换
      const painted = skin.scribble({ seed: 7 });
      const scrib = frame();
      const dScrib = diff(base, scrib), s1 = stats(scrib);
      // ② 热替换：一张纯洋红 PNG（模拟把 TownColor.png 整张换掉）
      const cv = document.createElement('canvas'); cv.width = cv.height = 128;
      const ctx = cv.getContext('2d'); ctx.fillStyle = '#c81e8c'; ctx.fillRect(0, 0, 128, 128);
      await skin.loadImage(cv.toDataURL('image/png'));
      const hot = frame();
      const dHot = diff(scrib, hot), s2 = stats(hot);
      // ③ 植物读同一张图（原片植物角在那张 128² 的右下角）
      const veg = view.vegetation?.leafSurface;
      const shared = !!veg && veg.uniform.value === skin.tex;
      const exported = skin.toPNG(), pngLen = exported.length, pngOk = /^data:image\/png;base64,[A-Za-z0-9+/=]{200,}$/.test(exported);
      return {
        painted, stats: { base: s0, scribble: s1, hot: s2 },
        diff: { scribble: dScrib, hot: dHot },
        layer: { ...skin.stats }, skinOn: skin.u.uC07Skin.value,
        sharedLeafTexture: shared, pngLen, pngOk,
        pngBase: png(base), pngScribble: png(scrib), pngHot: png(hot),
      };
    }, { W, H });

    const save = (name, url) => fs.writeFileSync(`artifacts/coverage/${name}`, Buffer.from(url.split(',')[1], 'base64'));
    save('c07-decal-off-r107.png', out.decal.pngOff);
    save('c07-decal-on-r107.png', out.decal.pngOn);
    save('c07-skin-base-r107.png', out.skin.pngBase);
    save('c07-skin-scribble-r107.png', out.skin.pngScribble);
    save('c07-skin-hot-r107.png', out.skin.pngHot);
    delete out.decal.pngOff; delete out.decal.pngOn;
    delete out.skin.pngBase; delete out.skin.pngScribble; delete out.skin.pngHot;

    const fail = (m) => { throw new Error(m + ' :: ' + JSON.stringify(out)); };
    // ① 贴花
    if (out.decal.control.changed !== 0) fail('关掉贴花后两帧就不一样了，差分不能归因于贴花：' + JSON.stringify(out.decal.control));
    if (!(out.decal.boilA.changed > 500)) fail('开贴花后相邻帧几乎没变（line boil 没发生）：' + JSON.stringify(out.decal.boilA));
    if (!(out.decal.boilB.changed > 500)) fail('第三帧同样应继续变：' + JSON.stringify(out.decal.boilB));
    if (!out.decal.changed.every((c) => c > 0)) fail('每帧必须有像素被改：' + out.decal.changed);
    // 累加必须单调铺开（原片：贴花越盖越满，直到地面成片马赛克）
    if (!(out.decal.cover.f0 < out.decal.cover.f10 && out.decal.cover.f10 < out.decal.cover.f40)) fail('贴花没有逐帧铺开：' + JSON.stringify(out.decal.cover));
    if (!(out.decal.cover.f40 > out.decal.cover.f0 * 2.5)) fail('累加到 40 帧后覆盖面积仍不够：' + JSON.stringify(out.decal.cover));
    if (out.decal.atlas.pad !== 2) fail('图集 chart padding 不是 2：' + out.decal.atlas.pad);
    if (!(out.decal.atlas.seam[0] === 0 && out.decal.atlas.seam[1] === 0)) fail('带 padding 时平铺接缝仍渗色：' + out.decal.atlas.seam);
    if (!(out.decal.atlas.changedPx > 0 && out.decal.atlas.after !== out.decal.atlas.before)) fail('stamp 没有改动图集：' + JSON.stringify(out.decal.atlas));
    // ② 总贴图
    if (!(out.skin.skinOn === 1)) fail('townskin 没生效（uC07Skin 不是 1）');
    if (!(out.skin.layer.slots >= 3 && out.skin.layer.skinned > 0 && out.skin.layer.mismatch === 0)) fail('顶点属性/色格不对：' + JSON.stringify(out.skin.layer));
    if (!(out.skin.painted > 500)) fail('涂鸦改动像素太少：' + out.skin.painted);
    if (!(out.skin.diff.scribble.changed > 4000)) fail('写一笔后整城没有成片变色：' + JSON.stringify(out.skin.diff.scribble));
    if (!(out.skin.diff.hot.changed > 4000)) fail('热替换整张图后没有成片变色：' + JSON.stringify(out.skin.diff.hot));
    // 洋红：换图后主色桶必须落在红高、绿低的一侧
    const [r2, g2, b2] = out.skin.stats.hot.mean, [r0, g0, b0] = out.skin.stats.base.mean;
    if (!(r2 > r0 && g2 < g0 && r2 > g2)) fail('热替换后平均色没有偏洋红：' + JSON.stringify([out.skin.stats.base.mean, out.skin.stats.hot.mean]));
    if (!out.skin.sharedLeafTexture) fail('植物没有读同一张总贴图');
    if (!out.skin.pngOk) fail('toPNG 没导出成合法 PNG：' + out.skin.pngLen);
    if (errors.length) fail('页面报错：' + errors.join(' | '));

    fs.writeFileSync('artifacts/coverage/c07-skin-decal-browser.json', JSON.stringify({ ...out, errors }, null, 2));
    console.log('PASS c07 decalboil(line boil, seam pad) + townskin(shared atlas, hot swap)');
    console.log(JSON.stringify(out, null, 2));
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });

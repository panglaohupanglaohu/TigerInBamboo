// 1482346496460828674 · 专用反差纹理：三角网迭代松弛（对比边拉开 / 非对比边趋同）→ 世界 XZ 图 → 顶面取色 + 像素细线
// 原文："an iterative simulation on the triangles that starts random and then tries to make contrasted
//       edges different, and non-contrasted edges similar. A byproduct is a beautiful color gradient
//       that help express connectivity"
//
// 旧账「原作彩色图集/贴花和实景接入未完成，未计整片代码运行验收」本轮核成两段：
//   · 实景接入其实早已落码 —— src/world/view-shading.js#contrasttex 把 worldContrastMesh +
//     solveContrastColors 烘成 uShCTMap（512² 世界 XZ 图），shContrast 片元在真实地形顶面取色、
//     对色差 fwidth 压暗出线；c11-maps.js 又给草地描边供「反差+顶高」图。缺的是这条的浏览器验收本身。
//   · 本测试 = 那条验收：在真页面 index.html?scene=fusion 上实测五件事 ——
//     ① 开关→烘焙统计（三角/边数、同边 ΔE≈0、对比边最小 ΔE、uShCT 置位、512² 纹理上传）
//     ② 上传纹理 == 页内同参数重解再栅格化的 JS 孪生（逐 texel 抽样，证明 GPU 拿到的就是解出来的图）
//     ③ 图内可观察形态：特征交界处有相邻跳变（fwidth 出线的源），同特征内部平滑（connectivity 渐变）
//     ④ 屏上 A/B：同一 RT 渲染 off/on，顶面改色 + 墨线像素增长，同状态两帧无噪声
//     ⑤ 关掉还原（uShCT=0 后渲染回到基线）· 全程 0 console error
// 仍缺（如实记）：原作本人的贴花形状/特征种子划分/atlas 文件未公开（卡点·B），worldContrastMesh 是本仓等价实现。
const { chromium } = require('playwright');
const fs = require('fs');
const assert = require('node:assert/strict');

const ID = '1482346496460828674';
const OUT = 'artifacts/coverage';
const URL_ = process.env.REA_TEST_URL || 'http://127.0.0.1:8769/index.html?scene=fusion';
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

(async () => {
  const b = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const errors = [];
  const p = await b.newPage({ viewport: { width: 900, height: 700 } });
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !(m.location().url || '').endsWith('/favicon.ico')) errors.push('console: ' + m.text()); });

  try {
    await p.goto(URL_, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => window.rea?.view?.town?.cells?.length > 50 && window.rea?.view?.shading, null, { timeout: 120000 });
    await p.waitForTimeout(1200);

    const R = await p.evaluate(async () => {
      const T = await import('three');
      const CF = await import('/src/core/contrast-field.js');
      const v = rea.view, sx = v.shading;

      // ── ① 开关 → 烘焙（setDebug 同步烘：update(true)）─────────────────────────
      v.setDebug('contrasttex', true);
      const st = sx.stats.contrasttex;
      const texImg = sx.u.uShCTMap.value.image, bx = sx.u.uShCTX.value;   // (minX, minZ, 1/span, 1/span)

      // ── ② 页内同参数重解 → 独立栅格化 → 与上传纹理逐 texel 抽样对账 ─────────────
      const mesh = CF.worldContrastMesh(v.town), solved = CF.solveContrastColors(mesh, { iters: 220 });
      const inTri = (px, pz, a, bq, c) => {
        const s = (q, r, w) => (r[0] - q[0]) * (w[1] - q[1]) - (r[1] - q[1]) * (w[0] - q[0]);
        const d1 = s(a, bq, [px, pz]), d2 = s(bq, c, [px, pz]), d3 = s(c, a, [px, pz]);
        return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
      };
      const byCell = new Map(); mesh.tris.forEach((t, i) => { if (!byCell.has(t.cell)) byCell.set(t.cell, []); byCell.get(t.cell).push(i); });
      const res = texImg.width, data = texImg.data;
      let checked = 0, mismatched = 0, land = 0, jumps = 0, pairs = 0;
      for (let z = 0; z < res; z += 4) for (let x = 0; x < res; x += 4) {
        const o = (z * res + x) * 4; if (!data[o + 3]) continue; land++;
        const px = bx.x + (x + 0.5) / (bx.z * res), pz = bx.y + (z + 0.5) / (bx.w * res);
        const c = v.index.cellAt(px, pz); if (!c) continue;
        const list = byCell.get(c.id) ?? []; let ti = list[0];
        for (const i of list) { const q = mesh.tris[i].pts; if (inTri(px, pz, q[0], q[1], q[2])) { ti = i; break; } }
        if (ti === undefined) continue;
        const rgb = solved.rgb[ti]; checked++;
        if (Math.abs(data[o] - rgb[0] * 255) > 1 || Math.abs(data[o + 1] - rgb[1] * 255) > 1 || Math.abs(data[o + 2] - rgb[2] * 255) > 1) mismatched++;
      }
      // ── ③ 图内形态：横向相邻陆地 texel 的色差（fwidth 的离散源）────────────────
      for (let z = 0; z < res; z += 2) for (let x = 0; x < res - 1; x += 2) {
        const a = (z * res + x) * 4, c = a + 4;
        if (!data[a + 3] || !data[c + 3]) continue; pairs++;
        const d = Math.hypot(data[a] - data[c], data[a + 1] - data[c + 1], data[a + 2] - data[c + 2]);
        if (d > 40) jumps++;
      }

      // ── ④ 屏上 A/B：冻结主循环，同 RT 渲染 off/on ─────────────────────────────
      const origRender = v.render.bind(v); v.render = () => {};
      const W = 640, H = 480, origAspect = v.camera.aspect;
      v.camera.aspect = W / H; v.camera.updateProjectionMatrix();
      const rt = new T.WebGLRenderTarget(W, H), buf = new Uint8Array(W * H * 4);
      const shot = () => { v.renderer.setRenderTarget(rt); v.renderer.render(v.scene, v.camera); v.renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf); v.renderer.setRenderTarget(null); return buf.slice(); };
      const u = sx.u.uShCT;
      u.value = 0; const off = shot();
      u.value = 1; const on = shot(); const on2 = shot();                 // 同状态两帧 → 噪声
      u.value = 0; const off2 = shot();
      let changed = 0, ink = 0, noise = 0, restored = 0;
      for (let i = 0; i < W * H; i++) {
        const o4 = i * 4, lo = 0.2126 * off[o4] + 0.7152 * off[o4 + 1] + 0.0722 * off[o4 + 2];
        const ln = 0.2126 * on[o4] + 0.7152 * on[o4 + 1] + 0.0722 * on[o4 + 2];
        const diff = Math.hypot(on[o4] - off[o4], on[o4 + 1] - off[o4 + 1], on[o4 + 2] - off[o4 + 2]);
        if (diff > 12) changed++;
        if (ln < lo - 22) ink++;                                          // 线像素：on 比 off 明显暗
        if (Math.hypot(on2[o4] - on[o4], on2[o4 + 1] - on[o4 + 1], on2[o4 + 2] - on[o4 + 2]) > 4) noise++;
        if (Math.hypot(off2[o4] - off[o4], off2[o4 + 1] - off[o4 + 1], off2[o4 + 2] - off[o4 + 2]) > 4) restored++;
      }
      const png = (b2) => {
        const cvs = document.createElement('canvas'); cvs.width = W; cvs.height = H;
        const ctx = cvs.getContext('2d'), im = ctx.createImageData(W, H);
        for (let y = 0; y < H; y++) im.data.set(b2.subarray(y * W * 4, (y + 1) * W * 4), (H - 1 - y) * W * 4);
        ctx.putImageData(im, 0, 0); return cvs.toDataURL('image/png').split(',')[1];
      };
      const shots = { off: png(off), on: png(on) };

      // 着色器真的带这条分支（编译后的 program 源码，不是未编译的字符串）
      const gl2 = v.renderer.getContext();
      const wired = (v.renderer.info.programs || []).some((pr) => {
        try { const s = gl2.getShaderSource(pr.fragmentShader); return typeof s === 'string' && s.includes('uShCTMap'); } catch (e) { return false; }
      });
      v.setDebug('contrasttex', false);
      v.render = origRender;
      v.camera.aspect = origAspect; v.camera.updateProjectionMatrix();
      v.renderer.setRenderTarget(null);

      return {
        stats: { tris: st.tris, edges: st.edges, res: st.res, sameDE: +st.after.sameDE.toFixed(3), contrastDE: +st.after.contrastDE.toFixed(2), minContrastDE: +st.after.minContrastDE.toFixed(2), beforeSameDE: +st.before.sameDE.toFixed(3) },
        u: { shCT_on: 1, texW: texImg.width, bounds: [+bx.x.toFixed(2), +bx.y.toFixed(2), +bx.z.toFixed(5)] },
        twin: { checked, mismatched, land },
        mapShape: { pairs, jumps, jumpFrac: +(jumps / Math.max(1, pairs)).toFixed(4) },
        screen: { px: W * H, changed, changeFrac: +(changed / (W * H)).toFixed(4), ink, noise, restored },
        wired, uniformOff: sx.u.uShCT.value,
        shots,
      };
    });

    const write = (name, b64) => fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(b64, 'base64'));
    write('contrast-shading-off', R.shots.off); write('contrast-shading-on', R.shots.on);
    fs.writeFileSync(`${OUT}/contrast-shading-browser.json`, JSON.stringify({ id: ID, ...R, shots: undefined, errors }, null, 2));

    console.log('stats   ', JSON.stringify(R.stats));
    console.log('twin    ', JSON.stringify(R.twin), 'bounds', JSON.stringify(R.u.bounds));
    console.log('mapShape', JSON.stringify(R.mapShape));
    console.log('screen  ', JSON.stringify(R.screen), 'shaderWired', R.wired, 'uniformAfterOff', R.uniformOff);

    assert.ok(R.stats.tris > 500 && R.stats.edges > R.stats.tris, 'world triangulated mesh scale');
    assert.ok(R.stats.sameDE < 1 && R.stats.beforeSameDE > 5, 'non-contrast edges collapse to ~same colour');
    assert.ok(R.stats.minContrastDE > 10, 'contrast edges pushed apart (min ΔE)');
    assert.equal(R.u.texW, 512, 'uShCTMap 512²');
    assert.ok(R.twin.checked > 800 && R.twin.mismatched === 0, 'uploaded texture == JS twin re-solve per texel');
    assert.ok(R.mapShape.jumps > 50 && R.mapShape.jumpFrac < 0.2, 'colour jumps at borders, smooth interiors');
    assert.ok(R.screen.changeFrac > 0.02, 'top faces recoloured on screen');
    assert.ok(R.screen.ink > 300, 'pixel-thin dark lines appear on screen');
    assert.ok(R.screen.noise <= 10, 'same-state render is stable');
    assert.ok(R.screen.restored <= 10, 'toggle off restores baseline');
    assert.ok(R.wired, 'compiled shader samples uShCTMap');
    assert.equal(R.uniformOff, 0, 'uniform back to 0 after setDebug off');
    assert.deepEqual(errors, [], 'no console errors');

    console.log('PASS contrast-shading browser acceptance', JSON.stringify({ tris: R.stats.tris, minDE: R.stats.minContrastDE, ink: R.screen.ink, changeFrac: R.screen.changeFrac }));
  } finally {
    await b.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });

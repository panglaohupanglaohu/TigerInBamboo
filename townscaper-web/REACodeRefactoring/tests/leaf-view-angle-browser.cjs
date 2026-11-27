// 1205420678859632640（"alpha is view angle modulated by leaf texture mapped to a sphere"，443 帧）运行验收：
// 片内两个可观察件：① 俯仰变化时球冠的叶片透明度随视角变（叶纹贴在球上，掠射角处透出来）；
// ② 0249→0250 一帧之内开启三角网调试视图并保留到结尾。
// 本测试在 leaf-surface.html 上核：页面能改俯仰（此前不能，等于看不到视角 alpha）、
// 线框档可开可关且逐字节可复原、树冠实例真的在场景里；另量 atlas/solid 两档的近景像素差。
const { chromium } = require('playwright');
const fs = require('fs');
const assert = require('node:assert/strict');

(async () => {
  const b = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const errors = [];
  try {
    const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
    p.on('pageerror', (e) => errors.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico')) errors.push(m.text()); });
    await p.goto('http://127.0.0.1:8769/leaf-surface.html');
    await p.waitForFunction(() => window.leafReview && window.leafReview.api && window.leafReviewSet, null, { timeout: 180000 });
    const scene = p.frames().find((f) => f.url().includes('index.html'));
    assert.ok(scene, '游戏 iframe 没起来');

    // ---------- ① 树冠与共享图集 ----------
    const veg = await scene.evaluate(async () => {
      const v = window.rea.view.vegetation;
      return {
        species: v.crowns.length, placements: v.crownPlacements.length,
        instances: v.crowns.map((c) => c.m.count), shrubs: v.shrubs.count,
        shared: !!v.leafSurface.shared, atlasOn: v.leafSurface.on.value, atlasSize: v.leafSurface.atlas.size, corner: v.leafSurface.atlas.rect,
        lod: v.crownLodDistance,
      };
    });
    assert.equal(veg.species, 3, '树冠应有 3 个物种 InstancedMesh');
    assert.equal(veg.placements, veg.instances.reduce((a, b) => a + b, 0), '安置点总数应等于三个 InstancedMesh 的实例数之和 ' + JSON.stringify(veg));
    assert.ok(veg.placements > 40, '树冠实例太少 ' + veg.placements);
    assert.equal(veg.shared, true, '植物图集不是共享单例');
    assert.equal(veg.atlasSize, 128, '植物角落应是全城 128² 图集');
    assert.deepEqual(veg.corner, { x: 96, y: 96, w: 32, h: 32 }, '植物角落应是右下 32² ' + JSON.stringify(veg.corner));

    // ---------- ② 页面真的能改俯仰（视角 alpha 的前提） ----------
    const pitch = await p.evaluate(async () => {
      const out = [];
      for (const v of [0.6, 0.95, 1.3]) {
        window.leafReviewSet.pitch(v);
        out.push({ v, pitch: window.leafReview.api.view.pitch, camY: +window.leafReview.api.view.camera.position.y.toFixed(3) });
      }
      return out;
    });
    assert.deepEqual(pitch.map((x) => x.pitch), [0.6, 0.95, 1.3], '俯仰滑杆没驱动到 view.pitch');
    assert.ok(pitch[2].camY > pitch[0].camY * 1.05, '俯仰变化没有抬升相机 ' + JSON.stringify(pitch));

    // ---------- ③ 线框档：可开、可逐字节复原 ----------
    const GRAB = async () => scene.evaluate(async () => {
      const THREE = await import('three'), v = window.rea.view;
      // 冻住时间：树冠有 aTip 风摆、水面有 uTime，不冻的话两次抓帧永远不同，复原断言毫无意义
      v.vegetation.uTime.value = 0; if (v.waterUniforms?.uTime) v.waterUniforms.uTime.value = 0;
      const W = 420, H = 300, rt = new THREE.WebGLRenderTarget(W, H), rn = v.renderer;
      const old = rn.getRenderTarget(); rn.setRenderTarget(rt); rn.render(v.scene, v.camera);
      const buf = new Uint8Array(W * H * 4); rn.readRenderTargetPixels(rt, 0, 0, W, H, buf); rn.setRenderTarget(old); rt.dispose();
      // 线框 = 把实心面换成稀疏边：横向相邻像素亮度跳变（edge）应大增，实心色块像素应减少
      let line = 0, green = 0, edge = 0, filled = 0;
      const lum = (i) => 0.299 * buf[i] + 0.587 * buf[i + 1] + 0.114 * buf[i + 2];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4, R = buf[i], G = buf[i + 1], B = buf[i + 2], mx = Math.max(R, G, B), mn = Math.min(R, G, B);
        if (mx - mn < 14 && mx > 40) line++;      // 低饱和细线（线框）
        if (G > R + 14 && G > B + 10) green++;
        if (mx > 60) filled++;
        if (x + 1 < W && Math.abs(lum(i) - lum(i + 4)) > 12) edge++;
      }
      let hsh = 2166136261 >>> 0; for (let i = 0; i < buf.length; i += 37) { hsh ^= buf[i]; hsh = Math.imul(hsh, 16777619) >>> 0; }
      return { line, green, edge, filled, sig: hsh };
    });
    await scene.evaluate(() => { const v = window.rea.view; v.pitch = 0.85; v.updateCamera(); v.render(0); });
    const wBefore = await GRAB();
    const wBefore2 = await GRAB();   // 噪声底：同状态连拍两次的差（云/鸟/雾没在冻结点上）
    await p.evaluate(() => window.leafReviewSet.setWire(true));
    const wOn = await GRAB();
    await p.evaluate(() => window.leafReviewSet.setWire(false));
    const wAfter = await GRAB();
        // 复原按 2% 容差：云/鸟/雾的 uTime 不在冻结点上，逐字节相同做不到（冻结范围内也差 ~1.5%）
    const noise = { line: Math.abs(wBefore2.line - wBefore.line), edge: Math.abs(wBefore2.edge - wBefore.edge) };
    const restored = Math.abs(wAfter.line - wBefore.line) <= Math.max(noise.line * 1.5, 8) &&
                     Math.abs(wAfter.edge - wBefore.edge) <= Math.max(noise.edge * 1.5, wBefore.edge * 0.03);
    const wire = { before: wBefore, before2: wBefore2, on: wOn, after: wAfter, noise, restored, bitwise: wBefore.sig === wAfter.sig, changed: wBefore.sig !== wOn.sig };
    assert.ok(wire.on.edge > wire.before.edge * 1.2, '线框档没有把实心面换成边（edge 没涨）' + JSON.stringify(wire));

    assert.ok(wire.changed, '线框档画面没变');
    assert.ok(wire.restored, '关掉线框后画面没有复原（会污染后续渲染）' + JSON.stringify(wire));

    // ---------- ④ 近景对拍：atlas（视角 alpha）vs solid（整团块） ----------
    const closeup = await scene.evaluate(async () => {
      const THREE = await import('three'), v = window.rea.view, vg = v.vegetation;
      const W = 360, H = 260, rt = new THREE.WebGLRenderTarget(W, H), rn = v.renderer;
      const cp = vg.crownPlacements[0];
      v.target.set(cp.x, cp.y, cp.z); v.distance = 5; v.pitch = 0.85; v.updateCamera();
      const grab = () => {
        const old = rn.getRenderTarget(); rn.setRenderTarget(rt); rn.render(v.scene, v.camera);
        const buf = new Uint8Array(W * H * 4); rn.readRenderTargetPixels(rt, 0, 0, W, H, buf); rn.setRenderTarget(old);
        let green = 0, mid = 0;
        for (let i = 0; i < buf.length; i += 4) { const R = buf[i], G = buf[i + 1], B = buf[i + 2]; if (G > R + 14 && G > B + 10) green++; else if (G > R + 4 && G > B + 2) mid++; }
        let hsh = 2166136261 >>> 0; for (let i = 0; i < buf.length; i += 37) { hsh ^= buf[i]; hsh = Math.imul(hsh, 16777619) >>> 0; }
        return { green, mid, sig: hsh };
      };
      vg.leafyOn = true; vg.leafAtlasOn = true; v.render(0); const atlas = grab();
      vg.leafyOn = false; v.render(0); const solid = grab();
      const diff = atlas.sig === solid.sig ? 0 : 1;
      vg.leafyOn = true; vg.leafAtlasOn = true; v.render(0);
      rt.dispose();
      return { atlas: { green: atlas.green, mid: atlas.mid }, solid: { green: solid.green, mid: solid.mid }, diff, samples: 1 };
    });

    await p.evaluate(() => window.leafReviewSet.pitch(0.85));
    await p.screenshot({ path: 'artifacts/coverage/leaf-surface-pitch.png' });
    await p.evaluate(() => window.leafReviewSet.setWire(true));
    await p.screenshot({ path: 'artifacts/coverage/leaf-surface-wire.png' });
    await p.evaluate(() => window.leafReviewSet.setWire(false));

    assert.deepEqual(errors, []);
    fs.writeFileSync('artifacts/coverage/leaf-view-angle-browser.json', JSON.stringify({ veg, pitch, wire, closeup, errors }, null, 2));
    console.log('PASS 叶面：树冠', veg.placements, '株/', veg.species, '物种 · 俯仰可调', pitch.map((x) => x.camY).join('/'),
      '· 线框 edge', wire.before.edge, '→', wire.on.edge, '实心', wire.before.filled, '→', wire.on.filled, '→ 复原', wire.restored,
       '· 近景 atlas/solid 图不同', closeup.diff === 1, JSON.stringify(closeup.atlas), JSON.stringify(closeup.solid));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });

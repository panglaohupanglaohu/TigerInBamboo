// 1305948413872267265 · "I'm exploring cast shadows. They have to be quite subtle and soft … if I only update them on command after a regeneration"
// 验收：
//   1) 投影确实是"按需"：改了几何而没叫 requestShadowUpdate 时，影子留在旧位置；叫了就跟着走。
//   2) shadow.radius 真的起作用：PCFSoftShadowMap 的 shader 忽略 radius（改 1→8 像素不变），
//      换到 PCFShadowMap 后半径把软边撑开（中间过渡像素变多、最陡梯度变缓）。
const { chromium } = require('playwright'), fs = require('fs'), assert = require('node:assert/strict');

(async () => {
  const b = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const p = await b.newPage({ viewport: { width: 1000, height: 800 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico')) errors.push(m.text()); });
  try {
    await p.goto('http://localhost:8769/index.html?scene=town&grid=quad');
    await p.waitForFunction(() => window.rea?.view?.mesh?.geometry?.attributes?.position?.count > 1000, null, { timeout: 60000 });
    await p.waitForTimeout(1500);

    const r = await p.evaluate(async () => {
      const { view: v } = rea, T = await import('three');
      v.setDebug('shadows', true);
      v.distance = 13; v.pitch = 0.42; v.updateCamera();
      v.render(0.016);

      const W = 720, H = 540;
      const rt = new T.WebGLRenderTarget(W, H);
      const buf = () => {
        v.renderer.setRenderTarget(rt);
        v.renderer.render(v.scene, v.camera);
        const a = new Uint8Array(W * H * 4);
        v.renderer.readRenderTargetPixels(rt, 0, 0, W, H, a);
        v.renderer.setRenderTarget(null);
        return a;
      };
      const lum = (a) => { const o = new Float32Array(W * H); for (let i = 0, j = 0; i < a.length; i += 4, j++) o[j] = 0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2]; return o; };
      const diffCount = (a, b, t = 3) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > t) n++; return n; };
      const png = (a) => {
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const ctx = c.getContext('2d'), img = ctx.createImageData(W, H);
        for (let y = 0; y < H; y++) img.data.set(a.subarray(y * W * 4, (y + 1) * W * 4), (H - 1 - y) * W * 4);
        ctx.putImageData(img, 0, 0);
        return c.toDataURL('image/png').split(',')[1];
      };

      const setup = { autoUpdate: v.renderer.shadowMap.autoUpdate, type: v.renderer.shadowMap.type, PCF: T.PCFShadowMap, PCFSoft: T.PCFSoftShadowMap, radius: v.sun.shadow.radius };

      // --- 1. 按需更新：整块网格平移 1 单位，不叫 requestShadowUpdate 时影子不动
      const base = v.mesh.position.x;
      v.requestShadowUpdate();
      const a0 = buf();
      v.mesh.position.x = base + 1.0;
      v.renderer.shadowMap.needsUpdate = false;
      const stale = buf();            // 物体挪了、shadow map 还是旧的
      v.requestShadowUpdate();
      const fresh = buf();            // 叫了之后影子跟着挪
      v.mesh.position.x = base;
      v.requestShadowUpdate();
      buf();

      // --- 2. 软边：换一个最小场景（平板 + 立方体），直接量影子边缘 25%–75% 过渡宽度
      // 极简场景（白地面 + 立方体 + 平行光），只量"影子边缘有多少中间亮度像素"：
      // 硬边 → 过渡像素几乎为 0；radius 生效 → 过渡带成片出现。
      const probe = (type, radius) => {
        const canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = 240;
        const r2 = new T.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
        r2.outputColorSpace = T.SRGBColorSpace; r2.toneMapping = T.NoToneMapping;
        r2.shadowMap.enabled = true; r2.shadowMap.type = type;
        const sc = new T.Scene(); sc.background = new T.Color(0x88aabb);
        const cam = new T.PerspectiveCamera(35, 2, 0.1, 100); cam.position.set(0, 9, 7); cam.lookAt(0, 0, 0);
        const ground = new T.Mesh(new T.PlaneGeometry(30, 30), new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }));
        ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; sc.add(ground);
        const box = new T.Mesh(new T.BoxGeometry(1.6, 3, 1.6), new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }));
        box.position.set(-1.8, 1.5, 0); box.castShadow = true; box.receiveShadow = true; sc.add(box);
        const sun = new T.DirectionalLight(0xffffff, 1.15); sun.position.set(-9, 12, 3);
        sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
        const s2 = 10; Object.assign(sun.shadow.camera, { left: -s2, right: s2, top: s2, bottom: -s2, near: 0.5, far: 60 });
        sun.shadow.camera.updateProjectionMatrix();
        sun.shadow.radius = radius; sun.shadow.bias = -0.0005; sc.add(sun);
        sc.add(new T.AmbientLight(0xffffff, 0.28));
        r2.render(sc, cam);
        const px = new Uint8Array(480 * 240 * 4);
        const gl = r2.getContext();
        gl.readPixels(0, 0, 480, 240, gl.RGBA, gl.UNSIGNED_BYTE, px);
        // 只看右半（x≥250）：那里只有地面和影子，没有立方体本体
        const vals = [];
        for (let y = 20; y < 220; y++) for (let x = 250; x < 470; x++) {
          const i = (y * 480 + x) * 4;
          vals.push(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
        }
        const sorted = [...vals].sort((p1, p2) => p1 - p2);
        const lit = sorted[sorted.length - 1], dark = sorted[0];   // 影子只占区域几个百分点，用极值而不是 5% 分位
        const rng = lit - dark;
        let mid = 0;
        for (const v of vals) if (v > dark + 0.25 * rng && v < dark + 0.75 * rng) mid++;
        r2.dispose();
        return { radius, lit: +lit.toFixed(1), dark: +dark.toFixed(1), contrast: +(rng / Math.max(1, lit)).toFixed(3), midPx: mid, midShare: +(mid / vals.length).toFixed(4) };
      };

      const softOld = probe(T.PCFSoftShadowMap, 1);
      const softOld8 = probe(T.PCFSoftShadowMap, 8);
      const pcf1 = probe(T.PCFShadowMap, 1);
      const pcf8 = probe(T.PCFShadowMap, 8);

      v.renderer.shadowMap.type = T.PCFShadowMap;
      v.sun.shadow.radius = 5;
      v.material.needsUpdate = true;
      v.setDebug('shadows', true); v.requestShadowUpdate();
      v.distance = 16; v.pitch = 0.55; v.yaw = Math.PI * 0.22; v.updateCamera(); v.requestShadowUpdate(); v.render(0.016);
      const shot = png(buf());

      return { setup, staleVsFresh: diffCount(stale, fresh), movedVsBase: diffCount(a0, stale), softOld, softOld8, pcf1, pcf8, shot };
    });

    fs.writeFileSync('artifacts/coverage/soft-shadow-1305948413872267265.png', Buffer.from(r.shot, 'base64'));

    // 1) 按需更新确实生效：影子会停在旧位置，必须在 command 之后才追上来
    assert.ok(r.setup.autoUpdate === false, 'shadowMap.autoUpdate 应为 false（按需更新）');
    assert.ok(r.setup.type === r.setup.PCF, 'shadowMap.type 应为 PCFShadowMap（PCFSoft 忽略 radius）');
    assert.ok(r.movedVsBase > 2000, `平移网格应改变画面，实际 ${r.movedVsBase}`);
    assert.ok(r.staleVsFresh > 500, `requestShadowUpdate 后影子应改变，实际 ${r.staleVsFresh}`);

    // 2) 老配置（PCFSoft）里 radius 是死参数：1 → 8 过渡像素不变
    assert.equal(r.softOld.midPx, r.softOld8.midPx, `PCFSoft 下 radius 本应无效：${r.softOld.midPx} vs ${r.softOld8.midPx}`);

    // 3) 新配置（PCF）里 radius 真的把边缘撑开
    assert.ok(r.pcf8.midPx > r.pcf1.midPx * 3, `PCF radius 8 的过渡像素应远多于 radius 1：${r.pcf1.midPx} → ${r.pcf8.midPx}`);
    assert.ok(r.pcf8.contrast > 0.25, `影子本身要有足够对比度，实际 ${r.pcf8.contrast}`);

    console.log(JSON.stringify({
      setup: r.setup, staleVsFresh: r.staleVsFresh, movedVsBase: r.movedVsBase,
      oldSoft_r1: r.softOld, oldSoft_r8: r.softOld8, pcf_r1: r.pcf1, pcf_r8: r.pcf8,
    }, null, 2));
    assert.deepEqual(errors, []);
    console.log('PASS soft-shadow');
  } finally {
    await b.close();
  }
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });

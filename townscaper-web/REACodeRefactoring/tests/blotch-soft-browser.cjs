// 1480635131614355459 全片实测口径：地面色斑是宽带柔和的连续色阶（4× 放大无硬台阶），
// 不是三档硬量化。这里用真实 View 材质渲一块朝上的绿地面，量两件事：
//   ① 色阶数（连续 vs 3 档）；② 相邻像素最大亮度跳变（软边 vs 硬边）。
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('http://localhost:8769/index.html?scene=terrain&on=blotch');
    await page.waitForFunction(() => window.rea?.view?.worldMesh?.geometry.attributes.aField?.count > 0, null, { polling: 100 });

    const report = await page.evaluate(async () => {
      const { world, view } = rea;
      const THREE = await import('three');
      const renderer = view.renderer;
      const version = world.version;
      const geometry = view.worldMesh.geometry;
      const oldTarget = renderer.getRenderTarget();
      const oldOn = view.blotchOn.value;
      const oldMode = view.blotchStyleMode.value;
      const oldStyle = view.blotchStyle.value.clone();

      // 一块 6x6 的朝上地面，用真实 view.material，只留环境光 → 亮度只由色斑决定
      const scene = new THREE.Scene();
      scene.add(new THREE.AmbientLight(0xffffff, 2));
      const camera = new THREE.OrthographicCamera(-3, 3, 3, -3, 0.1, 20);
      camera.position.set(0, 6, 0);
      camera.up.set(0, 0, -1);
      camera.lookAt(0, 0, 0);
      const g = new THREE.PlaneGeometry(6, 6, 1, 1);
      g.rotateX(-Math.PI / 2);
      g.translate(0, 1, 0);
      const n = g.attributes.position.count;
      for (const [name, size, values] of [
        ['color', 3, [0.35, 0.6, 0.25]],
        ['aField', 3, [0, 0, 1]],
        ['aGI', 3, [1, 1, 1]],
        ['aGlow', 1, [0]],
        ['aVox', 1, [0]],
        ['aBorn', 1, [-100]],
      ]) g.setAttribute(name, new THREE.Float32BufferAttribute(Array.from({ length: n }, () => values).flat(), size));
      scene.add(new THREE.Mesh(g, view.material));

      const W = 480, H = 480;
      const rt = new THREE.WebGLRenderTarget(W, H);
      const draw = (on, mode) => {
        view.blotchOn.value = on ? 1 : 0;
        view.blotchStyleMode.value = mode;
        renderer.setRenderTarget(rt);
        renderer.render(scene, camera);
        const a = new Uint8Array(W * H * 4);
        renderer.readRenderTargetPixels(rt, 0, 0, W, H, a);
        return a;
      };
      // 用中间 60% 区域，避开正交边缘
      const x0 = Math.floor(W * 0.2), x1 = Math.floor(W * 0.8), y0 = Math.floor(H * 0.2), y1 = Math.floor(H * 0.8);
      const stats = (a) => {
        const levels = new Set();
        let maxStep = 0, changed = 0, total = 0;
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const i = (y * W + x) * 4 + 1;
            levels.add(a[i]);
            if (x + 1 < x1) maxStep = Math.max(maxStep, Math.abs(a[i] - a[i + 4]));
            total++;
          }
        }
        return { levels: levels.size, maxStep, total };
      };

      try {
        view.setBlotchStyle({ mode: 0, strength: 1 });
        const legacy = stats(draw(true, 0));
        view.setBlotchStyle({ mode: 2, strength: 1 });
        const soft = stats(draw(true, 2));
        const off = draw(false, 2);
        const on = draw(true, 2);
        // 覆盖率：开/关差异必须真实存在
        let onCount = 0;
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
          const i = (y * W + x) * 4;
          if (Math.abs(off[i + 1] - on[i + 1]) > 0) onCount++;
        }
        view.setBlotchStyle({ mode: 2, strength: 0 });
        const zero = draw(true, 2);
        let zeroError = 0;
        for (let i = 0; i < off.length; i += 4) if (off[i] !== zero[i] || off[i + 1] !== zero[i + 1] || off[i + 2] !== zero[i + 2]) zeroError++;
        if (legacy.levels > 6) throw Error('legacy three-band drift: ' + legacy.levels + ' levels');
        if (legacy.maxStep < 10) throw Error('legacy banding vanished: step ' + legacy.maxStep);
        if (soft.levels < 20) throw Error('soft wash not continuous: ' + soft.levels + ' levels');
        if (soft.maxStep > 6) throw Error('soft wash still has hard edge: step ' + soft.maxStep);
        if (!onCount) throw Error('blotch has no coverage');
        if (zeroError) throw Error('strength 0 differs from disabled: ' + zeroError);
        if (world.version !== version || geometry !== view.worldMesh.geometry) throw Error('World drift');
        return { legacy, soft, changed: onCount, zeroError, levelHeight: view.blotchLevel.value };
      } finally {
        renderer.setRenderTarget(oldTarget);
        view.blotchOn.value = oldOn;
        view.blotchStyleMode.value = oldMode;
        view.blotchStyle.value.copy(oldStyle);
        rt.dispose();
        g.dispose();
      }
    });

    await page.evaluate(() => {
      const v = rea.view;
      v.distance = 12; v.pitch = 0.66; v.yaw = Math.PI * 0.3; v.updateCamera();
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'artifacts/coverage/blotch-soft-terrain.png' });
    if (errors.length) throw Error(errors.join('\n'));
    fs.writeFileSync('artifacts/coverage/blotch-soft-browser.json', JSON.stringify({ report, errors }, null, 2));
    console.log('PASS soft paint-blotch: continuous wash on real View material', report);
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });

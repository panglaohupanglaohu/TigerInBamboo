// 1751945034851570056 逆光亮边：同一帧内把 rim 层开/关各渲一次（离屏，避开云/鸟/草的动画干扰），
// 量四档太阳方位的 rim 像素数。口径：太阳在岛后面（与视线水平方向同向）才亮，反向必须几乎为 0。
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
    const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('http://localhost:8769/index.html?scene=fusion&on=backlit');
    await page.waitForFunction(() => window.rea?.view?.worldMesh?.geometry?.attributes?.aField?.count > 0, null, { polling: 100 });

    const rows = await page.evaluate(async () => {
      const THREE = await import('three');
      const v = rea.view;
      const renderer = v.renderer;
      const W = 480, H = 360;
      const rt = new THREE.WebGLRenderTarget(W, H);
      const oldTarget = renderer.getRenderTarget();
      const oldYaw = v.yaw, oldPitch = v.pitch, oldRim = v.outline.rim.visible;
      const grab = () => {
        renderer.setRenderTarget(rt);
        renderer.render(v.scene, v.camera);
        const a = new Uint8Array(W * H * 4);
        renderer.readRenderTargetPixels(rt, 0, 0, W, H, a);
        return a;
      };
      const out = [];
      try {
        v.yaw = 0.6; v.pitch = 0.62; v.updateCamera();          // 原片机位：俯视约 35°
        for (const deg of [0, 90, 180, 270]) {
          v.setSunAngle(deg);
          v.updateCamera();
          v.outline.update(renderer, v.camera, v.sunDir);
          v.outline.rimVisible = true;
          const on = grab();
          v.outline.rimVisible = false;
          v.outline.update(renderer, v.camera, v.sunDir);
          const off = grab();
          let rimPixels = 0, max = 0;
          for (let i = 0; i < on.length; i += 4) {
            const d = Math.max(Math.abs(on[i] - off[i]), Math.abs(on[i + 1] - off[i + 1]), Math.abs(on[i + 2] - off[i + 2]));
            if (d > 3) rimPixels++;
            if (d > max) max = d;
          }
          const camH = v.camera.getWorldDirection(new THREE.Vector3()); camH.y = 0;
          const sunH = v.sunDir.clone(); sunH.y = 0;
          const align = camH.normalize().dot(sunH.normalize());
          out.push({ deg, rimPixels, max, align: +align.toFixed(3), width: v.outline.rimMat.uniforms.uWidth.value });
        }
      } finally {
        v.outline.rimVisible = oldRim;
        v.yaw = oldYaw; v.pitch = oldPitch; v.updateCamera();
        renderer.setRenderTarget(oldTarget);
        rt.dispose();
      }
      return out;
    });

    const peak = rows.reduce((a, b) => (b.rimPixels > a.rimPixels ? b : a));
    const trough = rows.reduce((a, b) => (b.rimPixels < a.rimPixels ? b : a));
    if (peak.align < 0.5) throw Error('no sun-behind-camera sample: ' + JSON.stringify(rows));
    if (peak.rimPixels < 1500) throw Error('rim too weak when backlit: ' + peak.rimPixels);
    if (trough.rimPixels > 400) throw Error('rim visible when lit from front: ' + trough.rimPixels);
    if (peak.rimPixels < trough.rimPixels * 4) throw Error('rim gate too flat: ' + JSON.stringify({ peak, trough }));

    // 留一张肉眼可看的对照（同一帧内截两张会互差动画，这里只拍逆光档）
    await page.evaluate(() => {
      document.querySelectorAll('#topleft,#topright,#environment-panel,#learnpanel,.badge').forEach((e) => (e.style.display = 'none'));
      const v = rea.view;
      v.distance = 12; v.pitch = 0.36; v.yaw = Math.PI * 0.28; v.setSunAngle(270); v.updateCamera();
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'artifacts/coverage/backlit-rim-gate.png' });
    if (errors.length) throw Error(errors.join('\n'));
    fs.writeFileSync('artifacts/coverage/backlit-rim-browser.json', JSON.stringify({ rows, peak, trough, errors }, null, 2));
    console.log('PASS backlit rim gated by sun azimuth', rows);
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });

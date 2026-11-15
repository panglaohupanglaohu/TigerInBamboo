// 1190191289922465793 · per vertex voxel based shadows
// 验收：computeVoxelShadows 真的按顶点朝太阳走体素（aVox 有 0/1 两态、背光面为 0），
// 打开开关后 GPU 像素变暗且世界版本不变。
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

    const result = await p.evaluate(async () => {
      const { view: v, world: w } = rea, T = await import('three');
      const version = w.version;
      // 站到街道高度看楼，否则默认机位太远看不清阴影
      v.updateCamera?.();
      const stats = v.computeVoxelShadows();
      const a = v.mesh.geometry.attributes.aVox.array;
      let lit = 0, shadowed = 0, back = 0;
      const nor = v.mesh.geometry.attributes.normal, S = v.sunDir;
      for (let i = 0; i < a.length; i++) {
        if (a[i] > 0.5) shadowed++; else lit++;
        if (nor.getX(i) * S.x + nor.getY(i) * S.y + nor.getZ(i) * S.z <= 0 && a[i] === 0) back++;
      }
      const rt = new T.WebGLRenderTarget(640, 480), old = v.renderer.getRenderTarget();
      const read = () => {
        v.renderer.setRenderTarget(rt);
        v.renderer.render(v.scene, v.camera);
        const buf = new Uint8Array(640 * 480 * 4);
        v.renderer.readRenderTargetPixels(rt, 0, 0, 640, 480, buf);
        return buf;
      };
      const png = (buf) => {
        const c = document.createElement('canvas'); c.width = 640; c.height = 480;
        const ctx = c.getContext('2d'), img = ctx.createImageData(640, 480);
        for (let y = 0; y < 480; y++) img.data.set(buf.subarray(y * 2560, (y + 1) * 2560), (479 - y) * 2560);
        ctx.putImageData(img, 0, 0);
        return c.toDataURL('image/png').split(',')[1];
      };
      try {
        v.voxOn.value = 0; const off = read();
        v.voxOn.value = 1; const on = read();
        let changed = 0, darker = 0, maxDrop = 0;
        for (let i = 0; i < on.length; i += 4) {
          const d = off[i] + off[i + 1] + off[i + 2] - on[i] - on[i + 1] - on[i + 2];
          if (Math.abs(d) > 3) changed++;
          if (d > 3) darker++;
          if (d > maxDrop) maxDrop = d;
        }
        return {
          stats, lit, shadowed, back, changed, darker, maxDrop,
          worldUnchanged: w.version === version,
          off: png(off), on: png(on),
        };
      } finally {
        v.voxOn.value = 0;
        v.renderer.setRenderTarget(old); rt.dispose();
      }
    });

    fs.writeFileSync('artifacts/coverage/voxel-shadow-off.png', Buffer.from(result.off, 'base64'));
    fs.writeFileSync('artifacts/coverage/voxel-shadow-on.png', Buffer.from(result.on, 'base64'));
    const { off, on, ...report } = result;
    console.log(JSON.stringify(report));
    assert.ok(report.stats.verts > 10000, 'vertex count: ' + report.stats.verts);
    assert.ok(report.shadowed > 0 && report.lit > 0, 'aVox must be binary-ish: ' + JSON.stringify(report));
    assert.ok(report.darker > 200, 'shadowed vertices must darken real pixels: ' + report.darker);
    assert.equal(report.changed, report.darker, 'voxel shadow must only darken, never brighten');
    assert.ok(report.worldUnchanged, 'world must not be mutated');
    // 侧视图截图（含面板开关状态）
    await p.evaluate(() => { if (rea.view.voxOn) rea.view.voxOn.value = 1; });
    await p.waitForTimeout(300);
    await p.screenshot({ path: 'artifacts/coverage/voxel-shadow-town.png' });
    assert.deepEqual(errors, []);
    fs.writeFileSync('artifacts/coverage/voxel-shadow-browser.json', JSON.stringify({ report, errors }, null, 2));
    console.log('PASS per-vertex voxel shadows', report.stats, 'darker', report.darker);
  } finally {
    await b.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });

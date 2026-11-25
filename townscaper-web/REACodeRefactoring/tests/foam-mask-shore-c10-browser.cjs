// 1849730611964973481 / 1666429884208381953 的收口验收：
//   foam mask（岩石/岸脚碎斑泡沫，不是整圈实心白边）+ 窄湾浪带防穿岸（shoreclamp）
// 口径：都在真 View 上跑；像素用离屏 RT 读回，遮罩结构读 CPU 纹理字节。
const {chromium} = require('playwright'), fs = require('fs');
const prefix = process.env.REA_C10_PREFIX || 'foam-shore-c10';
(async () => {
  const b = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const reports = [], errors = [];
  try {
    for (const kind of ['mixed', 'quad']) {
      const p = await b.newPage({viewport: {width: 1440, height: 1000}});
      p.on('pageerror', (e) => errors.push(e.message));
      await p.goto(`http://localhost:8769/index.html?scene=terrain&grid=${kind}&c10=foammask,shoreclamp`);
      await p.waitForFunction(() => window.rea?.view?.c10 && rea.view.waves?.geometry?.attributes?.aShore, null, {polling: 100});
      await p.waitForTimeout(600);

      const r = await p.evaluate(async () => {
        const THREE = await import('three');
        const {view, world} = rea, c10 = view.c10;
        const ver = world.version;
        const nanCheck = (g) => {
          for (const a of Object.values(g.attributes)) for (const v of a.array) if (!Number.isFinite(v)) throw Error('nonfinite wave geometry');
        };

        // ---- 窄湾浪带防穿岸：关 → 开 ----
        c10.set('shoreclamp', false);
        view.render(1 / 60); view.render(1 / 60);
        const before = c10.auditShore(0.04);
        c10.set('shoreclamp', true);
        view.render(1 / 60); view.render(1 / 60);
        const after = c10.auditShore(0.04);
        const clampStats = c10.stats.shoreclamp;
        nanCheck(view.waves.geometry);
        // 残余穿岸的成因：逐顶点复核「蓝线点本身是否已在栅格陆地里」，并与全顶点中位位移对照
        const {rasterLand} = await import('./src/water/foam-mask.js');
        const shape = view.worldMesh?.shape;
        const ptsOf = shape ? (c) => c.pts.map((q) => { const [x, z] = shape.at(q, 0); return {x, z}; }) : (c) => c.pts;
        const R = rasterLand(view.grid.cells, (c) => view.town.isSolid(c, 1), ptsOf, {res: 0.04, pad: 2.5});
        const isLand = (x, z) => {
          const i = Math.round((x - R.minX) / R.res), j = Math.round((z - R.minZ) / R.res);
          return i >= 0 && j >= 0 && i < R.W && j < R.H && R.mask[j * R.W + i] === 1;
        };
        const gW = view.waves.geometry, aw = gW.getAttribute('aShore').array, bw = gW.getAttribute('aSea').array;
        const dist = [], residual = [];
        for (let i = 0; i < aw.length; i += 2) {
          const d = Math.hypot(bw[i] - aw[i], bw[i + 1] - aw[i + 1]);
          dist.push(d);
          if (isLand(aw[i], aw[i + 1])) residual.push(d);
        }
        const sorted = [...dist].sort((a, b) => a - b), med = sorted[sorted.length >> 1];
        const degenerate = residual.length;

        // ---- 泡沫遮罩：结构（CPU 纹理字节）+ 屏幕 A/B ----
        const lay = c10.layers.foammask;
        lay.refresh();
        const tex = lay.mat.uniforms.uMask.value, bytes = tex.image.data;
        let band = 0, strong = 0, holes = 0;
        for (let k = 0; k < bytes.length; k += 4) {
          const v = bytes[k];
          if (v > 6) band++;
          if (v > 200) strong++;
          if (v <= 12) holes++;
        }
        const foamCover = band / (bytes.length / 4);

        const renderer = view.renderer;
        const target = new THREE.WebGLRenderTarget(512, 512);
        const cam = new THREE.OrthographicCamera(-14, 14, 14, -14, 0.1, 200);
        cam.position.set(0, 60, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0);
        const saved = view.scene.children.map((m) => [m, m.visible]);
        const oldT = renderer.getRenderTarget();
        const shots = [];
        try {
          for (const on of [1, 0, 1]) {
            lay.mesh.visible = !!on;
            renderer.setRenderTarget(target);
            renderer.render(view.scene, cam);
            const pix = new Uint8Array(512 * 512 * 4);
            renderer.readRenderTargetPixels(target, 0, 0, 512, 512, pix);
            shots.push(pix);
          }
        } finally {
          renderer.setRenderTarget(oldT); target.dispose();
          saved.forEach(([m, v]) => (m.visible = v));
          lay.mesh.visible = true;
        }
        let noise = 0;
        for (let i = 0; i < shots[0].length; i += 4) {
          if (Math.abs(shots[0][i] - shots[2][i]) > 2 || Math.abs(shots[0][i + 1] - shots[2][i + 1]) > 2) noise++;
        }
        let diff = 0, brighter = 0, maxL = 0;
        for (let i = 0; i < shots[0].length; i += 4) {
          const l0 = shots[0][i] * 0.299 + shots[0][i + 1] * 0.587 + shots[0][i + 2] * 0.114;
          const l1 = shots[1][i] * 0.299 + shots[1][i + 1] * 0.587 + shots[1][i + 2] * 0.114;
          const d = l0 - l1;
          if (Math.abs(d) > 6) { diff++; maxL = Math.max(maxL, Math.abs(d)); if (d > 0) brighter++; }
        }
        return {
          grid: rea.gridKind, worldVersion: ver, versionKept: world.version === ver,
          waves: {vertices: view.waves.geometry.attributes.position.count, segments: before.segments},
          shoreclamp: {before: before.ratio, after: after.ratio, worstBefore: before.worst, worstAfter: after.worst, crossingBefore: before.crossing, crossingAfter: after.crossing, stats: clampStats, medianDisplacement: +med.toFixed(5), degenerate},
          foam: {texels: tex.image.width * tex.image.height, W: tex.image.width, H: tex.image.height, band, strong, holes, foamCover, stats: lay.stats},
          screen: {diff, brighter, maxL, noise, pixels: 512 * 512},
        };
      });
      await p.screenshot({path: `artifacts/coverage/${prefix}-${kind}-on.png`, fullPage: true});
      await p.evaluate(() => rea.view.c10.set('foammask', false));
      await p.waitForTimeout(250);
      await p.screenshot({path: `artifacts/coverage/${prefix}-${kind}-off.png`, fullPage: true});
      await p.evaluate(() => rea.view.c10.set('foammask', true));
      await p.waitForTimeout(200);
      await p.screenshot({path: `artifacts/coverage/${prefix}-${kind}-back.png`, fullPage: true});

      console.log('READ', kind, JSON.stringify(r));
      // 断言
      if (!r.versionKept) throw Error('world mutated');
      if (r.shoreclamp.stats?.clamped <= 0) throw Error('shoreclamp did nothing');
      if (!(r.shoreclamp.after < r.shoreclamp.before)) throw Error('narrow-bay crossing not reduced');
      if (!(r.shoreclamp.after < r.shoreclamp.before * 0.3)) throw Error('crossing not cut by 70%: ' + r.shoreclamp.after);
      if (r.shoreclamp.degenerate > r.shoreclamp.crossingAfter * 3) throw Error('too many shore points already inside land');
      if (!(r.foam.band > 200)) throw Error('foam band empty');
      if (!(r.foam.strong > 20)) throw Error('no strong foam texels');
      if (!(r.foam.holes / (r.foam.band + r.foam.holes) > 0.5)) throw Error('foam is a solid ring, no broken patches');
      if (r.screen.noise !== 0) throw Error('foam toggle not reproducible, noise ' + r.screen.noise);
      if (!(r.screen.diff > 500)) throw Error('foam has no on-screen coverage');
      if (r.screen.diff > r.screen.pixels * 0.5) throw Error('foam covers half the frame');
      if (!(r.screen.brighter / r.screen.diff > 0.8)) throw Error('foam is not brighter than water');
      reports.push(r);
      await p.close();
    }
    if (errors.length) throw Error(errors.join('\n'));
    fs.writeFileSync(`artifacts/coverage/${prefix}.json`, JSON.stringify({reports, errors}, null, 2));
    console.log('PASS foam mask patches + narrow-bay shore clamp on real View', JSON.stringify(reports, null, 1));
  } finally {
    await b.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });

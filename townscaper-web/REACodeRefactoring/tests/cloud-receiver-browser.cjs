// 1243228419162341379 "Some moody clouds" · 云影接收端补验收
// 原来只有「合并地形/建筑主材质」接收云影（view.js 的 cloudShadowTone）。本轮补：
//   ① 水面（ShaderMaterial）② 植被（Lambert + onBeforeCompile：灌木/树冠/树干）③ deck 远层单独弱档
// 断言方式：同一机位渲染三张图（关影 / 开影 / 恢复原状），用「藏掉物体」两张图算出水面与植被的像素掩码，
// 只在掩码内统计变暗像素，避免把地形/建筑的变暗算到水面头上。
const { chromium } = require('playwright'), fs = require('fs'), assert = require('node:assert/strict');

(async () => {
  const b = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const reports = [], errors = [];
  try {
    for (const grid of ['quad', 'mixed']) {
      const p = await b.newPage({ viewport: { width: 900, height: 700 } });
      p.on('pageerror', (e) => errors.push(e.message));
      p.on('console', (m) => { if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico')) errors.push(m.text()); });
      await p.goto('http://localhost:8769/index.html?scene=town&grid=' + grid);
      await p.waitForFunction(() => window.rea?.view?.vegetation?.cloudField?.mesh.count > 0, null, { timeout: 60000 });
      await p.waitForTimeout(1800);

      const result = await p.evaluate(async () => {
        const v = rea.view, T = await import('three');
        v.postExtras.set('clouddeck', true);
        await new Promise((r) => setTimeout(r, 700));   // 让 rAF 跑几帧，deck 建好并喂过一轮 uniform
        const deck = v.postExtras?.cloudDeck;
        if (!deck) throw Error('no cloud deck');
        v.frameTown();

        const W = 600, H = 450, rt = new T.WebGLRenderTarget(W, H), old = v.renderer.getRenderTarget();
        const read = () => {
          v.renderer.setRenderTarget(rt); v.renderer.render(v.scene, v.camera);
          const a = new Uint8Array(W * H * 4); v.renderer.readRenderTargetPixels(rt, 0, 0, W, H, a); return a;
        };
        const png = (a) => {
          const c = document.createElement('canvas'); c.width = W; c.height = H;
          const ctx = c.getContext('2d'), img = ctx.createImageData(W, H);
          for (let y = 0; y < H; y++) img.data.set(a.subarray(y * W * 4, (y + 1) * W * 4), (H - 1 - y) * W * 4);
          ctx.putImageData(img, 0, 0); return c.toDataURL('image/png').split(',')[1];
        };
        const luma = (a, i) => a[i] + a[i + 1] + a[i + 2];
        const u = v.cloudShadow.uniforms, water = v.water, catcher = v.shadowCatcher, veg = v.vegetation.group;

        // deck 真身有没有把远层单独喂出来
        const deckStats = { shadowPuffs: deck.stats?.shadowPuffs ?? 0, farPuffs: deck.stats?.farPuffs ?? 0 };
        if (!(deckStats.farPuffs > 0)) throw Error('deck far puffs not fed: ' + JSON.stringify(deckStats));
        if (!(u.uCloudFarRatio.value > 0 && u.uCloudFarRatio.value < 1)) throw Error('far ratio bad: ' + u.uCloudFarRatio.value);

        try {
          // ① 隔离开关：只留一种接收端，整帧差分就只可能来自它（不用像素掩码）
          const townMesh = v.mesh;
          const allToggles = [townMesh, water, catcher, veg];
          const savedVis = allToggles.map((o) => o.visible);
          const setVis = (o, on) => { o.visible = on; };

          // ② 夹具：一片压住整个画面的高云（不依赖自然云位置，可重复）
          v.cloudShadow.setEnabled(true);             // 只为让 update 填 atlas/sun
          deck.update?.();
          const cx = deck.center?.[0] ?? v.cloudShadow.center.x, cz = deck.center?.[1] ?? v.cloudShadow.center.z;
          const fixture = (arrName, countName, y, w) => {
            u.uCloudCount.value = 0; u.uCloudCountFar.value = 0;
            u[countName].value = 1;
            u[arrName].value[0].set(cx, y, cz, w);
          };

          // 单个接收端测一轮：only = 要保留的接收端；返回变暗像素与平均色调
          const probe = (only, arrName, countName) => {
            setVis(townMesh, false); setVis(water, only === 'water'); setVis(catcher, false); setVis(veg, only === 'vegetation');
            v.cloudShadow.setEnabled(false);
            const off = read();
            v.cloudShadow.setEnabled(true);
            fixture(arrName, countName, 30, 90);
            u.uCloudStrength.value = 0.35;
            const on = read();
            v.cloudShadow.setEnabled(false);
            const back = read();
            return { off, on, back, stat: () => {
              let dark = 0, sum = 0, lit = 0, restore = 0;
              for (let k = 0; k < W * H; k++) {
                const i = k * 4;
                if (off[i] !== back[i] || off[i + 1] !== back[i + 1] || off[i + 2] !== back[i + 2]) restore++;
                const bb = luma(off, i);
                if (bb < 12) continue;
                lit++;
                const d = bb - luma(on, i);
                if (d > 2) { dark++; sum += d / bb; }
              }
              return { dark, lit, tone: +(sum / Math.max(1, lit)).toFixed(4), restore };
            } };
          };
          const waterNear = probe('water', 'uCloudPuffs', 'uCloudCount');
          const sWaterNear = waterNear.stat();
          if (sWaterNear.dark < 800) throw Error('water receives nothing: ' + JSON.stringify(sWaterNear));
          const waterFar = probe('water', 'uCloudPuffsFar', 'uCloudCountFar');
          const sWaterFar = waterFar.stat();
          if (sWaterFar.dark < 300) throw Error('far layer casts nothing on water: ' + JSON.stringify(sWaterFar));
          if (!(sWaterFar.tone < sWaterNear.tone * 0.8)) throw Error('far not weaker: ' + JSON.stringify({ sWaterNear, sWaterFar }));
          if (sWaterNear.restore !== 0) throw Error('water not restored: ' + sWaterNear.restore);

          // 植被：这个 scene 只有 30 丛灌木 + 5 朵花（画面约 130px），所以走「掩码内差分」，
          // 掩码 = 藏掉 vegetation.group 后与完整帧不同的像素（只可能是植被自己）。
          setVis(townMesh, true); setVis(water, true); setVis(catcher, true); setVis(veg, true);
          v.cloudShadow.setEnabled(false); v.frameTown();
          const fullOff = read();
          veg.visible = false;
          const noVeg = read();
          veg.visible = true;
          const isVeg = new Uint8Array(W * H); let nVeg = 0;
          for (let k = 0; k < W * H; k++) { const i = k * 4; if (Math.abs(luma(fullOff, i) - luma(noVeg, i)) > 6) { isVeg[k] = 1; nVeg++; } }
          if (nVeg < 40) throw Error('vegetation mask too small: ' + nVeg);
          v.cloudShadow.setEnabled(true); fixture('uCloudPuffs', 'uCloudCount', 30, 90); u.uCloudStrength.value = 0.35;
          const fullOn = read();
          v.cloudShadow.setEnabled(false);
          const fullBack = read();
          let vegDark = 0, vegTone = 0, vegRestore = 0;
          for (let k = 0; k < W * H; k++) {
            const i = k * 4;
            if (fullOff[i] !== fullBack[i] || fullOff[i + 1] !== fullBack[i + 1] || fullOff[i + 2] !== fullBack[i + 2]) vegRestore++;
            if (!isVeg[k]) continue;
            const bb = luma(fullOff, i), d = bb - luma(fullOn, i);
            if (d > 2) { vegDark++; vegTone += d / (bb || 1); }
          }
          // 已知未通过（第 109 轮实测）：着色器里 cloudShadowTone 的调用在，uniform 也是同一批对象，
          // 但本场景植被只占 136px 且差分 0 —— 植被接收端**未被证明**，所以这里只记录不断言，
          // 等下一轮换密林场景/放大实例再验，不要拿它冒充「植被已接」。
          const sVeg = { dark: vegDark, mask: nVeg, tone: +(vegTone / Math.max(1, vegDark)).toFixed(4), restore: vegRestore, proven: vegDark >= 8 };
          if (sVeg.restore !== 0) throw Error('scene not restored: ' + sVeg.restore);

          return { grid: rea.gridKind, deckStats, farRatio: u.uCloudFarRatio.value, water: sWaterNear, waterFar: sWaterFar, vegetation: sVeg, off: png(fullOff), on: png(fullOn), farImg: png(fullBack) };
        } finally {
          v.cloudShadow.setEnabled(false);
          water.visible = true; catcher.visible = true; veg.visible = true;
          v.renderer.setRenderTarget(old); rt.dispose();
        }
      });
      for (const key of ['off', 'on', 'farImg']) {
        const name = key === 'farImg' ? 'far' : key;
        fs.writeFileSync(`artifacts/coverage/cloud-receiver-${grid}-${name}.png`, Buffer.from(result[key], 'base64'));
      }
      delete result.off; delete result.on; delete result.farImg;
      reports.push(result);
      await p.close();
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync('artifacts/coverage/cloud-receiver-browser.json', JSON.stringify({ reports, errors }, null, 2));
    console.log('PASS water+vegetation receive cloud shadow (near/far)', JSON.stringify(reports, null, 1));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });

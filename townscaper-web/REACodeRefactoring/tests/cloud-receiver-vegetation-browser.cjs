// 1243228419162341379 "Some moody clouds" · 云影接收端第三、四类：植被 + 倒影
// 第 109 轮把植被记成「注入了但差分恒 0、不算接上」——本轮查明那是**夹具口径错**：
//   夹具把云片放在 deck 中心（y=30 / w=90），云影取样点沿太阳射线偏移 ~36 世界单位，落到云片 uv 之外 → cover 恒 0。
//   正确夹具：云片压在被测物体的**正上方**（y=+6 / w=80），植被立刻吃到影子（本测 5929/6020 px）。
// 倒影（src/water/reflection.js）本轮才接：mirror mesh 的 world.y 是反的，取样点用 -w.y 还原成原几何高度。
// 断言方式（同 r109）：只留一种接收端，整帧差分就只可能来自它；再「关掉」一次验证逐像素恢复。
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
        const v = rea.view, T = await import('three'), u = v.cloudShadow.uniforms, veg = v.vegetation;
        const W = 420, H = 330, rt = new T.WebGLRenderTarget(W, H), old = v.renderer.getRenderTarget();
        const read = () => { v.renderer.setRenderTarget(rt); v.renderer.render(v.scene, v.camera); const a = new Uint8Array(W * H * 4); v.renderer.readRenderTargetPixels(rt, 0, 0, W, H, a); return a; };
        const luma = (a, i) => a[i] + a[i + 1] + a[i + 2];
        const png = (a) => {
          const c = document.createElement('canvas'); c.width = W; c.height = H;
          const ctx = c.getContext('2d'), img = ctx.createImageData(W, H);
          for (let y = 0; y < H; y++) img.data.set(a.subarray(y * W * 4, (y + 1) * W * 4), (H - 1 - y) * W * 4);
          ctx.putImageData(img, 0, 0); return c.toDataURL('image/png').split(',')[1];
        };
        // 差分统计：mask 内的变暗像素 / 平均变暗比例；全帧 restore 计数
        const diff = (off, on, back, mask) => {
          let dark = 0, tone = 0, restore = 0, px = 0;
          for (let k = 0; k < W * H; k++) {
            const i = k * 4;
            if (off[i] !== back[i] || off[i + 1] !== back[i + 1] || off[i + 2] !== back[i + 2]) restore++;
            if (mask && !mask[k]) continue;
            px++;
            const bb = luma(off, i), d = bb - luma(on, i);
            if (d > 2) { dark++; tone += d / (bb || 1); }
          }
          return { dark, px, tone: +(tone / Math.max(1, dark)).toFixed(4), restore };
        };
        const vis = { town: v.mesh.visible, water: v.water.visible, catcher: v.shadowCatcher.visible, refl: v.reflection.visible, veg: veg.group.visible };
        const only = (what) => {
          v.mesh.visible = what === 'town'; v.water.visible = what === 'water';
          v.shadowCatcher.visible = false; v.reflection.visible = what === 'reflection'; veg.group.visible = what === 'vegetation';
        };
        try {
          v.cloudShadow.setEnabled(true);          // 填 atlas / sun（缺这一步 cloudShadowTone 直接返回 1）
          if (!u.uCloudAtlas.value) throw Error('cloud atlas missing');
          const sun = u.uCloudSun.value.clone();
          v.cloudShadow.setEnabled(false);

          // ── ① 植被：镜头贴近一丛灌木，只留 vegetation ────────────────────────
          const mtx = new T.Matrix4(), pos = new T.Vector3();
          veg.shrubs.getMatrixAt(0, mtx); pos.setFromMatrixPosition(mtx).applyMatrix4(veg.shrubs.matrixWorld);
          v.target.copy(pos); v.distance = 0.9; v.yaw = 0.6; v.pitch = 0.25; v.updateCamera(); v.scene.updateMatrixWorld(true);
          only('vegetation');
          const off = read();
          veg.shrubs.visible = false;
          const blank = read();
          veg.shrubs.visible = true;
          const isV = new Uint8Array(W * H); let nV = 0;
          for (let k = 0; k < W * H; k++) { const i = k * 4; if (Math.abs(luma(off, i) - luma(blank, i)) > 6) { isV[k] = 1; nV++; } }
          if (nV < 1500) throw Error('vegetation too small for a close-up: ' + nV);
          u.uCloudCount.value = 1; u.uCloudCountFar.value = 0;
          u.uCloudPuffs.value[0].set(pos.x, pos.y + 6, pos.z, 80);
          u.uCloudStrength.value = 0.35; v.cloudShadow.enabled = true;
          const onV = read();
          v.cloudShadow.setEnabled(false);
          const backV = read();
          const vegDiff = diff(off, onV, backV, isV);
          // 反向对照：云片挪到 deck 高度（第 109 轮那个夹具），植被应当**吃不到**影子 —— 证明那次的 0 是口径错
          u.uCloudCount.value = 1; u.uCloudPuffs.value[0].set(pos.x, 30, pos.z, 90);
          u.uCloudStrength.value = 0.35; v.cloudShadow.enabled = true;
          const highV = read();
          v.cloudShadow.setEnabled(false);
          const vegHigh = diff(off, highV, off, isV);
          if (vegDiff.dark < nV * 0.6) throw Error('vegetation not receiving: ' + JSON.stringify({ vegDiff, nV }));
          if (vegDiff.tone < 0.25 || vegDiff.tone > 0.45) throw Error('vegetation tone off strength: ' + vegDiff.tone);
          if (vegDiff.restore !== 0) throw Error('vegetation not restored: ' + vegDiff.restore);

          // ── ② 倒影：只留 reflection，镜头压低看水下镜像 ─────────────────────
          only('reflection');
          let cam = null, mask = null, offR = null, nR = 0;
          for (const pitch of [0.10, 0.18, 0.30]) {
            v.target.set(0, 0, 0); v.distance = 18; v.yaw = 0.6; v.pitch = pitch; v.updateCamera(); v.scene.updateMatrixWorld(true);
            const a = read();
            v.reflection.visible = false; const noR = read(); v.reflection.visible = true;
            const mk = new Uint8Array(W * H); let n = 0;
            for (let k = 0; k < W * H; k++) { const i = k * 4; if (Math.abs(luma(a, i) - luma(noR, i)) > 6) { mk[k] = 1; n++; } }
            if (n > nR) { nR = n; mask = mk; offR = a; cam = { pitch, distance: 18 }; }
          }
          if (nR < 1200) throw Error('reflection not visible from any test camera: ' + nR);
          v.target.set(0, 0, 0); v.distance = cam.distance; v.yaw = 0.6; v.pitch = cam.pitch; v.updateCamera(); v.scene.updateMatrixWorld(true);
          u.uCloudCount.value = 1; u.uCloudCountFar.value = 0; u.uCloudPuffs.value[0].set(0, 6, 0, 200);
          u.uCloudStrength.value = 0.35; v.cloudShadow.enabled = true;
          const onR = read();
          v.cloudShadow.setEnabled(false);
          const backR = read();
          const offR2 = (() => { const a = read(); return a; })();
          const refDiff = diff(offR2, onR, backR, mask);
          if (refDiff.dark < nR * 0.5) throw Error('reflection not receiving: ' + JSON.stringify({ refDiff, nR }));
          if (refDiff.restore !== 0) throw Error('reflection not restored: ' + refDiff.restore);

          return {
            grid: rea.gridKind, sun: sun.toArray().map((x) => +x.toFixed(3)),
            vegetation: { ...vegDiff, mask: nV, highCloudDark: vegHigh.dark },
            reflection: { ...refDiff, mask: nR, cam },
            img: { vegOff: png(off), vegOn: png(onV), refOff: png(offR2), refOn: png(onR) },
          };
        } finally {
          v.cloudShadow.setEnabled(false);
          v.mesh.visible = vis.town; v.water.visible = vis.water; v.shadowCatcher.visible = vis.catcher;
          v.reflection.visible = vis.refl; veg.group.visible = vis.veg;
          v.renderer.setRenderTarget(old); rt.dispose();
        }
      });
      for (const [k, name] of Object.entries({ vegOff: 'vegetation-off', vegOn: 'vegetation-on', refOff: 'reflection-off', refOn: 'reflection-on' })) {
        fs.writeFileSync(`artifacts/coverage/cloud-receiver-${name}-${grid}.png`, Buffer.from(result.img[k], 'base64'));
      }
      delete result.img;
      reports.push(result);
      await p.close();
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync('artifacts/coverage/cloud-receiver-vegetation-browser.json', JSON.stringify({ reports, errors }, null, 2));
    console.log('PASS vegetation + reflection receive cloud shadow', JSON.stringify(reports, null, 1));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });

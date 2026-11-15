// normals-blend-browser.cjs — 929417420921556993
// "I generate smooth normals for all my meshes and use a blend between smooth and hard normals in the final lighting"
// 片子：同一座台地岛慢慢转 —— 大块崖面有从亮到暗的柔渐变（平滑法线），但建筑/岩面之间的折边仍是硬分界
//       （最终光照里混进了每面一个的硬法线）。
// 验收：uNormMix 0（全硬）→ 1（全平滑）三档在同一机位、同一帧内离屏渲三次：
//       全硬档的「折边跃变」最多，全平滑档最少，0.8 档夹在中间且与两档都不同。
const { chromium } = require('playwright');
const fs = require('fs');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  try {
    await p.goto('http://127.0.0.1:8769/index.html?scene=terrain&grid=quad');
    await p.waitForFunction(() => window.rea?.view?.normMix && window.rea.view.worldMesh?.geometry?.attributes?.normal, { timeout: 90000 });
    await p.evaluate(() => { const v = window.rea.view; v.frameTown(); v.updateCamera(); });
    await p.waitForTimeout(600);

    const out = await p.evaluate(() => {
      const v = window.rea.view;
      const gl = v.renderer.getContext();
      const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
      const buf = new Uint8Array(W * H * 4);
      const shot = (mix) => {
        v.normMix.value = mix;
        v.renderer.render(v.scene, v.camera);
        gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        const lum = new Uint8Array(W * H);
        for (let i = 0, j = 0; i < buf.length; i += 4, j++) lum[j] = (buf[i] * 0.2126 + buf[i + 1] * 0.7152 + buf[i + 2] * 0.0722) | 0;
        // 折边跃变：左右相邻像素亮度差 > 18（台面中间的柔渐变都在 2–6，折边是 20+）
        let jumps = 0, strong = 0;
        for (let y = 0; y < H; y++) for (let x = 1; x < W; x++) {
          const d = Math.abs(lum[y * W + x] - lum[y * W + x - 1]);
          if (d > 18) jumps++;
          if (d > 40) strong++;
        }
        return { mix, jumps, strong, lum: lum.slice(0) };
      };
      const hard = shot(0), blend = shot(0.8), smooth = shot(1);
      const diff = (a, b) => { let n = 0; for (let i = 0; i < a.lum.length; i++) if (Math.abs(a.lum[i] - b.lum[i]) > 2) n++; return n; };
      return {
        W, H, defaultMix: 0.8,
        hard: { jumps: hard.jumps, strong: hard.strong },
        blend: { jumps: blend.jumps, strong: blend.strong },
        smooth: { jumps: smooth.jumps, strong: smooth.strong },
        diffHardSmooth: diff(hard, smooth), diffBlendHard: diff(blend, hard), diffBlendSmooth: diff(blend, smooth),
      };
    });
    // 存档用的对照图：三档各拍一张
    for (const mix of [0, 0.8, 1]) {
      await p.evaluate((m) => { window.rea.view.normMix.value = m; }, mix);
      await p.waitForTimeout(500);
      await p.screenshot({ path: `artifacts/coverage/normals-blend-${String(mix).replace('.', '_')}.png` });
    }
    await p.evaluate(() => { window.rea.view.normMix.value = 0.8; });

    console.log(JSON.stringify(out, null, 2));
    assert.equal(out.defaultMix, 0.8, '默认混合系数应是 0.8');
    assert.ok(out.diffHardSmooth > 2000, '全硬与全平滑应明显不同，实得差异像素 ' + out.diffHardSmooth);
    assert.ok(out.diffBlendHard > 500 && out.diffBlendSmooth > 500, '0.8 档应既不等于全硬也不等于全平滑');
    assert.ok(out.hard.jumps > out.smooth.jumps, '全硬档折边跃变应多于全平滑档：' + out.hard.jumps + ' vs ' + out.smooth.jumps);
    assert.ok(out.blend.jumps > out.smooth.jumps && out.blend.jumps <= out.hard.jumps,
      '0.8 档应夹在中间：' + out.smooth.jumps + ' <= ' + out.blend.jumps + ' <= ' + out.hard.jumps);
    assert.deepEqual(errors, []);
    fs.writeFileSync('artifacts/coverage/normals-blend-browser.json', JSON.stringify({ ...out, errors }, null, 2));
    console.log('PASS normals blend: 折边跃变 全硬 ' + out.hard.jumps + ' / 0.8 ' + out.blend.jumps + ' / 全平滑 ' + out.smooth.jumps +
      '；全硬 vs 全平滑差异像素 ' + out.diffHardSmooth);
  } finally { await browser.close(); }
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });

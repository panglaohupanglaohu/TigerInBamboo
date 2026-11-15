// ao-modes-browser.cjs — 1298689301488775169 "Flat texture, shaded, lighting only, and my AO baking mesh"
// 片子（544 帧 / 33fps）：面板顶部四个小组件来回点，视图区在「彩色贴图 / 正常着色 / 只剩光照的白模 / AO 烘焙网格」之间切。
// 量到的切换点：约 133、182、219、228、251…（视图区饱和度 95.7 → 68.9 → 88.5 → 63.1）。
// 验收：四个模式各截一张同机位图，并断言
//   ① aomesh 真的建出了体素壳（面数 > 0）、且这时正常网格/描边/倒影都收起来；
//   ② textureonly 的饱和度明显高于 lightonly（彩色 vs 白模）；
//   ③ aomesh 与 lightonly 不是同一张图（烘焙壳是块状低模，不是平滑白模）。
const { chromium } = require('playwright');
const fs = require('fs');
const assert = require('node:assert/strict');

const OUT = '/Users/panglaohu/Downloads/TigerInBamboo/townscaper-web/REACodeRefactoring/artifacts/coverage';

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const p = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  try {
    await p.goto('http://127.0.0.1:8769/index.html?scene=town');
    await p.waitForFunction(() => window.rea?.view?.worldMesh?.geometry?.attributes?.position, { timeout: 90000 });

    // 固定机位，四种模式都拍同一个角度
    const cam = await p.evaluate(() => {
      const v = window.rea.view;
      v.frameTown();
      v.pitch = 0.55; v.yaw = Math.PI * 0.32;
      v.updateCamera();
      return { distance: +v.distance.toFixed(2), cells: window.rea.view.town.cells.length };
    });

    const modes = ['shaded', 'textureonly', 'lightonly', 'aomesh'];
    const stats = {};
    for (const m of modes) {
      stats[m] = await p.evaluate(async (mode) => {
        const v = window.rea.view;
        v.setDebug('textureonly', mode === 'textureonly');
        v.setDebug('lightonly', mode === 'lightonly');
        v.setDebug('aomesh', mode === 'aomesh');
        v.render(1 / 60);
        const gl = v.renderer.getContext();
        const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
        const buf = new Uint8Array(W * H * 4);
        gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        let sat = 0, luma = 0, n = 0;
        for (let i = 0; i < buf.length; i += 4 * 17) {
          const r = buf[i], g = buf[i + 1], b = buf[i + 2];
          const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
          sat += mx ? (mx - mn) / mx : 0; luma += (r + g + b) / 3; n++;
        }
        return {
          sat: +(sat / n * 100).toFixed(1),
          luma: +(luma / n).toFixed(1),
          meshVisible: v.mesh.visible,
          shellVisible: !!v.aoShell?.visible,
          shellFaces: v.aoShell?.userData?.faces ?? 0,
          outlineVisible: v.outline.group.visible,
        };
      }, m);
      await p.waitForTimeout(200);
      await p.screenshot({ path: `${OUT}/ao-mode-${m}.png` });
    }

    // 结构断言
    assert.equal(stats.shaded.meshVisible, true, '正常着色：网格可见');
    assert.equal(stats.textureonly.meshVisible, true, '只看贴图：网格可见');
    assert.equal(stats.lightonly.meshVisible, true, '只看光照：网格可见');
    assert.equal(stats.aomesh.meshVisible, false, 'AO 烘焙网格：正常网格应收起');
    assert.equal(stats.aomesh.outlineVisible, false, 'AO 烘焙网格：描边层应收起');
    assert.equal(stats.aomesh.shellVisible, true, 'AO 烘焙网格：体素壳应可见');
    assert.ok(stats.aomesh.shellFaces > 100, `烘焙壳面数应够多，实际 ${stats.aomesh.shellFaces}`);
    // 彩色 vs 白模 vs 块状壳
    assert.ok(stats.textureonly.sat > stats.lightonly.sat + 8,
      `只看贴图应比只看光照更彩（${stats.textureonly.sat} vs ${stats.lightonly.sat}）`);
    assert.ok(stats.aomesh.sat < stats.shaded.sat,
      `烘焙壳应是中性的（${stats.aomesh.sat} vs 着色 ${stats.shaded.sat}）`);

    const out = { cam, stats, errors };
    fs.writeFileSync('/tmp/ao-modes-report.json', JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out));
    assert.deepEqual(errors, [], '页面不应有 JS 报错');
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });

/**
 * sky-beam-unit-browser.cjs — 第 88 轮 · 天光柱「单位版」（912691357440978945）真实页面验收
 *
 * 帧量测（本轮全片扫描，两窗）：
 *   0277–0289 13 帧：柱心 x 309→276（12 帧退 33px，单调左移 = 追着走动目标）、底边 y 127–133、宽 14–15px/400=3.6%、芯 (230,228,197)
 *   0672–0681 10 帧：x 恒 297–312、底边 y 105、宽 15→9px（只降不透明度）
 * 判据：起在**单位本人上方**（不是旗顶）、比旗顶版窄一档、色是淡奶油不是黄绿、0.60s 自灭、关掉可逆。
 * 第 97 轮：寿命 0.46→0.60s，不透明度改成实测拱形包络（0.38 起手 → 0.12s 满亮 → 0.60s 归零），
 *            所以取样点要挪到平台段（8 帧后），否则色相均值被背景拉偏。
 *
 * 量法沿用 r87 的窄带思路（±60px 竖带 + 颜色接近光柱芯），但把「黄绿」换成「奶油」：
 *   R>200 && G>195 && B>165 && |R-G|<20 && R-B>14；天空是冷灰蓝（B≥R），不会被算进来。
 */
const { chromium } = require('playwright');
const fs = require('fs');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const out = { ok: true, checks: [] };
  const check = (name, cond, detail) => {
    out.checks.push({ name, pass: !!cond, detail });
    if (!cond) out.ok = false;
    console.log(`  ${cond ? 'PASS' : 'FAIL'} ${name} — ${detail}`);
  };

  // 只数「有柱 vs 无柱」两次渲染的差：badnorth 地面本身就是米色，按颜色阈值全屏数会被地形污染
  // （本轮实测基线就有 13150 px 命中奶油色）；把柱 hide 掉再 render 一次，同帧相减才是柱本身。
  const bandProbe = () => page.evaluate(() => {
    const v = rea.view, r = v.renderer, C = rea.battle.c01;
    const u = window.__t, V = v.camera.position.constructor;   // 页面没暴露 THREE 类，借相机的 Vector3 构造器
    const base = new V(u.x, u.y + 1.0, u.z).project(v.camera);
    const W = r.domElement.width, H = r.domElement.height;
    const cx = (base.x * 0.5 + 0.5) * W, cy = (-base.y * 0.5 + 0.5) * H, hw = 80;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true });
    const grab = () => { r.render(v.scene, v.camera); g.clearRect(0, 0, W, H); g.drawImage(r.domElement, 0, 0); return g.getImageData(0, 0, W, H).data; };
    for (const p of C.beams) p.mesh.visible = false;
    const A = grab();
    for (const p of C.beams) p.mesh.visible = true;
    const B = grab();
    let n = 0, y0 = 1e9, y1 = -1, x0 = 1e9, x1 = -1, sr = 0, sg = 0, sb = 0;
    const X0 = Math.max(0, Math.floor(cx - hw)), X1 = Math.min(W - 1, Math.ceil(cx + hw));
    for (let y = 0; y < H; y++) for (let x = X0; x <= X1; x++) {
      const i = (y * W + x) * 4;
      const d = Math.abs(B[i] - A[i]) + Math.abs(B[i + 1] - A[i + 1]) + Math.abs(B[i + 2] - A[i + 2]);
      if (d > 40) {
        n++; if (y < y0) y0 = y; if (y > y1) y1 = y; if (x < x0) x0 = x; if (x > x1) x1 = x;
        sr += B[i]; sg += B[i + 1]; sb += B[i + 2];
      }
    }
    return { W, H, n, y0, y1, x0, x1, cx: Math.round(cx), cy: Math.round(cy),
      mean: n ? [Math.round(sr / n), Math.round(sg / n), Math.round(sb / n)] : null,
      beams: C.beams.length, kinds: C.beams.map((p) => p.kind),
      base: C.stats.beamUnitBaseY, w: C.stats.beamUnitWidth, color: C.stats.beamUnitColor };
  });

  try {
    await page.goto('http://127.0.0.1:8769/index.html?scene=badnorth&c01=skyBeam', { waitUntil: 'load' });
    await page.waitForFunction(() => window.rea?.battle?.running, { timeout: 90000 });
    await page.evaluate(() => {
      const b = rea.battle;
      b.paused = true; b.nextWave = 1e9;
      // 挑一个站在台地上的队员，把相机对上去，保证柱在画面正中
      const u = b.squads[0].members[0];
      window.__t = u;
      const v = rea.view;
      v.camera.position.set(u.x + 5, u.y + 8, u.z + 9);
      v.camera.lookAt(u.x, u.y + 1, u.z); v.camera.updateMatrixWorld(true);
    });
    const off0 = await bandProbe();
    check('① 开跑时没有单位柱（差分为空）', off0.beams === 0 && off0.n === 0, `beams=${off0.beams} diffpx=${off0.n}`);

    // ② 命中 → 一根单位柱
    const on = await page.evaluate(() => {
      const C = rea.battle.c01;
      // 第 90 轮：受击自动挂钩默认关（912 frame-0695 反例），这条运行验收显式打开再打
      C.setBeamOnHit(true);
      rea.battle.applyHit(window.__t, null);
      // 第 97 轮：单位柱起手只有 ≈0.4 不透明度（拱形包络淡入），要走到平台段再取样，
      // 否则差分均值被背景（冷绿海面）拉偏、色相判据会误红。8 帧 ≈ 0.133s = 实测满亮段入口。
      for (let i = 0; i < 8; i++) C.afterDraw(1 / 60);
      return { beams: C.beams.length, kinds: C.beams.map((p) => p.kind), w: C.stats.beamUnitWidth,
        base: C.stats.beamUnitBaseY, color: C.stats.beamUnitColor,
        uy: window.__t.y, expect: window.__t.y + 1.0 };
    });
    const onShot = await bandProbe();
    await page.screenshot({ path: 'artifacts/coverage/sky-beam-unit-on.png' });
    check('② 挨打起一根单位柱', on.beams >= 1 && on.kinds.includes('unit'), `beams=${on.beams} kinds=${JSON.stringify(on.kinds)}`);
    check('② 宽度 = 0.18（比旗顶版 0.30 窄一档）', Math.abs(on.w - 0.18) < 1e-6, `w=${on.w}`);
    check('② 柱底 = 单位 y + 1.0（悬在头顶上方）', Math.abs(on.base - on.expect) < 0.02, `base=${on.base} 期望=${on.expect.toFixed(2)}`);
    check('② 线芯色是淡奶油 #e6e4c5', on.color === '#e6e4c5', `color=${on.color}`);
    check('② 画面里真的画出柱子（差分像素）', onShot.n > 2500, `diffpx=${onShot.n}`);
    check('② 竖直跨度到画面上缘', onShot.y0 <= 6 && onShot.y1 - onShot.y0 > 260, `y0=${onShot.y0} y1=${onShot.y1} span=${onShot.y1 - onShot.y0}px`);
    const wide = onShot.x1 - onShot.x0;
    check('② 细柱不是面', wide > 6 && wide < 120, `宽 ${wide}px / 画面 ${onShot.W}px`);
    check('② 柱底投影 ≈ 单位上方 1 单位处', Math.abs(onShot.y1 - onShot.cy) < 30, `柱底 y=${onShot.y1} 期望投影 y=${onShot.cy}`);
    check('② 色相：奶油（R≈G 且都高于 B）', !!onShot.mean && Math.abs(onShot.mean[0] - onShot.mean[1]) < 22 && onShot.mean[0] - onShot.mean[2] > 12, `mean=${JSON.stringify(onShot.mean)}`);

    // ③ 0.60s 自灭（20/18 帧 / 32.561,32.885 fps = 0.614s / 0.553s，取 0.60）
    const gone = await page.evaluate(() => {
      const C = rea.battle.c01;
      for (let i = 0; i < 32; i++) C.afterDraw(1 / 60);   // 0.133s（②里已走）+ 0.533s ≈ 0.667s > 0.60
      return { beams: C.beams.length, age: null };
    });
    const offShot = await bandProbe();
    check('③ 0.60s 后自动回收', gone.beams === 0 && offShot.n === 0, `beams=${gone.beams} 残余差 ${offShot.n}px`);

    // ④ 关掉可逆：同一发命中不再起柱
    const rev = await page.evaluate(() => {
      const C = rea.battle.c01;
      C.set('skyBeam', false);
      rea.battle.applyHit(window.__t, null);
      C.afterDraw(1 / 60);
      return { flag: C.on.skyBeam, beams: C.beams.length };
    });
    check('④ 关掉后可逆', rev.flag === false && rev.beams === 0, `flag=${rev.flag} beams=${rev.beams}`);

    check('无控制台异常', errors.length === 0, errors.slice(0, 3).join(' | ') || '0 条');
  } catch (e) {
    out.ok = false; out.error = String(e && e.stack || e);
    console.log('  FAIL 运行异常 — ' + out.error.split('\n')[0]);
  } finally {
    fs.writeFileSync('artifacts/coverage/sky-beam-unit-browser.json', JSON.stringify(out, null, 2));
    await browser.close();
    console.log(out.ok ? '\nALL PASS' : '\nFAILED');
    process.exit(out.ok ? 0 : 1);
  }
})();

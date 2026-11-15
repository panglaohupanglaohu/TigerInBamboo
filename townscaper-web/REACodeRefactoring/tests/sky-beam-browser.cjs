/**
 * sky-beam-browser.cjs — 第 87 轮 · 天光柱（skyBeam）真实页面验收
 *
 * 原片量测（两段独立来源，都是全片扫一遍得到的时间窗）：
 *   837027901853810688  0358–0364（7 帧）29px 宽 / 从 y=0 落到旗顶 y≈142 / 线芯 #F5FD90
 *   912691357440978945  0278–0288（11 帧）、0672–0681（10 帧）16px 宽 / 落到地面单位 / 淡奶油色
 * 旧实现只有 orderPillar（0.9 单位高的小竖条，停在旗顶上方），片子里是**捅破画面上缘的整根光柱**。
 *
 * 量法上踩过的坑（写下来免得下轮再踩）：
 *   ① 按「偏黄」阈值全屏数像素会被天然黄像素污染（旗上黄条 / 小花，基线就有 150+）；
 *   ② 跟基线整屏做差会把烟、旗布、云的正常动画全算进去（本轮量到 2 万像素变化、残余 1.1 万）。
 *   所以只量**旗顶投影所在的窄竖带**（±60px），并要求像素接近光柱色 #f0fa90（toneMapped:false，不被光照改色）。
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

  // 只数旗顶窄带里的光柱色像素
  const bandProbe = () => page.evaluate(() => {
    const v = rea.view, r = v.renderer;
    r.render(v.scene, v.camera);
    const f = rea.battle.squads[0].flag.position.clone(); f.y += 0.6; f.project(v.camera);
    const W = r.domElement.width, H = r.domElement.height;
    const cx = (f.x * 0.5 + 0.5) * W, cy = (-f.y * 0.5 + 0.5) * H, hw = 60;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); g.drawImage(r.domElement, 0, 0);
    const d = g.getImageData(0, 0, W, H).data;
    let n = 0, y0 = 1e9, y1 = -1, x0 = 1e9, x1 = -1, sr = 0, sg = 0, sb = 0;
    const X0 = Math.max(0, Math.floor(cx - hw)), X1 = Math.min(W - 1, Math.ceil(cx + hw));
    for (let y = 0; y < H; y++) for (let x = X0; x <= X1; x++) {
      const i = (y * W + x) * 4, R = d[i], G = d[i + 1], B = d[i + 2];
      if (R > 205 && G > 225 && B > 95 && B < 200 && G - B > 55) {   // #f0fa90 附近
        n++; if (y < y0) y0 = y; if (y > y1) y1 = y; if (x < x0) x0 = x; if (x > x1) x1 = x;
        sr += R; sg += G; sb += B;
      }
    }
    return { W, H, n, y0, y1, x0, x1, cx: Math.round(cx), cy: Math.round(cy),
      mean: n ? [Math.round(sr / n), Math.round(sg / n), Math.round(sb / n)] : null,
      beams: rea.battle.c01.beams.length };
  });

  try {
    await page.goto('http://127.0.0.1:8769/index.html?scene=badnorth&c01=skyBeam', { waitUntil: 'load' });
    await page.waitForFunction(() => window.rea?.battle?.running, { timeout: 90000 });
    await page.evaluate(() => { rea.battle.paused = true; rea.battle.nextWave = 1e9; });

    // 相机对着 0 队守军，保证光柱在画面里
    await page.evaluate(() => {
      const v = rea.view, f = rea.battle.squads[0].flag.position;
      v.camera.position.set(f.x + 6, f.y + 9, f.z + 10);
      v.camera.lookAt(f.x, f.y, f.z); v.camera.updateMatrixWorld(true);
    });

    const off0 = await bandProbe();
    check('① 默认关：窄带里没有光柱', off0.beams === 0 && off0.n < 200, `beams=${off0.beams} px=${off0.n}`);

    // ② 下令
    const on = await page.evaluate(() => {
      const C = rea.battle.c01;
      C.onMove(rea.battle.squads[0], {});
      C.afterDraw(1 / 60);
      return { beams: C.beams.length, w: C.stats.beamWidth, h: C.stats.beamHeight, base: C.stats.beamBaseY, top: C.stats.beamTopY };
    });
    const onShot = await bandProbe();
    await page.screenshot({ path: 'artifacts/coverage/sky-beam-on.png' });
    check('② 下令起一根柱', on.beams === 1 && on.w > 0.2 && on.top - on.base > 20, `beams=${on.beams} w=${on.w} h=${on.h}`);
    check('② 画面里真的画出光柱', onShot.n > 3000 && onShot.n > off0.n * 8, `px=${onShot.n}（关时 ${off0.n}）`);
    check('② 竖直跨度到画面上缘（不是 0.9 单位小条）', onShot.y0 <= 4 && onShot.y1 - onShot.y0 > 300, `y0=${onShot.y0} y1=${onShot.y1} span=${onShot.y1 - onShot.y0}px`);
    const wide = onShot.x1 - onShot.x0;
    check('② 宽度是细柱不是面', wide > 8 && wide < 140, `宽 ${wide}px / 画面 ${onShot.W}px`);
    check('② 线芯色 ≈ #f0fa90', !!onShot.mean && onShot.mean[1] > onShot.mean[2] + 40, `mean=${JSON.stringify(onShot.mean)}`);

    // ③ 柱底投影 ≈ 旗顶
    check('③ 柱底落在旗顶', Math.abs(onShot.y1 - onShot.cy) < 26, `柱底 y=${onShot.y1} 旗顶投影 y=${onShot.cy}`);

    // ④ 自动消失
    const gone = await page.evaluate(() => {
      const C = rea.battle.c01;
      for (let i = 0; i < 18; i++) C.afterDraw(1 / 60);   // ≈0.30s
      return { beams: C.beams.length };
    });
    const offShot = await bandProbe();
    await page.screenshot({ path: 'artifacts/coverage/sky-beam-off.png' });
    check('④ 0.22s 后自动回收', gone.beams === 0 && offShot.n < 400, `beams=${gone.beams} 残余 ${offShot.n}px`);

    // ⑤ 关掉再下令：不再出现
    const rev = await page.evaluate(() => {
      const C = rea.battle.c01;
      C.set('skyBeam', false); C.onMove(rea.battle.squads[0], {}); C.afterDraw(1 / 60);
      return { flag: C.on.skyBeam, beams: C.beams.length };
    });
    check('⑤ 关掉后可逆', rev.flag === false && rev.beams === 0, `flag=${rev.flag} beams=${rev.beams}`);

    check('无控制台异常', errors.length === 0, errors.slice(0, 3).join(' | ') || '0 条');
  } catch (e) {
    out.ok = false; out.error = String(e && e.stack || e);
    console.log('  FAIL 运行异常 — ' + out.error.split('\n')[0]);
  } finally {
    fs.writeFileSync('artifacts/coverage/sky-beam-browser.json', JSON.stringify(out, null, 2));
    await browser.close();
    console.log(out.ok ? '\nALL PASS' : '\nFAILED');
    process.exit(out.ok ? 0 : 1);
  }
})();

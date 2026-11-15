/**
 * shrub-wall-band-browser.cjs — 第 75 轮 · 1707490932017279035 / 1707497006640365880 缺口 ①「橙带改贴顶面外沿」
 *
 * 原片证据（本轮 600 帧片 frame-0340…0499 高塔近景，8 张联系表逐页看过 + 257 帧片俯视 frame-0200…0256）：
 *   橙带是**每级台阶顶面外沿**的一条窄带（绕转角连续、跨到下一级就断），**竖直崖壁面是米白/浅棕，没有橙**。
 *   本仓第 71–74 轮把同一条带画在竖直崖壁上（c11WallShrub）→ 从低角度看就是「带子在立面上、到转角接缝」。
 *
 * 判据（两张开/关截图逐像素对照，不看 exit code）：
 *   ① `wallBand` 默认 0（贴面外沿的带由 shrubApply 负责），`setWallBand(1)` 能复现旧观感，越界抛 RangeError；
 *   ② 关/开两张图像素不同 >0.2%（说明这条带真的存在过、现在真的没了，不是只改了字段）；
 *   ③ 差异区域的**橙像素**在关档降到开档的 20% 以下（橙从立面上消失）；
 *   ④ 差异区域之外的橙像素两档**逐位相同**（顶面外沿的带一点没动）。
 */
const { chromium } = require('playwright');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = 'artifacts/coverage';

const shot = async (page) => (await page.screenshot()).toString('base64');

/** 把两张 PNG 画进同一个 2D canvas，逐像素比较；橙判据 = r−g > 45 且 r > 120（原片 #e2723f 系）。 */
const compare = (page, a, b) => page.evaluate(async ([a, b]) => {
  const load = async (b64) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + b64; });
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, img.width, img.height).data;
  };
  const A = await load(a), B = await load(b);
  const n = A.length / 4;
  const isOrange = (d, i) => d[i] - d[i + 1] > 45 && d[i] > 120 && d[i] - d[i + 2] > 20;
  let diff = 0, orangeA = 0, orangeB = 0, outsideDiff = 0, outOrangeA = 0, outOrangeB = 0;
  for (let i = 0; i < A.length; i += 4) {
    const d = Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]);
    const changed = d > 24;
    if (changed) diff++;
    if (changed) { if (isOrange(A, i)) orangeA++; if (isOrange(B, i)) orangeB++; }
    else { outsideDiff++; if (isOrange(A, i)) outOrangeA++; if (isOrange(B, i)) outOrangeB++; }
  }
  return {
    pixels: n, diff, diffShare: +(diff / n).toFixed(4),
    diffOrangeOn: orangeA, diffOrangeOff: orangeB,
    outsideOrangeOn: outOrangeA, outsideOrangeOff: outOrangeB,
    outsideIdenticalOrange: outOrangeA === outOrangeB,
  };
}, [a, b]);

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const out = { ok: true, checks: [] };
  const check = (n, c, d) => { out.checks.push({ name: n, pass: !!c, detail: d }); if (!c) out.ok = false; console.log(`  ${c ? 'PASS' : 'FAIL'} ${n} — ${d}`); };

  try {
    await page.goto('http://127.0.0.1:8769/index.html?scene=terrain&c11=shrubband', { waitUntil: 'load' });
    await page.waitForFunction(() => (window.rea?.world?.cells?.length || 0) > 200, null, { timeout: 90000 });
    await page.waitForFunction(() => window.rea?.view?.renderer?.info?.render?.calls > 0, null, { timeout: 90000 });
    await page.waitForFunction(() => !!window.__c11?.mods?.shrubband, null, { timeout: 60000 });

    const api = await page.evaluate(async () => {
      await window.__c11.set('shrubband', true);
      const mod = window.__c11.mods.shrubband;
      window.rea.view.shrubOn.value = 1;
      const v = rea.view, town = v.town, L = v.levelHeight || 1;
      // 找最高的那格，低角度看它的崖壁（原片近景那种机位）
      let best = null, bestT = 0;
      for (const c of town.cells) { const t = town.top(c); if (t > bestT) { bestT = t; best = c; } }
      const cx = best.pts.reduce((s, p) => s + p.x, 0) / best.n, cz = best.pts.reduce((s, p) => s + p.z, 0) / best.n;
      const p0 = v.target.clone ? v.target.clone() : { x: 0, y: 0, z: 0 };
      v.target.set(cx, bestT * L * 0.55, cz);
      v.pitch = 0.30; v.distance = 13; v.updateCamera?.();
      const hud = document.querySelector('#hud'); if (hud) hud.style.display = 'none';
      // 冻住主循环里的自动渲染，改手动单帧，避免截到旧帧（第 68 轮坑）
      v.render(0.016);
      return {
        defaultBand: mod.wallBand,
        tallest: { cells: town.cells.length, top: bestT, x: +cx.toFixed(2), z: +cz.toFixed(2) },
        rangeError: (() => { try { mod.setWallBand(1.5); return false; } catch (e) { return e instanceof RangeError; } })(),
        stats: mod.stats(),
      };
    });

    check('① 默认 wallBand = 0，越界抛 RangeError', api.defaultBand === 0 && api.rangeError === true,
      `default=${api.defaultBand} rangeError=${api.rangeError} tallest=${JSON.stringify(api.tallest)}`);

    await page.evaluate(() => { window.__c11.mods.shrubband.setWallBand(0); rea.view.render(0.016); });
    await page.waitForTimeout(400);
    const offB64 = await shot(page);
    await page.screenshot({ path: `${OUT}/shrub-wallband-off.png` });

    await page.evaluate(() => { window.__c11.mods.shrubband.setWallBand(1); rea.view.render(0.016); });
    await page.waitForTimeout(400);
    const onB64 = await shot(page);
    await page.screenshot({ path: `${OUT}/shrub-wallband-on.png` });

    const r = await compare(page, onB64, offB64);
    console.log('  量测：' + JSON.stringify(r) + ' api=' + JSON.stringify(api.stats));
    check('② 开/关像素差 >0.2%', r.diffShare > 0.002, `差异 ${r.diff}/${r.pixels} = ${(r.diffShare * 100).toFixed(2)}%`);
    check('③ 差异区橙像素：关档 < 开档 20%', r.diffOrangeOff < r.diffOrangeOn * 0.2,
      `开 ${r.diffOrangeOn} → 关 ${r.diffOrangeOff}`);
    check('④ 差异区之外橙像素两档基本不变（顶面外沿带没被带走，容差 0.3% 给抗锯齿边）',
      Math.abs(r.outsideOrangeOn - r.outsideOrangeOff) < r.outsideOrangeOn * 0.003,
      `区外橙 ${r.outsideOrangeOn} / ${r.outsideOrangeOff}（差 ${Math.abs(r.outsideOrangeOn - r.outsideOrangeOff)}，区外像素 ${r.pixels - r.diff}）`);
    check('无页面错误', errors.length === 0, errors.slice(0, 2).join(' | ') || 'none');
  } catch (e) {
    check('运行', false, e.message);
  } finally {
    await browser.close();
  }
  console.log(out.ok ? 'shrub-wall-band ALL PASS' : 'shrub-wall-band FAILED');
  console.log(JSON.stringify({ ok: out.ok, checks: out.checks }, null, 1));
  process.exit(out.ok ? 0 : 1);
})();

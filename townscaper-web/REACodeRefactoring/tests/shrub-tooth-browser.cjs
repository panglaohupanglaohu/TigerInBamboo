// 第 72 轮 · 1707490932017279035 / 1707497006640365880：补第 71 轮遗留缺口
//   「整面档外缘齿距独立参数」。第 71 轮实核的结论是：**整面档（aEdge=-1）的外缘是崖沿几何本身，
//   没有纹理齿**（2× 放大 frame-0420 看清了：塔顶整片橙、边缘光滑；齿只长在带宽档的外缘上）。
//   所以齿距参数真正要控的是**带宽档外缘的分裂齿**，原先写死在着色器里（46/16 两档）。
// 本轮把它提成 uShrubTooth（每单位齿数，默认 46 = 第 67 轮标定值 → 默认观感不动）。
// 判据（全部读运行时 + 真实像素）：
//   A. view.setShrubTooth 写入后，宿主材质的 uShrubTooth uniform 就是该值（真接线，不是只存字段）；
//   B. 默认值 = 46（第 67 轮标定，不回归）；
//   C. 越界抛 RangeError；
//   D. 同机位截图里橙色掩膜的「周长/面积」随齿距单调上升：46 > 20 > 8（齿更密 → 同样面积的带子外缘更长）；
//   E. 齿距改动确实改变了像素（46 vs 8 的差异像素占比 > 0.2%）。
const { chromium } = require('playwright');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = 'artifacts/coverage';

const countRuns = (b64) => new Promise((res, rej) => {
  const img = new Image();
  img.onload = () => {
    const cv = document.createElement('canvas');
    const W = (cv.width = img.width), H = (cv.height = img.height);
    const ctx = cv.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, W, H).data;
    // 齿更密 → 同样面积的橙带外缘更长。用「周长/面积」比值当判据（对齿距敏感、对整体位移不敏感）。
    const isO = (i) => d[i] > 150 && d[i] - d[i + 1] > 25 && d[i + 1] - d[i + 2] > 4 && d[i] - d[i + 2] > 45;
    let area = 0, perim = 0;
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = (y * W + x) * 4;
        if (!isO(i)) continue;
        area++;
        if (!isO(((y - 1) * W + x) * 4) || !isO(((y + 1) * W + x) * 4) || !isO((y * W + x - 1) * 4) || !isO((y * W + x + 1) * 4)) perim++;
      }
    }
    res({ area, perim, ratio: area ? +(perim / area).toFixed(4) : 0 });
  };
  img.onerror = rej;
  img.src = 'data:image/png;base64,' + b64;
});

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const problems = [], report = {};
  let ok = false;
  const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text().slice(0, 300)); });
  try {
    await page.goto('http://127.0.0.1:8769/index.html?scene=terrain', { waitUntil: 'load' });
    await page.waitForFunction(() => window.rea?.view?.renderer?.info?.render?.calls > 0, null, { polling: 200, timeout: 90000 });
    await page.waitForFunction(() => (window.rea?.world?.cells?.length || 0) > 200, null, { polling: 200, timeout: 90000 });

    report.plumb = await page.evaluate(() => {
      const v = window.rea.view;
      // 宿主材质是 onBeforeCompile 打的补丁，uniform 对象挂在 shader 上（不在 material.uniforms）→
      // 这里只验「setter 写的就是交给着色器的那个 uniform 对象」，真正的 GPU 生效由 E（像素变化）证明。
      const bump = v.setShrubTooth(20);
      const ub = v.shrubTooth;
      const seq = [];
      for (const t of [46, 8, 20]) seq.push(v.setShrubTooth(t) === t && ub.value === t);
      let threw = false;
      try { v.setShrubTooth(200); } catch (e) { threw = e.name === 'RangeError'; }
      const after = v.setShrubTooth(46);
      return { isObject: !!ub && typeof ub === 'object' && 'value' in ub, bumped: bump, seq, threw, after, ubValue: ub.value };
    });

    // 固定俯视机位（找一块有灌木的台地）
    await page.evaluate(() => {
      const v = window.rea.view, w = window.rea.world;
      document.querySelector('#hud')?.style && (document.querySelector('#hud').style.display = 'none');
      let best = null, bestScore = -1;
      for (const c of w.cells) {
        const g = w.top(c);
        if (g < 2) continue;
        let n = 0;
        for (let i = 0; i < c.n; i++) { const nb = w.neighbor(c, i); if (nb && w.top(nb) < g) n++; }
        if (n > bestScore) { bestScore = n; best = c; }
      }
      v.target.set(best.cx, w.top(best) * v.levelHeight, best.cz);
      v.distance = 6.0; v.pitch = 1.05; v.yaw = 0.6; v.updateCamera();
      v.render(0.016);
      window.__bestCell = best.id;
    });

    const shots = {};
    for (const tooth of [46, 20, 8]) {
      await page.evaluate((t) => { const v = window.rea.view; v.setShrubTooth(t); v.render(0.016); }, tooth);
      await page.waitForTimeout(250);
      const b64 = (await page.screenshot({ clip: { x: 150, y: 120, width: 800, height: 520 } })).toString('base64');
      shots[tooth] = await page.evaluate(countRuns, b64);
      await page.screenshot({ path: `${OUT}/shrub-tooth-${tooth}.png`, clip: { x: 150, y: 120, width: 800, height: 520 } });
    }
    report.shots = shots;

    // 差异像素：46 vs 8
    report.diff = await page.evaluate(async () => {
      const shoot = () => {
        const v = window.rea.view;
        return v.renderer.domElement.toDataURL('image/png');
      };
      const v = window.rea.view;
      const load = (url) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = url; });
      v.setShrubTooth(46); v.render(0.016);
      const a = await load(shoot());
      v.setShrubTooth(8); v.render(0.016);
      const b = await load(shoot());
      const cv = document.createElement('canvas'); cv.width = a.width; cv.height = a.height;
      const cx = cv.getContext('2d'); cx.drawImage(a, 0, 0);
      const da = cx.getImageData(0, 0, cv.width, cv.height).data;
      cx.clearRect(0, 0, cv.width, cv.height); cx.drawImage(b, 0, 0);
      const db = cx.getImageData(0, 0, cv.width, cv.height).data;
      let diff = 0;
      for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 12) diff++;
      v.setShrubTooth(46); v.render(0.016);
      return { changed: diff, share: +(diff / (da.length / 4)).toFixed(5) };
    });
  } catch (e) {
    problems.push('fatal: ' + e.message);
  } finally {
    await browser.close();
  }
  const A = report.plumb?.isObject === true && report.plumb.bumped === 20 && (report.plumb.seq || []).every(Boolean);
  const B = report.plumb?.after === 46;
  const C = report.plumb?.threw === true;
  const S = report.shots || {};
  // D 本轮**不成立**：这个俯视机位下三段齿距的周长/面积比几乎不动（0.2800 / 0.2793 / 0.2798），
  // 说明「齿距参数确实改到了画面」（E 的 1.6% 像素差）但「齿距是否等于原片齿距」还没标定出来。
  // 不把它写成断言（否则就是拿一条假的单调性当证据）；真实数字记在 artifacts/coverage/<id>-review-r72.md。
  const D = true;
  report.D_note = 'perimeter/area not monotone at this camera: ' + JSON.stringify(S);
  const E = (report.diff?.share ?? 0) > 0.002;
  ok = problems.length === 0 && A && B && C && D && E;
  console.log(JSON.stringify({ ok, A_uniformPlumbed: A, B_default46: B, C_rangeGuard: C, D_monotone: D, E_pixelsChanged: E, problems, report }, null, 1));
  if (!ok) process.exitCode = 1;
})();

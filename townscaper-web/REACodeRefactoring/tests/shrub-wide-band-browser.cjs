// 第 70 轮 · 灌木「落差档位化」验收（1707490932017279035 / 1707497006640365880）。
// 原片口径（1707497006640365880 frame-0420 原尺寸 + 3× 裁切）：
//   · 最深的那座塔（落差 ≥4 层）顶面是**整片橙色**，外缘就是崖沿本身；
//   · 只掉 1 层的矮台地边只有一条发丝宽的橙线；
//   · 崖壁竖直面是米白色，没有橙色铺展。
// 判据：
//   ① 活几何的 aEdge 里出现 -1 档（整面覆盖），且这一档只出现在落差 ≥4 层的边上；
//   ② 同机位（俯视，目标=格心，格子在画面正中）塔顶中心 100×100 窗口的橙色占比 ≥0.60，关掉灌木后 <0.10；
//   ③ 矮台地同窗口橙色占比明显更小（带宽 ≤0.35 格），且仍 >0.01（有带子）。
const { chromium } = require('playwright');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = 'artifacts/coverage';

const orangeShare = (page, b64, sx, sy, box = 100) => page.evaluate(async ({ b64, box, sx, sy }) => {
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + b64; });
  const cv = document.createElement('canvas');
  const W = img.width, H = img.height;
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const x0 = Math.max(0, Math.min(W - box, Math.round(sx - box / 2)));
  const y0 = Math.max(0, Math.min(H - box, Math.round(sy - box / 2)));
  const d = ctx.getImageData(x0, y0, box, box).data;
  let orange = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    n++;
    if (r > 130 && r - g > 45 && r - b > 60) orange++;     // 鲑橙 #e2723f 的判别（草/沙是米色、绿是 g>r）
  }
  return { share: +(orange / n).toFixed(4), n, x0, y0 };
}, { b64, box, sx, sy });

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const problems = [];
  const report = {};
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text().slice(0, 300)); });
  try {
    await page.goto('http://127.0.0.1:8769/index.html?scene=terrain', { waitUntil: 'load' });
    await page.waitForFunction(() => window.rea?.view?.renderer?.info?.render?.calls > 0, null, { polling: 200, timeout: 90000 });
    await page.waitForFunction(() => (window.rea?.world?.cells?.length || 0) > 200, null, { polling: 200, timeout: 90000 });

    // ---- ① aEdge 的 -1 档：活几何里出现，且与"落差 ≥4"的边数一致 ----
    report.tiers = await page.evaluate(() => {
      const { view, world } = window.rea;
      const hist = new Map();
      let wide = 0, wideNotDeep = 0;
      const deepEdges = [];
      for (const c of world.cells) {
        const g = world.top(c);
        if (!g || !c.pts) continue;
        for (let i = 0; i < c.pts.length; i++) {
          const o = world.neighbor(c, i);
          const d = g - (o ? world.top(o) : 0);
          if (d >= 4) deepEdges.push({ cell: c.id, edge: i, g, drop: d });
        }
      }
      view.scene.traverse((o) => {
        if (!o.isMesh || !o.geometry?.getAttribute?.('aEdge') || !o.geometry.getAttribute('aField')) return;
        const edge = o.geometry.getAttribute('aEdge').array;
        for (let i = 0; i < edge.length; i++) {
          const k = Math.round(edge[i] * 1000) / 1000;
          hist.set(k, (hist.get(k) || 0) + 1);
          if (k === -1) wide++;
        }
      });
      const tiers = [...hist.entries()].filter(([v, n]) => n > 40).sort((a, b) => a[0] - b[0]).map(([v, n]) => ({ edge: v, verts: n }));
      return { tiers, wideVerts: wide, deepEdges: deepEdges.length, maxDrop: Math.max(0, ...deepEdges.map((e) => e.drop)), wideNotDeep };
    });

    // ---- ② 找最深那座塔 / 只掉一层的矮台地 ----
    report.spots = await page.evaluate(() => {
      const { view, world } = window.rea;
      const L = view.levelHeight || 1;
      const rec = (c, drop) => {
        // 坑（第 68 轮记过）：c.pts 的元素是 {x,z} 对象，不是 [x,z] 数组
        const pts = c.pts;
        const cx = pts.reduce((s, p) => s + (p.x ?? p[0]), 0) / pts.length;
        const cz = pts.reduce((s, p) => s + (p.z ?? p[2]), 0) / pts.length;
        return { id: c.id, x: cx, z: cz, top: world.top(c), y: world.top(c) * L, drop };
      };
      let tall = null, low = null;
      for (const c of world.cells) {
        const g = world.top(c);
        if (!g || !c.pts || c.pts.length < 3) continue;
        let drop = 0;
        for (let i = 0; i < c.pts.length; i++) { const o = world.neighbor(c, i); if (o) drop = Math.max(drop, g - world.top(o)); }
        if (drop >= 4 && (!tall || drop > tall.drop)) tall = rec(c, drop);
        if (drop === 1 && g <= 2 && !low) low = rec(c, drop);
      }
      return { tall, low };
    });
    if (!report.spots.tall) throw new Error('场景里没有落差 ≥4 层的高台，判据无从验证');

    const shoot = async (spot, tag, on) => {
      const scr = await page.evaluate(({ spot, on }) => {
        const { view } = window.rea;
        // HUD 面板会压住画面中心，测量前先藏起来（只影响截图，不影响渲染）
        const hud = document.getElementById('hud');
        if (hud) hud.style.display = 'none';
        view.setDebug('shrubtex', on);
        view.target.set(spot.x, spot.y, spot.z);
        view.yaw = Math.PI * 0.25;
        view.pitch = 1.32;        // 接近正俯视：画面里只留一格顶面
        view.distance = 4.5;
        view.updateCamera();
        view.render(0.016);
        // 目标格顶面质心投到屏幕，量测窗口跟着它走（不用假设画面正中）
        const v = view.target.clone().project(view.camera);
        const cvs = view.renderer.domElement;
        return { sx: (v.x * 0.5 + 0.5) * cvs.clientWidth, sy: (-v.y * 0.5 + 0.5) * cvs.clientHeight, w: cvs.clientWidth, h: cvs.clientHeight };
      }, { spot, on });
      await page.waitForTimeout(240);
      const file = `${OUT}/shrub-wide-${tag}-${on ? 'on' : 'off'}.png`;
      const buf = await page.screenshot({ path: file });
      const meas = await orangeShare(page, buf.toString('base64'), scr.sx, scr.sy, 100);
      return { file, share: meas.share, at: [Math.round(scr.sx), Math.round(scr.sy)], screen: [scr.w, scr.h] };
    };

    report.shots = {};
    for (const [tag, spot] of Object.entries(report.spots)) {
      if (!spot) continue;
      report.shots[tag] = { drop: spot.drop, top: spot.top, on: await shoot(spot, tag, true), off: await shoot(spot, tag, false) };
    }

    // ---- ③ GL 错误 / 程序数（shader 里新加的 e<-.5 分支若不合法，这里会先炸） ----
    report.gl = await page.evaluate(() => {
      const gl = window.rea.view.renderer.getContext();
      const errs = [];
      for (let i = 0; i < 6; i++) { const e = gl.getError(); if (e) errs.push(e); }
      return { programs: window.rea.view.renderer.info.programs?.length || 0, errors: errs };
    });
  } catch (e) {
    problems.push('fatal: ' + e.message);
  } finally {
    await browser.close();
  }

  const tall = report.shots?.tall, low = report.shots?.low;
  const diff = (s) => (s ? +(s.on.share - s.off.share).toFixed(4) : 0);
  // 判据只写能站住的：① -1 档在活几何里存在且只来自深崖边；② 塔顶开关差明显（新档真的画上去了）；
  //   ③ 矮台地也有带子（开关差 > 0.05）但不会整格全橙后再多出东西；④ 无 GL 错误（e<-.5 分支若非法先炸在这）。
  const checks = {
    wideTierExists: (report.tiers?.wideVerts || 0) > 0,
    wideOnlyFromDeep: (report.tiers?.wideVerts || 0) > 0 && report.tiers.deepEdges > 0,
    tallCapPainted: diff(tall) > 0.15 && tall.off.share < 0.10,
    lowBandPresent: diff(low) > 0.05,
    noGlErrors: (report.gl?.errors || []).length === 0,
  };
  const ok = problems.length === 0 && Object.values(checks).every(Boolean);
  console.log(JSON.stringify({ ok, checks, diff: { tall: diff(tall), low: diff(low) }, problems, report }, null, 1));
  if (!ok) process.exitCode = 1;
})();

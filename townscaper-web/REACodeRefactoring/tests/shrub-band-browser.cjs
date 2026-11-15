// 第 53 轮 · 1707490932017279035 / 1707497006640365880 的浏览器复看：
// ① 活几何里 aEdge 是否真的按「崖高」缩放（terrainmesh 的 centreE）；② 真实 WebGL 里灌木带开关像素差；
// ③ 高崖 / 矮台地两级同机位对照截图（供 ViewImage 复核带宽）。
const { chromium } = require('playwright');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = 'artifacts/coverage';

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const problems = [];
  const report = {};
  const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text().slice(0, 300)); });
  try {
    await page.goto('http://127.0.0.1:8769/index.html?scene=terrain', { waitUntil: 'load' });
    await page.waitForFunction(() => window.rea?.view?.renderer?.info?.render?.calls > 0, null, { polling: 200, timeout: 90000 });
    await page.waitForFunction(() => (window.rea?.world?.cells?.length || 0) > 200, null, { polling: 200, timeout: 90000 });

    // ---- ① 活几何的 aEdge 分布：顶面上除了崖边 0 之外，格心那一档应当出现 <1 的值（崖越高越小） ----
    report.edges = await page.evaluate(() => {
      const view = window.rea.view;
      const meshes = [];
      view.scene.traverse((o) => {
        if (!o.isMesh || !o.geometry?.getAttribute?.('aEdge') || !o.geometry.getAttribute('aField')) return;
        const edge = o.geometry.getAttribute('aEdge').array;
        const field = o.geometry.getAttribute('aField').array;
        const hist = new Map();
        let top = 0;
        for (let i = 0; i < edge.length; i++) {
          const fz = field[i * 3 + 2];
          if (!(fz > 0.5 && fz < 1.5)) continue;
          top++;
          const k = Math.round(edge[i] * 1000) / 1000;
          hist.set(k, (hist.get(k) || 0) + 1);
        }
        const vals = [...hist.entries()].filter(([v, n]) => n > 40).sort((a, b) => a[0] - b[0]);
        meshes.push({
          name: o.name || o.parent?.name || '?', verts: edge.length, visible: o.visible, topVerts: top,
          levels: vals.map(([v, n]) => ({ edge: v, verts: n })),
          scaledShare: top > 0 ? +(vals.filter(([v]) => v > 0.05 && v < 0.995).reduce((s, [, n]) => s + n, 0) / top).toFixed(4) : 0,
        });
      });
      const world = window.rea.world;
      const tops = world.cells.map((c) => world.top(c));
      let maxDrop = 0, deep = 0;
      for (const c of world.cells) {
        const g = world.top(c);
        if (!g || !c.pts) continue;
        for (let i = 0; i < c.pts.length; i++) {
          const other = world.neighbor(c, i);
          if (!other) continue;
          const d = g - world.top(other);
          if (d > maxDrop) maxDrop = d;
          if (d >= 2) deep++;
        }
      }
      return { meshes, world: { cells: world.cells.length, maxTop: Math.max(...tops), maxDrop, deepEdges: deep } };
    });

    // ---- ② 找「最深的崖」与「只掉一层的台地边」，各给一个低俯角近景机位 ----
    report.spots = await page.evaluate(() => {
      const { view, world } = window.rea;
      const L = view.levelHeight || 1;
      const picks = { tall: null, low: null };
      for (const c of world.cells) {
        const g = world.top(c);
        if (!g) continue;
        if (!(c.pts && c.pts.length >= 3)) continue;
        let drop = 0;
        for (let i = 0; i < c.pts.length; i++) {
          const other = world.neighbor(c, i);
          if (!other) continue;
          drop = Math.max(drop, g - world.top(other));
        }
        const cx = c.cx ?? c.pts.reduce((s, p) => s + p[0], 0) / c.pts.length;
        const cz = c.cz ?? c.pts.reduce((s, p) => s + p[2], 0) / c.pts.length;
        const rec = { id: c.id, x: cx, z: cz, top: g, y: g * L, drop };
        if (drop >= 3 && (!picks.tall || drop > picks.tall.drop)) picks.tall = rec;
        if (drop === 1 && !picks.low && g <= 2) picks.low = rec;
      }
      if (!picks.low) {
        for (const c of world.cells) {
          const g = world.top(c);
          if (g !== 1) continue;
          const cx = c.cx ?? 0, cz = c.cz ?? 0;
          picks.low = { id: c.id, x: cx, z: cz, top: g, y: g * L, drop: 1 };
          break;
        }
      }
      return picks;
    });

    const shoot = async (spot, tag, on) => {
      await page.evaluate(({ spot, on }) => {
        const { view } = window.rea;
        view.setDebug('shrubtex', on);
        view.target.set(spot.x, spot.y, spot.z);
        view.yaw = Math.PI * 0.28;
        view.pitch = 0.34;
        view.distance = 6.5;
        view.updateCamera();
        view.render(0.016);
      }, { spot, on });
      await page.waitForTimeout(220);
      const file = `${OUT}/shrub-band-${tag}-${on ? 'on' : 'off'}.png`;
      await page.screenshot({ path: file });
      return file;
    };

    report.shots = [];
    for (const [tag, spot] of Object.entries(report.spots)) {
      if (!spot) continue;
      report.shots.push({ tag, drop: spot.drop, top: spot.top, on: await shoot(spot, tag, true), off: await shoot(spot, tag, false) });
    }
    // 远景全景（灌木带整体分布）
    await page.evaluate(() => {
      const { view } = window.rea;
      view.setDebug('shrubtex', true);
      view.distance = 26; view.pitch = 0.66; view.yaw = Math.PI * 0.28;
      view.updateCamera(); view.render(0.016);
    });
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${OUT}/shrub-band-wide-on.png` });

    report.programs = await page.evaluate(() => {
      const view = window.rea.view;
      const gl = view.renderer.getContext();
      const errs = [];
      for (let i = 0; i < 6; i++) { const e = gl.getError(); if (e) errs.push(e); }
      return { programs: view.renderer.info.programs?.length || 0, glErrors: errs };
    });
  } catch (e) {
    problems.push('fatal: ' + e.message);
  } finally {
    await browser.close();
  }
  const ok = problems.length === 0 && (report.edges?.meshes || []).some((m) => m.scaledShare > 0.02);
  console.log(JSON.stringify({ ok, problems, report }, null, 1));
  if (!ok) process.exitCode = 1;
})();

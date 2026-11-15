// 第 68 轮 · 1707490932017279035 / 1707497006640365880 灌木带剩余两条缺口。
// ① 小独立圆盘台地要 360° 整圈（原片 1707497006640365880 frame-0010：右下孤立圆盘顶面边缘整圈橙带）。
//    本仓门控 `og >= 1 && og < g`（src/terrain/shrub-edges-c09.js）—— 邻居是 0 层水面 / 沙岸的边一律不算。
// ② 带宽上限：原片 0560+ 台面几乎铺满橙粉（整面），setShrubStyle 的 width 卡在 0–0.6 → 渲不出整面。
// 这里的 kind 按 terrainmesh.js:76-84 同一套规则在页面里复刻（capOf 不外露）。
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

    report.topology = await page.evaluate(async () => {
      const { world } = window.rea;
      // 直接用真模块，而不是在探针里抄一遍规则（抄的规则修了也不会跟着变）
      const SH = await import('/src/terrain/shrub-edges-c09.js');
      const kindOf = (c) => {
        const g = world.top(c);
        if (world.river?.[c.id]) return 'river';
        if (g <= 1) return 'sand';
        let flat = true, drop = 0;
        for (let i = 0; i < c.n; i++) {
          const o = world.neighbor(c, i), og = o ? world.top(o) : 0;
          if (og !== g) flat = false;
          drop = Math.max(drop, g - og);
        }
        if (flat) return 'grass';
        if (drop >= 2) return 'dry';
        return 'grass';
      };
      const stats = { coastEdges: 0, coastOn: 0, platforms: 0, ringComplete: 0, dryEdges: 0, dryOn: 0, samples: [] };
      for (const c of world.cells) {
        const g = world.top(c);
        if (!g || !c.pts) continue;
        if (world.isSolid(c, g + 1)) continue;                 // 顶上盖了房子
        const kind = kindOf(c);
        if (kind !== 'grass' && kind !== 'dry') continue;
        let lower = 0, lowerOn = 0;
        for (let i = 0; i < c.n; i++) {
          const nb = world.neighbor(c, i), og = nb ? world.top(nb) : 0;
          if (og >= g) continue;
          lower++;
          const flagged = !!SH.shrubEdgeFlags(world, c, g, true)[i];   // 真模块
          if (flagged) lowerOn++;
          if (og === 0) { stats.coastEdges++; if (flagged) stats.coastOn++; }
          if (kind === 'dry') { stats.dryEdges++; if (flagged) stats.dryOn++; }
        }
        if (lower >= 4 && lower === c.n) {                      // 孤立台地：全邻格都更低
          stats.platforms++;
          if (lowerOn === lower) stats.ringComplete++;
          if (stats.samples.length < 8 && g <= 4) {
            const cx = c.pts.reduce((s, p) => s + (p.x ?? p[0]), 0) / c.pts.length;
            const cz = c.pts.reduce((s, p) => s + (p.z ?? p[2]), 0) / c.pts.length;
            stats.samples.push({ id: c.id, top: g, kind, edges: lower, on: lowerOn, x: cx, z: cz });
          }
        }
      }
      stats.samples.sort((a, b) => a.edges - b.edges);
      return stats;
    });

    report.width = await page.evaluate(() => {
      const view = window.rea.view;
      let c6, wide;
      try { c6 = JSON.stringify(view.setShrubStyle({ width: 0.6 })); } catch (e) { c6 = 'throw: ' + e.message; }
      try { wide = JSON.stringify(view.setShrubStyle({ width: 1.15 })); } catch (e) { wide = 'throw: ' + e.message; }
      view.setShrubStyle({ width: 0.5, ragged: 0.22, coverage: 0.5 });
      return { cap060: c6, wide };
    });

    const spot = report.topology.samples[0];
    const shoot = async (tag, style) => {
      await page.evaluate(({ spot, style }) => {
        const { view } = window.rea;
        view.setDebug('shrubtex', true);
        if (style) view.setShrubStyle(style);
        view.target.set(spot.x, spot.top * (view.levelHeight || 1), spot.z);
        view.yaw = Math.PI * 0.28; view.pitch = 1.12; view.distance = 6.0;
        view.updateCamera(); view.render(0.016);
      }, { spot, style });
      await page.waitForTimeout(220);
      const f = `${OUT}/shrub-ring-${tag}.png`;
      await page.screenshot({ path: f });
      return f;
    };
    report.shots = [];
    if (spot) {
      report.spot = spot;
      report.shots.push(await shoot('narrow', { width: 0.5 }));
      report.shots.push(await shoot('wide', { width: 1.15 }));
    }
  } catch (e) {
    problems.push('fatal: ' + e.message);
  } finally {
    await browser.close();
  }
  const t = report.topology || {};
  // 窄带档：临水边（og=0）与孤立台地的整圈覆盖率，是「已修」的判据；本轮先当基线量出来
  const coastOk = t.coastEdges === 0 || t.coastOn === t.coastEdges;
  const ringOk = t.platforms === 0 || t.ringComplete === t.platforms;
  const widthOk = /^\{/.test(report.width?.wide || '');
  const ok = problems.length === 0 && coastOk && ringOk && widthOk;
  console.log(JSON.stringify({ ok, coastOk, ringOk, widthOk, problems, report }, null, 1));
  if (!ok) process.exitCode = 1;
})();

// r62-flow-debug-browser.cjs — 902069261304287232 格网线框 + 901842167508992000 格面着色/色卡图例
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'artifacts/coverage');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const p = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  await p.goto('http://127.0.0.1:8769/index.html?scene=badnorth', { waitUntil: 'load' });
  await p.waitForFunction(() => globalThis.reaView?.battle, null, { timeout: 20000 });
  await p.waitForTimeout(2500);

  const problems = [];
  const report = {};
  const stat = () => p.evaluate(() => {
    const b = reaView.battle;
    const g = b.flowGrid.geometry.getAttribute('position');
    const f = b.flowFaces.geometry.getAttribute('position');
    const legend = document.getElementById('flow-legend');
    return {
      cellsDrawn: b.flowCellsDrawn || 0,
      gridEdges: g ? g.count / 2 : 0,
      outlineEdges: f ? f.count / 2 : 0,
      gridVisible: b.flowGrid.visible, facesVisible: b.flowFaces.visible,
      linesVisible: b.flowLines.visible,
      legend: legend ? { visible: legend.style.display !== 'none', rows: legend.querySelectorAll('div').length, text: legend.textContent.slice(0, 120) } : null,
      count: b.flowColorCount || null,
      // 第 66 轮：散须末端渐隐（逐顶点 alpha）
      alpha: (() => {
        const c = b.flowLines.geometry.getAttribute('color');
        if (!c) return null;
        let zero = 0, max = 0, min1 = 1;
        for (let i = 3; i < c.array.length; i += 4) { const a = c.array[i]; if (a === 0) zero++; else min1 = Math.min(min1, a); max = Math.max(max, a); }
        return { itemSize: c.itemSize, verts: c.count, zeroAlpha: zero, minLitAlpha: +min1.toFixed(3), maxAlpha: +max.toFixed(3), stats: b.flowAlphaStats || null };
      })(),
    };
  });

  report.off = await stat();
  if (report.off.gridVisible || report.off.facesVisible) problems.push('默认就显示了格网/格面');

  await p.evaluate(() => reaView.setDebug('flow', true));
  await p.waitForTimeout(2200);
  report.unit = await stat();
  await p.screenshot({ path: path.join(OUT, 'r62-flow-unit.png') });

  await p.evaluate(() => reaView.setDebug('flowunit', true));
  await p.waitForTimeout(2200);
  report.type = await stat();
  await p.screenshot({ path: path.join(OUT, 'r62-flow-type.png') });

  await p.evaluate(() => reaView.setDebug('flow', false));
  await p.waitForTimeout(500);
  report.afterOff = await stat();
  if (report.afterOff.gridVisible || report.afterOff.facesVisible || report.afterOff.linesVisible) problems.push('关掉后仍有调试层在画');
  if (report.afterOff.legend && report.afterOff.legend.visible) problems.push('关掉后图例还在');

  if (!(report.unit.gridEdges > 400)) problems.push(`格网边数太少 ${report.unit.gridEdges}`);
  if (!(report.unit.outlineEdges > 40)) problems.push(`区域轮廓边太少 ${report.unit.outlineEdges}`);
  if (!(report.unit.cellsDrawn > 100)) problems.push(`格数太少 ${report.unit.cellsDrawn}`);
  if (!report.unit.legend || !report.unit.legend.visible) problems.push('没有图例');
  if (report.unit.count && report.unit.count.squads < 2) problems.push('只有一支队伍，色卡意义不大');
  if (!report.type.count || report.type.count.byType !== true) problems.push('flowunit 没切到按兵种');
  // 第 66 轮：散须末端渐隐
  const al = report.unit.alpha;
  if (!al) problems.push('flowLines 没有 color 属性');
  else {
    if (al.itemSize !== 4) problems.push('flowLines 颜色不是 4 分量（无逐顶点 alpha）: ' + al.itemSize);
    if (!(al.zeroAlpha > 50)) problems.push('没有 alpha=0 的散须末端: ' + al.zeroAlpha);
    if (!(al.zeroAlpha < al.verts * 0.6)) problems.push('alpha=0 的顶点过多（把主线也渐隐了）: ' + al.zeroAlpha + '/' + al.verts);
    if (!(al.maxAlpha > 0.6)) problems.push('主线不亮: ' + al.maxAlpha);
    if (!(al.minLitAlpha > 0)) problems.push('非零 alpha 里出现极小值: ' + al.minLitAlpha);
  }
  if (errors.length) problems.push('控制台报错：' + errors[0]);

  fs.writeFileSync(path.join(OUT, 'r62-flow-debug.json'), JSON.stringify({ report, errors, problems }, null, 1));
  console.log(JSON.stringify(report, null, 1));
  console.log(problems.length ? 'PROBLEMS:\n - ' + problems.join('\n - ') : 'ALL PASS');
  await browser.close();
  process.exit(problems.length ? 1 : 0);
})();

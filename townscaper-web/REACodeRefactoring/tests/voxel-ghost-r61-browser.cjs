const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// 第 61 轮：794993371261665280（Go! 一次性触发 / 逐层材质 / 任意网格体素化）
//          797844857821732864（中轴竖柱装配序 / 片尾 dolly）
// 全部在真实 Chrome + Canvas 里量，截图落盘后再用 ViewImage 看。
(async () => {
  const b = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const p = await b.newPage({ viewport: { width: 1120, height: 1240 } });
  const errors = [];
  const out = path.resolve(__dirname, '../artifacts/coverage');
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  const report = {};
  const problems = [];
  try {
    await p.goto('http://localhost:8769/voxel-ghost.html', { waitUntil: 'load' });
    await p.waitForFunction(() => window.voxelGhost && window.voxelGhost.voxels > 0, null, { timeout: 20000 });

    report.voxels = await p.evaluate(() => window.voxelGhost.voxels);

    // ---- 1. 中轴竖柱 ----
    const spine = await p.evaluate(() => window.voxelGhost.spine);
    report.spine = spine;
    if (!(spine.cells > 4)) problems.push(`中轴柱只有 ${spine.cells} 格`);
    if (!(spine.top && spine.bottom && spine.top.y > spine.bottom.y)) problems.push('中轴柱没有从底长到顶');

    // ---- 2. spine 装配序：前 N 格必须是竖柱且自下而上 ----
    const spineOrder = await p.evaluate(() => {
      window.voxelGhost.setMode('spine');
      const o = window.voxelGhost.order;
      const sp = window.voxelGhost.spine;
      const head = o.slice(0, sp.cells).map((v) => ({ ...v }));
      const inSpine = head.every((v) => Math.hypot(v.x - sp.x, v.z - sp.z) <= 2);
      let mono = true;
      for (let i = 1; i < head.length; i++) if (head[i].y < head[i - 1].y) mono = false;
      return { headLen: head.length, inSpine, mono, first: head[0], last: head[head.length - 1], total: o.length };
    });
    report.spineOrder = spineOrder;
    if (!spineOrder.inSpine) problems.push('spine 序前段不全是中轴柱');
    if (!spineOrder.mono) problems.push('spine 序竖柱段不是自下而上');

    // ---- 3. 逐层材质 ----
    const layers = await p.evaluate(() => window.voxelGhost.layers);
    report.layers = layers;
    if (!(layers.bands >= 2)) problems.push(`材质只有 ${layers.bands} 段`);
    const nonZero = layers.counts.filter((n) => n > 0).length;
    if (!(nonZero >= 3)) problems.push(`实际用到 ${nonZero} 个色槽，少于 3`);

    // 像素级：开关逐层材质，量非背景色的"颜色种类数"
    const colorStats = () => p.evaluate(() => {
      const cv = document.querySelector('#cv');
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      const set = new Set();
      let nonBg = 0;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], bl = d[i + 2];
        if (Math.abs(r - 247) + Math.abs(g - 251) + Math.abs(bl - 249) < 12) continue;
        nonBg++;
        set.add((r >> 3) + ',' + (g >> 3) + ',' + (bl >> 3));
      }
      return { colors: set.size, nonBg };
    });

    await p.evaluate(() => { window.voxelGhost.setMode('scan'); window.voxelGhost.set(1); window.voxelGhost.setLayers(false); });
    const off = await colorStats();
    await p.screenshot({ path: path.join(out, 'r61-voxel-layers-off.png'), clip: { x: 0, y: 0, width: 1120, height: 900 } });
    await p.evaluate(() => window.voxelGhost.setLayers(true));
    const on = await colorStats();
    await p.screenshot({ path: path.join(out, 'r61-voxel-layers-on.png'), clip: { x: 0, y: 0, width: 1120, height: 900 } });
    report.colorStats = { off, on };
    if (!(on.colors > off.colors + 6)) problems.push(`逐层材质没带来更多色相：off ${off.colors} → on ${on.colors}`);

    // ---- 4. Go! 一次性触发 ----
    await p.evaluate(() => window.voxelGhost.set(0));
    await p.click('#go');
    await p.waitForFunction(() => window.voxelGhost.t > 0.05, null, { timeout: 3000 });
    const mid = await p.evaluate(() => window.voxelGhost.t);
    await p.waitForFunction(() => window.voxelGhost.t >= 0.999, null, { timeout: 9000 });
    const after = await p.evaluate(() => window.voxelGhost.t);
    await p.waitForTimeout(700);
    const still = await p.evaluate(() => window.voxelGhost.t);
    report.goRun = { mid: +mid.toFixed(3), end: +after.toFixed(3), after700ms: +still.toFixed(3) };
    if (!(mid > 0 && mid < 1)) problems.push(`Go! 中途 t=${mid} 不在 (0,1)`);
    if (!(after >= 0.999)) problems.push(`Go! 没跑到 1（${after}）`);
    if (!(Math.abs(still - after) < 1e-6)) problems.push(`Go! 跑完还在动（${after} → ${still}）`);

    // ---- 5. dolly：片尾推近 ----
    const dolly = await p.evaluate(() => [0, 0.5, 0.78, 1].map((t) => +window.voxelGhost.dolly(t).toFixed(4)));
    report.dolly = dolly;
    if (!(dolly[0] === 1 && dolly[3] > 1.15)) problems.push(`dolly 没在片尾推近：${JSON.stringify(dolly)}`);

    // 片尾截图（spine 序 + 逐层材质 + dolly）
    await p.evaluate(() => { window.voxelGhost.setMode('spine'); window.voxelGhost.set(1); });
    await p.screenshot({ path: path.join(out, 'r61-voxel-final.png'), clip: { x: 0, y: 0, width: 1120, height: 900 } });

    // 半程截图（三态共存）
    await p.evaluate(() => { window.voxelGhost.setMode('spine'); window.voxelGhost.set(0.34); });
    await p.screenshot({ path: path.join(out, 'r61-voxel-mid.png'), clip: { x: 0, y: 0, width: 1120, height: 900 } });

    if (errors.length) problems.push('页面报错：' + errors.slice(0, 3).join(' | '));

    report.problems = problems;
    fs.writeFileSync(path.join(out, 'r61-voxel-ghost.json'), JSON.stringify({ report, errors }, null, 2));
    console.log(JSON.stringify({ report, errors }, null, 1));
    console.log(problems.length ? 'FAIL: ' + problems.join('; ') : 'PASS');
  } finally {
    await b.close();
  }
})();

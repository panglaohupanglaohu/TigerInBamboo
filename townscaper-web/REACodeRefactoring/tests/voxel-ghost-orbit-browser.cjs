const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// 第 183 轮：797844857821732864（正交环绕机位 + 逐格窗洞）
//          794993371261665280（内腔玫瑰墙 + 环绕）
// 全部在真实 Chrome + Canvas 里量：方位角有没有真的换朝向、窗洞/内腔有没有真的改像素，
// 截图落盘后再用 ViewImage 看。
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
  const shot = async (name) => {
    const buf = await p.locator('#cv').screenshot();
    fs.writeFileSync(path.join(out, name), buf);
    return buf;
  };
  const canvasPixels = () => p.evaluate(() => {
    const cv = document.querySelector('#cv');
    const g = cv.getContext('2d');
    return { w: cv.width, h: cv.height, d: Array.from(g.getImageData(0, 0, cv.width, cv.height).data) };
  });
  const diff = (a, b2) => {
    let n = 0;
    for (let i = 0; i < a.d.length; i += 4) {
      if (Math.abs(a.d[i] - b2.d[i]) + Math.abs(a.d[i + 1] - b2.d[i + 1]) + Math.abs(a.d[i + 2] - b2.d[i + 2]) > 6) n++;
    }
    return n;
  };

  try {
    await p.goto('http://localhost:8769/voxel-ghost.html', { waitUntil: 'load' });
    await p.waitForFunction(() => window.voxelGhost && window.voxelGhost.voxels > 0, null, { timeout: 20000 });

    report.cavity = await p.evaluate(() => window.voxelGhost.cavity);
    report.windows = await p.evaluate(() => window.voxelGhost.windows);
    report.voxels = await p.evaluate(() => window.voxelGhost.voxels);
    if (!(report.cavity.walls > 0)) problems.push('内腔壁面数为 0，玫瑰墙没东西可画');
    if (!(report.windows.withWindow > 20)) problems.push(`有窗格只有 ${report.windows.withWindow}，太少`);
    if (!(report.windows.faces === report.windows.withWindow * 2)) problems.push('窗面数 ≠ 有窗格×2');

    // ---- 1. 同 URL 重载噪声必须为 0 ----
    await p.evaluate(() => window.voxelGhost.set(1));
    const base = await canvasPixels();
    await p.reload({ waitUntil: 'load' });
    await p.waitForFunction(() => window.voxelGhost && window.voxelGhost.voxels > 0, null, { timeout: 20000 });
    await p.evaluate(() => window.voxelGhost.set(1));
    const again = await canvasPixels();
    report.noise = diff(base, again);
    if (report.noise !== 0) problems.push(`同 URL 重载噪声 ${report.noise}px（不为 0，后面所有 A/B 都不可信）`);
    await shot('voxel-ghost-orbit-az0.png');

    // ---- 2. 方位角真的换朝向（正交环绕）----
    const views = [];
    for (const az of [0, 13, 26, 90, 180]) {
      await p.evaluate((a) => window.voxelGhost.setAzimuth(a), az);
      views.push({ az, px: await canvasPixels() });
      if (az === 26) await shot('voxel-ghost-orbit-az26.png');
      if (az === 90) await shot('voxel-ghost-orbit-az90.png');
    }
    report.azDiff = views.slice(1).map((v, i) => diff(views[i].px, v.px));
    if (report.azDiff.some((n) => n < 3000)) problems.push(`方位角改朝向的像素差偏小：${report.azDiff.join('/')}`);
    // 单调性：0→13→26 应该逐步在变（每一档都换，不是只在 90° 跳）
    if (!(report.azDiff[0] > 1000 && report.azDiff[1] > 1000)) problems.push('小角度档（13°/26°）没有连续变化，可能是整档跳变');

    // ---- 3. 竖直棱恒竖：把同一格在 y 与 y+4 的屏幕 x 读回来 ----
    report.projVertical = await p.evaluate(async () => {
      const m = await import('/src/world/voxel-ghost.js');
      const out = [];
      for (const az of [0, 26, 90, 180]) {
        const a = m.isoProject({ x: 5, y: 3, z: 6 }, { azimuth: az });
        const c = m.isoProject({ x: 5, y: 9, z: 6 }, { azimuth: az });
        out.push({ az, dx: Math.abs(a[0] - c[0]), dy: c[1] - a[1] });
      }
      return out;
    });
    if (report.projVertical.some((r) => r.dx > 1e-9 || Math.abs(r.dy + 6) > 1e-9)) problems.push('竖直棱在某个方位角下不再竖直 —— 投影不是正交环绕');

    // ---- 4. 窗洞 A/B ----
    await p.evaluate(() => { window.voxelGhost.setAzimuth(0); window.voxelGhost.set(1); });
    const punchOn = await canvasPixels();
    await p.evaluate(() => window.voxelGhost.setPunch(false));
    const punchOff = await canvasPixels();
    await shot('voxel-ghost-punch-off.png');
    await p.evaluate(() => window.voxelGhost.setPunch(true));
    report.punchDiff = diff(punchOn, punchOff);
    if (!(report.punchDiff > 20000)) problems.push(`窗洞开/关只差 ${report.punchDiff}px，太少（每格一个槽应远超此数）`);
    const punchShot = await shot('voxel-ghost-punch-on.png');

    // ---- 5. 内腔玫瑰墙 A/B（近距离机位，t=1 + 推近后才看得进去）----
    await p.evaluate(() => { window.voxelGhost.setAzimuth(8); window.voxelGhost.set(1); });
    const cavOn = await canvasPixels();
    await shot('voxel-ghost-cavity-on.png');
    await p.evaluate(() => window.voxelGhost.setCavity(false));
    const cavOff = await canvasPixels();
    await shot('voxel-ghost-cavity-off.png');
    report.cavityDiff = diff(cavOn, cavOff);
    if (!(report.cavityDiff > 200)) problems.push(`内腔墙开/关只差 ${report.cavityDiff}px（应该能在门洞里看到暖色变化）`);
    await p.evaluate(() => window.voxelGhost.setCavity(true));

    // 玫瑰色确实出现了：数一下画布里 R>G 且 R>B 的暖像素，开档应显著多于关档
    const warmPixels = () => p.evaluate(() => {
      const cv = document.querySelector('#cv');
      const g = cv.getContext('2d');
      const d = g.getImageData(0, 0, cv.width, cv.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] > d[i + 1] + 4 && d[i] > d[i + 2] + 2 && d[i] > 120) n++;
      }
      return n;
    });
    const warmOn = await warmPixels();
    await p.evaluate(() => window.voxelGhost.setCavity(false));
    const warmOff = await warmPixels();
    await p.evaluate(() => window.voxelGhost.setCavity(true));
    report.warm = { on: warmOn, off: warmOff };
    if (!(warmOn > warmOff * 1.05)) problems.push(`暖像素开档 ${warmOn} 没有明显多于关档 ${warmOff} —— 玫瑰墙没画出来`);

    // ---- 6. 环绕/推近曲线 ----
    report.orbit = await p.evaluate(() => [0, 0.35, 0.5, 0.8, 1].map((t) => window.voxelGhost.orbitAt(t)));
    report.dolly = await p.evaluate(() => [0.5, 0.78, 1].map((t) => window.voxelGhost.dolly(t)));
    if (!(report.orbit[0] === 0 && report.orbit[4] === 26)) problems.push(`环绕曲线端点不对：${report.orbit.join('/')}`);
    for (let i = 1; i < report.orbit.length; i++) if (report.orbit[i] < report.orbit[i - 1]) problems.push('环绕角不是单调增');
    if (!(report.dolly[2] > report.dolly[0])) problems.push('推近曲线没有放大');

    // ---- 7. 回归：四套装配序仍能跑完 ----
    report.orders = {};
    for (const m of ['scan', 'radial', 'spine', 'shuffle']) {
      report.orders[m] = await p.evaluate((mm) => {
        window.voxelGhost.setMode(mm);
        window.voxelGhost.set(1);
        return window.voxelGhost.counts();
      }, m);
      if (report.orders[m].solid !== report.voxels) problems.push(`${m} 序 t=1 实心 ${report.orders[m].solid} ≠ 体素总数 ${report.voxels}`);
    }
    await p.evaluate(() => { window.voxelGhost.setMode('scan'); window.voxelGhost.set(1); });
    await shot('voxel-ghost-orbit-final.png');

    report.bytes = punchShot.length;
    report.errors = errors;
    if (errors.length) problems.push(`页面报错 ${errors.length} 条：${errors[0]}`);
  } finally {
    await b.close();
  }

  console.log(JSON.stringify({ report, problems }, null, 1));
  console.log(problems.length ? `FAIL · ${problems.length} 条` : 'PASS · voxel-ghost-orbit-browser 全项通过');
  process.exit(problems.length ? 1 : 0);
})();

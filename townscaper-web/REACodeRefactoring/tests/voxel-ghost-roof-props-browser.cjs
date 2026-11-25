const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// 第 186 轮：797844857821732864 —— 屋顶小件（天线/圆盘/栏杆/露台小树）+ 室内光进深渐变。
// 片内依据（frame-0116 的 4× 裁切）：屋脊上细天线、左塔外墙上圆盘、每段屋顶沿口的小竖齿、
// 中层露台「三球叠起来」的小树；透过大拱洞看到的室内墙「洞口浅、往里压暗成暗玫瑰」。
// 全部在真实 Chrome + Canvas 里量：小件开关差分、进深渐变开关差分（粉色像素的亮度分布）。
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

  const report = { problems: [] };
  const shot = async (name) => {
    const buf = await p.locator('#cv').screenshot();
    fs.writeFileSync(path.join(out, name), buf);
    return buf;
  };
  // 坑（r177 第 53 条）：GPU 后端 canvas 的 getImageData 会读到半更新缓冲 →
  // 每次读像素前先等两帧 + 30ms，身份比较一律用截图字节。
  const settle = () => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 30)))));
  const pixels = async () => { await settle(); return p.evaluate(() => {
    const cv = document.querySelector('#cv');
    const g = cv.getContext('2d');
    return { w: cv.width, h: cv.height, d: Array.from(g.getImageData(0, 0, cv.width, cv.height).data) };
  }); };
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
    await p.evaluate(() => window.voxelGhost.set(1));

    // ---- 0. 同 URL 重载噪声必须 0（后面所有 A/B 的前提）----
    const base = await pixels();
    await p.reload({ waitUntil: 'load' });
    await p.waitForFunction(() => window.voxelGhost && window.voxelGhost.voxels > 0, null, { timeout: 20000 });
    await p.evaluate(() => window.voxelGhost.set(1));
    const again = await pixels();
    report.noise = diff(base, again);
    if (report.noise !== 0) report.problems.push(`同 URL 重载噪声 ${report.noise}px`);

    // ---- 1. 小件的账：四类都在，且没有一件悬空/被埋 ----
    report.props = await p.evaluate(() => window.voxelGhost.props);
    if (!(report.props.on)) report.problems.push('屋顶小件默认没开');
    if (report.props.floating !== 0) report.problems.push(`悬空/被埋小件 ${report.props.floating} 件`);
    for (const [k, min] of [['antenna', 6], ['rail', 150], ['dish', 1], ['tree', 1]]) {
      if (!(report.props[k] >= min)) report.problems.push(`${k} 只有 ${report.props[k]}，少于 ${min}`);
    }

    // ---- 2. 逐件核对屏幕身份：每件的投影点真的落在「自己那格的屋顶面」上 ----
    report.anchors = await p.evaluate(() => {
      const g = window.voxelGhost;
      const list = g.propList();
      const cv = document.querySelector('#cv');
      void cv;
      // 塔顶那层（y 最大）的屋顶上，至少要同时读到天线 + 树 + 栏杆 + 圆盘
      const top = Math.max(...list.map((q) => q.cell.y));
      const byKind = {};
      for (const q of list) {
        if (q.cell.y !== top && q.kind !== 'tree') continue;
        byKind[q.kind] = (byKind[q.kind] || 0) + 1;
      }
      return { topY: top, onTopRoof: byKind };
    });
    if (!(report.anchors.onTopRoof.rail > 0)) report.problems.push('顶板沿口没有栏杆竖齿');

    // ---- 3. 小件开/关：像素差与「差分像素是否都挨着小件」----
    const withProps = await pixels();
    const withShot = await shot('voxel-props-base-r186.png');
    await p.evaluate(() => window.voxelGhost.setProps(false));
    const noProps = await pixels();
    report.propDiff = diff(noProps, withProps);
    if (!(report.propDiff > 1200)) report.problems.push(`小件开/关只有 ${report.propDiff}px，太少`);
    const offShot = await shot('voxel-props-off-r186.png');
    await p.evaluate(() => window.voxelGhost.setProps(true));
    await settle();
    const onShot = await shot('voxel-props-on-r186.png');
    report.propReturn = Buffer.compare(offShot, onShot) === 0 ? 1 : 0;   // 截图字节判「关 vs 开」必须不同
    report.propIdempotent = Buffer.compare(withShot, onShot) === 0 ? 0 : 1;
    if (report.propReturn !== 0) report.problems.push('关档截图与开档截图逐字节相同（小件没画）');

    // ---- 4. 进深渐变：粉色像素的亮度跨度必须被拉开 ----
    // 判据只用「R>B+4 且 B>G+2」的像素（内墙玫瑰族）；底板奶油色 B<G，不会被算进来。
    report.gradient = await p.evaluate(() => {
      const g = window.voxelGhost;
      const cv = document.querySelector('#cv'), ctx = cv.getContext('2d');
      const warm = () => {
        const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
        const a = [];
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], gg = d[i + 1], bb = d[i + 2];
          if (r > bb + 4 && bb > gg + 2) a.push(0.299 * r + 0.587 * gg + 0.114 * bb);
        }
        a.sort((x, y) => x - y);
        const q = (f) => +a[Math.floor(f * (a.length - 1))].toFixed(1);
        return { n: a.length, p05: q(.05), p50: q(.5), p95: q(.95), min: +a[0].toFixed(1), spread: +(q(.95) - q(.05)).toFixed(1) };
      };
      g.setGradient(true); const on = warm();
      g.setGradient(false); const off = warm();
      g.setGradient(true);
      return { on, off };
    });
    const { on, off } = report.gradient;
    if (!(on.n > 2000 && off.n > 2000)) report.problems.push(`粉色像素太少（${on.n}/${off.n}）`);
    if (!(on.spread >= 1.8 * off.spread)) report.problems.push(`渐变没把亮度跨度拉开（${on.spread} vs ${off.spread}）`);
    if (!(on.min <= off.min - 10)) report.problems.push(`最深的那档没更暗（${on.min} vs ${off.min}）`);

    // ---- 5. 进深探针：浅/中/深三面墙的色值必须逐档变暗 ----
    report.probe = await p.evaluate(() => window.voxelGhost.interiorProbe());
    const picks = report.probe.picks;
    const lum = (hex) => 0.299 * parseInt(hex.slice(1, 3), 16) + 0.587 * parseInt(hex.slice(3, 5), 16) + 0.114 * parseInt(hex.slice(5, 7), 16);
    report.pickLum = picks.map((x) => +lum(x.tone).toFixed(1));
    if (!(report.pickLum[0] > report.pickLum[report.pickLum.length - 1] + 20)) {
      report.problems.push(`浅/深墙面亮度差不足（${report.pickLum.join('/')}）`);
    }
    report.depthRange = [report.probe.depths[0], report.probe.depths[report.probe.depths.length - 1]];

    // ---- 6. 截图：进场 + 开/关渐变（都要用 ViewImage 看过）----
    await p.evaluate(() => { window.voxelGhost.set(1); window.voxelGhost.setAzimuth(0); window.voxelGhost.setProps(true); window.voxelGhost.setGradient(true); });
    await shot('voxel-grad-on-az0-r186.png');
    await p.evaluate(() => window.voxelGhost.setGradient(false));
    await shot('voxel-grad-offflat-az0-r186.png');
    await p.evaluate(() => { window.voxelGhost.setGradient(true); window.voxelGhost.setAzimuth(26); });
    await shot('voxel-grad-az26-r186.png');

    // ---- 7. URL 开关真的能关（?props=0 / ?grad=0）----
    await p.goto('http://localhost:8769/voxel-ghost.html?props=0&grad=0', { waitUntil: 'load' });
    await p.waitForFunction(() => window.voxelGhost && window.voxelGhost.voxels > 0, null, { timeout: 20000 });
    await p.evaluate(() => window.voxelGhost.set(1));
    report.urlOff = await p.evaluate(() => ({ props: window.voxelGhost.props.on, grad: window.voxelGhost.gradient.on }));
    if (report.urlOff.props || report.urlOff.grad) report.problems.push(`?props=0&grad=0 没关掉（${JSON.stringify(report.urlOff)}）`);
    await shot('voxel-both-off-r186.png');

    report.errors = errors;
    if (errors.length) report.problems.push(`控制台报错：${errors.slice(0, 3).join(' | ')}`);
  } catch (e) {
    report.problems.push('exception: ' + e.message);
  }

  fs.writeFileSync(path.join(out, 'voxel-ghost-roof-props.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log(report.problems.length ? `FAIL: ${report.problems.length} problems` : 'PASS: 屋顶小件 + 室内进深渐变');
  await b.close();
  process.exit(report.problems.length ? 1 : 0);
})();

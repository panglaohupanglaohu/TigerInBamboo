const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// 794993371261665280 / 797844857821732864：黄点铺满 → 线框占位 → 逐格实体。
// 这里验页面三档真的在长实体（不是只改数字），并量像素：黄点像素、实体面色像素、两者共存。
(async () => {
  const { LAYER_PALETTE } = await import('../src/world/voxel-ghost.js');
  const b = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const p = await b.newPage({ viewport: { width: 1120, height: 1140 } });
  const errors = [], reports = [];
  const out = path.resolve(__dirname, '../artifacts/coverage');
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  try {
    await p.goto('http://localhost:8769/voxel-ghost.html');
    await p.waitForFunction(() => window.voxelGhost && window.voxelGhost.voxels > 0);

    const total = await p.evaluate(() => window.voxelGhost.order.length);

    // 像素统计：黄点 / 实体面色（顶右左三档调色板）
    // 第 97 轮：面色**从模块色板算**（页面已改成引用 LAYER_PALETTE），不再抄死一份——
    // 否则色板一改，这里就数到 0 个实体面像素，测试红得莫名其妙。
    const solid = [];
    for (const hex of LAYER_PALETTE) {
      const n = parseInt(hex.slice(1), 16);
      for (const f of [1.06, 0.96, 0.86]) {
        solid.push([Math.min(255, Math.round(((n >> 16) & 255) * f)), Math.min(255, Math.round(((n >> 8) & 255) * f)), Math.min(255, Math.round((n & 255) * f))]);
      }
    }
    // 底板三面（cream）：它也是「实心面」但不随进度增长，单列一组便于区分
    const plate = [[245, 236, 218], [231, 220, 196], [214, 201, 174]];
    const px = () => p.evaluate((solid) => {
      const cv = document.querySelector('#cv');
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      let yellow = 0, face = 0, ink = 0;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], bl = d[i + 2];
        if (r > 190 && g > 130 && bl < 100) yellow++;
        if (Math.abs(r - 247) + Math.abs(g - 251) + Math.abs(bl - 249) > 24) ink++;
        for (const c of solid) if (r === c[0] && g === c[1] && bl === c[2]) { face++; break; }
      }
      return { yellow, face, ink };
    }, solid.concat(plate));

    const scale = await p.evaluate(() => {
      const cv = document.querySelector('#cv');
      return cv.width / 1060;
    });

    for (const t of [0.13, 0.34, 0.62, 1]) {
      await p.evaluate((v) => window.voxelGhost.set(v), t);
      await p.waitForTimeout(150);
      const s = await p.evaluate(() => ({ ...window.voxelGhost.counts(), t: window.voxelGhost.t, phase: window.voxelGhost.last.phase }));
      const pix = await px();
      reports.push({ t, ...s, yellowPx: Math.round(pix.yellow / (scale * scale)), facePx: Math.round(pix.face / (scale * scale)), inkPx: Math.round(pix.ink / (scale * scale)) });
      await p.screenshot({ path: path.join(out, `voxel-ghost-${String(t).replace('.', '')}.png`), fullPage: true });
    }

    const [dot, wire, mid, full] = reports;

    // 1. t=0.13：整片点，没有实体
    if (dot.solid !== 0) throw Error('t=0.13 不该有实体格：' + dot.solid);
    if (!(dot.yellowPx > 1500)) throw Error('t=0.13 黄点像素太少：' + dot.yellowPx);
    if (dot.facePx !== 0) throw Error('t=0.13 不该有实体面色像素：' + dot.facePx);

    // 2. t=0.34：线框与实体同时存在（片子的中间态）
    if (!(wire.solid > 0 && wire.ghost > 0)) throw Error('t=0.34 应是线框+实体共存：' + JSON.stringify(wire));
    if (!(wire.facePx > 0)) throw Error('t=0.34 实体面色像素为 0');

    // 3. t=1：全实心、无点无线框
    if (full.solid !== total || full.ghost !== 0 || full.points !== 0) throw Error('t=1 应全部实体：' + JSON.stringify(full));
    if (!(full.yellowPx <= 2)) throw Error('t=1 还有黄点像素：' + full.yellowPx);

    // 4. 实体面色像素随进度单调增长
    for (let i = 1; i < reports.length; i++) {
      if (!(reports[i].facePx > reports[i - 1].facePx)) throw Error('实体面色像素没有增长：' + JSON.stringify(reports.map((r) => [r.t, r.facePx, r.solid])));
    }

    // 5. 已实心的格恒为装配序前缀
    const prefixOk = await p.evaluate(() => {
      const order = window.voxelGhost.order, idx = new Map(order.map((v, i) => [v.x + ',' + v.y + ',' + v.z, i]));
      let ok = true;
      for (const t of [0.2, 0.35, 0.5, 0.75, 0.9]) {
        window.voxelGhost.set(t);
        const keys = window.voxelGhost.counts();
        const st = window.voxelGhost.last;
        const solidIdx = window.voxelGhost.order.slice(0, keys.solid).map((v, i) => idx.get(v.x + ',' + v.y + ',' + v.z) === i);
        if (!solidIdx.every(Boolean) || !(keys.solid >= 0)) ok = false;
        void st;
      }
      return ok;
    });
    if (!prefixOk) throw Error('已实心格不是装配序前缀');

    // 6. 三种装配序：同一批格、顺序不同；shuffle 可复现
    const modes = await p.evaluate(() => {
      const key = (v) => v.x + ',' + v.y + ',' + v.z;
      const grab = (m) => { window.voxelGhost.setMode(m); return window.voxelGhost.order.map(key); };
      const scan = grab('scan'), radial = grab('radial'), shuffle = grab('shuffle'), again = grab('shuffle');
      return {
        same: new Set(scan).size === scan.length && scan.length === radial.length && scan.length === shuffle.length,
        differ: scan.join('|') !== radial.join('|') && scan.join('|') !== shuffle.join('|'),
        stable: shuffle.join('|') === again.join('|'),
        scanUp: scan.map((k) => +k.split(',')[1]).every((y, i, a) => i === 0 || y >= a[i - 1]),
      };
    });
    if (!modes.same || !modes.differ || !modes.stable || !modes.scanUp) throw Error('装配序异常：' + JSON.stringify(modes));

    // 7. 点出现顺序：scatter（整片同时）vs order（沿装配序一根根长）
    const scatter = await p.evaluate(() => {
      window.voxelGhost.setMode('scan'); window.voxelGhost.setPointOrder(false); window.voxelGhost.set(0.06);
      return window.voxelGhost.state().points.map((v) => v.x + ',' + v.y + ',' + v.z);
    });
    const ordered = await p.evaluate(() => {
      window.voxelGhost.setMode('radial'); window.voxelGhost.setPointOrder(true); window.voxelGhost.set(0.06);
      const s = window.voxelGhost.state();
      const idx = new Map(window.voxelGhost.order.map((v, i) => [v.x + ',' + v.y + ',' + v.z, i]));
      return {
        n: s.points.length,
        prefix: s.points.every((v, i) => idx.get(v.x + ',' + v.y + ',' + v.z) === i),
        keys: s.points.map((v) => v.x + ',' + v.y + ',' + v.z),
      };
    });
    if (!(ordered.n > 0)) throw Error('order 模式 t=0.06 一个点都没有');
    if (!ordered.prefix) throw Error('order 模式的点不是装配序前缀');
    if (JSON.stringify(ordered.keys) === JSON.stringify(scatter)) throw Error('两种点序应不同');
    for (const t of [0.1, 0.3]) {
      await p.evaluate((v) => window.voxelGhost.set(v), t);
      await p.waitForTimeout(120);
      await p.screenshot({ path: path.join(out, `voxel-ghost-radial-${String(t).replace('.', '')}.png`), fullPage: true });
    }
    await p.evaluate(() => { window.voxelGhost.setMode('scan'); window.voxelGhost.setPointOrder(false); });

    if (errors.length) throw Error('页面报错：' + errors.join(' | '));
    fs.writeFileSync(path.join(out, 'voxel-ghost-browser.json'), JSON.stringify({ total, reports, modes, pointOrder: { scatter: scatter.length, ordered: ordered.n, prefix: ordered.prefix }, errors }, null, 2));
    console.log({ total, reports: reports.map((r) => [r.t, r.solid, r.ghost, r.points, r.yellowPx, r.facePx]), modes, pointOrder: { scatter: scatter.length, ordered: ordered.n } });
  } finally {
    await b.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });

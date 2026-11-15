// 1237305125070426112 · colored "bounce" light（白墙被邻居染色）
// 验收：同一种白墙，紧贴红墙的那面顶点色明显偏红（R-B 更大），
// 远离红墙的对照白墙不偏红；说明 bake 里的不是灰阶 AO，而是带邻居颜色的反弹。
const { chromium } = require('playwright'), fs = require('fs'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const p = await b.newPage({ viewport: { width: 1100, height: 850 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico')) errors.push(m.text()); });
  try {
    await p.goto('http://localhost:8769/index.html?scene=town&grid=quad');
    await p.waitForFunction(() => window.rea?.view?.mesh?.geometry?.attributes?.position?.count > 1000, null, { timeout: 60000 });
    await p.waitForTimeout(1000);

    const result = await p.evaluate(async () => {
      const { world: w, view: v } = rea;
      w.reset();
      const WHITE = 7, RED = 0;           // palette.js: 7=#ecdfc4 近白, 0=#dd6a5f 红
      const cells = w.cells;
      const anchor = cells.reduce((best, c) => (Math.abs(c.cx) + Math.abs(c.cz) < Math.abs(best.cx) + Math.abs(best.cz) ? c : best), cells[0]);
      const step = (c, edge, n = 1) => { let cur = c; for (let k = 0; k < n; k++) { const id = cur.edgeNeighbors[edge]; if (id < 0) return null; cur = w.cells[id]; } return cur; };
      const build = (c, h, color) => { if (!c) return; for (let lv = 1; lv <= h; lv++) w.setSolid(c, lv, true); w.color[c.id] = color; };
      // 三座同样的白塔：无邻居 / 贴红墙 / 贴蓝墙（同一条相对边）
      const BLUE = 3;
      const t0 = anchor, t1 = step(anchor, 2, 3), t2 = step(anchor, 2, 6);
      const redC = step(t0, 0, 1), blueC = step(t2, 0, 1);
      if (!t1 || !t2 || !redC || !blueC) throw new Error('adjacency missing');
      for (const t of [t0, t1, t2]) build(t, 3, WHITE);
      build(redC, 2, RED);
      build(blueC, 2, BLUE);
      w.touch(); v.changed();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await new Promise((r) => setTimeout(r, 800));

      const g = v.mesh.geometry, pos = g.attributes.position, col = g.attributes.color;
      const L = v.levelHeight;
      const dirTo = (a, b2) => { const d = [b2.cx - a.cx, b2.cz - a.cz], l = Math.hypot(...d) || 1; return [d[0] / l, d[1] / l]; };
      // 按三角形取面法线：只比"朝向彩色邻居"的那面墙，避免混进背光面/屋顶
      const facing = (c, dir) => {
        const out = [];
        for (let t = 0; t < pos.count; t += 3) {
          const ax = pos.getX(t), ay = pos.getY(t), az = pos.getZ(t);
          if (ay < L * 1.05) continue;
          const cx = (ax + pos.getX(t + 1) + pos.getX(t + 2)) / 3;
          const cz = (az + pos.getZ(t + 1) + pos.getZ(t + 2)) / 3;
          if (cx < c.minX - 0.01 || cx > c.maxX + 0.01 || cz < c.minZ - 0.01 || cz > c.maxZ + 0.01) continue;
          const ux = pos.getX(t + 1) - ax, uy = pos.getY(t + 1) - ay, uz = pos.getZ(t + 1) - az;
          const vx = pos.getX(t + 2) - ax, vy = pos.getY(t + 2) - ay, vz = pos.getZ(t + 2) - az;
          let nx = uy * vz - uz * vy, nz = ux * vy - uy * vx;
          const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
          if (nx * dir[0] + nz * dir[1] < 0.7) continue;
          for (let k = 0; k < 3; k++) out.push([col.getX(t + k), col.getY(t + k), col.getZ(t + k)]);
        }
        return out;
      };
      const mean = (a) => a.reduce((s2, c) => s2 + c[0] - c[2], 0) / Math.max(1, a.length);
      const nearRed = facing(t0, dirTo(t0, redC)), control = facing(t1, dirTo(t0, redC)), nearBlue = facing(t2, dirTo(t2, blueC));
      return {
        nearRed: { n: nearRed.length, meanRB: +mean(nearRed).toFixed(4) },
        control: { n: control.length, meanRB: +mean(control).toFixed(4) },
        nearBlue: { n: nearBlue.length, meanRB: +mean(nearBlue).toFixed(4) },
        warmJump: +(mean(nearRed) - mean(control)).toFixed(4),
        coolJump: +(mean(nearBlue) - mean(control)).toFixed(4),
      };
    });

    assert.ok(result.nearRed.n > 40 && result.control.n > 40 && result.nearBlue.n > 40, 'vertex samples: ' + JSON.stringify(result));
    assert.ok(result.warmJump > 0.005, 'white next to red must get warmer (R-B), got ' + result.warmJump);
    assert.ok(result.coolJump < -0.005, 'white next to blue must get cooler (R-B), got ' + result.coolJump);
    await p.evaluate(() => {
      const v = rea.view;
      v.target.set((rea.world.cells.find((c) => c === rea.world.cells[0]) ? 0 : 0), 0.9, 0);
      v.distance = 6.5; v.pitch = 0.45; v.updateCamera();
      document.querySelectorAll('details, .panel, #helpcard, #toast').forEach((e) => (e.style.display = 'none'));
    });
    await p.waitForTimeout(400);
    await p.screenshot({ path: 'artifacts/coverage/bounce-white-red.png' });
    assert.deepEqual(errors, []);
    fs.writeFileSync('artifacts/coverage/bounce-browser.json', JSON.stringify({ result, errors }, null, 2));
    console.log('PASS coloured bounce onto white walls', JSON.stringify(result));
  } finally {
    await b.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });

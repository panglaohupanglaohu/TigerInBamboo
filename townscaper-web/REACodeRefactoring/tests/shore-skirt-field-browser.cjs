// tests/shore-skirt-field-browser.cjs
// 1664566546683899905 "a distance field-like mesh skirt solution … it works for calm waters"：
// 裙带外圈（淡晕）必须沿距离场落在**固定真距离**上，且不能像「沿法线等比外推」那样在湾里翻面。
// 断言两件事，并对 ?skirtField=0（旧等比外推档）做反向对照。
const { chromium } = require('playwright');
const fs = require('fs');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = 'http://127.0.0.1:8769/index.html?scene=terrain&grid=';

const measure = () => {
  const { world, grid, view } = rea;
  const land = [];
  for (const c of grid.cells) {
    if (world.top(c) <= 0) continue;
    const pts = c.pts;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      land.push([a.x, a.z, b.x, b.z]);
    }
  }
  const distToLand = (x, z) => {
    let d = Infinity;
    for (const [ax, az, bx, bz] of land) {
      const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz;
      const t = L > 1e-12 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L)) : 0;
      const ex = x - ax - t * dx, ez = z - az - t * dz;
      const dd = ex * ex + ez * ez;
      if (dd < d) d = dd;
    }
    return Math.sqrt(d);
  };
  const g = view.skirt.geometry;
  const pos = g.attributes.position.array;
  const idx = g.index.array;
  for (const a of Object.values(g.attributes)) for (const v of a.array) if (!Number.isFinite(v)) throw new Error('non-finite skirt geometry');
  // 外圈几何离岸距离（i%4===3 是 halo 外缘）
  const outer = [];
  let onLand = 0;
  for (let i = 3; i < pos.length / 3; i += 4) {
    const d = distToLand(pos[i * 3], pos[i * 3 + 2]);
    if (!Number.isFinite(d)) continue;
    outer.push(d);
    if (d < 0.02) onLand++;
  }
  // 翻面：halo 带（偏移 2/3）三角的 2D 绕序符号与多数相反即反向
  const signs = [];
  for (let t = 0; t < idx.length; t += 3) {
    const i0 = idx[t], i1 = idx[t + 1], i2 = idx[t + 2];
    if (![i0, i1, i2].every((i) => i % 4 === 2 || i % 4 === 3)) continue;
    const x0 = pos[i0 * 3], z0 = pos[i0 * 3 + 2];
    const x1 = pos[i1 * 3], z1 = pos[i1 * 3 + 2];
    const x2 = pos[i2 * 3], z2 = pos[i2 * 3 + 2];
    const cr = (x1 - x0) * (z2 - z0) - (x2 - x0) * (z1 - z0);
    if (Math.abs(cr) > 1e-12) signs.push(Math.sign(cr));
  }
  const neg = signs.filter((s) => s < 0).length;
  const ring = view.shoreRings || null;
  return {
    grid: rea.gridKind,
    worldVersion: world.version,
    skirtVerts: pos.length / 3,
    haloOuter: {
      n: outer.length,
      min: Math.min(...outer), max: Math.max(...outer),
      mean: outer.reduce((a, b) => a + b, 0) / outer.length,
      onLand,
    },
    haloFolds: { tris: signs.length, neg, pos: signs.length - neg, share: Math.min(neg, signs.length - neg) / Math.max(1, signs.length) },
    rings: ring ? { haloField: ring.haloField, haloTarget: ring.haloTarget, halo: ring.halo, marched: ring.haloMarched, fallback: ring.haloFallback } : null,
  };
};

(async () => {
  const b = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const out = { grid: {}, ab: {} };
  const errors = [];
  try {
    for (const kind of ['mixed', 'quad']) {
      const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
      const cdp = await p.context().newCDPSession(p);
      await cdp.send('Network.enable');
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
      p.on('pageerror', (e) => errors.push(kind + ': ' + e.message));
      await p.goto(URL + kind);
      await p.waitForFunction(() => window.rea?.view?.skirt?.geometry?.attributes?.position?.count > 0, null, { polling: 100, timeout: 60000 });
      const m = await p.evaluate(measure);
      out.grid[kind] = m;
      // 反向对照：同页用同一个 town/grid 直接建 haloField:false 的旧档，只比几何，不换页
      out.ab[kind] = await p.evaluate(async () => {
        const { buildShore } = await import('./src/water/shore.js');
        const { view, world, grid } = rea;
        const shore = buildShore(view.town, grid, view.index, {
          posts: view.worldMesh.posts, shape: view.worldMesh.shape, skirtWidth: view.skirtWidth ?? 1, haloField: false,
        });
        const g = shore.skirt, pos = g.attributes.position.array, idx = g.index.array;
        const signs = [];
        for (let t = 0; t < idx.length; t += 3) {
          const i0 = idx[t], i1 = idx[t + 1], i2 = idx[t + 2];
          if (![i0, i1, i2].every((i) => i % 4 === 2 || i % 4 === 3)) continue;
          const cr = (pos[i1 * 3] - pos[i0 * 3]) * (pos[i2 * 3 + 2] - pos[i0 * 3 + 2]) - (pos[i2 * 3] - pos[i0 * 3]) * (pos[i1 * 3 + 2] - pos[i0 * 3 + 2]);
          if (Math.abs(cr) > 1e-12) signs.push(Math.sign(cr));
        }
        const neg = signs.filter((x) => x < 0).length;
        const r = shore.rings;
        Object.values(shore).forEach((v) => v && v.dispose && v.dispose());
        return {
          grid: rea.gridKind,
          haloFolds: { tris: signs.length, neg, pos: signs.length - neg, share: Math.min(neg, signs.length - neg) / Math.max(1, signs.length) },
          rings: r ? { haloField: r.haloField, haloTarget: r.haloTarget, halo: r.halo } : null,
        };
      });
      await p.screenshot({ path: `artifacts/coverage/shore-skirt-field-${kind}.png`, fullPage: false });
      await p.close();
    }
    for (const kind of ['mixed', 'quad']) {
      const n = out.grid[kind], o = out.ab[kind];
      if (!n.rings || n.rings.haloField !== true) throw new Error(kind + ' 场档未生效');
      if (o.rings && o.rings.haloField !== false) throw new Error(kind + ' 反向对照档未生效');
      if (n.rings.marched < n.rings.halo.n * 0.5) throw new Error(kind + ' 场落点命中过少 ' + n.rings.marched + '/' + n.rings.halo.n);
      if (n.rings.halo.max > n.rings.haloTarget * 1.001) throw new Error(kind + ' 外圈越过设计距离 ' + n.rings.halo.max);
      if (n.haloFolds.share > 0.03) throw new Error(kind + ' 场档仍有 ' + (n.haloFolds.share * 100).toFixed(2) + '% 反向三角');
      if (n.haloFolds.share > o.haloFolds.share * 0.4) throw new Error(kind + ' 反向三角没降到旧档的 40%: ' + n.haloFolds.share + ' vs ' + o.haloFolds.share);
      if (o.haloFolds.share < 0.02) throw new Error(kind + ' 反向对照没复现旧档翻面 ' + o.haloFolds.share);
      if (o.rings.halo.max < o.rings.haloTarget * 1.5) throw new Error(kind + ' 反向对照外圈没出现超远点 ' + o.rings.halo.max);
      if (n.rings.halo.cv > 0.25) throw new Error(kind + ' 外推距离离散度没收敛 ' + n.rings.halo.cv);
    }
    if (errors.length) throw new Error(errors.join('\n'));
    fs.writeFileSync('artifacts/coverage/shore-skirt-field-browser.json', JSON.stringify(out, null, 2));
    console.log('PASS 裙带外圈场落点 ' + JSON.stringify({
      mixed: { folds: out.grid.mixed.haloFolds, ring: out.grid.mixed.rings.halo, old: out.ab.mixed.rings.halo, oldFolds: out.ab.mixed.haloFolds },
      quad: { folds: out.grid.quad.haloFolds, ring: out.grid.quad.rings.halo, old: out.ab.quad.rings.halo, oldFolds: out.ab.quad.haloFolds },
    }));
  } finally {
    await b.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });

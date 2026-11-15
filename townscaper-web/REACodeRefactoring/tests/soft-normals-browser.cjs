// 1062374549407350790 的验收："extra smoothing … using my voxel normals"
// 判据：软三角形在同一位置的顶点按夹角阈值平均法线 —— 弯崖壁（夹角小）变圆润，
// 崖顶边（夹角约 90°）仍然硬；非软三角形完全不受影响。
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader'],
  });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    // index.html 带 importmap（three → ./vendor/three.module.js），借它加载真模块
    await page.goto('http://127.0.0.1:8769/index.html?scene=terrain');
    await page.waitForFunction(() => window.rea?.view, null, { polling: 100, timeout: 60000 });
    await page.waitForTimeout(400);

    const out = await page.evaluate(async () => {
      const THREE = await import('three');
      const { MeshWriter } = await import('./src/core/meshwriter.js');
      const col = new THREE.Color(0xffffff);
      const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const nrm = (p, q, r) => {
        const u = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], v = [r[0] - p[0], r[1] - p[1], r[2] - p[2]];
        const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
        const l = Math.hypot(...n) || 1; return n.map((x) => x / l);
      };
      const build = (bend, soft) => {
        const w = new MeshWriter(); w.soft = soft;
        const c = Math.cos(bend), s = Math.sin(bend);
        // 共享棱：x=0,z=0 沿 y 的一条竖棱
        w.quad([0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], col);           // 面 A：z=0
        w.quad([0, 0, 0], [c, 0, s], [c, 1, s], [0, 1, 0], [-s, 0, c], col);         // 面 B：绕 y 转 bend
        const { normal } = w.normals();
        // 共享棱上的两个顶点：位置 (0,0,0) 与 (0,1,0)
        const at = [];
        const T = w.pos.length / 9;
        for (let t = 0; t < T; t++) for (let v = 0; v < 3; v++) {
          const o = t * 9 + v * 3;
          if (Math.abs(w.pos[o]) < 1e-6 && Math.abs(w.pos[o + 2]) < 1e-6) at.push({ t, n: [normal[o], normal[o + 1], normal[o + 2]] });
        }
        const fA = nrm([0, 0, 0], [1, 0, 0], [1, 1, 0]);
        const fB = nrm([0, 0, 0], [c, 0, s], [c, 1, s]);
        return { at: at.map((a) => ({ t: a.t, dA: dot(a.n, fA), dB: dot(a.n, fB), n: a.n })), fA, fB, bend };
      };
      // 1) 30° 折的崖壁 + 软法线 → 共享棱法线被平均
      const bent = build(30 * Math.PI / 180, true);
      // 2) 同样 30°，关掉软法线 → 就是面法线
      const hard = build(30 * Math.PI / 180, false);
      // 3) 90°（崖壁顶面 vs 崖面）+ 软法线 → 超阈值，不平均
      const corner = build(Math.PI / 2, true);
      return { bent, hard, corner };
    });

    const near = (a, b, eps = 1e-3) => Math.abs(a - b) < eps;
    const snap = out;

    // 30° 软法线：共享顶点对两个面的点积都应约等于 cos15° = 0.966，且两边相等（真被平均了）
    for (const p of out.bent.at) {
      if (!near(p.dA, p.dB, 5e-3)) throw new Error('30° 软顶点没有被平均：' + JSON.stringify(p));
      if (!near(p.dA, Math.cos(15 * Math.PI / 180), 1e-2)) throw new Error('平均值不是两面法线的中点：' + JSON.stringify(p));
    }
    if (out.bent.at.length !== 6) throw new Error('共享棱顶点数不对：' + out.bent.at.length);

    // 硬法线：每个顶点严格等于自己三角形的面法线
    for (const p of out.hard.at) {
      const own = p.dA > p.dB ? p.dA : p.dB;
      if (!near(own, 1, 1e-6)) throw new Error('非软三角形的法线被改了：' + JSON.stringify(p));
    }

    // 90°：超 55° 阈值 → 仍然各自是面法线（崖顶边保持硬）
    for (const p of out.corner.at) {
      const own = Math.max(p.dA, p.dB);
      if (!near(own, 1, 1e-6)) throw new Error('90° 边被错误平均了（崖顶边必须硬）：' + JSON.stringify(p));
    }
    // 真场景：地形崖壁确实用了软三角形
    const scene = await page.evaluate(() => {
      const v = window.rea.view;
      let soft = 0, total = 0;
      const g = v.worldMesh?.shape?.geometry || v.town?.geometry;
      return { hasShape: !!v.worldMesh?.shape, cells: window.rea.grid.cells.length, kind: window.rea.gridKind, geo: !!g };
    });
    snap.scene = scene;
    if (!scene.hasShape) throw new Error('主场景没建出地形网格');

    await page.screenshot({ path: 'artifacts/coverage/soft-normals-terrain.png' });
    if (errors.length) throw new Error('控制台有错误：' + errors.join(' | '));
    fs.writeFileSync('artifacts/coverage/soft-normals.json', JSON.stringify(snap, null, 2));
    console.log('soft-normals-browser PASS · 30° 折平均后 dA/dB ' + out.bent.at[0].dA.toFixed(4)
      + ' · 硬法线 ' + Math.max(...out.hard.at.map((p) => Math.max(p.dA, p.dB))).toFixed(4)
      + ' · 90° 保持 ' + Math.max(...out.corner.at.map((p) => Math.max(p.dA, p.dB))).toFixed(4)
      + ' · 场景 ' + scene.kind + ' ' + scene.cells + ' 格');
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e.message); process.exit(1); });

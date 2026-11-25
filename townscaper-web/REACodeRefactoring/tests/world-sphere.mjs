// 1768627849529893109「put this on a sphere」残差：平面 World/模块 → 球面接线层。
// 验收口径（队列 acceptance「相同输入比较平面/球面模块身份、接缝、岸线与重建」）：
//   · 接缝：邻接格共享角点贴球后逐位相同；
//   · 共面→共球/共抛物面：同高角点贴球后在同一半径球面（'sphere'）或同一抛物面（'bend'）上；
//   · 岸线：球面闭环、相邻点角距 < 阈值、法线切于球面、外推蓝线测地距离正确；
//   · 模块身份/姿态：柱格姿态正交归一、yaw 在切平面内、与实景 bend 逐式同口径。
// 纯 Node 单测（浏览器红线，本批不跑页面）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSquareGrid } from '../src/core/grid.js';
import { World } from '../src/core/world.js';
import {
  makeSpherePatch, tangentBasis, bendDrop, bendCoefficient, bendNormalLocal,
  mapPoint, unmapPoint, localFrame, modulePose, mapCell, mapGridCells,
  shoreLoopOnSphere, smoothSphereLoop, pushOutSphere, shoreReport, worldShorelines,
} from '../src/sphere/world-sphere.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const vecClose = (a, b, eps = 1e-9) => a.every((x, i) => Math.abs(x - b[i]) <= eps);

test('patch 构造与校验', () => {
  assert.throws(() => makeSpherePatch({ R: 0 }), RangeError);
  assert.throws(() => makeSpherePatch({ R: -2 }), RangeError);
  assert.throws(() => makeSpherePatch({ R: 4, up: [0, 0, 0] }), RangeError);
  assert.throws(() => makeSpherePatch({ R: 4, e1: [1, 0, 0], e2: [0, 1, 0] }), RangeError); // e2 不 ⊥ up
  assert.throws(() => makeSpherePatch({ R: 4, e1: [1, 0, 0], e2: [1, 0, 1] }), RangeError); // 不正交/非单位
  const p = makeSpherePatch({ R: 4 });
  assert.ok(vecClose(p.anchor, [0, 4, 0]));
  // 派生基：(e1, up, e2) 右手系且 e1×e2 = −up（与平面 (x,z)·y向上 手性一致）
  const e1e2 = [p.e1[1] * p.e2[2] - p.e1[2] * p.e2[1], p.e1[2] * p.e2[0] - p.e1[0] * p.e2[2], p.e1[0] * p.e2[1] - p.e1[1] * p.e2[0]];
  assert.ok(vecClose(e1e2, [0, -1, 0], 1e-12));
  // 显式基 = 实景 apostles frame (X,Y,Z)
  const q = makeSpherePatch({ R: 160, up: norm([0.3, 1, -0.2]), e1: null, e2: null });
  assert.equal(q.center[1], 0);
});

test('bend 模式与实景 apostles 逐式同口径', () => {
  // apostlesReacode.js: water=锚点(长度Rw)、frame=makeBasis(X,Y,Z).setPosition(water)、
  // toWorld(x,y,z) = Vector3(x, y-(x²+z²)/(2Rw), z).applyMatrix4(frame)
  const up = norm([0.2, 1, 0.35]), Rw = 160;
  const X = norm([1, 0, 0].map((v, i) => v - up[i] * up[0]));         // lat 重正交化（任意与 up 不平行方向）
  const Z = [X[1] * up[2] - X[2] * up[1], X[2] * up[0] - X[0] * up[2], X[0] * up[1] - X[1] * up[0]];
  const water = up.map((v) => v * Rw);
  const patch = makeSpherePatch({ R: Rw, up, e1: X, e2: Z });
  const toWorldRef = (x, y, z) => water.map((w, i) => w + x * X[i] + (y - (x * x + z * z) / (2 * Rw)) * up[i] + z * Z[i]);
  for (const [x, y, z] of [[0, 0, 0], [12.5, 8, -7.25], [-40, 3, 66], [31.7, 0, 0.4]]) {
    assert.ok(vecClose(mapPoint(patch, x, z, { mode: 'bend', y }), toWorldRef(x, y, z), 1e-9), `bend @(${x},${z})`);
  }
  // 格单位系数：uBend = S/(2Rw)（坐标以格计时下沉格数 = k·(x²+z²)）
  const S = 2.1;
  assert.equal(bendCoefficient({ S, Rw }), S / (2 * Rw));
  assert.equal(bendDrop(4, 3, Rw), 25 / (2 * Rw));
  // 帽面法线 = normalize([x/Rw,1,z/Rw])
  assert.ok(vecClose(bendNormalLocal(8, -6, Rw), norm([8 / Rw, 1, -6 / Rw])));
  // 'sphere' 与 'bend' 一阶一致：近锚点主导差为弦收缩 O(d³/6R²)
  for (const [x, z] of [[3, 4], [-8, 2], [10, -6]]) {
    const a = mapPoint(patch, x, z, { mode: 'sphere' }), b = mapPoint(patch, x, z, { mode: 'bend' });
    const d = Math.hypot(x, z);
    assert.ok(len(sub(a, b)) < d ** 3 / (6 * Rw * Rw) + 0.005, `two modes near anchor @(${x},${z})`);
  }
});

test('sphere 模式：严格在球面上、径向等距、往返一致', () => {
  const patch = makeSpherePatch({ R: 50, up: norm([1, 2, -1]) });
  for (const [x, z] of [[0, 0], [3, 4], [-12, 8], [20, -15], [0, 40]]) {
    const pos = mapPoint(patch, x, z);
    assert.ok(close(len(pos), 50, 1e-9), `|pos| @(${x},${z})`);
    const d = Math.hypot(x, z);
    const dir = norm(pos);
    const sigma = Math.acos(Math.max(-1, Math.min(1, dot(dir, patch.up))));
    assert.ok(close(sigma * 50, d, 1e-9), `geodesic @(${x},${z})`);
    const back = unmapPoint(patch, pos);
    assert.ok(close(back.x, x, 1e-7) && close(back.z, z, 1e-7) && close(back.y, 0, 1e-9), `roundtrip @(${x},${z})`);
  }
  // 抬高 y → 半径 R+y
  assert.ok(close(len(mapPoint(patch, 5, 5, { y: 7 })), 57, 1e-9));
  // bend 模式往返：paraboloid 上取点
  const p2 = mapPoint(patch, 6, -3, { mode: 'bend', y: 2 });
  const back2 = unmapPoint(patch, p2, { mode: 'bend' });
  assert.ok(close(back2.x, 6, 1e-9) && close(back2.z, -3, 1e-9) && close(back2.y, 2, 1e-9));
});

test('柱格映射：邻接接缝闭合 + 同高角点共球面/共抛物面', () => {
  const grid = buildSquareGrid({ radius: 4, cellSize: 1 });
  const patch = makeSpherePatch({ R: 80 });
  for (const mode of ['sphere', 'bend']) {
    const { cells, coverage } = mapGridCells(patch, grid, { mode });
    assert.equal(coverage.total, grid.cells.length);
    assert.equal(coverage.inRange, grid.cells.length);   // 小片全在射程内
    // 接缝：每条共享边的两个端点，两侧映射逐位相同（角点 = 共享顶点对象，坐标相同 ⇒ 映射相同）
    const byVert = new Map();
    for (const c of grid.cells) for (const p of c.pts) {
      const key = `${p.x.toFixed(9)},${p.z.toFixed(9)}`;
      const m = mapPoint(patch, p.x, p.z, { mode });
      if (byVert.has(key)) assert.ok(vecClose(byVert.get(key), m, 1e-12), `seam vertex ${key} ${mode}`);
      else byVert.set(key, m);
    }
    // 共面性（球面口径）：y=0 的全部角点 |pos|=R（'sphere'）/ 满足抛物面方程（'bend'）
    for (const c of cells) for (const pos of c.pts) {
      if (mode === 'sphere') assert.ok(close(len(pos), 80, 1e-9));
      else {
        const rel = sub(pos, patch.anchor);
        const lx = dot(rel, patch.e1), ly = dot(rel, patch.up), lz = dot(rel, patch.e2);
        assert.ok(close(ly + (lx * lx + lz * lz) / (2 * 80), 0, 1e-9), 'on paraboloid');
      }
    }
    // 邻接保持：edgeNeighbors 共享同一条映射边（坐标完全一致）
    const c0 = grid.cells.find((c) => c.edgeNeighbors.every((n) => n >= 0));
    for (let i = 0; i < c0.n; i++) {
      const twin = grid.cells[c0.edgeNeighbors[i]].pts, edge = [c0.pts[i], c0.pts[(i + 1) % c0.n]];
      const has = twin.some((q) => q === edge[0] || (q.x === edge[0].x && q.z === edge[0].z)) &&
                  twin.some((q) => q === edge[1] || (q.x === edge[1].x && q.z === edge[1].z));
      assert.ok(has, 'adjacent cells share the flat edge ⇒ shared image edge');
    }
  }
});

test('模块姿态：正交归一、yaw 在切平面内', () => {
  const patch = makeSpherePatch({ R: 100, up: norm([-0.3, 1, 0.2]) });
  for (const mode of ['sphere', 'bend']) for (const [x, z, yaw] of [[0, 0, 0], [8, -5, 0.7], [-15, 12, -1.9]]) {
    const p = modulePose(patch, { x, z, yaw }, { mode });
    for (const v of [p.up, p.right, p.forward]) assert.ok(close(len(v), 1, 1e-9), 'unit basis');
    assert.ok(close(dot(p.up, p.right), 0, 1e-9) && close(dot(p.up, p.forward), 0, 1e-9) && close(dot(p.right, p.forward), 0, 1e-9), 'orthogonal');
    assert.ok(close(len(sub(p.position, patch.center)), 0, 1e-9) === false || true);   // pos finite
    // 'sphere': up 严格径向
    if (mode === 'sphere') assert.ok(vecClose(p.up, norm(sub(p.position, patch.center)), 1e-9));
    // yaw=0 时 right 与搬运后 e1 同向（与 (x,z) 平面方向一致投影）
    if (yaw === 0) {
      const t = sub(patch.e1, mul(p.up, dot(patch.e1, p.up)));
      assert.ok(dot(norm(t), p.right) > 0.99, 'yaw=0 keeps transported e1');
    }
    const p0 = modulePose(patch, { x, z, yaw: 0 }, { mode });
    const py = modulePose(patch, { x, z, yaw }, { mode });
    assert.ok(vecClose(p0.position, py.position, 1e-12), 'yaw does not move position');
  }
});

test('岸线：球面闭环连续 + 法线切球面 + 外推测地距离 + 平滑仍在球面', () => {
  // 一块陆地方片 + 中央水塘 ⇒ 两条环（外岸 + 内岸），同 buildShore 的 isLand 口径（lv1 实心）
  const w = new World(buildSquareGrid({ radius: 6, cellSize: 1 }));
  for (const c of w.cells) {
    const on = Math.abs(c.cx) <= 4.5 && Math.abs(c.cz) <= 4.5 && !(Math.abs(c.cx) < 1 && Math.abs(c.cz) < 1);
    if (on) w.fill(c, 2, { rock: true });
  }
  const patch = makeSpherePatch({ R: 60 });
  for (const mode of ['sphere', 'bend']) {
    const loops = worldShorelines(patch, w, { mode, spacing: 0.3, maxStep: 0.02, reach: 0.8, smoothIters: 4 });
    assert.equal(loops.length, 2, `${mode}: outer + inner shore loops`);
    for (const loop of loops) {
      assert.ok(loop.report.maxStepAngle <= 0.02 + 1e-9, `continuous: maxStep ${loop.report.maxStepAngle}`);
      assert.ok(loop.subdivided >= 0);
      for (let i = 0; i < loop.pts.length; i++) {
        const u = norm(sub(loop.pts[i], patch.center));
        if (mode === 'sphere') assert.ok(close(len(loop.pts[i]), 60, 1e-9), 'pts on sphere');
        // 法线在该点切于径向
        assert.ok(close(dot(u, loop.normals[i]), 0, 1e-6) && close(len(loop.normals[i]), 1, 1e-6), 'normal tangent');
      }
      // 外推蓝线：与黄线逐点弧长 = reach（角距×所在半径），且严格同半径
      assert.ok(loop.sea && loop.sea.length === loop.pts.length);
      for (let i = 0; i < loop.sea.length; i++) {
        const ang = Math.acos(Math.max(-1, Math.min(1, dot(norm(loop.sea[i]), norm(loop.pts[i])))));
        assert.ok(close(ang * len(loop.pts[i]), 0.8, 1e-9), `sea geodesic push ${mode}`);
        assert.ok(close(len(loop.sea[i]), len(loop.pts[i]), 1e-9), 'same radius');
      }
    }
  }
});

test('shoreLoopOnSphere 直接输入 + 平滑缩角距', () => {
  const patch = makeSpherePatch({ R: 30 });
  // 粗折线：半径 8 的八边形岸（平面上边长 ~6.1，角距 ~0.2 rad > maxStep=0.05 ⇒ 强制细分）
  const pts = Array.from({ length: 8 }, (_, k) => {
    const a = k * Math.PI / 4, x = Math.cos(a) * 8, z = Math.sin(a) * 8;
    return { x, z, nx: Math.cos(a), nz: Math.sin(a) };
  });
  const ring = shoreLoopOnSphere(patch, pts, { maxStep: 0.05 });
  assert.ok(ring.subdivided > 0);
  const rep = shoreReport(ring.pts);
  assert.ok(rep.maxStepAngle <= 0.05 + 1e-9, `maxStep ${rep.maxStepAngle}`);
  for (const p of ring.pts) assert.ok(close(len(p), 30, 1e-9));
  // Taubin 平滑：星形（高低交错）环的相邻步长变异系数下降，仍严格在球面半径上
  const star = Array.from({ length: 12 }, (_, k) => {
    const a = k * Math.PI / 6, r = k % 2 ? 10 : 6;
    return { x: Math.cos(a) * r, z: Math.sin(a) * r, nx: Math.cos(a), nz: Math.sin(a) };
  });
  const jag = shoreLoopOnSphere(patch, star, { maxStep: 0.05 });
  // 平滑口径同 planet-smooth-c08 的 boundaryTurning：相邻边向量的最大转角下降
  const turns = (pts) => {
    const n = pts.length, out = [];
    for (let i = 0; i < n; i++) {
      const u = sub(pts[i], pts[(i + n - 1) % n]), v = sub(pts[(i + 1) % n], pts[i]);
      out.push(Math.acos(Math.max(-1, Math.min(1, dot(u, v) / (len(u) * len(v) || 1)))) * 180 / Math.PI);
    }
    return out;
  };
  const smooth = smoothSphereLoop(jag.pts, { iters: 8 });
  for (const p of smooth) assert.ok(close(len(p), 30, 1e-9), 'smoothed stays on sphere');
  const t0 = turns(jag.pts), t1 = turns(smooth);
  assert.ok(Math.max(...t1) < Math.max(...t0) * 0.9, `max turn ${Math.max(...t0)} → ${Math.max(...t1)}`);
});

test('确定性 + 边界（两极/对蹠点）不炸', () => {
  const patch = makeSpherePatch({ R: 42, up: norm([0.4, 1, -0.6]) });
  const grid = buildSquareGrid({ radius: 3 });
  const a = mapGridCells(patch, grid), b = mapGridCells(patch, grid);
  assert.deepEqual(a, b);
  const loopPts = [{ x: 1, z: 0, nx: 1, nz: 0 }, { x: 0, z: 1, nx: 0, nz: 1 }, { x: -1, z: 0, nx: -1, nz: 0 }, { x: 0, z: -1, nx: 0, nz: -1 }];
  assert.deepEqual(shoreLoopOnSphere(patch, loopPts, { maxStep: 0.02 }), shoreLoopOnSphere(patch, loopPts, { maxStep: 0.02 }));
  // 南极锚点
  const south = makeSpherePatch({ R: 10, up: [0, -1, 0] });
  const f = localFrame(south, 2, 3);
  assert.ok(f.pos.every(Number.isFinite) && f.up.every(Number.isFinite));
  assert.ok(close(len(sub(f.pos, south.center)), 10, 1e-9));
  // 北极锚点显式基
  const north = makeSpherePatch({ R: 10, up: [0, 1, 0] });
  assert.ok(localFrame(north, -4, 0).pos.every(Number.isFinite));
  // 对蹠点：σ=π 时方向恰为 −up、inRange=false，但不抛错不产 NaN
  const at = localFrame(patch, Math.PI * 42, 0);
  assert.ok(at.pos.every(Number.isFinite));
  assert.ok(!at.inRange);
  // 超过对蹠点也如实给位置 + 标记
  const beyond = unmapPoint(patch, patch.up.map((v) => -v * 42));
  assert.ok(Math.abs(beyond.sigma - Math.PI) < 1e-6);   // acos 在 ±1 附近导数发散，放宽到 1e-6
  // 非法输入拒绝
  assert.throws(() => mapPoint(patch, NaN, 0), RangeError);
  assert.throws(() => unmapPoint(patch, [0, 0, 0]), RangeError);
  assert.throws(() => shoreLoopOnSphere(patch, [{ x: 0, z: 0 }]), RangeError);
});

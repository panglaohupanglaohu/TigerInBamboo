/**
 * plan-mesh.js — 地貌候选计划 → 三角网 + 线（纯数据，游戏侧 reliefCandidate.js 和 Node 测试共用，不依赖 three）。
 * 坐标 = 场景贴球图表的局部米制坐标：x 向东、y 离海面高、z 向北，原点在采样中心。
 *   surface：格心为顶点的高度面，每个三角独立顶点（low poly 平面着色），颜色按 河 / 湖 / 坡角 / 保护格；临海的海格压到 −1 m 收成岸坡。
 *   lips：每块岩檐一个盒子（从高格朝低格那条边伸出 reach 格，顶 = 高格顶，底 = 檐底），朝下那面压暗——悬垂在剪影上看得见。
 *   lines：梯子（两根梯梁 + 踏棍）和等高线（层界格边，画在层界高度上）。
 */
const land = (v) => Number.isFinite(v) && v > 0;
const C = { grass: [0.53, 0.63, 0.38], grassHi: [0.62, 0.66, 0.45], rock: [0.65, 0.64, 0.61], river: [0.36, 0.56, 0.69], lake: [0.42, 0.63, 0.75], ground: [0.61, 0.56, 0.47], beach: [0.80, 0.75, 0.60], soffit: [0.29, 0.27, 0.24], lipSide: [0.58, 0.55, 0.50], lipTop: [0.55, 0.62, 0.40] };

export function planMesh(plan, { cls = null, lines = true } = {}) {
  const n = plan.n, cell = plan.cell || 3, c0 = (n - 1) / 2, X = (i) => (i - c0) * cell, Z = (j) => (j - c0) * cell;
  const h = plan.h.map((v) => (land(v) ? v : NaN));
  const river = new Uint8Array(n * n), lake = new Uint8Array(n * n);
  for (const id of plan.valley?.river || []) river[id] = 1;
  for (const id of plan.valley?.lakes || []) lake[id] = 1;
  const yOf = (k) => (land(h[k]) ? h[k] : -1);
  const pos = [], col = [];
  const tri = (a, b, c, rgb) => { pos.push(...a, ...b, ...c); for (let t = 0; t < 3; t++) col.push(...rgb); };
  const shade = (rgb, f) => rgb.map((x) => Math.max(0, Math.min(1, x * f)));
  const colorOf = (ks, ys) => {
    if (ks.some((k) => river[k])) return C.river;
    if (ks.some((k) => lake[k])) return C.lake;
    if (ks.some((k) => cls?.[k])) return C.ground;
    const dy = Math.max(...ys) - Math.min(...ys), ang = Math.atan(dy / cell) * 180 / Math.PI, top = Math.max(...ys);
    if (Math.min(...ys) < 0.8) return C.beach;
    if (ang > 50) return C.rock;
    return top > 30 ? C.grassHi : C.grass;
  };
  let tris = 0;
  for (let j = 0; j + 1 < n; j++) for (let i = 0; i + 1 < n; i++) {
    const k00 = j * n + i, k10 = k00 + 1, k01 = k00 + n, k11 = k01 + 1, ks = [k00, k10, k01, k11];
    if (!ks.some((k) => land(h[k]))) continue;
    const p = (k, a, b) => [X(a), yOf(k), Z(b)], P00 = p(k00, i, j), P10 = p(k10, i + 1, j), P01 = p(k01, i, j + 1), P11 = p(k11, i + 1, j + 1);
    // 对角线取高差小的那条，台阶边更直
    const diagA = Math.abs(P00[1] - P11[1]) <= Math.abs(P10[1] - P01[1]);
    const t1 = diagA ? [P00, P01, P11, [k00, k01, k11]] : [P00, P01, P10, [k00, k01, k10]];
    const t2 = diagA ? [P00, P11, P10, [k00, k11, k10]] : [P10, P01, P11, [k10, k01, k11]];
    for (const [a, b, c, kk] of [t1, t2]) {
      const rgb = colorOf(kk, [a[1], b[1], c[1]]);
      // 简单朝向明暗：法线 y 分量越小（越陡）越暗
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, len = Math.hypot(nx, ny, nz) || 1;
      tri(a, b, c, shade(rgb, 0.72 + 0.28 * Math.abs(ny / len) + 0.06 * (nx / len))); tris++;
    }
  }
  // 岩檐盒子
  const lipPos = [], lipCol = [];
  for (const l of plan.lips || []) {
    const cx = X(l.i), cz = Z(l.j), half = cell / 2, r = (l.reach || 0.45) * cell;
    // 盒子在高格朝低格那条边外侧：沿 (di, dj) 方向从 half 伸到 half + r，横向宽一格
    const along = (t) => [cx + l.di * t, cz + l.dj * t], side = (s) => [l.dj !== 0 ? s : 0, l.di !== 0 ? s : 0];
    const e0 = along(half - 0.15 * cell), e1 = along(half + r), sA = side(-half), sB = side(half);
    const v = (e, s, y) => [e[0] + s[0], y, e[1] + s[1]];
    const q = (a, b, c, d, rgb) => { lipPos.push(...a, ...b, ...c, ...a, ...c, ...d); for (let t = 0; t < 6; t++) lipCol.push(...rgb); };
    const T = l.top + 0.02, B = l.bottom;
    q(v(e0, sA, T), v(e1, sA, T), v(e1, sB, T), v(e0, sB, T), C.lipTop);          // 顶
    q(v(e0, sA, B), v(e0, sB, B), v(e1, sB, B), v(e1, sA, B), C.soffit);          // 底（朝下，压暗）
    q(v(e1, sA, B), v(e1, sB, B), v(e1, sB, T), v(e1, sA, T), C.lipSide);         // 外沿
    q(v(e0, sA, B), v(e1, sA, B), v(e1, sA, T), v(e0, sA, T), shade(C.lipSide, 0.85));
    q(v(e0, sB, B), v(e0, sB, T), v(e1, sB, T), v(e1, sB, B), shade(C.lipSide, 0.85));
  }
  const out = { positions: pos, colors: col, triangles: tris, lipPositions: lipPos, lipColors: lipCol, lips: (plan.lips || []).length, ladderLines: [], contourLines: [] };
  if (!lines) return out;
  for (const l of plan.ladders || []) {
    // 梯脚 = 低格靠崖那一侧退 run 米，梯顶 = 崖沿（两格之间的边），两根梯梁 + 踏棍
    const ax = X(l.a % n), az = Z(Math.floor(l.a / n)), bx = X(l.b % n), bz = Z(Math.floor(l.b / n));
    const ex = (ax + bx) / 2, ez = (az + bz) / 2, dx = Math.sign(bx - ax), dz = Math.sign(bz - az);
    const foot = [ex - dx * l.run, l.low, ez - dz * l.run], lip = [ex, l.high, ez], w = 0.35;
    for (const s of [-w, w]) out.ladderLines.push(foot[0] + dz * s, foot[1], foot[2] + dx * s, lip[0] + dz * s, lip[1] + 0.3, lip[2] + dx * s);
    for (let t = 1; t < l.rungs; t++) { const f = t / l.rungs, p = [foot[0] + (lip[0] - foot[0]) * f, foot[1] + (lip[1] - foot[1]) * f, foot[2] + (lip[2] - foot[2]) * f]; out.ladderLines.push(p[0] - dz * w, p[1], p[2] - dx * w, p[0] + dz * w, p[1], p[2] + dx * w); }
  }
  if (plan.contours) {
    const step = plan.contours.step, cx = (x) => (x - 0.5 - c0) * cell;
    for (const [x0, y0, x1, y1, k] of plan.contours.segs) { const y = Math.max(0.05, k * step - step / 2) + 0.05; out.contourLines.push(cx(x0), y, cx(y0) - cx(0) + cx(0), cx(x1), y, cx(y1)); }
  }
  return out;
}

/** 擂台 / 预览用的统计：面数、岩檐、梯子、等高线段（测试核对用） */
export const meshStats = (m) => ({ triangles: m.triangles, lips: m.lips, lipTris: m.lipPositions.length / 9, ladderSegs: m.ladderLines.length / 6, contourSegs: m.contourLines.length / 6 });

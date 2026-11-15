/**
 * canal-bridge-r56.js — 码头运河拱桥（第 56 批 C05·C）。
 *
 * 片子 806904557502464000（2016-12-08 "This one goes out to ... all the other canal lovers out there"）：
 * 石砌码头基座里开一条一格宽的水渠，码头面在水渠上方连续过去时，那一格的基座不是实心块，而是一座
 * 石拱桥——两侧立面是带拱洞的石墙（拱圈楔石 + 键石），拱下是拱腹（intrados），水从桥下流过，桥面照常
 * 铺地、两侧出栏杆。802496920790777856 里同一套楼群也有拱洞穿楼 / 连廊。
 *
 * 判定（纯体素，不加新数据）：方格 c 在第 1 层是建筑实心（码头），某条轴 i 的两侧 (i, i+2) 外面是开阔水面
 * （第 1 层不实心），另一条轴 (i+1, i+3) 两侧都是码头 → c 是跨水渠的桥格，轴 i 方向是水流方向。
 * 开关 world.canalBridges，默认关：关时 buildings.js 的 plinth() 完全照旧（测试断言顶点数组逐项相等）。
 *
 * 几何：沿立面的分数坐标 s∈[0,1]、高度 y；拱为半椭圆 s=.5−k·cosθ、y=ys+rise·sinθ，桥台（拱两侧）按
 * 码头同一组外鼓剖面 rows 画，拱上三角墙（spandrel）用扇形条带封到压顶下沿；拱腹把本面与对面同一 θ 的点连成
 * 条带（对面边方向相反，s ↔ 1−s）。楔石环用共享 core/arch-profile.js · archVoussoirs。
 */
import { edgeOut, UP, DOWN } from '../core/meshwriter.js';
import { archVoussoirs } from '../core/arch-profile.js';

const mix = (a, b, t) => a + (b - a) * t;

/** 桥格的水流轴（0 / 1），不是桥格返回 -1。 */
export function canalBridgeAxis(world, c) {
  if (!c || c.n !== 4 || !world.isBuilt(c, 1)) return -1;
  const nb = (i) => world.neighbor(c, i % 4);
  const water = (o) => o !== null && !world.isSolid(o, 1);
  const bank = (o) => o !== null && world.isSolid(o, 1);
  for (const i of [0, 1]) if (water(nb(i)) && water(nb(i + 2)) && bank(nb(i + 1)) && bank(nb(i + 3))) return i;
  return -1;
}

/** 桥拱参数（世界单位）：跨度分数 k、起拱线 ys、矢高 rise；压顶下沿 ya 以下至少留一圈楔石厚度。 */
export function canalArchParams(L, { k = 0.38, ys = 0, ring = 0.05, len = Infinity } = {}) {
  // 矢高 ≤ 压顶下沿留一圈楔石，且不超过 1.4 倍半跨（格子只有约 0.45 宽，按半圆拱会贴着水面；略高于半圆的竖椭圆拱）
  const ya = L - 0.055, rise = Math.min(ya - ring - 0.02 - ys, k * len * 1.4);
  if (!(rise > 0)) throw new RangeError('canal arch: storey too low');
  return { k, ys, rise, ya, ring };
}

/** 码头外鼓剖面（与 buildings.js plinth rows 同一组数）：高度 y 处外推量。 */
export function quayProfile(L) {
  const rows = [[0.0, 0.085], [0.1 * L, 0.06], [0.3 * L, 0.022], [0.62 * L, 0.004], [L - 0.055, 0.0]];
  const f = (y) => {
    if (y <= rows[0][0]) return rows[0][1];
    for (let r = 0; r + 1 < rows.length; r++) if (y <= rows[r + 1][0]) return mix(rows[r][1], rows[r + 1][1], (y - rows[r][0]) / (rows[r + 1][0] - rows[r][0]));
    return 0;
  };
  return { rows, f };
}

/**
 * 画桥格 c 的第 i 面（只在 i 是水流轴两端时画并返回 true；否则返回 false，调用方照旧画实心基座）。
 * ctx: { L, K, flare(p, amount) → [x,z], log: [], voussoirs: bool, segments }
 */
export function canalBridgeFace(w, world, c, i, ctx) {
  const axis = canalBridgeAxis(world, c);
  if (axis < 0 || (i !== axis && i !== axis + 2)) return false;
  const { L, K, flare, log, voussoirs = true, segments = 12 } = ctx;
  const { rows, f } = quayProfile(L);
  const face = (j) => {
    const a = c.pts[j % 4], b = c.pts[(j + 1) % 4], [nx, nz] = edgeOut(c, j % 4);
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    // 角点沿用码头逐顶点外法线（相邻岸墙同一顶点同一外鼓），中间点沿本面法线外推
    const P = (s, y, extra = 0) => {
      const o = f(y) + extra;
      if (s <= 1e-9 && flare) { const q = flare(a, o); return [q[0], y, q[1]]; }
      if (s >= 1 - 1e-9 && flare) { const q = flare(b, o); return [q[0], y, q[1]]; }
      return [mix(a.x, b.x, s) + nx * o, y, mix(a.z, b.z, s) + nz * o];
    };
    return { a, b, nx, nz, len, P };
  };
  const F = face(i), out = [F.nx, 0, F.nz];
  const { k, ys, rise, ya } = canalArchParams(L, { len: F.len });
  const xl = 0.5 - k, xr = 0.5 + k;
  const th = (q) => (q * Math.PI) / segments;
  const arch = (q) => ({ s: 0.5 - k * Math.cos(th(q)), y: ys + rise * Math.sin(th(q)) });
  const shade = (r) => (0.86 + 0.05 * r) * (0.96 + 0.08 * (((c.id * 7 + i * 3 + r) * 2654435761 >>> 0) % 1000) / 1000);

  // 1) 桥台：拱两侧按 rows 分带，外鼓与码头一致
  for (let r = 0; r < rows.length - 1; r++) {
    const [y0] = rows[r], [y1] = rows[r + 1], col = r < 2 ? K.stoneDark : K.stone;
    w.quad(F.P(0, y0), F.P(xl, y0), F.P(xl, y1), F.P(0, y1), out, col, shade(r));
    w.quad(F.P(xr, y0), F.P(1, y0), F.P(1, y1), F.P(xr, y1), out, col, shade(r));
  }
  // 2) 拱上三角墙：每段拱弦到压顶下沿 ya
  for (let q = 0; q < segments; q++) {
    const p0 = arch(q), p1 = arch(q + 1);
    w.quad(F.P(p0.s, p0.y), F.P(p1.s, p1.y), F.P(p1.s, ya), F.P(p0.s, ya), out, K.stone, 0.95);
  }
  // 3) 压顶红带（与 plinth 相同的三片）
  { const o = 0.012, yb = L + 0.006, a = F.a, b = F.b, nx = F.nx, nz = F.nz;
    w.quad([a.x + nx * o, ya, a.z + nz * o], [b.x + nx * o, ya, b.z + nz * o], [b.x + nx * o, yb, b.z + nz * o], [a.x + nx * o, yb, a.z + nz * o], out, K.band, 1);
    w.quad([a.x, ya, a.z], [b.x, ya, b.z], [b.x + nx * o, ya, b.z + nz * o], [a.x + nx * o, ya, a.z + nz * o], DOWN, K.band, 0.7);
    w.quad([a.x, yb, a.z], [b.x, yb, b.z], [b.x + nx * o, yb, b.z + nz * o], [a.x + nx * o, yb, a.z + nz * o], UP, K.band, 1.05); }
  // 4) 楔石环 + 键石（共享 archVoussoirs；u∈[0,1] 映射到 s∈[xl,xr]）
  let wedges = 0;
  const spanW = 2 * k * F.len;
  if (voussoirs) {
    const ring = archVoussoirs(spanW, rise, { thickness: 0.045, count: 9 });
    for (const wd of ring.wedges) {
      const key = wd === ring.keystone, Q = (p) => F.P(xl + (xr - xl) * p.u, ys + p.y, 0.006);
      w.quad(Q(wd.quad[0]), Q(wd.quad[3]), Q(wd.quad[2]), Q(wd.quad[1]), out, key ? K.stoneDark : K.frame, key ? 1 : 0.9 + 0.08 * (wd.index % 2));
      wedges++;
    }
  }
  // 5) 拱腹：只在轴的第一面画一次，连到对面（对面边方向相反 → s ↔ 1−s）
  let vault = 0;
  if (i === axis) {
    const G = face(axis + 2), riseG = canalArchParams(L, { len: G.len }).rise;
    const archG = (q) => ({ s: 0.5 - k * Math.cos(th(q)), y: ys + riseG * Math.sin(th(q)) });
    const cx = c.cx, cz = c.cz;
    for (let q = 0; q < segments; q++) {
      const p0 = arch(q), p1 = arch(q + 1);
      const g0 = archG(q), g1 = archG(q + 1);
      const A0 = F.P(p0.s, p0.y), A1 = F.P(p1.s, p1.y), B1 = G.P(1 - g1.s, g1.y), B0 = G.P(1 - g0.s, g0.y);
      const e1 = [A1[0] - A0[0], A1[1] - A0[1], A1[2] - A0[2]], e2 = [B0[0] - A0[0], B0[1] - A0[1], B0[2] - A0[2]];
      let nrm = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const l = Math.hypot(...nrm) || 1; nrm = nrm.map((v) => v / l);
      // 朝拱心（桥洞内部）
      const mid = [(A0[0] + B1[0]) / 2, (A0[1] + B1[1]) / 2, (A0[2] + B1[2]) / 2], toC = [cx - mid[0], ys - mid[1], cz - mid[2]];
      if (nrm[0] * toC[0] + nrm[1] * toC[1] + nrm[2] * toC[2] < 0) nrm = nrm.map((v) => -v);
      w.quad(A0, A1, B1, B0, nrm, K.stoneDark, 0.72 + 0.1 * Math.sin(th(q + 0.5)));
      vault++;
    }
  }
  log?.push({ cell: c.id, face: i, axis, span: spanW, rise, ys, crown: ys + rise, deck: L, wedges, vault, clearance: rise });
  return true;
}

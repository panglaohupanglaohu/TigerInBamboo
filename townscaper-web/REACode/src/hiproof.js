/**
 * hiproof.js — 四坡（攒尖）屋顶：屋脊长度不是参数，是足迹的差
 *
 * 帖子 ID：807256278154301441（Bad North，2017 老片，data.js 原无登记）
 * 原文：`(无原文，仅有视频)` —— 六帧画面判读：
 *   - 红砖方塔（近正方形）顶端是**尖顶**，四条坡面汇于一点，没有山墙；
 *   - 长方体量顶端有**一条短屋脊**（长度约为塔宽减塔深），脊两端各一个三角坡；
 *   - 所有檐口（白色封边带）都在**同一水平高度**，四边都落檐；
 *   - 三座粉/黄/青抹灰小塔用的是**同一款四坡顶**，只是足迹更小。
 *
 * 为什么这么做：画四坡顶最容易犯的错是"给个坡度参数 + 顶上一根脊"，结果是
 * 正方塔上凭空多出一条脊（脊长 ∈ [0, w−d]，方塔就该是 0 = 攒尖）。
 * 反过来，只要把「脊长 = 足迹长 − 足迹宽」「坡角 = atan(矢高 / (足迹宽/2))」
 * 这两条钉死，方塔自动攒尖、长塔自动出脊、四种足迹的**坡角可以不同而檐口仍然齐平**，
 * 这正是原片里一排塔"各高各的、檐线却对得上"的来源。山墙数量是判据：
 * 双坡 = 2 面山墙 + 2 个坡面；四坡 = 0 面山墙 + 4 个坡面（两梯两三角）。
 */

/** 足迹 w≥d（脊沿 x），檐口外挑 o。返回四个坡面 + 可测的量。 */
export function hipRoof(w, d, rise, o = 0) {
  const W = Math.max(w, d), D = Math.min(w, d);
  const EW = W + 2 * o, ED = D + 2 * o;   // 檐口矩形（含外挑）
  const R = Math.max(0, EW - ED);          // 脊长：外挑不影响，仍是 W−D
  const run = ED / 2;                      // 每个坡面的水平进深
  const slopeDeg = (Math.atan2(rise, run) * 180) / Math.PI;
  const rx = R / 2;
  const eave = [[-EW / 2, ED / 2], [EW / 2, ED / 2], [EW / 2, -ED / 2], [-EW / 2, -ED / 2]];

  const faces = [];
  // 两个梯形：长边（y=±ED/2）升到脊
  for (const s of [1, -1]) {
    faces.push({
      kind: 'trap',
      pts: [[-EW / 2, (s * ED) / 2, 0], [EW / 2, (s * ED) / 2, 0], [rx, 0, rise], [-rx, 0, rise]],
    });
  }
  // 两个三角（驼峰/hip 端）：短边（x=±EW/2）
  for (const s of [1, -1]) {
    faces.push({
      kind: 'tri',
      pts: [[(s * EW) / 2, ED / 2, 0], [(s * EW) / 2, -ED / 2, 0], [(s * rx), 0, rise]],
    });
  }

  // 方塔上 R=0，两个"梯形"退化成三角形 —— 必须在这里改判，否则账上写 2 梯 2 三角，
  // 而画面里四个坡面一模一样（攒尖）。
  const apex = R <= 1e-9;
  if (apex) for (const f of faces) f.kind = 'tri';

  let surf = 0;
  for (const f of faces) { f.area = polyArea3(f.pts); f.nz = normalZ(f.pts); surf += f.area; }

  const ridge = R > 1e-9 ? [[-rx, 0, rise], [rx, 0, rise]] : [[0, 0, rise], [0, 0, rise]];
  return {
    w: W, d: D, rise, overhang: o, eaveW: EW, eaveD: ED,
    ridgeLen: R, ridge, eave, faces, slopeDeg,
    surfArea: surf, footArea: W * D,
    surfRatio: surf / (W * D),
    triCount: faces.filter((f) => f.kind === 'tri').length,
    trapCount: faces.filter((f) => f.kind === 'trap').length,
    gableWalls: 0,
    eaveEdges: eave.map((p, i) => [p, eave[(i + 1) % 4]]),
    rakingEdges: 0,
    apex,
  };
}

/** 对照：同足迹的双坡顶（山墙 2 面）。坡角取同一个值，比较面积与山墙数。 */
export function gableRoof(w, d, rise, o = 0) {
  const W = Math.max(w, d), D = Math.min(w, d);
  const EW = W + 2 * o, ED = D + 2 * o;
  const slopeDeg = (Math.atan2(rise, ED / 2) * 180) / Math.PI;
  const faces = [];
  for (const s of [1, -1]) {
    faces.push({
      kind: 'trap',
      pts: [[-EW / 2, (s * ED) / 2, 0], [EW / 2, (s * ED) / 2, 0], [EW / 2, 0, rise], [-EW / 2, 0, rise]],
    });
  }
  let surf = 0;
  for (const f of faces) { f.area = polyArea3(f.pts); surf += f.area; }
  const base = hipRoof(w, d, rise, o);
  return {
    ...base,
    faces, ridgeLen: EW, surfArea: surf, surfRatio: surf / (W * D),
    triCount: 0, trapCount: 2, gableWalls: 2, slopeDeg, apex: false,
    rakingEdges: 2,
    // 山墙 = 檐口以上那两块三角外墙（四坡没有）
    gableWallArea: ED * rise,
    gableTri: [[-EW / 2, ED / 2, 0], [-EW / 2, -ED / 2, 0], [-EW / 2, 0, rise]],
  };
}

export function polyArea3(pts) {
  let n = [0, 0, 0];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    n[0] += a[1] * b[2] - a[2] * b[1];
    n[1] += a[2] * b[0] - a[0] * b[2];
    n[2] += a[0] * b[1] - a[1] * b[0];
  }
  return Math.hypot(n[0], n[1], n[2]) / 2;
}

export function normalZ(pts) {
  let n = [0, 0, 0];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    n[0] += a[1] * b[2] - a[2] * b[1];
    n[1] += a[2] * b[0] - a[0] * b[2];
    n[2] += a[0] * b[1] - a[1] * b[0];
  }
  const L = Math.hypot(n[0], n[1], n[2]) || 1;
  return n[2] / L;
}

/** 原片里的四座塔：足迹 + 塔身层数 + 抹灰色。屋顶参数全部由足迹推。 */
export const TOWERS = [
  { name: 'A 方塔', w: 4, d: 4, rise: 2.0, floors: 5, wall: '#b4533c', plaster: null, x: 0.5, y: 0.5 },
  { name: 'B 长塔', w: 6, d: 4, rise: 1.6, floors: 6, wall: '#b4533c', plaster: null, x: 11, y: -1.5 },
  { name: 'C 长塔', w: 8, d: 4, rise: 1.4, floors: 5, wall: '#b4533c', plaster: null, x: 1.5, y: 9.5 },
  { name: 'D 粉塔', w: 3, d: 3, rise: 1.2, floors: 3, wall: '#e0838d', plaster: '#e0838d', x: 13.5, y: 7 },
  { name: 'E 黄塔', w: 3.4, d: 2.6, rise: 1.1, floors: 3, wall: '#e3bf6d', plaster: '#e3bf6d', x: -7.6, y: 8.6 },
  { name: 'F 青塔', w: 3, d: 3, rise: 1.3, floors: 3, wall: '#6ec6c0', plaster: '#6ec6c0', x: 20, y: 2.5 },
];

export const FLOOR_H = 1.1;

/** 一座塔的全部可测事实（给 lab 的表格直接用，不在页面里重算） */
export function audit(t) {
  const r = hipRoof(t.w, t.d, t.rise, 0.28);
  const g = gableRoof(t.w, t.d, t.rise, 0.28);
  const eaveZ = r.faces.flatMap((f) => f.pts.filter((p) => p[2] === 0).map((p) => p[2]));
  const nz = r.faces.map((f) => Math.abs(f.nz));
  const slopeOf = (v) => (Math.acos(Math.min(1, v)) * 180) / Math.PI;
  return {
    name: t.name,
    foot: `${r.w}×${r.d}`,
    ridgeLen: r.ridgeLen,
    ridgeShare: r.ridgeLen / r.w,
    slopeDeg: r.slopeDeg,
    apex: r.apex,
    tri: r.triCount,
    trap: r.trapCount,
    gable: r.gableWalls,
    surfRatio: r.surfRatio,
    eaveSpread: Math.max(...eaveZ) - Math.min(...eaveZ),
    slopeSpreadDeg: Math.max(...nz.map(slopeOf)) - Math.min(...nz.map(slopeOf)),
    rakingHip: r.rakingEdges,
    rakingGable: g.rakingEdges,
    gableWallArea: g.gableWallArea,
    // 等坡角等矢高下四坡与双坡的瓦面面积**完全相等**（都 = 2·檐长·坡长），
    // 所以面积不能当判据；差别只在山墙与檐口走向。
    areaTie: Math.abs(g.surfArea - r.surfArea) < 1e-9,
    eaveW: r.eaveW, eaveD: r.eaveD,
  };
}

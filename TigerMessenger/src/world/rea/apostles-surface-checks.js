/**
 * apostles-surface-checks.js — R29 / R30 十二门徒地形的硬性检查（纯数据，不依赖 three；Node 单元测试与游戏页面共用）。
 *
 * R29「半透明破面」自动检查（截图之外的第二道证据）：
 *   materialAudit   岩体材质必须不透明（transparent=false、opacity=1、alphaTest=0）；白沫 / 浪 / 悬停框本来就半透明，单独列出不算错
 *   meshIntegrity   岩体网格（水线以上）：反面三角（几何法线与着色法线相反，FrontSide 下会被剔掉、看起来是透的）、
 *                   开口边（焊接后只被一个三角用到的边 = 网格上的洞）、退化三角、非有限坐标
 * R30 植被、岸线白沫跟随新地形：
 *   buildSurfaceIndex + plantDeltas + classifyPlants   每株植物离它脚下岩面的高差（米）：悬空 / 埋进去 / 脚下没有岩面
 *   nearestDistances + classifyFoam                   白沫顶点离岩体水线多远，以及水线有多少被白沫覆盖（米）
 * 所有坐标都在同一块岩体的局部坐标里（游戏里每块岩体自带切平面坐标系，网格和植物都按球面下弯过 y -= bend·(x²+z²)）。
 * 阈值是首版：判据以「同机位、同种子下与认可现状 approved 比有没有变差」为主（compareToBaseline），绝对阈值只给 warn / 粗 fail。
 */
const TRI_AREA_EPS = 1e-10;

/** 三角形 i 的三个顶点下标 */
function triIndex(index, i) { return index ? [index[3 * i], index[3 * i + 1], index[3 * i + 2]] : [3 * i, 3 * i + 1, 3 * i + 2]; }

/**
 * 岩体网格完整性。position / normal：扁平数组（xyz…）；index 可空。bend：球面下弯系数（局部 y 加回 bend·(x²+z²) 才是离海面的高）。
 * waterY：只看「离海面高于 waterY」的三角 / 边（崖脚被故意压到水线以下，那里的开口不算）。
 */
export function meshIntegrity({ position, normal = null, index = null, bend = 0, waterY = 0.05, eps = 1e-3, keepAt = 24 } = {}) {
  if (!position || position.length % 3) throw new RangeError('position 必须是 xyz 扁平数组');
  const nv = position.length / 3, nt = index ? Math.floor(index.length / 3) : Math.floor(nv / 3);
  const up = (v) => position[3 * v + 1] + bend * (position[3 * v] ** 2 + position[3 * v + 2] ** 2);
  // 焊接：按 eps 量化坐标，同一位置的顶点算同一个点
  const weld = new Int32Array(nv), ids = new Map();
  for (let v = 0; v < nv; v++) { const k = Math.round(position[3 * v] / eps) + ',' + Math.round(position[3 * v + 1] / eps) + ',' + Math.round(position[3 * v + 2] / eps); let id = ids.get(k); if (id === undefined) { id = ids.size; ids.set(k, id); } weld[v] = id; }
  const edges = new Map(), edgeAt = new Map();
  let considered = 0, degenerate = 0, nonFinite = 0, inverted = 0; const invertedAt = [], openAt = [];
  for (let t = 0; t < nt; t++) {
    const [a, b, c] = triIndex(index, t);
    const P = [a, b, c].map((v) => [position[3 * v], position[3 * v + 1], position[3 * v + 2]]);
    if (P.flat().some((x) => !Number.isFinite(x))) { nonFinite++; continue; }
    for (const [u, w] of [[a, b], [b, c], [c, a]]) { const x = weld[u], y = weld[w]; if (x === y) continue; const k = x < y ? x * 4294967296 + y : y * 4294967296 + x; edges.set(k, (edges.get(k) || 0) + 1); if (!edgeAt.has(k)) edgeAt.set(k, [u, w]); }
    if (Math.min(up(a), up(b), up(c)) <= waterY) continue;
    considered++;
    const e1 = [P[1][0] - P[0][0], P[1][1] - P[0][1], P[1][2] - P[0][2]], e2 = [P[2][0] - P[0][0], P[2][1] - P[0][1], P[2][2] - P[0][2]];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], len = Math.hypot(...n);
    if (len / 2 < TRI_AREA_EPS) { degenerate++; continue; }
    if (normal) {
      const m = [0, 1, 2].map((k) => normal[3 * a + k] + normal[3 * b + k] + normal[3 * c + k]), ml = Math.hypot(...m);
      if (ml > 1e-6 && (n[0] * m[0] + n[1] * m[1] + n[2] * m[2]) / (len * ml) < -0.3) { inverted++; if (invertedAt.length < keepAt) invertedAt.push([0, 1, 2].map((k) => +((P[0][k] + P[1][k] + P[2][k]) / 3).toFixed(3))); }
    }
  }
  let openEdges = 0;
  for (const [k, n] of edges) {
    if (n !== 1) continue; const [u, w] = edgeAt.get(k);
    if (up(u) <= waterY || up(w) <= waterY) continue;
    openEdges++; if (openAt.length < keepAt) openAt.push([0, 1, 2].map((j) => +((position[3 * u + j] + position[3 * w + j]) / 2).toFixed(3)));
  }
  return { triangles: nt, considered, degenerate, nonFinite, inverted, openEdges, invertedAt, openAt };
}

/** 材质审计：rows = [{ name, kind: 'rock'|'foam'|'waves'|'hover'|'plant'|…, transparent, opacity, alphaTest }] */
export function materialAudit(rows = []) {
  const EXPECTED = new Set(['foam', 'waves', 'hover']);
  const rock = rows.filter((r) => r.kind === 'rock');
  const see = (r) => !!r.transparent || (Number.isFinite(r.opacity) && r.opacity < 0.999) || (Number.isFinite(r.alphaTest) && r.alphaTest > 0);
  const bad = rock.filter(see).map((r) => r.name || '(未命名)');
  const expected = rows.filter((r) => EXPECTED.has(r.kind) && see(r)).map((r) => r.name || r.kind);
  const unexpected = rows.filter((r) => !EXPECTED.has(r.kind) && r.kind !== 'rock' && see(r)).map((r) => r.name || r.kind);
  return { rock: rock.length, transparentRock: bad, expectedTransparent: expected, otherTransparent: unexpected, status: !rock.length ? 'fail' : bad.length ? 'fail' : unexpected.length ? 'warn' : 'pass' };
}

/**
 * 岩面高度索引：把每个三角按 XZ 包围盒放进 bin 网格；查询 (x,z) 时对落在里面的三角做重心插值。
 * 竖直的崖壁三角在 XZ 上投影面积≈0，跳过（植物不会长在竖壁上）。
 */
export function buildSurfaceIndex({ position, index = null, bin = 1 } = {}) {
  const nt = index ? Math.floor(index.length / 3) : Math.floor(position.length / 9), cells = new Map(), tris = [];
  const key = (i, j) => i * 73856093 ^ j * 19349663;
  for (let t = 0; t < nt; t++) {
    const [a, b, c] = triIndex(index, t), ax = position[3 * a], az = position[3 * a + 2], bx = position[3 * b], bz = position[3 * b + 2], cx = position[3 * c], cz = position[3 * c + 2];
    const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (!Number.isFinite(det) || Math.abs(det) < 1e-9) continue;
    const id = tris.length; tris.push([ax, position[3 * a + 1], az, bx, position[3 * b + 1], bz, cx, position[3 * c + 1], cz, det]);
    const i0 = Math.floor(Math.min(ax, bx, cx) / bin), i1 = Math.floor(Math.max(ax, bx, cx) / bin), j0 = Math.floor(Math.min(az, bz, cz) / bin), j1 = Math.floor(Math.max(az, bz, cz) / bin);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = key(i, j); let l = cells.get(k); if (!l) cells.set(k, l = []); l.push(id); }
  }
  /** (x,z) 处所有岩面高度（升序） */
  const heightsAt = (x, z) => {
    const l = cells.get(key(Math.floor(x / bin), Math.floor(z / bin))) || [], out = [];
    for (const id of l) {
      const [ax, ay, az, bx, by, bz, cx, cy, cz, det] = tris[id];
      const w1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det, w2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det, w3 = 1 - w1 - w2;
      if (w1 >= -1e-6 && w2 >= -1e-6 && w3 >= -1e-6) out.push(w1 * ay + w2 * by + w3 * cy);
    }
    return out.sort((a, b) => a - b);
  };
  return { triangles: tris.length, heightsAt };
}

/**
 * 每株植物的高差（局部单位）：植物 y − 它脚下最近的岩面（不高于植物 y + reach 的最高那层）。
 * 正 = 悬空，负 = 埋进岩面（脚下没有 ≤ y+reach 的岩面、只有上方的岩面时，取 y − 上方最低岩面），null = 这个 XZ 上根本没有岩面。
 */
export function plantDeltas(surface, points, { reach = 0.3 } = {}) {
  return points.map(([x, y, z]) => {
    const hs = surface.heightsAt(x, z); if (!hs.length) return null;
    const below = hs.filter((h) => h <= y + reach); if (below.length) return y - below[below.length - 1];
    return y - hs[0];
  });
}

/** 植物高差分级。scale：局部单位 → 米。float / bury：米。 */
export function classifyPlants(deltas, { scale = 1, float = 0.35, bury = 0.8, warnShare = 0.05, failShare = 0.2 } = {}) {
  let floating = 0, buried = 0, off = 0; const abs = [];
  for (const d of deltas) { if (d == null || !Number.isFinite(d)) { off++; continue; } const m = d * scale; abs.push(Math.abs(m)); if (m > float) floating++; else if (m < -bury) buried++; }
  const count = deltas.length, bad = floating + buried + off, share = count ? bad / count : 0;
  abs.sort((a, b) => a - b);
  const p95 = abs.length ? +abs[Math.min(abs.length - 1, Math.floor(abs.length * 0.95))].toFixed(3) : null;
  return { count, ok: count - bad, floating, buried, offSurface: off, badShare: +share.toFixed(4), p95, status: !count ? 'warn' : share > failShare ? 'fail' : share > warnShare ? 'warn' : 'pass' };
}

/** 2D 最近距离：points / refs = [[x,z], …]。超过 maxDist 的记 Infinity。 */
export function nearestDistances(points, refs, { bin = 2, maxDist = 40 } = {}) {
  const grid = new Map(), key = (i, j) => i + ',' + j;
  for (const [x, z] of refs) { const k = key(Math.floor(x / bin), Math.floor(z / bin)); let l = grid.get(k); if (!l) grid.set(k, l = []); l.push([x, z]); }
  const rings = Math.ceil(maxDist / bin);
  return points.map(([x, z]) => {
    const i0 = Math.floor(x / bin), j0 = Math.floor(z / bin); let best = Infinity;
    for (let r = 0; r <= rings; r++) {
      for (let i = i0 - r; i <= i0 + r; i++) for (let j = j0 - r; j <= j0 + r; j++) {
        if (Math.max(Math.abs(i - i0), Math.abs(j - j0)) !== r) continue;
        for (const [a, b] of grid.get(key(i, j)) || []) best = Math.min(best, Math.hypot(a - x, b - z));
      }
      if (best <= r * bin) break;   // 更外一圈不可能更近
    }
    return best <= maxDist ? best : Infinity;
  });
}

/** 白沫分级。foamToCoast：每个白沫顶点到水线的距离；coastToFoam：每个水线点到白沫的距离（局部单位，scale 换成米）。 */
export function classifyFoam({ foamToCoast = [], coastToFoam = [] } = {}, { scale = 1, near = 3, warnShare = 0.1, failShare = 0.35 } = {}) {
  const far = (arr) => arr.filter((d) => !(d * scale <= near)).length;
  const strayed = far(foamToCoast), uncovered = far(coastToFoam);
  const strayShare = foamToCoast.length ? strayed / foamToCoast.length : 0, uncoveredShare = coastToFoam.length ? uncovered / coastToFoam.length : 1;
  const worst = Math.max(strayShare, uncoveredShare);
  return { foam: foamToCoast.length, coast: coastToFoam.length, strayed, uncovered, strayShare: +strayShare.toFixed(4), uncoveredShare: +uncoveredShare.toFixed(4), status: !foamToCoast.length || !coastToFoam.length ? 'fail' : worst > failShare ? 'fail' : worst > warnShare ? 'warn' : 'pass' };
}

/** 一块岩体的检查汇总成 checks（工坊面板与报告共用的格式）。 */
export function surfaceChecks({ materials, integrity, plants, foam }) {
  const out = [], add = (id, name, status, detail) => out.push({ id, name, status, detail });
  if (materials) add('material', '岩体材质不透明', materials.status, materials.transparentRock.length ? `半透明岩体材质：${materials.transparentRock.join('、')}` : `${materials.rock} 个岩体材质不透明${materials.expectedTransparent.length ? `；白沫 / 浪 / 悬停框按设计半透明 ${materials.expectedTransparent.length} 个` : ''}`);
  if (integrity) add('integrity', '水线以上破面', integrity.nonFinite ? 'fail' : integrity.inverted || integrity.openEdges ? 'warn' : 'pass', `反面三角 ${integrity.inverted} · 开口边 ${integrity.openEdges} · 退化 ${integrity.degenerate} · 非有限 ${integrity.nonFinite}（水线以上 ${integrity.considered} / ${integrity.triangles} 面；与 approved 同机位比才下结论）`);
  if (plants) add('plants', '植被贴地', plants.status, `${plants.count} 株抽样：悬空 ${plants.floating} · 埋入 ${plants.buried} · 脚下无岩面 ${plants.offSurface} · |高差| p95 ${plants.p95 ?? '—'} 米`);
  if (foam) add('foam', '岸线白沫跟随', foam.status, `白沫离水线超 3 米 ${foam.strayed}/${foam.foam} · 水线 3 米内无白沫 ${foam.uncovered}/${foam.coast}`);
  return out;
}

export const worst = (statuses) => statuses.includes('fail') ? 'fail' : statuses.includes('warn') ? 'warn' : 'pass';

/**
 * 候选与认可现状 approved 同机位比较：哪些指标变差了。baseline / candidate = checkApostlesSurface 的 totals。
 * 返回 [{ id, name, before, after, detail }]，空数组 = 没有变差。
 */
export function compareToBaseline(baseline, candidate) {
  const out = [], add = (id, name, before, after, detail) => out.push({ id, name, before, after, detail });
  if (!baseline || !candidate) return [{ id: 'missing', name: '缺少对照', before: !!baseline, after: !!candidate, detail: '没有 approved 或候选的检查结果' }];
  const tris = Math.max(1, candidate.considered || 0);
  if (candidate.transparentRock > 0) add('material', '岩体材质半透明', baseline.transparentRock, candidate.transparentRock, '岩体材质不该半透明');
  if (candidate.inverted - baseline.inverted > Math.max(5, tris * 0.002)) add('inverted', '反面三角变多', baseline.inverted, candidate.inverted, '多出的反面三角在 FrontSide 下会被剔除，看起来是透的（半透明破面的常见原因）');
  if (candidate.openEdges - baseline.openEdges > Math.max(10, tris * 0.005)) add('open', '开口边变多', baseline.openEdges, candidate.openEdges, '水线以上网格出现新的洞');
  if (candidate.plantBadShare - baseline.plantBadShare > 0.05) add('plants', '植被不贴地变多', baseline.plantBadShare, candidate.plantBadShare, '比 approved 多 5 个百分点以上的植物悬空 / 埋入 / 脚下无岩面');
  if (candidate.foamUncoveredShare - baseline.foamUncoveredShare > 0.1) add('foam', '白沫没跟上水线', baseline.foamUncoveredShare, candidate.foamUncoveredShare, '比 approved 多 10 个百分点以上的水线 3 米内没有白沫');
  if (candidate.foamStrayShare - baseline.foamStrayShare > 0.1) add('foam-stray', '白沫离岸', baseline.foamStrayShare, candidate.foamStrayShare, '比 approved 多 10 个百分点以上的白沫顶点离水线超过 3 米');
  return out;
}

/** 1579483114178768898（补学 #2 · 网格 A+5「显式双格房屋……预制 socket / 联合 WFC 待补」）
 * + 1751932427272909032（补学 #6 · 模块约束 A+9「指定模块 patch……完整 prefab/socket 待续」）
 * + 1164926304640229376（core/wfc.js 的 socket CSP，本文件直接调用它求解）。
 *
 * 多格 prefab / socket + 联合 WFC，落在「高度场」上（游戏里的山形候选、峡谷阶地都是规则高度网格）。
 *
 * 先查别名（Guide §3.2 第 2 步），重构库里已有、本文件不重复做的：
 *   · core/wfc.js solveWithPrefab —— 一个 prefab、位置事先给定（mapping），外圈 socket 由回调给；
 *   · core/wfc.js jointSubtileCatalog / layeredJointCatalog —— 方格 + 三角格子格的联合目录（多边形网格）；
 *   · build/multitile-wfc.js —— 体素空间里的多格 tile（自带求解器，没有地形，没有门 / 路 socket）；
 *   · build/multicell.js —— 二维双格房屋整体放置 / 撤回（程序模板，头注释写明「不是 prefab/socket 库」）。
 * 本文件补的三件事：
 *   ① prefab 库：多格足迹 × 4 个朝向；每个部件的每条外边声明 socket（墙 w / 门 door）。
 *   ② 联合 WFC：「放哪种 prefab、朝哪、放在哪」和「路、空地」在同一次 solveWFC 里一起解。
 *      prefab 部件之间贴只与搭档匹配的私有标签（p:<prefab>:<朝向>:<i>-<j>，与 solveWithPrefab / multitile-wfc 同一拆法），
 *      所以部件整块出现；门只能对着路，路只能接路 / 门 / 老城保留格，于是新路网会把门接到老城或别的门。
 *   ③ 地形规则：足迹只落在可建格；足迹内高差 ≤ maxStep；坡度 ≤ maxSlope；
 *      保护格（已有建筑及外扩带 = 老城、轨道净空、海 / 无地形、太陡、采样边缘）只能是「保留」。
 * 和原版不同 / 没做的：原版 prefab 的美术、内部房间没有；socket 只有墙 / 门两种；
 *   路网全局连通不是 WFC 约束（WFC 只管局部），由 validateLayout 事后报告；不做竖向多层堆叠（stories 只是体量高度）。
 * 纯函数、确定性（同输入同种子同输出），Node / 浏览器 / Worker 通用。
 */
import { solveWFC } from '../core/wfc.js';

/** 四个方向：0 东(+i) 1 南(+j) 2 西(-i) 3 北(-j)；对边 = (e+2)%4。 */
export const DIRS = Object.freeze([[1, 0], [0, 1], [-1, 0], [0, -1]]);
export const REASON = Object.freeze({ 0: '可建', 1: '老城保护带', 2: '轨道净空', 3: '海 / 无地形', 4: '太陡', 5: '采样边缘' });

/** prefab 库：cells = 足迹（格偏移，部件 0 在原点）；door = [部件, 方向]（必须是外边）；stories = 层数（每层约 3 m）；tower = 加一层的部件。 */
export const PREFAB_LIBRARY = Object.freeze([
  Object.freeze({ id: 'cottage', name: '小屋', cells: [[0, 0]], door: [0, 1], stories: 1, weight: 1 }),
  Object.freeze({ id: 'hall', name: '长屋', cells: [[0, 0], [1, 0]], door: [0, 1], stories: 2, weight: 1 }),
  Object.freeze({ id: 'lhouse', name: 'L 形宅', cells: [[0, 0], [1, 0], [0, 1]], door: [1, 1], stories: 2, weight: 1 }),
  Object.freeze({ id: 'chapel', name: '礼拜堂', cells: [[0, 0], [1, 0], [2, 0]], door: [0, 2], stories: 2, tower: 2, weight: 0.6 }),
  Object.freeze({ id: 'manor', name: '大宅', cells: [[0, 0], [1, 0], [0, 1], [1, 1]], door: [2, 1], stories: 3, weight: 0.8 }),
]);

const key = (i, j) => i + ',' + j;
const rot1 = ([x, y]) => [-y, x];

/** 一个 prefab 转 r 个 90°（东 → 南 → 西 → 北）。门的方向一起转。 */
export function rotatePrefab(p, r) {
  if (!Number.isInteger(r) || r < 0 || r > 3) throw new RangeError('朝向必须是 0..3');
  let cells = p.cells.map((c) => [c[0], c[1]]);
  for (let k = 0; k < r; k++) cells = cells.map(rot1);
  cells = cells.map(([x, y]) => [x + 0, y + 0]);   // 去掉 -0
  return { ...p, rot: r, cells, door: [p.door[0], (p.door[1] + r) % 4] };
}

/** 校验 prefab 库：足迹连通、不重叠、门在外边上。 */
export function validateLibrary(lib = PREFAB_LIBRARY) {
  const errors = [], ids = new Set();
  for (const p of lib) {
    if (!p?.id || ids.has(p.id)) { errors.push(`prefab id 重复或缺失：${p?.id}`); continue; } ids.add(p.id);
    const set = new Set(p.cells.map(([x, y]) => key(x, y)));
    if (set.size !== p.cells.length) errors.push(`${p.id}：足迹有重叠格`);
    if (p.cells[0][0] !== 0 || p.cells[0][1] !== 0) errors.push(`${p.id}：部件 0 必须在原点`);
    const seen = new Set([key(0, 0)]), stack = [[0, 0]];
    while (stack.length) { const [x, y] = stack.pop(); for (const [dx, dy] of DIRS) { const k = key(x + dx, y + dy); if (set.has(k) && !seen.has(k)) { seen.add(k); stack.push([x + dx, y + dy]); } } }
    if (seen.size !== set.size) errors.push(`${p.id}：足迹不连通`);
    const [dp, de] = p.door || []; const c = p.cells[dp];
    if (!c || !Number.isInteger(de) || de < 0 || de > 3) errors.push(`${p.id}：门的部件 / 方向无效`);
    else if (set.has(key(c[0] + DIRS[de][0], c[1] + DIRS[de][1]))) errors.push(`${p.id}：门不在外边上`);
    if (!(p.stories >= 1)) errors.push(`${p.id}：层数无效`);
  }
  return { ok: !errors.length, errors };
}

/** 每个 prefab × 朝向拆成部件 tile；内部边贴私有配对标签，外边贴 socket（门 / 墙）。 */
export function prefabTiles(lib = PREFAB_LIBRARY, { density = 1 } = {}) {
  const tiles = [], variants = [];
  for (const p of lib) for (let r = 0; r < 4; r++) {
    const v = rotatePrefab(p, r), idx = new Map(v.cells.map(([x, y], i) => [key(x, y), i]));
    variants.push(v);
    v.cells.forEach(([x, y], i) => {
      const edges = DIRS.map(([dx, dy], e) => {
        const j = idx.get(key(x + dx, y + dy));
        if (j !== undefined) return `p:${p.id}:${r}:${Math.min(i, j)}-${Math.max(i, j)}`;
        return v.door[0] === i && v.door[1] === e ? 'door' : 'w';
      });
      tiles.push({ id: `pf:${p.id}:${r}:${i}`, edges, prefab: p.id, rot: r, part: i, weight: Math.max(0.05, (p.weight ?? 1) * density * 3 / v.cells.length) });
    });
  }
  return { tiles, variants };
}

/** 填充 tile：空地、15 种路（按位掩码：第 e 位 = 第 e 条边是路）、老城保留 keep、不可通行保留 rim。 */
export function fillTiles({ grassWeight = 1.4, roadWeight = 0.45 } = {}) {
  const out = [{ id: 'grass', edges: ['g', 'g', 'g', 'g'], weight: grassWeight }, { id: 'keep', edges: ['k', 'k', 'k', 'k'], weight: 1 }, { id: 'rim', edges: ['x', 'x', 'x', 'x'], weight: 1 }];
  for (let m = 1; m < 16; m++) {
    const n = (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1), straight = m === 5 || m === 10;
    out.push({ id: 'road:' + m, edges: [0, 1, 2, 3].map((e) => (m >> e) & 1 ? 'r' : 'g'), mask: m, weight: roadWeight * (straight ? 1.6 : n === 1 ? 0.5 : n >= 3 ? 0.35 : 0.9) });
  }
  return out;
}

// socket 相容表（对称）：路 r 接 路 / 门 / 老城 k；空地 g 与墙 w 互接，也接两种保留；门只接路；rim(x) 不接路和门。
const COMPAT = new Map(Object.entries({
  r: ['r', 'door', 'k'], g: ['g', 'w', 'k', 'x'], w: ['g', 'w', 'k', 'x'], door: ['r'], k: ['k', 'g', 'w', 'r', 'x'], x: ['x', 'g', 'w', 'k'],
}).map(([a, list]) => [a, new Set(list)]));
export function socketCompatible(a, b) {
  if (a.charCodeAt(0) === 112 && a[1] === ':') return a === b;   // 'p:' 私有配对标签
  if (b.charCodeAt(0) === 112 && b[1] === ':') return false;
  return !!COMPAT.get(a)?.has(b);
}

/** 两段距离变换（倒角）：到「是」格的距离（米）。 */
function chamfer(n, step, isSrc) {
  const d = new Float64Array(n * n).fill(Infinity);
  for (let q = 0; q < n * n; q++) if (isSrc(q)) d[q] = 0;
  const pass = (i, j, a, b, w) => { const x = i + a, z = j + b; if (x >= 0 && z >= 0 && x < n && z < n) { const v = d[z * n + x] + w * step; if (v < d[j * n + i]) d[j * n + i] = v; } };
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { pass(i, j, -1, 0, 1); pass(i, j, 0, -1, 1); pass(i, j, -1, -1, 1.414); pass(i, j, 1, -1, 1.414); }
  for (let j = n - 1; j >= 0; j--) for (let i = n - 1; i >= 0; i--) { pass(i, j, 1, 0, 1); pass(i, j, 0, 1, 1); pass(i, j, 1, 1, 1.414); pass(i, j, -1, 1, 1.414); }
  return d;
}

/** 把高度场（{ n, step, h[n*n], cls[n*n]（0 地形 1 建筑 2 轨道）, half?, sea? }）聚成建筑格（cellSize 米一格）并标出每格为什么不能建。 */
export function latticeFromField(field, { cellSize = 6, band = 4, railBand = 6, maxSlope = 24, sea = field?.sea ?? 0.3 } = {}) {
  const { n, step, h, cls } = field || {};
  if (!Number.isInteger(n) || n < 4 || !(step > 0) || !h || h.length !== n * n || !cls || cls.length !== n * n) throw new RangeError('高度场无效');
  const k = Math.max(1, Math.round(cellSize / step)), W = Math.floor(n / k), H = W, N = W * H;
  const dB = chamfer(n, step, (q) => cls[q] === 1), dR = chamfer(n, step, (q) => cls[q] === 2);
  const hMin = new Float64Array(N), hMax = new Float64Array(N), hMean = new Float64Array(N), slope = new Float64Array(N), reason = new Uint8Array(N);
  for (let J = 0; J < H; J++) for (let I = 0; I < W; I++) {
    const c = J * W + I; let lo = Infinity, hi = -Infinity, s = 0, cnt = 0, why = 0;
    for (let b = 0; b < k; b++) for (let a = 0; a < k; a++) {
      const q = (J * k + b) * n + I * k + a, v = h[q];
      if (v == null || !Number.isFinite(v) || v <= sea) { why = why || 3; continue; }
      if (cls[q] === 1 || dB[q] < band) why = 1;
      else if ((cls[q] === 2 || dR[q] < railBand) && why !== 1) why = 2;
      lo = Math.min(lo, v); hi = Math.max(hi, v); s += v; cnt++;
    }
    if (!cnt) why = 3;
    hMin[c] = cnt ? lo : 0; hMax[c] = cnt ? hi : 0; hMean[c] = cnt ? s / cnt : 0;
    if (I === 0 || J === 0 || I === W - 1 || J === H - 1) why = why || 5;
    reason[c] = why;
  }
  const cs = k * step;
  for (let J = 0; J < H; J++) for (let I = 0; I < W; I++) {
    const c = J * W + I; if (reason[c] === 3) continue;
    const at = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H || reason[y * W + x] === 3) return hMean[c]; return hMean[y * W + x]; };
    const gx = (at(I + 1, J) - at(I - 1, J)) / (2 * cs), gz = (at(I, J + 1) - at(I, J - 1)) / (2 * cs);
    slope[c] = Math.atan(Math.hypot(gx, gz)) * 180 / Math.PI;
    if (reason[c] === 0 && slope[c] > maxSlope) reason[c] = 4;
  }
  return { n, step, k, W, H, cellSize: cs, half: field.half, hMin, hMax, hMean, slope, reason, params: { cellSize, band, railBand, maxSlope, sea } };
}

/** 在建筑格上挑一个 span×span 的窗口：可建格最多的那块（同分取最靠前）。 */
export function chooseWindow(lat, span = 16) {
  const w = Math.min(span, lat.W), h = Math.min(span, lat.H), S = new Int32Array((lat.W + 1) * (lat.H + 1)), W1 = lat.W + 1;
  for (let J = 0; J < lat.H; J++) for (let I = 0; I < lat.W; I++) S[(J + 1) * W1 + I + 1] = (lat.reason[J * lat.W + I] === 0 ? 1 : 0) + S[J * W1 + I + 1] + S[(J + 1) * W1 + I] - S[J * W1 + I];
  let best = { i0: 0, j0: 0, w, h, buildable: -1 };
  for (let j0 = 0; j0 + h <= lat.H; j0++) for (let i0 = 0; i0 + w <= lat.W; i0++) {
    const c = S[(j0 + h) * W1 + i0 + w] - S[j0 * W1 + i0 + w] - S[(j0 + h) * W1 + i0] + S[j0 * W1 + i0];
    if (c > best.buildable) best = { i0, j0, w, h, buildable: c };
  }
  return best;
}

/** 一个窗口的联合 WFC 问题：网格（窗口局部 id）、tile 目录、每格允许的 tile。 */
export function buildJointProblem(lat, win, { library = PREFAB_LIBRARY, density = 1, maxStep = 1.6, roadSlope = null, grassWeight, roadWeight } = {}) {
  const { w, h, i0, j0 } = win, inWin = (I, J) => I >= i0 && J >= j0 && I < i0 + w && J < j0 + h, ring = (I, J) => I === i0 || J === j0 || I === i0 + w - 1 || J === j0 + h - 1;
  const R = (I, J) => lat.reason[J * lat.W + I], free = (I, J) => inWin(I, J) && !ring(I, J) && R(I, J) === 0;
  const roadOk = (I, J) => free(I, J) && (roadSlope == null || lat.slope[J * lat.W + I] <= roadSlope);
  const cells = [];
  for (let wj = 0; wj < h; wj++) for (let wi = 0; wi < w; wi++) {
    const id = wj * w + wi;
    cells.push({ id, n: 4, wi, wj, I: i0 + wi, J: j0 + wj, edgeNeighbors: [wi + 1 < w ? id + 1 : -1, wj + 1 < h ? id + w : -1, wi > 0 ? id - 1 : -1, wj > 0 ? id - w : -1], edgeTwins: [2, 3, 0, 1] });
  }
  const { tiles: parts, variants } = prefabTiles(library, { density });
  const tiles = [...fillTiles({ grassWeight, roadWeight }), ...parts];
  // 每个朝向的 prefab 能放的锚点：足迹全在可建格、足迹内高差 ≤ maxStep、门外那一格能修路
  const anchors = new Map();
  for (const v of variants) {
    const ok = new Set(), [dp, de] = v.door;
    for (let J = j0; J < j0 + h; J++) for (let I = i0; I < i0 + w; I++) {
      let lo = Infinity, hi = -Infinity, fits = true;
      for (const [dx, dy] of v.cells) { const x = I + dx, y = J + dy; if (!free(x, y)) { fits = false; break; } const c = y * lat.W + x; lo = Math.min(lo, lat.hMin[c]); hi = Math.max(hi, lat.hMax[c]); }
      if (!fits || hi - lo > maxStep) continue;
      const dI = I + v.cells[dp][0] + DIRS[de][0], dJ = J + v.cells[dp][1] + DIRS[de][1];
      if (!roadOk(dI, dJ)) continue;
      ok.add(key(I, J));
    }
    anchors.set(v.id + ':' + v.rot, ok);
  }
  const roads = tiles.filter((t) => t.id.startsWith('road:')).map((t) => t.id), allowed = {};
  let feasibleParts = 0;
  for (const c of cells) {
    const r = R(c.I, c.J);
    if (r === 1 && !ring(c.I, c.J)) { allowed[c.id] = ['keep']; continue; }
    if (!free(c.I, c.J)) { allowed[c.id] = r === 1 ? ['keep'] : ['rim']; continue; }
    const list = ['grass', ...(roadOk(c.I, c.J) ? roads : [])];
    for (const t of parts) { const v = variants.find((x) => x.id === t.prefab && x.rot === t.rot), [dx, dy] = v.cells[t.part]; if (anchors.get(t.prefab + ':' + t.rot).has(key(c.I - dx, c.J - dy))) { list.push(t.id); feasibleParts++; } }
    allowed[c.id] = list;
  }
  return { grid: { cells }, tiles, allowed, variants, anchors: Object.fromEntries([...anchors].map(([k2, s]) => [k2, s.size])), feasibleParts };
}

const hash32 = (a, b) => { let x = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263); x = Math.imul(x ^ (x >>> 13), 1274126177); return (x ^ (x >>> 16)) >>> 0; };

/** 把 solveWFC 的结果解码成「整栋建筑 + 路」。部件按锚点归组，缺部件的组判失败（正常情况下配对标签保证不会缺）。 */
export function decodeLayout(lat, win, problem, tilesByCell, { seed = 1 } = {}) {
  const groups = new Map(), roads = [], errors = [];
  for (const c of problem.grid.cells) {
    const id = tilesByCell[c.id]; if (!id) continue;
    if (id.startsWith('road:')) { roads.push({ cell: [c.I, c.J], mask: Number(id.slice(5)), h: +lat.hMean[c.J * lat.W + c.I].toFixed(2) }); continue; }
    if (!id.startsWith('pf:')) continue;
    const [, prefab, r, part] = id.split(':'), v = problem.variants.find((x) => x.id === prefab && x.rot === Number(r)), off = v.cells[Number(part)];
    const aI = c.I - off[0], aJ = c.J - off[1], g = prefab + ':' + r + ':' + key(aI, aJ);
    if (!groups.has(g)) groups.set(g, { v, anchor: [aI, aJ], parts: new Set() });
    groups.get(g).parts.add(Number(part));
  }
  const placements = [];
  for (const { v, anchor, parts } of [...groups.values()].sort((a, b) => a.anchor[1] - b.anchor[1] || a.anchor[0] - b.anchor[0] || a.v.id.localeCompare(b.v.id))) {
    if (parts.size !== v.cells.length) { errors.push(`${v.name} @${anchor} 缺部件（${parts.size}/${v.cells.length}）`); continue; }
    const cells = v.cells.map(([dx, dy]) => [anchor[0] + dx, anchor[1] + dy]);
    let lo = Infinity, hi = -Infinity; for (const [I, J] of cells) { const q = J * lat.W + I; lo = Math.min(lo, lat.hMin[q]); hi = Math.max(hi, lat.hMax[q]); }
    const [dp, de] = v.door, n = placements.length;
    // instance：整栋的稳定身份（prefab + 锚点，同种子重生成同 id；同锚点换朝向/层数仍同一栋）。
    placements.push({ n, instance: `pf:${v.id}:${anchor[0]}x${anchor[1]}`, prefab: v.id, name: v.name, rot: v.rot, anchor, cells, floor: +lo.toFixed(2), base: +(hi + 0.05).toFixed(2), stories: v.stories, tower: v.tower ?? null, door: { cell: cells[dp], dir: de }, color: hash32(seed, n * 31 + cells.length) % 5 });
  }
  return { placements, roads, errors };
}

/** 格中心（米，场景舞台坐标）。需要 field.half（采样网格以场景中心为原点：x = i·step − half）。 */
export function cellCenter(layout, I, J) {
  const c = (v) => (v * layout.k + (layout.k - 1) / 2) * layout.step - (layout.half ?? 0);
  return { x: +c(I).toFixed(3), z: +c(J).toFixed(3) };
}

/**
 * 联合 WFC 摆一个建筑群：选窗口 → 建问题 → core/wfc.js solveWFC（weighted）→ 解码。
 * 失败（矛盾 / 超预算 / 一栋都没放下）就换种子重试，最多 retries 次；全部失败返回 ok:false 和原因，不抛。
 */
export function solveJointLayout(field, opts = {}) {
  const { seed = 1, span = 16, retries = 4, maxSteps = 300000, window: forced = null, minBuildings = 1, prefabs = null } = opts;
  const library = (opts.library || PREFAB_LIBRARY).filter((p) => !prefabs || prefabs.includes(p.id));
  const lib = validateLibrary(library); if (!lib.ok) return { ok: false, reason: 'prefab 库无效：' + lib.errors.join('；') };
  if (!library.length) return { ok: false, reason: '没有可用的 prefab' };
  const lat = latticeFromField(field, opts), win = forced ? { ...forced } : chooseWindow(lat, span);
  if (win.w < 3 || win.h < 3) return { ok: false, reason: '采样网格太小', lattice: summarizeLattice(lat) };
  const problem = buildJointProblem(lat, win, { ...opts, library });
  if (!problem.feasibleParts) return { ok: false, reason: '窗口里没有一处能放下任何 prefab（可建格不够平或不够大）', lattice: summarizeLattice(lat), window: win };
  const tries = [];
  for (let t = 0; t <= retries; t++) {
    const s = seed + t * 7919;
    const res = solveWFC(problem.grid, { tiles: problem.tiles, seed: s, allowed: problem.allowed, maxSteps, compatible: socketCompatible, weighted: true });
    tries.push({ seed: s, ok: res.ok, reason: res.reason, steps: res.steps, backtracks: res.backtracks });
    if (!res.ok) continue;
    const dec = decodeLayout(lat, win, problem, res.tiles, { seed: s });
    if (dec.errors.length || dec.placements.length < minBuildings) { tries.at(-1).reason = dec.errors[0] || `只放下 ${dec.placements.length} 栋`; continue; }
    const layout = { version: 1, seed: s, requestedSeed: seed, k: lat.k, step: lat.step, half: lat.half ?? null, cellSize: lat.cellSize, W: lat.W, H: lat.H, window: { i0: win.i0, j0: win.j0, w: win.w, h: win.h },
      params: { ...lat.params, maxStep: opts.maxStep ?? 1.6, density: opts.density ?? 1, prefabs: library.map((p) => p.id) }, placements: dec.placements, roads: dec.roads };
    return { ok: true, layout, tries, lattice: summarizeLattice(lat), stats: layoutStats(layout) };
  }
  return { ok: false, reason: '联合 WFC 没解出来：' + tries.map((x) => x.reason).join(' / '), tries, lattice: summarizeLattice(lat), window: win };
}

export function summarizeLattice(lat) {
  const counts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }; for (const r of lat.reason) counts[r]++;
  return { W: lat.W, H: lat.H, k: lat.k, cellSize: lat.cellSize, counts, labels: REASON };
}
export function layoutStats(layout) {
  const byPrefab = {}; let cells = 0; for (const p of layout.placements) { byPrefab[p.prefab] = (byPrefab[p.prefab] || 0) + 1; cells += p.cells.length; }
  return { buildings: layout.placements.length, buildingCells: cells, roadCells: layout.roads.length, byPrefab };
}

/** 建筑 / 路落到的采样格（高度场下标），给验证与保护检查用。 */
export function layoutProbeCells(layout, n) {
  const k = layout.k, out = { building: [], road: [] };
  const push = (arr, [I, J]) => { for (let b = 0; b < k; b++) for (let a = 0; a < k; a++) { const i = I * k + a, j = J * k + b; if (i < n && j < n) arr.push(j * n + i); } };
  for (const p of layout.placements) for (const c of p.cells) push(out.building, c);
  for (const r of layout.roads) push(out.road, r.cell);
  return out;
}

/**
 * 独立验证（不信任求解过程）：只拿原高度场和 layout 重算。
 * fail：足迹落在保护格 / 越界、重叠、足迹不平、门外不是路、形状与 prefab 不符、路落在保护格或路口对着空地；
 * warn：有门的路网既不接老城也不接别的门、建筑数少于 minBuildings。
 */
export function validateLayout(field, layout, { minBuildings = 1, library = PREFAB_LIBRARY } = {}) {
  const checks = [], add = (id, name, status, detail) => checks.push({ id, name, status, detail });
  if (!layout || !Array.isArray(layout.placements) || !Array.isArray(layout.roads)) { add('layout', '建筑群计划', 'fail', '缺 placements / roads'); return { ok: false, checks, stats: null }; }
  const lat = latticeFromField(field, layout.params || {}), at = (I, J) => (I >= 0 && J >= 0 && I < lat.W && J < lat.H ? lat.reason[J * lat.W + I] : 5);
  const used = new Map(), bad = [], overlap = [];
  const claim = (c, who) => { const k2 = key(c[0], c[1]); if (used.has(k2)) overlap.push(`${k2}（${used.get(k2)} / ${who}）`); else used.set(k2, who); };
  const byId = new Map(library.map((p) => [p.id, p]));
  const shape = [], flat = [], door = [];
  for (const p of layout.placements) {
    const who = `${p.name || p.prefab}#${p.n}`;
    for (const c of p.cells) { claim(c, who); if (at(c[0], c[1]) !== 0) bad.push(`${who} 在 ${key(c[0], c[1])}（${REASON[at(c[0], c[1])]}）`); }
    const lib = byId.get(p.prefab);
    if (!lib) shape.push(`${who}：库里没有 ${p.prefab}`);
    else { const v = rotatePrefab(lib, p.rot), want = v.cells.map(([dx, dy]) => key(p.anchor[0] + dx, p.anchor[1] + dy)).sort().join(' '), got = p.cells.map((c) => key(c[0], c[1])).sort().join(' '); if (want !== got) shape.push(`${who}：足迹与 prefab 不符`); }
    let lo = Infinity, hi = -Infinity; for (const [I, J] of p.cells) { if (at(I, J) === 5 && (I < 0 || J < 0 || I >= lat.W || J >= lat.H)) continue; const q = J * lat.W + I; lo = Math.min(lo, lat.hMin[q]); hi = Math.max(hi, lat.hMax[q]); }
    if (hi - lo > (layout.params?.maxStep ?? 1.6) + 1e-6) flat.push(`${who} 高差 ${(hi - lo).toFixed(2)} m`);
  }
  const roadAt = new Map(layout.roads.map((r) => [key(r.cell[0], r.cell[1]), r.mask]));
  for (const r of layout.roads) { claim(r.cell, '路'); if (at(r.cell[0], r.cell[1]) !== 0) bad.push(`路在 ${key(r.cell[0], r.cell[1])}（${REASON[at(r.cell[0], r.cell[1])]}）`); }
  const doorAt = new Set();
  for (const p of layout.placements) { const [I, J] = p.door.cell, [dx, dy] = DIRS[p.door.dir], o = key(I + dx, J + dy); doorAt.add(o + '>' + ((p.door.dir + 2) % 4)); const m = roadAt.get(o); if (m == null) door.push(`${p.name || p.prefab}#${p.n} 门外 ${o} 不是路`); else if (!((m >> ((p.door.dir + 2) % 4)) & 1)) door.push(`${p.name || p.prefab}#${p.n} 门外的路没朝门开口`); }
  const dangling = [];
  for (const r of layout.roads) for (let e = 0; e < 4; e++) if ((r.mask >> e) & 1) {
    const I = r.cell[0] + DIRS[e][0], J = r.cell[1] + DIRS[e][1], o = key(I, J), m = roadAt.get(o);
    const ok = (m != null && ((m >> ((e + 2) % 4)) & 1)) || doorAt.has(key(r.cell[0], r.cell[1]) + '>' + e) || at(I, J) === 1;
    if (!ok) dangling.push(`${key(r.cell[0], r.cell[1])} 的第 ${e} 边`);
  }
  add('footprint', '足迹不压保护格', bad.length ? 'fail' : 'pass', bad.length ? bad.slice(0, 4).join('；') + (bad.length > 4 ? ` 等 ${bad.length} 处` : '') : `${layout.placements.length} 栋都在可建格上`);
  add('overlap', '建筑 / 路不重叠', overlap.length ? 'fail' : 'pass', overlap.length ? overlap.slice(0, 3).join('；') : `共占 ${used.size} 格`);
  add('shape', '足迹 = prefab 形状', shape.length ? 'fail' : 'pass', shape.length ? shape.slice(0, 3).join('；') : '每栋与库里的 prefab × 朝向一致');
  add('flat', '足迹高差', flat.length ? 'fail' : 'pass', flat.length ? flat.slice(0, 3).join('；') : `每栋 ≤ ${layout.params?.maxStep ?? 1.6} m`);
  add('door', '门 socket 对着路', door.length ? 'fail' : 'pass', door.length ? door.slice(0, 3).join('；') : `${layout.placements.length} 扇门都对着路`);
  add('roads', '路 socket 不悬空', dangling.length ? 'fail' : 'pass', dangling.length ? dangling.slice(0, 3).join('；') : `${layout.roads.length} 格路都接上了`);
  // 路网连通：每个连通块是否接到老城（保留格）或至少两扇门
  const seen = new Set(); let comps = 0, linked = 0, lonelyDoors = 0;
  for (const r of layout.roads) {
    const k0 = key(r.cell[0], r.cell[1]); if (seen.has(k0)) continue; comps++;
    const stack = [r.cell], doors = new Set(); let town = false; seen.add(k0);
    while (stack.length) {
      const [I, J] = stack.pop(), m = roadAt.get(key(I, J));
      for (let e = 0; e < 4; e++) if ((m >> e) & 1) { const x = I + DIRS[e][0], y = J + DIRS[e][1], o = key(x, y); if (roadAt.has(o) && !seen.has(o)) { seen.add(o); stack.push([x, y]); } else if (at(x, y) === 1) town = true; if (doorAt.has(key(I, J) + '>' + e)) doors.add(key(I, J) + '>' + e); }
    }
    if (town || doors.size >= 2) linked++; else lonelyDoors += doors.size;
  }
  add('reach', '路网接到老城或别的门', comps && linked < comps ? 'warn' : 'pass', comps ? `${comps} 段路网，${linked} 段接到老城或 ≥ 2 扇门${lonelyDoors ? `；${lonelyDoors} 扇门的路是孤立的` : ''}` : '没有路');
  add('count', '建筑数量', layout.placements.length >= minBuildings ? 'pass' : 'warn', `${layout.placements.length} 栋（要求 ≥ ${minBuildings}）`);
  return { ok: !checks.some((c) => c.status === 'fail'), checks, stats: layoutStats(layout) };
}

/** 整体替换：同一窗口换一个种子重新解一组；不改输入。 */
export function relayout(field, layout, { seed = (layout?.seed ?? 1) + 1, ...opts } = {}) {
  if (!layout?.window) throw new RangeError('需要原建筑群的窗口');
  return solveJointLayout(field, { ...(layout.params || {}), ...opts, seed, window: layout.window, prefabs: layout.params?.prefabs || null });
}

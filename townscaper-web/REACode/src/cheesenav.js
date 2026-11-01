/**
 * cheesenav.js — 在"瑞士奶酪"里导航：实体到处都是洞，路得从洞里穿。
 *
 * 原文（x.com/OskSta/status/906425294533394432, 2017-09-09）：
 *
 *   "It's like navigating a Swiss cheese"
 *
 * 画面（24 帧，420×420 等距俯视）：一座紫灰色的岛楼，**拱门/洞道特别多** ——
 * 底层一圈拱、中间穿堂、上层还有天井；一个深色小人（第 12 帧之后才看得清）在
 * 这些洞之间绕，走的路**不是外围平台**，是从拱洞里穿过去的。
 * 岛体量不大，但"能走的地方"被切得七零八落 —— 原话的瑞士奶酪就是这个意思：
 * 空间是连通的，但连通路径是一堆弯弯曲曲的洞。
 *
 * 为什么值得单独做一层：
 *   在**图**上跑 Dijkstra 谁都会，麻烦在于"图从哪来"。实体-空腔这种几何，
 *   2D 网格寻路是套不上的（洞在上下方向也在穿），必须先在**体素**上生成可行走图：
 *     · 空腔格 = 空气；
 *     · 可行走 = 该格是空气 **且** 下一格是实体（有地板）**且** 上面一格还是空气（有头顶空间）；
 *     · 相邻只在 6 邻接里连（不走斜，否则会穿墙缝）。
 *   这套判据同时解释了片子里的两件事：为什么小人只沿着拱洞走（没有地板的地方不进去），
 *   以及为什么洞道那么"窄"（头顶空间 ≥2 格是硬条件）。
 *
 * 另一个用途（对应 797119718477991936 "Got some basic navigation going" 那片）：
 *   片子里在体素城堡的地板上一颗颗亮起**白点** —— 那就是这套 `navNodes()` 的输出。
 *   所以这个文件同时覆盖了那一条的落点。
 *
 * 纯数据，不 import three；`selfCheck()` 能量出洞数、连通性、绕路倍数。
 */

/* ------------------------------------------------------------ 噪声 */

function hash3(x, y, z, seed) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 1442695040888963407) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise3(x, y, z, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = x - xi, fy = y - yi, fz = z - zi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), sz = fz * fz * (3 - 2 * fz);
  let acc = 0;
  for (let dz = 0; dz < 2; dz++) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
    const w = (dx ? sx : 1 - sx) * (dy ? sy : 1 - sy) * (dz ? sz : 1 - sz);
    acc += w * hash3(xi + dx, yi + dy, zi + dz, seed);
  }
  return acc;
}

function fbm3(x, y, z, seed, oct = 3) {
  let a = 0.5, f = 1, s = 0;
  for (let i = 0; i < oct; i++) { s += a * valueNoise3(x * f, y * f, z * f, seed + i * 17); a *= 0.5; f *= 2.07; }
  return s;
}

/* ------------------------------------------------------------ 造奶酪 */

/**
 * 造一块"瑞士奶酪"：外面是实心壳，里面按噪声挖出大量洞，再挖几条钻来钻去的隧道。
 *
 * @returns {{w,h,d,solid:Uint8Array,seededAt:number[]}}
 */
export function carveCheese({
  w = 26, h = 18, d = 26,
  seed = 7,
  holeScale = 0.70,     // 噪声频率：越大洞越小越多
  solidFrac = 0.55,     // 岛内目标实体率（按噪声分位数自动定阈值）
  holeCut = 0.56,       // 兜底阈值（只有岛内一个格子都没有时才用到）
  shell = 1,            // 外壳厚度（>0 才有"岛"的感觉）
  tunnels = 7,          // 额外挖的隧道条数（少了的话空腔会碎成十几个互相不通的口袋）
  tunnelLen = 90,
} = {}) {
  const solid = new Uint8Array(w * h * d);
  const idx = (x, y, z) => (z * h + y) * w + x;
  const cx = (w - 1) / 2, cz = (d - 1) / 2;

  // 第一遍：先算出"岛内"每格的噪声值，等会儿用**分位数**定阈值。
  // 坑：第一版直接用固定阈值 holeCut=0.56 去比 fbm 值，结果 fbm 的实际分布只有
  // 0.30~0.62（三倍频叠加本来就把方差压小了），阈值一卡，内部几乎全被判成空气 ——
  // 奶酪中间是个大空洞，不是海绵。改成"按目标实体率取分位数"之后，实体率才可控。
  const vals = [];
  const island = new Uint8Array(w * h * d);
  for (let z = shell; z < d - shell; z++) {
    for (let y = shell; y < h - shell; y++) {
      for (let x = shell; x < w - shell; x++) {
        const r = Math.hypot((x - cx) / (w * 0.5), (z - cz) / (d * 0.5));
        const topCut = 1 - (y / h) * 0.55;
        if (r >= topCut * 0.98) continue;
        const c = idx(x, y, z);
        island[c] = 1;
        // 中间层多发洞（片子里拱门都在中下层）
        const bias = 0.10 * Math.sin((y / h) * Math.PI);
        vals.push([c, fbm3(x * holeScale, y * holeScale, z * holeScale, seed, 3) + bias]);
      }
    }
  }
  const sorted = vals.map((v) => v[1]).sort((a, b) => a - b);
  const q = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((1 - solidFrac) * sorted.length))] : holeCut;

  for (let c = 0; c < solid.length; c++) {
    const x = c % w, y = ((c / w) | 0) % h, z = (c / (w * h)) | 0;
    const edge = x < shell || y < shell || z < shell || x >= w - shell || y >= h - shell || z >= d - shell;
    if (edge) { solid[c] = 1; continue; }
    if (!island[c]) { solid[c] = 0; continue; }
  }
  for (const [c, v] of vals) solid[c] = v >= q ? 1 : 0;

  // 隧道：随机方向的行进者，边走边把周围挖空（保证连通，不然奶酪是死的）
  let s = seed * 7919 + 13;
  const rnd = () => ((s = (s * 1664525 + 1013904223) | 0) >>> 0) / 4294967296;
  const seededAt = [];
  for (let t = 0; t < tunnels; t++) {
    let x = 2 + ((rnd() * (w - 4)) | 0), y = 2 + ((rnd() * (h - 6)) | 0), z = 2 + ((rnd() * (d - 4)) | 0);
    seededAt.push(idx(x, y, z));
    let dir = [rnd() < 0.5 ? 1 : -1, 0, 0];
    for (let k = 0; k < tunnelLen; k++) {
      // 偶尔拐弯（拐弯才有"钻来钻去"的形状，直线隧道一眼假）
      if (rnd() < 0.30) {
        const ax = (rnd() * 3) | 0;
        if (ax === 0) dir = [dir[2], 0, dir[0]];
        else if (ax === 1) dir = [dir[0], 0, -dir[2]];
        else dir = [0, rnd() < 0.5 ? 1 : -1, dir[2]];
      }
      x += dir[0]; y += dir[1]; z += dir[2];
      if (x < 1 || y < 1 || z < 1 || x >= w - 1 || y >= h - 2 || z >= d - 1) break;
      // 2×2 截面：1 格宽的隧道在体素里会"看不见"，而且头顶空间不够
      for (let dy = 0; dy <= 1; dy++) for (let dx = 0; dx <= 1; dx++) {
        solid[idx(x + dx, y + dy, z)] = 0;
      }
    }
  }
  return { w, h, d, solid, seededAt };
}

/* ------------------------------------------------------------ 连通 / 导航 */

const NB6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

/** 空腔连通分量（6 邻接）。返回 labels 与每个分量的大小。 */
export function components(ch) {
  const { w, h, d, solid } = ch;
  const labels = new Int32Array(w * h * d).fill(-1);
  const sizes = [];
  const idx = (x, y, z) => (z * h + y) * w + x;
  for (let z = 0; z < d; z++) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c0 = idx(x, y, z);
    if (solid[c0] || labels[c0] >= 0) continue;
    const lab = sizes.length;
    let n = 0;
    const q = [c0]; labels[c0] = lab;
    for (let head = 0; head < q.length; head++) {
      const c = q[head]; n++;
      const cz = (c / (w * h)) | 0, cy = ((c / w) | 0) % h, cx = c % w;
      for (const [dx, dy, dz] of NB6) {
        const nx = cx + dx, ny = cy + dy, nz = cz + dz;
        if (nx < 0 || ny < 0 || nz < 0 || nx >= w || ny >= h || nz >= d) continue;
        const nc = idx(nx, ny, nz);
        if (solid[nc] || labels[nc] >= 0) continue;
        labels[nc] = lab; q.push(nc);
      }
    }
    sizes.push(n);
  }
  // 与外界连通的那个分量（贴着包围盒的空气）单独标出来 —— 不是"洞"
  let outside = -1;
  for (let z = 0; z < d; z++) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (x === 0 || y === 0 || z === 0 || x === w - 1 || y === h - 1 || z === d - 1) {
      const c = idx(x, y, z);
      if (!solid[c] && labels[c] >= 0) { outside = labels[c]; break; }
    }
    if (outside >= 0) break;
  }
  return { labels, sizes, outside, count: sizes.length };
}

/**
 * 可行走格：空气 + 下面有地板 + 上面还有一格空气（头顶空间 ≥2）。
 * 这三条就是"瑞士奶酪里能走的地方"的定义。
 */
export function navNodes(ch) {
  const { w, h, d, solid } = ch;
  const idx = (x, y, z) => (z * h + y) * w + x;
  const floor = new Uint8Array(w * h * d);
  const out = [];
  for (let z = 1; z < d - 1; z++) for (let y = 1; y < h - 2; y++) for (let x = 1; x < w - 1; x++) {
    const c = idx(x, y, z);
    if (solid[c]) continue;
    if (!solid[idx(x, y - 1, z)]) continue;               // 脚下要实
    if (solid[idx(x, y + 1, z)] || solid[idx(x, y + 2, z)]) continue; // 头顶要通
    floor[c] = 1; out.push(c);
  }
  return { floor, nodes: out };
}

/**
 * 在可行走图上跑 BFS（等权，够用；要地形代价就换 Dijkstra，这里不引入）。
 * @returns {{path:number[]|null, dist:number}}
 */
export function findPath(ch, nav, start, goal) {
  const { w, h, d } = ch;
  const idx = (x, y, z) => (z * h + y) * w + x;
  if (!nav.floor[start] || !nav.floor[goal]) return { path: null, dist: Infinity };
  const prev = new Int32Array(w * h * d).fill(-1);
  const seen = new Uint8Array(w * h * d);
  const q = [start]; seen[start] = 1;
  for (let head = 0; head < q.length; head++) {
    const c = q[head];
    if (c === goal) break;
    const cz = (c / (w * h)) | 0, cy = ((c / w) | 0) % h, cx = c % w;
    for (const [dx, dy, dz] of NB6) {
      const nx = cx + dx, ny = cy + dy, nz = cz + dz;
      if (nx < 1 || ny < 1 || nz < 1 || nx >= w - 1 || ny >= h - 1 || nz >= d - 1) continue;
      const nc = idx(nx, ny, nz);
      if (seen[nc] || !nav.floor[nc]) continue;
      seen[nc] = 1; prev[nc] = c; q.push(nc);
    }
  }
  if (!seen[goal]) return { path: null, dist: Infinity };
  const path = [];
  for (let c = goal; c >= 0; c = prev[c]) { path.push(c); if (c === start) break; }
  path.reverse();
  return { path, dist: path.length - 1 };
}

/** 欧氏距离（格子中心），用来算"绕了多少倍"。 */
export function euclid(ch, a, b) {
  const { w, h } = ch;
  const pos = (c) => [c % w, ((c / w) | 0) % h, (c / (w * h)) | 0];
  const [ax, ay, az] = pos(a), [bx, by, bz] = pos(b);
  return Math.hypot(ax - bx, ay - by, az - bz);
}

/**
 * 自检：洞数、可连通性、绕路倍数。
 * 对照组 = 同一块体素但**不挖洞**（只留外壳与隧道）—— 用来证明"绕路"确实是洞造成的。
 */
export function selfCheck(opts = {}) {
  const ch = carveCheese(opts);
  const comp = components(ch);
  const nav = navNodes(ch);

  const solidCount = ch.solid.reduce((a, b) => a + b, 0);
  const cells = ch.w * ch.h * ch.d;
  // 洞：不含"外界"的那些空腔分量
  const cavities = comp.sizes.filter((n, i) => i !== comp.outside).filter((n) => n >= 4);
  const enclosedAir = cavities.reduce((a, b) => a + b, 0);

  // 取两个隔得最远的可行走点，看能不能走通、绕多少
  let best = { ratio: 0, dist: 0, eu: 0, ok: false, path: null };
  const nodes = nav.nodes;
  const step = Math.max(1, Math.floor(nodes.length / 40));
  for (let i = 0; i < nodes.length; i += step) {
    for (let j = i + step; j < nodes.length; j += step * 3) {
      const r = findPath(ch, nav, nodes[i], nodes[j]);
      if (!r.path) continue;
      const eu = euclid(ch, nodes[i], nodes[j]);
      if (eu < 4) continue;
      const ratio = r.dist / eu;
      if (ratio > best.ratio) best = { ratio: +ratio.toFixed(3), dist: r.dist, eu: +eu.toFixed(2), ok: true, path: r.path };
    }
  }

  return {
    dims: [ch.w, ch.h, ch.d],
    cells,
    solidRate: +(solidCount / cells).toFixed(3),
    airRate: +(1 - solidCount / cells).toFixed(3),
    cavities: cavities.length,
    cavitySizes: cavities.sort((a, b) => b - a).slice(0, 5),
    enclosedAirRate: +(enclosedAir / cells).toFixed(3),
    navNodes: nodes.length,
    navRate: +(nodes.length / cells).toFixed(4),
    components: comp.count,
    longestDetour: best.ok ? { ratio: best.ratio, dist: best.dist, euclid: best.eu } : null,
  };
}

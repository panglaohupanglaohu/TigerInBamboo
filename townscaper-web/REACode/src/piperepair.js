/**
 * piperepair.js — 一套"很难用的"模块集，靠自修复收敛到合法状态。
 *
 * 原文（x.com/OskSta/status/793806535898136576, 2016-11-02）：
 *
 *   "I gave it an extra difficult tileset to work with to make sure it can repair
 *    itself when it has screwed up"
 *
 * 画面（24 帧）：一块方形地台，上面反复**长出 / 拆掉**一片白色管道 ——
 * 直管、90° 弯头、三通、法兰环端头；红色线框盒标出"这里有问题"的格子，黄色盒标选中的格子。
 * 帧 9/10/22/23 整片清空，只剩地台上的接口墩子，下一轮又长出完全不同的结构。
 * 所以这不是"生成一次"，而是**生成 → 发现接不上 → 修 → 清空 → 再来**的循环。
 *
 * 关键点：原话说 tileset "extra difficult" —— 模块种类少、朝向受限（只有直管和弯头），
 * 于是随机摆放几乎必然接不上。这时**修复逻辑**（而不是生成逻辑）决定了成品率。
 * 本文件把这件事做成可量的：
 *   ① 生成：随机行走铺管，每个新格从库里挑一个"至少有一个接口对上邻居"的模块；
 *   ② 判定：两个相邻格都存模块时，接口必须**双向对上**（我开你也开），否则算 leak；
 *   ③ 修复：不动点松弛 —— 有邻居朝我开口，我就必须回开；再不行就换模块；还不行就删格子；
 *   ④ 量化：leak 数、换模块次数、删格数、迭代次数、耗时、以及"最后是否连通"。
 */

/** 六向：0 -x, 1 +x, 2 -y, 3 +y, 4 -z, 5 +z。 */
export const DIRS = [
  { x: -1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 },
  { x: 0, y: -1, z: 0 }, { x: 0, y: 1, z: 0 },
  { x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 1 },
];
const OPP = [1, 0, 3, 2, 5, 4];

const bit = (d) => 1 << d;
function countBits(m) { let n = 0; while (m) { m &= m - 1; n++; } return n; }

/**
 * 模块库。`mask` 是接口位掩码。
 * 库里的种类越少，"extra difficult" 越成立 —— 提供 easy/normal/hard 三档。
 */
export function makeLibrary(kind = 'normal') {
  const M = {
    straight: bit(0) | bit(1),
    straightZ: bit(4) | bit(5),
    riser: bit(2) | bit(3),
    elbowXZ: bit(0) | bit(4),
    elbowXZ2: bit(0) | bit(5),
    elbowXZ3: bit(1) | bit(4),
    elbowXZ4: bit(1) | bit(5),
    elbowXY: bit(0) | bit(2),
    elbowXY2: bit(1) | bit(3),
    tee: bit(0) | bit(1) | bit(4),
    cross: bit(0) | bit(1) | bit(4) | bit(5),
    cap: bit(0),
  };
  // 端头必须**六个方向都有**。第一版只给了 +x 一个方向的 cap，
  // 于是凡是"朝被我关掉的方向"悬空的管子都没法收口 → 贪心只能删格，
  // 12 格的结构修完只剩 3 格连通。六向端头一加上，删除就变成罕见操作。
  const caps = DIRS.map((_, d) => ({ name: 'cap' + d, mask: bit(d) }));
  const pick = (keys) => keys.map((k) => ({ name: k, mask: M[k] }));
  const withCaps = (arr) => [...arr, ...caps];
  if (kind === 'hard') {
    // 只有直管 + 两种弯头 + 六向端头：这是原文说的 "extra difficult"
    return withCaps(pick(['straight', 'elbowXZ', 'elbowXZ3']));
  }
  if (kind === 'easy') {
    return Object.keys(M).filter((k) => k !== 'cap').reduce((a, k) => a.concat(pick([k])), caps);
  }
  return withCaps(pick(['straight', 'straightZ', 'elbowXZ', 'elbowXZ2', 'elbowXZ3', 'elbowXZ4', 'elbowXY', 'tee']));
}

/** 格子索引。y 是竖直方向，第 0 层是地台。 */
const idx = (g, x, y, z) => (y * g.W * g.D) + z * g.W + x;
const inside = (g, x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < g.W && y < g.H && z < g.D;

export function makeGrid({ W = 6, H = 4, D = 6 } = {}) {
  const g = { W, H, D, cells: new Uint8Array(W * H * D), mod: new Int16Array(W * H * D).fill(-1) };
  return g;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 生成：从地台随机行走，每个新格挑一个"接口数和已有邻居对得上"的模块。
 * 允许走到接不上（这才是"会 screwed up"的来源），修复在后面。
 */
export function generate({ W = 6, H = 4, D = 6, library = 'hard', steps = 26, seed = 3, corrupt = 0 } = {}) {
  const lib = makeLibrary(library);
  const g = makeGrid({ W, H, D });
  const rnd = mulberry32(seed);
  let x = (W >> 1), y = 0, z = (D >> 1);
  g.cells[idx(g, x, y, z)] = 1;
  g.mod[idx(g, x, y, z)] = Math.max(0, lib.findIndex((m) => m.name === 'cap0'));  // 起手朝 -x，进向记 0

  // 生成期**强制接口继承**：新模块必须朝来路开口，所以长出来的必然是一整条连通的管。
  // 第一版允许它随便挑，于是生成完就是一堆断头，修复只能收口、永远接不上 ——
  // 那时测出来的"连通率 0"其实是生成器的问题，不是修复的。
  let inDir = 0;    // 进向：当前格是朝哪个方向接到上一格的（起点朝 -x）
  for (let s = 0; s < steps; s++) {
    // 每个站位试若干个方向：库里根本没有能"转过去"的模块时，就换方向再试。
    // 不这么写，hard 库第一步就卡死（起手朝下 + 要右转，没有这个模块）——
    // 实测结构只长到 1~2 格，看起来像"修复坏了"，其实是生成器走不动。
    let d = -1, i = -1, nx = 0, ny = 0, nz = 0;
    const order = [0, 1, 2, 3, 4, 5].sort(() => rnd() - 0.5);
    for (const dd of order) {
      const v = DIRS[dd];
      const tx = x + v.x, ty = y + v.y, tz = z + v.z;
      if (!inside(g, tx, ty, tz)) continue;
      if (ty > 0 && rnd() < 0.55) continue;             // 偏向在地台上铺
      const j = idx(g, tx, ty, tz);
      if (g.cells[j]) continue;
      const kc = bestModule(lib, bit(inDir) | bit(dd), bit(inDir));
      const kn = bestModule(lib, bit(OPP[dd]), bit(OPP[dd]));
      if (kc < 0 || kn < 0) continue;
      d = dd; i = j; nx = tx; ny = ty; nz = tz;
      break;
    }
    if (d < 0) break;                                   // 这个库在这个位置转不动了

    // 关键：**两头一起改**。当前的管子要同时含"来向"和"去向"，否则这一段就是单向开口，
    // 按"两边都开"的定义根本不算连通 —— 那是第一版"生成完 largest=1"的根本原因。
    const cur = idx(g, x, y, z);
    const kCur = bestModule(lib, bit(inDir) | bit(d), bit(inDir));
    const kNew = bestModule(lib, bit(OPP[d]), bit(OPP[d]));
    if (kCur < 0 || kNew < 0) continue;
    g.mod[cur] = kCur;
    g.cells[i] = 1;
    g.mod[i] = kNew;
    x = nx; y = ny; z = nz;
    inDir = OPP[d];
  }
  // 收尾：最后一格收口
  const last = idx(g, x, y, z);
  if (g.cells[last]) {
    const k = bestModule(lib, bit(inDir), bit(inDir));
    if (k >= 0) g.mod[last] = k;
  }

  // "screwed up"：按比例把一些格子换成随机模块，模拟摆放错/库不够用。
  // 这才是原文说的场景 —— 生成是对的，用难用的 tileset 摆着摆着就错了。
  if (corrupt > 0) {
    const list = [];
    for (let i = 0; i < g.cells.length; i++) if (g.cells[i]) list.push(i);
    const nBad = Math.round(list.length * corrupt);
    for (let k = 0; k < nBad; k++) {
      const i = list[(rnd() * list.length) | 0];
      g.mod[i] = (rnd() * lib.length) | 0;
    }
  }
  return { g, lib };
}

/**
 * 找出所有 leak：相邻两格都存模块，但接口没有双向对上。
 * 返回 [{a,b,dirA}]，a/b 是格子索引。
 */
export function findLeaks(g, lib) {
  const out = [];
  for (let y = 0; y < g.H; y++) {
    for (let z = 0; z < g.D; z++) {
      for (let x = 0; x < g.W; x++) {
        const i = idx(g, x, y, z);
        if (!g.cells[i]) continue;
        const mi = g.mod[i];
        if (mi < 0) continue;
        const maskA = lib[mi].mask;
        for (let d = 0; d < 6; d++) {
          if (!(maskA & bit(d))) continue;
          const v = DIRS[d];
          const nx = x + v.x, ny = y + v.y, nz = z + v.z;
          if (!inside(g, nx, ny, nz)) { out.push({ a: i, b: -1, d, why: 'facing-outside' }); continue; }
          const j = idx(g, nx, ny, nz);
          if (!g.cells[j]) { out.push({ a: i, b: -1, d, why: 'facing-empty' }); continue; }
          const mj = g.mod[j];
          if (mj < 0 || !(lib[mj].mask & bit(OPP[d]))) out.push({ a: i, b: j, d, why: 'mismatch' });
        }
      }
    }
  }
  return out;
}

/**
 * 修复：**逐格贪心下降**（每个格子上试遍库里的模块 + "删掉"这一手，只接受让本地 leak 变少的那个）。
 *
 * 为什么不写成"每轮全量重算 required 掩码再统一换"：那是第一版，结果**不收敛** ——
 * 两个模块在 2 个 leak 之间来回换，每轮 swap 2 次、leak 恒为 7，跑到迭代上限。
 * 贪心下降有单调性（每步本地 leak 严格减少），所以一定停；停不下来就说明这个格局在
 * 这套库里无解，那就删格子 —— 这正是原文 "extra difficult tileset" 下会发生的事。
 *
 * `localLeaks(g, lib, i)` 只统计和 i 相关的不一致：
 *   · i 开的每个口，对面必须存在且回开；
 *   · 对面开的每个口，i 必须回开。
 */
export function localLeaks(g, lib, i) {
  if (!g.cells[i]) return 0;
  const y = (i / (g.W * g.D)) | 0, r = i % (g.W * g.D), z = (r / g.W) | 0, x = r % g.W;
  const mi = g.mod[i];
  const mask = mi >= 0 ? lib[mi].mask : 0;
  let n = 0;
  for (let d = 0; d < 6; d++) {
    const v = DIRS[d];
    const nx = x + v.x, ny = y + v.y, nz = z + v.z;
    const insideN = inside(g, nx, ny, nz);
    const j = insideN ? idx(g, nx, ny, nz) : -1;
    const nbPresent = insideN && g.cells[j];
    const nbOpen = nbPresent && g.mod[j] >= 0 && (lib[g.mod[j]].mask & bit(OPP[d]));
    if (mask & bit(d)) { if (!nbOpen) n++; }        // 我开了，对面没接
    else if (nbOpen) n++;                            // 对面开了，我没接
  }
  return n;
}

export function repair(g, lib, { maxIter = 24, allowDelete = true, verbose = false } = {}) {
  const t0 = performance.now();
  const history = [];
  let leaks = findLeaks(g, lib).length;
  history.push({ iter: 0, leaks, swaps: 0, deletes: 0, cells: countCells(g) });
  let totalSwaps = 0, totalDeletes = 0, iters = 0;

  // 两阶段：前几轮只允许换模块（邻居之间往往要互相让一步），
  // 换不动了才允许删格。第一版一上来就能删，于是每格都优先"自删"，
  // 因为删完本地必然 0 leak —— 贪心把结构拆光了。
  let phase = 'swap';
  for (let it = 1; it <= maxIter && leaks > 0; it++) {
    let swaps = 0, deletes = 0;
    const canDelete = allowDelete && phase === 'delete';
    for (let i = 0; i < g.cells.length; i++) {
      if (!g.cells[i]) continue;
      let bestScore = localLeaks(g, lib, i);
      if (bestScore === 0) continue;
      let bestMod = g.mod[i], bestAction = null;
      for (let k = 0; k < lib.length; k++) {
        if (k === g.mod[i]) continue;
        const old = g.mod[i];
        g.mod[i] = k;
        const sc = localLeaks(g, lib, i);
        g.mod[i] = old;
        if (sc < bestScore) { bestScore = sc; bestMod = k; bestAction = 'swap'; }
      }
      if (allowDelete && canDelete) {
        const old = g.cells[i], oldMod = g.mod[i];
        // 地台第一层不删，只留端头（对应帧里清空后剩下的那些"接口墩子"）
        if (i < g.W * g.D) {
          const cap = lib.findIndex((m) => m.name === 'cap');
          if (cap >= 0) {
            g.cells[i] = 1; g.mod[i] = cap;
            const sc = localLeaks(g, lib, i);
            g.cells[i] = old; g.mod[i] = oldMod;
            if (sc < bestScore) { bestScore = sc; bestMod = cap; bestAction = 'swap'; }
          }
        } else {
          g.cells[i] = 0; g.mod[i] = -1;
          const sc = localLeaks(g, lib, i);
          g.cells[i] = old; g.mod[i] = oldMod;
          if (sc < bestScore) { bestScore = sc; bestAction = 'delete'; }
        }
      }
      if (bestAction === 'swap') { g.mod[i] = bestMod; swaps++; }
      else if (bestAction === 'delete') { g.cells[i] = 0; g.mod[i] = -1; deletes++; }
    }
    totalSwaps += swaps; totalDeletes += deletes;
    leaks = findLeaks(g, lib).length;
    history.push({ iter: it, leaks, swaps, deletes, cells: countCells(g) });
    iters = it;
    if (verbose) console.log('  iter', it, 'leaks', leaks, 'swaps', swaps, 'deletes', deletes);
    if (phase === 'swap' && !swaps && !deletes) { phase = 'delete'; continue; }
    if (!swaps && !deletes) break;   // 换也换不动、删也删不动 = 这套库到此为止
  }
  return {
    leaks, history, swaps: totalSwaps, deletes: totalDeletes, iters,
    ms: +(performance.now() - t0).toFixed(2),
    cells: countCells(g),
    connected: largestComponent(g, lib) === countCells(g),
    largest: largestComponent(g, lib),
  };
}

function countCells(g) { let n = 0; for (const c of g.cells) n += c; return n; }

/** 连通块（只沿"接口对上"的边连，所以它同时也是"水/人能走通"的判据）。 */
export function largestComponent(g, lib) {
  const seen = new Uint8Array(g.cells.length);
  let best = 0;
  for (let s = 0; s < g.cells.length; s++) {
    if (!g.cells[s] || seen[s]) continue;
    let n = 0;
    const stack = [s];
    seen[s] = 1;
    while (stack.length) {
      const i = stack.pop(); n++;
      const y = (i / (g.W * g.D)) | 0, r = i % (g.W * g.D), z = (r / g.W) | 0, x = r % g.W;
      const mi = g.mod[i];
      if (mi < 0) continue;
      const mask = lib ? lib[mi].mask : 0x3f;
      for (let d = 0; d < 6; d++) {
        if (lib && !(mask & bit(d))) continue;
        const v = DIRS[d];
        const nx = x + v.x, ny = y + v.y, nz = z + v.z;
        if (!inside(g, nx, ny, nz)) continue;
        const j = idx(g, nx, ny, nz);
        if (!g.cells[j] || seen[j]) continue;
        if (lib) {
          const mj = g.mod[j];
          if (mj < 0 || !(lib[mj].mask & bit(OPP[d]))) continue;
        }
        seen[j] = 1; stack.push(j);
      }
    }
    if (n > best) best = n;
  }
  return best;
}

/**
 * 成品率实验：同一个库、同一批 seed，只换"有没有修复"。
 * 这是原文那句 "make sure it can repair itself" 的可测形式。
 */
export function repairReport({ library = 'hard', seeds = [3, 4, 5, 6, 7], steps = 26, maxIter = 12, corrupt = 0.25 } = {}) {
  const rows = [];
  for (const seed of seeds) {
    const { g, lib } = generate({ library, steps, seed, corrupt });
    const before = findLeaks(g, lib);
    const r = repair(g, lib, { maxIter });
    const rc = reconnect(g, lib);
    rows.push({
      joined: rc.joined,
      componentsBefore: rc.before.components, componentsAfter: rc.after.components,
      seed,
      cellsBefore: countCells(g) + r.deletes,
      leaksBefore: before.length,
      leaksAfter: r.leaks,
      swaps: r.swaps, deletes: r.deletes, iters: r.iters,
      cellsAfter: r.cells, connected: rc.after.components === 1, largest: rc.after.largest,
      ms: r.ms,
    });
  }
  const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
  const bef = sum('leaksBefore'), aft = sum('leaksAfter');
  return {
    library, rows,
    totalLeaksBefore: bef, totalLeaksAfter: aft,
    fixedPct: +(((bef - aft) / Math.max(1, bef)) * 100).toFixed(1),
    connectedRate: +(rows.filter((r) => r.connected).length / rows.length).toFixed(2),
  };
}

/* ------------------------------------------------------------ 画（等距投影） */

/** 等距投影：世界 (x,y,z) → 屏幕。y 向上。 */
export function project(x, y, z, s = 24) {
  return { sx: (x - z) * s * 0.866, sy: (x + z) * s * 0.5 - y * s };
}

/**
 * 把网格画成"管子 + 线框盒"。红色盒 = 有 leak 的格子，黄色 = 当前选中的格子。
 * 管子用粗线近似（帧里就是白色圆管 + 灰色法兰），这里只求"读得出拓扑"。
 */
export function drawPipes(ctx, g, lib, { s = 24, ox = 0, oy = 0, leaks = [], select = -1, showBoxes = true } = {}) {
  const leakSet = new Set();
  for (const l of leaks) { leakSet.add(l.a); if (l.b >= 0) leakSet.add(l.b); }
  // 画家算法：按 (x+z+y) 从远到近
  const order = [];
  for (let y = 0; y < g.H; y++) {
    for (let z = 0; z < g.D; z++) {
      for (let x = 0; x < g.W; x++) {
        const i = idx(g, x, y, z);
        if (g.cells[i]) order.push({ i, x, y, z, key: x + z + y * 0.4 });
      }
    }
  }
  order.sort((a, b) => a.key - b.key);

  for (const o of order) {
    const p = project(o.x + 0.5, o.y + 0.5, o.z + 0.5, s);
    const cx = ox + p.sx, cy = oy + p.sy;
    const mask = g.mod[o.i] >= 0 ? lib[g.mod[o.i]].mask : 0;
    // 管身：每个开口画一段朝外的粗线
    ctx.lineCap = 'round';
    for (let d = 0; d < 6; d++) {
      if (!(mask & bit(d))) continue;
      if (d === 2 || d === 3) continue;      // 竖直口用竖线段表示
      const v = DIRS[d];
      const q = project(o.x + 0.5 + v.x * 0.5, o.y + 0.5, o.z + 0.5 + v.z * 0.5, s);
      ctx.strokeStyle = 'rgba(30,32,36,0.55)';
      ctx.lineWidth = 13;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ox + q.sx, oy + q.sy); ctx.stroke();
      ctx.strokeStyle = '#dfe3e8';
      ctx.lineWidth = 10;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ox + q.sx, oy + q.sy); ctx.stroke();
    }
    if (mask & (bit(2) | bit(3))) {
      const h = mask & bit(3) ? -0.5 : 0.5;
      const q = project(o.x + 0.5, o.y + 0.5 + h, o.z + 0.5, s);
      ctx.strokeStyle = 'rgba(30,32,36,0.55)'; ctx.lineWidth = 13;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ox + q.sx, oy + q.sy); ctx.stroke();
      ctx.strokeStyle = '#dfe3e8'; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ox + q.sx, oy + q.sy); ctx.stroke();
    }
    // 法兰
    ctx.fillStyle = '#c8ccd2';
    ctx.beginPath(); ctx.arc(cx, cy, 7.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#eef1f4';
    ctx.beginPath(); ctx.arc(cx, cy, 4.5, 0, 7); ctx.fill();

    if (showBoxes && (leakSet.has(o.i) || o.i === select)) {
      drawCellBox(ctx, o.x, o.y, o.z, s, ox, oy, o.i === select ? '#e8d24a' : '#d6483c');
    }
  }
}

/** 一个格子的线框立方体（帧里那些红色网格盒）。 */
export function drawCellBox(ctx, x, y, z, s, ox, oy, color) {
  const pts = [];
  for (let k = 0; k < 8; k++) {
    const px = x + (k & 1 ? 1 : 0), py = y + (k & 2 ? 1 : 0), pz = z + (k & 4 ? 1 : 0);
    const q = project(px, py, pz, s);
    pts.push({ x: ox + q.sx, y: oy + q.sy });
  }
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (const [a, b] of E) { ctx.moveTo(pts[a].x, pts[a].y); ctx.lineTo(pts[b].x, pts[b].y); }
  ctx.stroke();
}

/**
 * 重连：把"两边都收了口"的相邻格重新接上。
 *
 * 为什么必须有这一步：closed 是个**局部最优**。一个断口的两侧都不开，
 * 那么任何单侧修改都只是"继续闭着"或"开出更多漏" —— 单格贪心永远不会去接它。
 * 帧里那个"整片长出来又修好"的过程，实际上就是这种**成对**修改：
 * 一侧开口、另一侧也开口，才叫接上。
 *
 * 做法：枚举相邻且共享面两侧都关着的格子对，两边各找一个"含该方向 + 尽量少多余口"的模块，
 * 成对替换；只有当全局 leak 数不增加时才接受。返回重连了多少对、连通块怎么变。
 */
export function reconnect(g, lib, { maxIter = 6 } = {}) {
  const before = componentStats(g, lib);
  let joined = 0;
  const baseLeaks = findLeaks(g, lib).length;
  for (let it = 0; it < maxIter; it++) {
    let changed = 0;
    for (let y = 0; y < g.H; y++) {
      for (let z = 0; z < g.D; z++) {
        for (let x = 0; x < g.W; x++) {
          const i = idx(g, x, y, z);
          if (!g.cells[i]) continue;
          for (let d = 0; d < 6; d++) {
            const v = DIRS[d];
            const nx = x + v.x, ny = y + v.y, nz = z + v.z;
            if (!inside(g, nx, ny, nz)) continue;
            const j = idx(g, nx, ny, nz);
            if (!g.cells[j]) continue;
            const mi = g.mod[i], mj = g.mod[j];
            if (mi < 0 || mj < 0) continue;
            // 只看"两边都关着"的面
            if ((lib[mi].mask & bit(d)) || (lib[mj].mask & bit(OPP[d]))) continue;
            const ki = bestModule(lib, lib[mi].mask | bit(d), bit(d));
            const kj = bestModule(lib, lib[mj].mask | bit(OPP[d]), bit(OPP[d]));
            if (ki < 0 || kj < 0) continue;
            const oldI = g.mod[i], oldJ = g.mod[j];
            g.mod[i] = ki; g.mod[j] = kj;
            const now = findLeaks(g, lib).length;
            if (now <= baseLeaks) { joined++; changed++; }
            else { g.mod[i] = oldI; g.mod[j] = oldJ; }
          }
        }
      }
    }
    if (!changed) break;
  }
  const after = componentStats(g, lib);
  return { joined, before, after, leaks: findLeaks(g, lib).length };
}

/** 在库里挑一个"必须含 must、尽量少额外口"的模块。 */
export function bestModule(lib, must, seedBit) {
  let best = -1, bestExtra = 99;
  for (let k = 0; k < lib.length; k++) {
    const m = lib[k].mask;
    if ((m & must) !== must) continue;
    if (seedBit && !(m & seedBit)) continue;
    const extra = countBits(m & ~must);
    if (extra < bestExtra) { bestExtra = extra; best = k; }
  }
  return best;
}

/** 连通块统计（沿接口对上算）。 */
export function componentStats(g, lib) {
  const seen = new Uint8Array(g.cells.length);
  const sizes = [];
  for (let s = 0; s < g.cells.length; s++) {
    if (!g.cells[s] || seen[s]) continue;
    let n = 0;
    const stack = [s];
    seen[s] = 1;
    while (stack.length) {
      const i = stack.pop(); n++;
      const y = (i / (g.W * g.D)) | 0, r = i % (g.W * g.D), z = (r / g.W) | 0, x = r % g.W;
      const mi = g.mod[i];
      if (mi < 0) continue;
      for (let d = 0; d < 6; d++) {
        if (!(lib[mi].mask & bit(d))) continue;
        const v = DIRS[d];
        const nx = x + v.x, ny = y + v.y, nz = z + v.z;
        if (!inside(g, nx, ny, nz)) continue;
        const j = idx(g, nx, ny, nz);
        if (!g.cells[j] || seen[j]) continue;
        const mj = g.mod[j];
        if (mj < 0 || !(lib[mj].mask & bit(OPP[d]))) continue;
        seen[j] = 1; stack.push(j);
      }
    }
    sizes.push(n);
  }
  sizes.sort((a, b) => b - a);
  return { cells: countCells(g), components: sizes.length, largest: sizes[0] || 0, sizes };
}

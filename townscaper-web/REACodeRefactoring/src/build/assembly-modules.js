/** 787319655648100352「More procedural tile placement. Now in 3D」残差（一）：桥廊 / 围合楼体模块集。
 *
 * 原片事实（REACode/src/tileplace.js 头注，67 帧全核）：深色等距底板上块一次一个蹦出来，
 * 长成有高低起伏的墙 → 第二层 + 细柱 → 带院子的多层宅子；一块候选件悬空漂移、钉死才落位。
 * 本文件补的是「够拼出桥廊与围合楼体的最小 3D 模块集」——socket 标签 + 结构支撑策略的数据，
 * 不是原版模块美术库（形状/贴图未迁，见 acceptanceScope）。
 *
 * 边格式与 build/tile-assembly.js 一致：侧面 {label,v:0}、上边 {label,v:1,solid}、下边 {label,v:-1,solid}；
 * 相容判据复用 labelCompatible（等值 + joins 配对表）。模块声明：
 *   {name, sides:[标签]（长度 n 或 1=全同）, up, down, solid, weight, void?, support}
 *   support：'below'（脚下必须实心/底板）| 'free' | {type:'sides', sockets:[…], min}（侧挂：悬跨）。
 *   void：空模块（空气/庭院内部），只填求解域、不产生拼装步。
 * 平面图（bridgeArcadePlan / courtyardPlan）把一份结构意图展开成「每个 lattice 格一个模块 id」的
 * assignment；缺签名（库里没有该朝向变体）如实报 missing，不猜造。
 * 纯函数、确定性，Node / 浏览器 / Worker 通用；渲染交给消费者。
 */

/** 把模块声明集展开成某 n 侧格阵的 tile 目录：侧标签模式按 n 旋出去重。 */
export function moduleTiles(modules, n) {
  if (!Number.isInteger(n) || n < 3) throw new RangeError('side count');
  const out = [], seen = new Map();
  for (const m of modules) {
    if (!m?.name) throw new TypeError('module name required');
    const base = Array.isArray(m.sides) ? m.sides : [m.sides];
    if (base.length !== 1 && base.length !== n) throw new RangeError(`${m.name}：侧标签数 ${base.length} ≠ ${n}`);
    const rots = base.length === 1 ? [Array(n).fill(base[0])]
      : Array.from({ length: n }, (_, k) => base.map((_, i) => base[(i - k + n) % n]));
    for (let r = 0; r < rots.length; r++) {
      const s = rots[r], key = m.name + '|' + s.join(',');
      if (seen.has(key)) continue;
      seen.set(key, 1);
      const solid = m.solid !== false && !m.void;
      const id = rots.length === 1 && base.length === 1 ? `${m.name}/${n}` : `${m.name}/${n}@${r}`;
      out.push({ id, name: m.name, n, solid, void: !!m.void, weight: m.weight ?? 1, support: m.support ?? 'below',
        sides: s, up: m.up, down: m.down,
        edges: [...s.map((label) => ({ label, v: 0 })), { label: m.up, v: 1, solid }, { label: m.down, v: -1, solid }] });
    }
  }
  return out;
}

/** 按精确签名找 tile：侧面逐边标签 + 上/下标签全等。找不到返回 null。 */
export function matchTile(tiles, { sides, up, down }) {
  for (const t of tiles) {
    if (t.sides?.length !== sides.length || t.up !== up || t.down !== down) continue;
    if (t.sides.every((s, i) => s === sides[i])) return t;
  }
  return null;
}

/** 空模块 id（每个 n 一个；优先 name 'air'）。 */
export function voidTile(tiles, n, prefer = 'air') {
  const voids = tiles.filter((t) => t.void && t.sides?.length === n);
  return voids.find((t) => t.name === prefer)?.id ?? voids[0]?.id ?? null;
}

/* ---------------------------------------------------------------- 桥廊模块集
 * 跨过缺口的有顶廊桥：柱（pier）→ 柱头（cap，侧面挂 D 接口）→ 拱跨（span，两端 D 挂柱头，
 * 底面朝空气=横跨）→ 廊柱（post）→ 廊顶（roof）。标签：A 空气面、P 柱身、U 走道面、D 跨端、R 屋脊。
 * span 是唯一不靠脚下支撑的模块（侧挂 sockets:['D']）——悬跨由两端接口交代，不是无支撑悬空。
 * roof 端头允许 R 对 A（廊顶可以收尾于空），其余接口全等值。 */
export function bridgeArcadeSet() {
  return {
    joins: ['A|R'], gravity: false,
    modules: [
      { name: 'air', sides: 'A', up: 'A', down: 'A', void: true, weight: 6, support: 'free' },
      { name: 'pier', sides: 'A', up: 'P', down: 'P', weight: 4, support: 'below' },
      { name: 'cap.end', sides: ['D', 'A', 'A', 'A'], up: 'U', down: 'P', weight: 2, support: 'below' },
      { name: 'cap.mid', sides: ['D', 'A', 'D', 'A'], up: 'U', down: 'P', weight: 2, support: 'below' },
      { name: 'cap.turn', sides: ['D', 'D', 'A', 'A'], up: 'U', down: 'P', weight: 1, support: 'below' },
      { name: 'span', sides: ['D', 'A', 'D', 'A'], up: 'U', down: 'A', weight: 3, support: { type: 'sides', sockets: ['D'], min: 1 } },
      { name: 'span.turn', sides: ['D', 'D', 'A', 'A'], up: 'U', down: 'A', weight: 1, support: { type: 'sides', sockets: ['D'], min: 1 } },
      { name: 'post', sides: 'A', up: 'P', down: 'U', weight: 2, support: 'below' },
      { name: 'roof', sides: ['A', 'R', 'A', 'R'], up: 'A', down: 'P', weight: 3, support: 'below' },
      { name: 'roof.turn', sides: ['A', 'R', 'R', 'A'], up: 'A', down: 'P', weight: 1, support: 'below' },
      { name: 'roof.end', sides: ['A', 'A', 'A', 'R'], up: 'A', down: 'P', weight: 1, support: 'below' },
    ],
  };
}

/* ---------------------------------------------------------------- 围合楼体模块集
 * 带内院的多层宅：墙（wall，切向 W 接墙、内外面 A 对空气/庭院）叠 wallLevels 层，顶上盖一圈
 * 屋顶（roof，底 W 坐墙、顶 A 朝天）；庭院内可立细柱（pillar + pillar-cap）。
 * 标签：A 空气面（也朝庭院——院子本来就是空的）、W 墙墙相接、P 柱身。无 joins（全等值）。 */
export function courtyardHouseSet() {
  return {
    joins: [], gravity: true,
    modules: [
      { name: 'air', sides: 'A', up: 'A', down: 'A', void: true, weight: 5, support: 'free' },
      { name: 'wall.m', sides: ['A', 'W', 'A', 'W'], up: 'W', down: 'W', weight: 8, support: 'below' },
      { name: 'wall.c', sides: ['A', 'A', 'W', 'W'], up: 'W', down: 'W', weight: 5, support: 'below' },
      { name: 'wall.t', sides: ['A', 'A', 'A', 'W'], up: 'W', down: 'W', weight: 1, support: 'below' },
      { name: 'wall.i', sides: 'A', up: 'W', down: 'W', weight: 1, support: 'below' },          // 孤立端头墙（细院收口）
      { name: 'wall.j', sides: ['A', 'W', 'W', 'W'], up: 'W', down: 'W', weight: 1, support: 'below' },  // 凹角 T 接
      { name: 'wall.x', sides: 'W', up: 'W', down: 'W', weight: 1, support: 'below' },          // 四面环墙（袋形院心）
      { name: 'roof.m', sides: ['A', 'W', 'A', 'W'], up: 'A', down: 'W', weight: 4, support: 'below' },
      { name: 'roof.c', sides: ['A', 'A', 'W', 'W'], up: 'A', down: 'W', weight: 3, support: 'below' },
      { name: 'roof.t', sides: ['A', 'A', 'A', 'W'], up: 'A', down: 'W', weight: 1, support: 'below' },
      { name: 'roof.i', sides: 'A', up: 'A', down: 'W', weight: 1, support: 'below' },
      { name: 'roof.j', sides: ['A', 'W', 'W', 'W'], up: 'A', down: 'W', weight: 1, support: 'below' },
      { name: 'roof.x', sides: 'W', up: 'A', down: 'W', weight: 1, support: 'below' },
      { name: 'pillar', sides: 'A', up: 'P', down: 'P', weight: 1, support: 'below' },
      { name: 'pillar.cap', sides: 'A', up: 'A', down: 'P', weight: 1, support: 'below' },
    ],
  };
}

/* ---------------------------------------------------------------- 平面图
 * lattice = build/tile-assembly.js layeredLattice（cells 带 {cell 基格, level 层}）。
 * tiles = moduleTiles(set.modules, n)。每个 lattice 格都给出 assignment；逐边所需标签
 * 按邻居角色算（neighbor ∈ set → 结构标签，否则 'A'）再 matchTile；缺变体如实进 missing。
 */

/** 基格逐侧边所需标签：邻基格在 inSet 里 → label，否则 'A'。 */
function sideNeeds(world, lc, inSet, label) {
  const base = world.cells[lc.cell], out = [];
  for (let e = 0; e < base.n; e++) out.push(inSet.has(base.edgeNeighbors[e]) ? label : 'A');
  return out;
}

/**
 * 桥廊平面图。deck = 桥面经过的基格 id，按行进顺序排列（相邻两格必须共享一条边）；
 * piers ⊆ deck = 立柱位置（岸墩 / 水中墩——水中墩脚下要有体素支撑，装配校验负责判）；
 * deckLevel = 廊面所在 lattice 层（柱在其下、廊柱廊顶在其上两层）。
 * 返回 {ok, assignment, roles, missing?, deckCells}；missing 非空即库里缺变体，ok:false。
 */
export function bridgeArcadePlan(world, lattice, tiles, { deck, piers = [], deckLevel = 3 } = {}) {
  if (!Array.isArray(deck) || deck.length < 2) return { ok: false, reason: 'deck', detail: '桥面至少两个基格' };
  const n = lattice.cells[0].n - 2;
  const air = voidTile(tiles, n, 'air');
  if (!air) return { ok: false, reason: 'missing', missing: [{ detail: '缺 air 空模块' }] };
  const deckSet = new Set(deck), pierSet = new Set(piers);
  if ([...pierSet].some((id) => !deckSet.has(id))) return { ok: false, reason: 'piers', detail: '墩位必须在桥面上' };
  const byId = new Map(world.cells.map((c) => [c.id, c]));
  for (let i = 1; i < deck.length; i++) {
    const a = byId.get(deck[i - 1]);
    if (!a || !a.edgeNeighbors.includes(deck[i])) return { ok: false, reason: 'deck', detail: `桥面断在 ${deck[i - 1]}→${deck[i]}` };
  }
  if (deckLevel + 2 > lattice.H) return { ok: false, reason: 'height', detail: `deckLevel ${deckLevel}+2 超出 lattice 高 ${lattice.H}` };
  const missing = [], assignment = {}, roles = {};
  const need = (lc, sides, up, down) => {
    const t = matchTile(tiles, { sides, up, down });
    if (!t) { missing.push({ lattice: lc.id, cell: lc.cell, level: lc.level, sides, up, down }); return null; }
    return t.id;
  };
  for (const lc of lattice.cells) {
    let role = 'air', tile = air;
    if (deckSet.has(lc.cell)) {
      const tang = sideNeeds(world, lc, deckSet, 'x').map((s) => s === 'x');
      if (lc.level === deckLevel + 1) { role = 'post'; tile = need(lc, Array(tang.length).fill('A'), 'P', 'U'); }
      else if (lc.level === deckLevel + 2) { role = 'roof'; tile = need(lc, tang.map((t) => (t ? 'R' : 'A')), 'A', 'P'); }
      else if (lc.level === deckLevel) {
        role = pierSet.has(lc.cell) ? 'cap' : 'span';
        tile = pierSet.has(lc.cell)
          ? need(lc, tang.map((t) => (t ? 'D' : 'A')), 'U', 'P')
          : need(lc, tang.map((t) => (t ? 'D' : 'A')), 'U', 'A');
      } else if (lc.level < deckLevel && pierSet.has(lc.cell)) { role = 'pier'; tile = need(lc, Array(tang.length).fill('A'), 'P', 'P'); }
    }
    roles[lc.id] = role;
    if (tile) assignment[lc.id] = tile;
  }
  if (missing.length) return { ok: false, reason: 'missing', missing, assignment, roles };
  return { ok: true, assignment, roles, deckCells: [...deck] };
}

/**
 * 围合楼体平面图。ring = 围墙基格 id（一环即可）；或给 interior = 内院基格 id，
 * 环自动取内院的外圈邻居。wallLevels = 墙层数，顶上一层屋顶（lattice 层 wallLevels+1）；
 * pillars = [{cell, top}] 庭院细柱（1..top-1 层柱身、top 层柱头）。
 * 返回 {ok, assignment, roles, missing?, ringCells, courtCells}。
 */
export function courtyardPlan(world, lattice, tiles, { ring, interior = null, wallLevels = 2, pillars = [] } = {}) {
  const n = lattice.cells[0].n - 2;
  const air = voidTile(tiles, n, 'air');
  if (!air) return { ok: false, reason: 'missing', missing: [{ detail: '缺 air 空模块' }] };
  let ringSet, courtSet = new Set();
  if (interior) {
    courtSet = new Set(interior);
    const r = new Set();
    for (const id of interior) for (const nb of world.cells[id].edgeNeighbors) if (nb >= 0 && !courtSet.has(nb)) r.add(nb);
    ringSet = r;
  } else if (Array.isArray(ring) && ring.length >= 4) ringSet = new Set(ring);
  else return { ok: false, reason: 'ring', detail: '需要 ring（≥4 基格）或 interior' };
  const inLattice = new Set(lattice.cellIds ?? lattice.cells.map((c) => c.cell));
  for (const id of ringSet) if (!inLattice.has(id)) return { ok: false, reason: 'ring', detail: `环格 ${id} 不在 lattice 里` };
  for (const id of courtSet) if (!inLattice.has(id)) return { ok: false, reason: 'ring', detail: `内院格 ${id} 不在 lattice 里` };
  if (wallLevels + 1 > lattice.H) return { ok: false, reason: 'height', detail: `wallLevels ${wallLevels}+1 超出 lattice 高 ${lattice.H}` };
  const missing = [], assignment = {}, roles = {};
  const need = (lc, sides, up, down) => {
    const t = matchTile(tiles, { sides, up, down });
    if (!t) { missing.push({ lattice: lc.id, cell: lc.cell, level: lc.level, sides, up, down }); return null; }
    return t.id;
  };
  const pillarAt = new Map(pillars.map((p) => [p.cell, p.top ?? 2]));
  for (const lc of lattice.cells) {
    let role = 'air', tile = air;
    if (ringSet.has(lc.cell)) {
      const sides = sideNeeds(world, lc, ringSet, 'x').map((s) => (s === 'x' ? 'W' : 'A'));
      if (lc.level <= wallLevels) { role = 'wall'; tile = need(lc, sides, 'W', 'W'); }
      else if (lc.level === wallLevels + 1) { role = 'roof'; tile = need(lc, sides, 'A', 'W'); }
    } else if (pillarAt.has(lc.cell)) {
      const top = pillarAt.get(lc.cell), A = Array(n).fill('A');
      if (lc.level < top) { role = 'pillar'; tile = need(lc, A, 'P', 'P'); }
      else if (lc.level === top) { role = 'pillar.cap'; tile = need(lc, A, 'A', 'P'); }
    }
    roles[lc.id] = role;
    if (tile) assignment[lc.id] = tile;
  }
  if (missing.length) return { ok: false, reason: 'missing', missing, assignment, roles };
  return { ok: true, assignment, roles, ringCells: [...ringSet], courtCells: [...courtSet] };
}

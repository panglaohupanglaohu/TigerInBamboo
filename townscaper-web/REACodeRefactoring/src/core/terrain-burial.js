/**
 * terrain-burial.js — 抬地形吞掉建筑（terrain paint 的体素语义）。
 *
 * 1671840905957978113 那段转台里最怪的一幕：台地顶面和房子齐平，屋顶只剩一道脊露出地面，
 * 半截山墙被铺地吃掉；有的房子被更高的台地整个盖住，只在崖边留下一点屋顶。
 * 这不是"房子沉下去"，是**地表抬升时把同一列里高度不超过新地面的建筑层替换成岩石**，
 * 只有高出地面的那几层还算建筑 —— 所以屋顶还在，墙没了。
 *
 * World.fill() 是整列覆盖，直接拿它当地形刷子会把高出地面的屋顶一起抹掉（那是错的）。
 * 这里给出的规则是：
 *   1. 先记下这一列原有建筑的各层；
 *   2. 岩石填 1..h（含 h）；
 *   3. 只把 > h 的建筑层放回去；
 *   4. <= h 的建筑层算"被吞"，进统计。
 *
 * 另外两个可见量：
 *   - peeking  建筑柱被地面切断（底面 < 地面 < 顶面）= 片子里"只露屋顶"的那种；
 *   - blanketed 地面已经高过整根建筑柱 = 整栋被埋，只剩邻格的崖壁阴影。
 */

/**
 * 墙裙残留 / 悬檐联动（第 106 轮补）。
 *
 * 片子里被地面吞掉的墙**不是干净的一条切线**：崖面上留下了一圈比岩石深的薄带
 * （墙裙/勒脚），而且它只出现在**屋顶还悬在头顶**的那些面上 —— 屋顶挑出去了，
 * 檐下那一圈墙皮才躲过了刷地。被整栋埋掉的柱子没有屋顶，崖面上就什么都没有。
 *
 * 规则（两个量必须联动，不许各画各的）：
 *   - skirt：`ground` 层往下 SKIRT_DEPTH 的一条带，内缩 SKIRT_INSET —— 内缩是因为
 *     墙皮本来就在格内、不在格边，刷地只吃掉格心那一坨；
 *   - eave ：同一张面在 `ground..ground+1` 之间被屋檐**再压进去** EAVE_SETBACK，
 *     所以檐下的墙裙看得见、檐口的投影落得下来。
 *   两张表一一对应（每个 skirt 面必有一个 eave 缺口），这就是"联动"的可检验形式。
 */
export const SKIRT_DEPTH = 0.34;
export const SKIRT_INSET = 0.08;
export const EAVE_SETBACK = 0.17;
/** 檐口在墙头上压出来的高度（层）。 */
export const EAVE_SHADOW = 0.45;

/** 每份 World 一份掩埋台账：cellId → {height, swallowed[], kept[], wall}。 */
const LEDGER = new WeakMap();
function ledgerOf(world) {
  let m = LEDGER.get(world);
  if (!m) { m = new Map(); LEDGER.set(world, m); }
  return m;
}

/** 这一列在 1..MAX 里哪些层是建筑。 */
function builtLevels(world, cell) {
  const out = [];
  const top = world.top(cell);
  for (let lv = 1; lv <= top; lv++) if (world.isBuilt(cell, lv)) out.push(lv);
  return out;
}

/**
 * 把一格的地面抬到 height 层，吞掉不超过 height 的建筑层，保留其上的。
 * @returns {{cell:number, rockTo:number, swallowed:number[], kept:number[]}}
 */
export function buryColumn(world, cell, height) {
  if (!cell) throw new TypeError('buryColumn needs a cell');
  const h = Math.max(0, Math.min(12, Math.round(height)));
  const built = builtLevels(world, cell);
  const kept = built.filter((lv) => lv > h);
  const swallowed = built.filter((lv) => lv <= h);
  // 整列（到保留建筑的顶）先算岩石，再把高出地面的建筑层还原成非岩石
  const restoreTo = Math.max(h, kept.length ? kept[kept.length - 1] : 0);
  world.fill(cell, restoreTo, { rock: true });
  for (const lv of kept) world.setSolid(cell, lv, true);
  // 台账：墙裙要知道"这一列的墙是被刷掉的"，以及原来用的是哪一版墙色
  if (swallowed.length) {
    const led = ledgerOf(world);
    const prev = led.get(cell.id);
    const wall = swallowed.map((lv) => world.color[cell.id]).find((v) => v >= 0);
    led.set(cell.id, {
      height: h,
      swallowed: [...(prev?.swallowed || []), ...swallowed],
      kept,
      wall: wall ?? prev?.wall ?? -1,
    });
  }
  return { cell: cell.id, rockTo: h, swallowed, kept };
}

/** 批量抬地面；cells 可以是 [{cell, height}] 或 (cell, height) 列表。 */
export function raiseGround(world, list) {
  const out = [];
  for (const item of list) {
    const cell = item.cell || item[0];
    const height = item.height ?? item[1];
    out.push(buryColumn(world, cell, height));
  }
  return out;
}

/**
 * 全场地表/建筑的接缝报告（只看现在还剩什么，不查历史）：
 *   - peeking   地面切进了建筑柱、顶上还是建筑 → 片子里"只露屋顶"的那些；
 *   - blanketed 邻格地面高过本格屋顶 → 整栋压在台地下面，只剩崖壁阴影；
 *   - swallowedLevels 被切的层数合计（= 每根 peeking 柱子的 ground）。
 * @returns {{columns:Array, peeking:number, blanketed:number, swallowedLevels:number, ceiling:number}}
 */
export function burialReport(world) {
  const cells = world.cells;
  let peeking = 0, blanketed = 0, swallowedLevels = 0, ceiling = 0;
  const columns = [];
  for (const c of cells) {
    const ground = world.ground(c);
    const top = world.top(c);
    if (ground > ceiling) ceiling = ground;
    let maxNeighborGround = 0;
    for (let i = 0; i < c.n; i++) {
      const nb = world.neighbor(c, i);
      if (nb) maxNeighborGround = Math.max(maxNeighborGround, world.ground(nb));
    }
    const built = world.topIsBuilt(c);
    const peek = built && ground > 0;
    const blanket = built && maxNeighborGround >= top;
    if (peek) { peeking++; swallowedLevels += ground; }
    if (blanket) blanketed++;
    columns.push({
      id: c.id, ground, top, built: built ? top - ground : 0,
      peeking: peek, blanketed: blanket,
      shade: Math.max(0, maxNeighborGround - ground),
    });
  }
  return { columns, peeking, blanketed, swallowedLevels, ceiling };
}

/**
 * 这根建筑柱被地面切掉多少层（0 = 没被切）。只看现在还立着的建筑：
 * 整栋被埋之后这一列已经没有建筑顶，切深记 0（原始层数在 buryColumn 的返回值里）。
 */
export function burialDepth(world, cell) {
  return world.topIsBuilt(cell) ? world.ground(cell) : 0;
}

/** 邻格台地比本格地面高出来的层数（崖壁阴影落在屋顶上的原因）。 */
export function neighborShade(world, cell) {
  let best = 0;
  for (let i = 0; i < cell.n; i++) {
    const nb = world.neighbor(cell, i);
    if (!nb) continue;
    best = Math.max(best, world.ground(nb) - world.ground(cell));
  }
  return best;
}

/**
 * 崖面上的墙裙残留 + 檐下缺口（一一对应 → 联动）。
 *
 * 一张面要同时满足两条才出墙裙：
 *   1. **露在崖上**：邻格地面低于本格地面（或这一面就是网格边界）；
 *   2. **头顶还有屋顶**：本列 `top > ground` 且顶上仍是建筑 —— 屋面挑出格边，
 *      檐下那圈墙皮才没被刷地吃掉；被整栋埋掉的列没有屋顶，什么都不留。
 *
 * @returns {{bands:Array, notches:Array, faces:number, cells:number, buriedCells:number}}
 *   band  = {cell, level, face, y0, y1, inset, wall}（y 以层为单位，relative to 该层底）
 *   notch = {cell, face, y0, y1, setback, skirt:boolean}
 */
export function cliffSkirt(world, {
  depth = SKIRT_DEPTH, inset = SKIRT_INSET, eave = EAVE_SETBACK,
} = {}) {
  const led = ledgerOf(world);
  const bands = [], notches = [];
  let faces = 0;
  const cellIds = new Set();
  for (const [id, rec] of led) {
    const cell = world.cells[id];
    if (!cell) continue;
    const ground = world.ground(cell);
    const top = world.top(cell);
    if (!(ground > 0)) continue;
    cellIds.add(id);
    // 只剩屋顶那些列才留墙裙；整栋被埋（顶上不是建筑）什么都没留
    if (!(top > ground && world.topIsBuilt(cell))) continue;
    for (let i = 0; i < cell.n; i++) {
      const nb = world.neighbor(cell, i);
      const exposed = !nb || world.ground(nb) < ground;
      if (!exposed) continue;
      faces++;
      bands.push({
        cell: id, level: ground, face: i,
        y0: Math.max(0, ground - depth), y1: ground,
        inset, wall: rec.wall,
      });
      // 檐口在同一条面上：从 cut 层往上压出一段（挑出格边的屋顶/上覆台地把墙头压暗）
      notches.push({
        cell: id, face: i,
        y0: ground, y1: Math.min(top, ground + EAVE_SHADOW),
        setback: inset + eave, skirt: true,
      });
    }
  }
  return { bands, notches, faces, cells: cellIds.size, buriedCells: led.size };
}

/** 一面墙裙/缺口在 xz 平面上的两个端点（世界坐标，已内缩）。测试与页面共用。 */
export function skirtSegment(cell, face, inset) {
  const pts = cell.pts;
  const p0 = pts[face], p1 = pts[(face + 1) % pts.length];
  const cx = cell.cx, cz = cell.cz;
  const shrink = (p) => {
    const dx = p.x - cx, dz = p.z - cz;
    const len = Math.hypot(dx, dz) || 1;
    const k = Math.max(0, 1 - inset / len);
    return { x: cx + dx * k, z: cz + dz * k };
  };
  return [shrink(p0), shrink(p1)];
}


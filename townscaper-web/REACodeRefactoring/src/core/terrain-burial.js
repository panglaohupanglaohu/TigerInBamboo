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

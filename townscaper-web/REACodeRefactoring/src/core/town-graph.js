/**
 * town-graph.js — 原版 Town（体素图 + 区域图）的接口，落在共享 World 上。
 * R64（TigerMessenger CAPABILITY_PIPELINE_GUIDE §10 R61–R70）嫁接自原版 townscaper-web/REACode/src/town.js
 * （对应 Placemaker.Graphs.Graph / Qube：每格一列、每层一个 bit；一栋楼 = 顶部同高、边相邻的柱子，拥有一个屋顶、一圈墙）。
 *
 * 重构库早就换成了共享 World（core/world.js：地形与建筑读同一份体素，931196707236392960）。原版同名的
 * PALETTES、pointInQuad、decorateCells、buildCellIndex 已在 core/palette.js、core/spatial.js（对账别名登记在
 * TigerMessenger/tools/refactor/reacode-target-aliases.json；decorateCells 的 size 口径、buildCellIndex 的桶大小与原版不同，写在那里）。
 * 缺的是 Town 这个类自己的行为，这里补上：
 *   · regions()：原版把「顶部同高、边相邻」的所有柱子连成一块——含裸地形、含 1 层走道（isWalkway = h === 1）；
 *     World.regions() 只连「顶部是建筑」的格子。两种都要：光照 / 烟囱 / 植物要知道哪片是一栋楼、哪片是走道。
 *   · colors / roofColors：墙色与屋顶色分开（World 只有墙色 color）。
 *   · isFloating（柱子底下悬空，要立高脚）、neighborTop（第 i 条边的邻居多高）。
 * 不另存体素：solid 直接读写传入的 World（没传就自己建一个），地形管线、光照场、导航看到的是同一份数据。
 *
 * 与原版不同 / 原版的瑕疵：
 *   · MAX_HEIGHT = 9 保留原版上限（World 是 12 层）：setSolid / fill 超过 9 层按原版拒绝；读 top / bottom / isSolid 时只看前 9 层。
 *     World 里别的管线写到第 10–12 层的体素，这个类看不见——写在这里，免得以为它们是同一个口径。
 *   · regions() 里 top = 0 的空格标 −2、没走到的是 −1（原版如此，消费者容易混）；保留，parity 要逐值一致。
 *   · version 是 World.version 与本类颜色改动次数之和（两者都只增不减），区域缓存跟着它失效。
 */
import { World } from './world.js';
import { PALETTES } from './palette.js';

export const MAX_HEIGHT = 9;
const MASK9 = (1 << MAX_HEIGHT) - 1;

export class Town {
  /** @param grid 共享网格（cells[].id、cells[].edgeNeighbors）；options.world 给了就共用它的体素 */
  constructor(grid, { world = null } = {}) {
    this.grid = grid;
    this.world = world || new World(grid);
    const n = grid.cells.length;
    this.colors = new Int8Array(n).fill(-1);
    this.roofColors = new Int8Array(n).fill(-1);
    this.palette = PALETTES.town;
    this._paint = 0;
    this._regions = null;
    this._regionsVersion = -1;
  }

  get cells() { return this.grid.cells; }
  get solid() { return this.world.solid; }
  get version() { return this.world.version + this._paint; }

  reset() {
    this.world.solid.fill(0); this.world.rock.fill(0); this.world.touch();
    this.colors.fill(-1); this.roofColors.fill(-1); this._paint++;
  }

  /* ---------------------------------------------------------------- 体素 */
  isSolid(cell, level) {
    if (level < 1 || level > MAX_HEIGHT) return false;
    return (this.world.solid[cell.id] & (1 << (level - 1))) !== 0;
  }
  setSolid(cell, level, on) {
    if (level < 1 || level > MAX_HEIGHT) return false;
    const bit = 1 << (level - 1), before = this.world.solid[cell.id], after = on ? before | bit : before & ~bit;
    if (after === before) return false;
    this.world.solid[cell.id] = after;
    this.world.rock[cell.id] &= after;
    this.world.touch();
    return true;
  }
  /** 一列最高的实心层，空列 0（只看前 9 层） */
  top(cell) { const m = this.world.solid[cell.id] & MASK9; return m === 0 ? 0 : 32 - Math.clz32(m); }
  /** 一列最低的实心层，空列 0 */
  bottom(cell) { const m = this.world.solid[cell.id] & MASK9; return m === 0 ? 0 : 32 - Math.clz32(m & -m); }
  /** 柱子底下悬空（要立高脚） */
  isFloating(cell) { return this.bottom(cell) > 1; }
  /** 填 1..h，上面的全去掉；没变化返回 false */
  fill(cell, h) {
    const v = Math.max(0, Math.min(MAX_HEIGHT, h | 0)), mask = v === 0 ? 0 : (1 << v) - 1;
    if (this.world.solid[cell.id] === mask) return false;
    this.world.solid[cell.id] = mask;
    this.world.rock[cell.id] &= mask;
    this.world.touch();
    return true;
  }
  /** 第 i 条边的邻居多高，网格外 0 */
  neighborTop(cell, i) { const nid = cell.edgeNeighbors[i]; return nid < 0 ? 0 : this.top(this.grid.cells[nid]); }

  /* ---------------------------------------------------------------- 颜色 */
  color(cell) { return this.colors[cell.id]; }
  setColor(cell, c) { if (this.colors[cell.id] === c) return false; this.colors[cell.id] = c; this._paint++; return true; }
  roofColor(cell) { return this.roofColors[cell.id]; }
  setRoofColor(cell, c) { if (this.roofColors[cell.id] === c) return false; this.roofColors[cell.id] = c; this._paint++; return true; }

  /* ---------------------------------------------------------------- 区域 */
  /** 顶部同高、边相邻的柱子连成一块：一栋楼（或 1 层的走道），拥有一个屋顶平面、一圈墙、一圈栏杆。 */
  regions() {
    if (this._regionsVersion === this.version && this._regions !== null) return this._regions;
    const cells = this.grid.cells, regionOf = new Int32Array(cells.length).fill(-1), regions = [], tops = new Int32Array(cells.length);
    for (const c of cells) tops[c.id] = this.top(c);
    for (const start of cells) {
      if (regionOf[start.id] !== -1) continue;
      const h = tops[start.id];
      if (h === 0) { regionOf[start.id] = -2; continue; }
      const id = regions.length, members = [], stack = [start];
      regionOf[start.id] = id;
      while (stack.length > 0) {
        const cell = stack.pop();
        members.push(cell);
        for (const nid of cell.edgeNeighbors) {
          if (nid < 0 || regionOf[nid] !== -1) continue;
          if (tops[nid] !== h) continue;
          regionOf[nid] = id;
          stack.push(cells[nid]);
        }
      }
      regions.push({ id, h, cells: members, isWalkway: h === 1 });
    }
    this._regions = { regionOf, regions };
    this._regionsVersion = this.version;
    return this._regions;
  }

  /* ---------------------------------------------------------------- 快照 */
  snapshot() { return { solid: this.world.solid.slice(), colors: this.colors.slice(), roofColors: this.roofColors.slice() }; }
  restore(snap) {
    this.world.solid.set(snap.solid);
    for (let i = 0; i < this.world.rock.length; i++) this.world.rock[i] &= snap.solid[i];
    this.world.touch();
    this.colors.set(snap.colors); this.roofColors.set(snap.roofColors); this._paint++;
  }
}

/** 区域图摘要（管线 / 验证用）：一共几块、几块是走道、几块是楼（顶部是建筑体素）、最大一块几格。 */
export function regionSummary(town) {
  const { regions } = town.regions(), w = town.world;
  let walkways = 0, buildings = 0, largest = 0;
  for (const r of regions) {
    if (r.isWalkway) walkways++;
    if (r.cells.some((c) => w.topIsBuilt(c))) buildings++;
    largest = Math.max(largest, r.cells.length);
  }
  return { regions: regions.length, walkways, buildings, largest };
}

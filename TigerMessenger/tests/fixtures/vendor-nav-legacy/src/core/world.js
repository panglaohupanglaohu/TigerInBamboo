/**
 * world.js — 共享体素场：地形和建筑读同一份数据（学习路线第 1 步）。
 *
 * Bad North（931196707236392960）："My generated levels all keep a virtual voxel
 * space. It is used for light baking, soft normals, various 3D textures,
 * simplified collision, wind simulation…" —— 所有系统共用一个体素空间。
 * Townscaper（Placemaker.Graphs.Graph / Qube / Voxel）每格一列体素、按层寻址。
 *
 * 这里把两者合在一起：每格一列，最多 MAX_LEVEL 层，每层一个 bit：
 *   solid[cell]  这一层有没有东西
 *   rock[cell]   这一层是不是地形（岩石）；不是岩石的实心层就是"建筑"
 *   color[cell]  建筑墙色（调色板序号，-1 = 未上色）
 *   river[cell]  这一格的地表是河道
 * 地形管线只写 rock 层，建筑管线只写非 rock 层；渲染、AO、岸线、拾取都只看 solid。
 */

export const MAX_LEVEL = 12;

export class World {
  constructor(grid) {
    this.grid = grid;
    const n = grid.cells.length;
    this.solid = new Uint16Array(n);
    this.rock = new Uint16Array(n);
    this.color = new Int8Array(n).fill(-1);
    this.river = new Uint8Array(n);
    this.palette = null;
    this.version = 0;
    this._regions = null;
    this._regionsVersion = -1;
  }

  get cells() { return this.grid.cells; }
  touch() { this.version++; }

  reset() {
    this.solid.fill(0); this.rock.fill(0); this.color.fill(-1); this.river.fill(0);
    this.touch();
  }

  /* ---- 体素 ------------------------------------------------------------ */
  isSolid(cell, lv) { return lv >= 1 && lv <= MAX_LEVEL && (this.solid[cell.id] >> (lv - 1)) & 1; }
  isRock(cell, lv) { return lv >= 1 && lv <= MAX_LEVEL && (this.rock[cell.id] >> (lv - 1)) & 1; }
  isBuilt(cell, lv) { return this.isSolid(cell, lv) && !this.isRock(cell, lv); }

  setSolid(cell, lv, on, { rock = false } = {}) {
    if (lv < 1 || lv > MAX_LEVEL) return false;
    const bit = 1 << (lv - 1);
    const s0 = this.solid[cell.id], r0 = this.rock[cell.id];
    const s1 = on ? s0 | bit : s0 & ~bit;
    const r1 = on && rock ? r0 | bit : r0 & ~bit;
    if (s0 === s1 && r0 === r1) return false;
    this.solid[cell.id] = s1;
    this.rock[cell.id] = r1;
    this.touch();
    return true;
  }

  /** 把一列填到 h 层（地形用 rock=true）。 */
  fill(cell, h, { rock = false } = {}) {
    const v = Math.max(0, Math.min(MAX_LEVEL, h | 0));
    const mask = v === 0 ? 0 : (1 << v) - 1;
    this.solid[cell.id] = mask;
    this.rock[cell.id] = rock ? mask : 0;
    this.touch();
  }

  top(cell) {
    const m = this.solid[cell.id];
    return m === 0 ? 0 : 32 - Math.clz32(m);
  }
  bottom(cell) {
    const m = this.solid[cell.id];
    return m === 0 ? 0 : 32 - Math.clz32(m & -m);
  }
  /** 最高的岩石层（地表高度），0 = 水面。 */
  ground(cell) {
    const m = this.rock[cell.id];
    return m === 0 ? 0 : 32 - Math.clz32(m);
  }
  /** 这一格顶上是建筑（而不是裸露的地形）。 */
  topIsBuilt(cell) { const t = this.top(cell); return t > 0 && !this.isRock(cell, t); }
  /** 陆地 = 第 1 层实心（岩石或码头）：决定岸线。 */
  isLand(cell) { return cell !== null && this.isSolid(cell, 1); }

  neighbor(cell, i) { const id = cell.edgeNeighbors[i]; return id >= 0 ? this.grid.cells[id] : null; }

  /* ---- 建筑体量：同高相邻、顶部是建筑的格子连成一栋（拥有一个屋顶） ---------- */
  regions() {
    if (this._regionsVersion === this.version && this._regions) return this._regions;
    const cells = this.grid.cells;
    const regionOf = new Int32Array(cells.length).fill(-1);
    const regions = [];
    for (const start of cells) {
      if (regionOf[start.id] !== -1 || !this.topIsBuilt(start)) continue;
      const h = this.top(start);
      const id = regions.length;
      const members = [];
      const stack = [start];
      regionOf[start.id] = id;
      while (stack.length) {
        const c = stack.pop();
        members.push(c);
        for (let i = 0; i < c.n; i++) {
          const nb = this.neighbor(c, i);
          if (!nb || regionOf[nb.id] !== -1 || this.top(nb) !== h || !this.topIsBuilt(nb)) continue;
          regionOf[nb.id] = id;
          stack.push(nb);
        }
      }
      regions.push({ id, h, cells: members });
    }
    this._regions = { regionOf, regions };
    this._regionsVersion = this.version;
    return this._regions;
  }

  /* ---- 快照（撤销栈用） --------------------------------------------------- */
  snapshot() {
    return { solid: this.solid.slice(), rock: this.rock.slice(), color: this.color.slice(), river: this.river.slice() };
  }
  restore(s) {
    this.solid.set(s.solid); this.rock.set(s.rock); this.color.set(s.color); this.river.set(s.river);
    this.touch();
  }
}

/** 1120036868966502401（703 帧，不规则网格调试层）· 跨层区域 id。
 *
 *  原片（第 63 轮 2.5 倍裁切复核 frame-0210 / 0470）：
 *   · 区域边界是**沿格边**的折线，同一个区域在地形抬高的过程中**颜色不变**——台地长高一层，
 *     它那圈边界的颜色还是原来那个颜色；
 *   · 只有区域**分裂**（一个台地被中间掐断成两块）时才会出现新颜色；
 *   · 因此颜色不是「按高度层循环」，而是「区域身份（id）的颜色」。
 *
 *  本仓第 60 轮的做法是 `palette[(h-1)%6]`：同一条台地每升一层就换一次颜色（实测 10 层 6 色 1128 段里
 *  同一块台地跨层换了 3–4 种颜色），和原片不一致。
 *
 *  这里的口径：
 *   1. 每层 h 的集合 = { top ≥ h }，按 `edgeNeighbors` 求**层内**水平连通分量；
 *   2. 分量向上继承：该分量在 h−1 层所在分量（父）的 id 直接继承；
 *   3. 一个父分裂成 k>1 个孩子 → 最大那个继承父 id，其余各拿新 id（原片分裂才换色）；
 *   4. 一个孩子跨了两个父（合并）→ 拿新 id（身份变了）；
 *   5. 最底层（h=1）的每个分量各拿新 id。
 *  id 从 1 开始，颜色 = palette[(id−1) % palette.length]。
 */

/** 并查集（按 id 合并，路径减半）。坑：`union` 必须自己 `add` 两端——邻居格可能还没进循环，
 *  对没登记的点直接 `find` 会拿到 undefined，随后 `parent.set(i, undefined)` 把所有分量并成一个。 */
function makeDSU() {
  const parent = new Map();
  const find = (x) => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r);
    while (parent.get(x) !== r) { const nx = parent.get(x); parent.set(x, r); x = nx; }
    return r;
  };
  const add = (x) => { if (!parent.has(x)) parent.set(x, x); };
  return {
    add,
    find,
    union: (a, b) => { add(a); add(b); const ra = find(a), rb = find(b); if (ra === rb) return false; parent.set(ra < rb ? rb : ra, ra < rb ? ra : rb); return true; },
    roots: () => parent,
  };
}

/**
 * @param {Array} cells  世界格（下标即 id，元素需有 `edgeNeighbors`）
 * @param {(cell:any)=>number} topAt  每格高度（层数）
 * @param {{maxH?:number, paletteSize?:number}} opts
 * @returns {{maxH:number, layers:Array<{h:number, ids:Map<number,number>, colorOf:Map<number,number>, regions:Array<{id:number,colorIndex:number,cells:number,segmentsCells:number[]}>}>, regionOf:Map<string,number>, regionCount:number, idsByLayer:Map<number,Map<number,number>>}}
 */
export function regionComponentIds(cells, topAt, { maxH = 0, paletteSize = 6 } = {}) {
  if (!Array.isArray(cells)) throw new TypeError('cells must be an array');
  if (typeof topAt !== 'function') throw new TypeError('topAt must be a function');
  if (!Number.isInteger(paletteSize) || paletteSize < 1) throw new RangeError('Invalid palette size');
  const H = maxH || Math.max(0, ...cells.map((c) => topAt(c)));
  const layers = [];
  const idsByLayer = new Map();
  let nextId = 1;
  let prev = null;                      // Map<cellIndex, regionId> for h-1
  for (let h = 1; h <= H; h++) {
    const dsu = makeDSU();
    const members = [];
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      if (!c || topAt(c) < h) continue;
      dsu.add(i); members.push(i);
      const nb = c.edgeNeighbors || [];
      for (let e = 0; e < (c.n ?? nb.length); e++) {
        const j = nb[e];
        if (!(j >= 0) || j >= cells.length) continue;
        if (topAt(cells[j]) < h) continue;
        dsu.union(i, j);
      }
    }
    // 分组
    const groups = new Map();
    for (const i of members) {
      const r = dsu.find(i);
      if (!groups.has(r)) groups.set(r, []);
      groups.get(r).push(i);
    }
    const comps = [...groups.values()].sort((a, b) => b.length - a.length || a[0] - b[0]);
    // 先算每个分量在 h−1 层的父 id 集合
    const parentsOf = comps.map((mem) => {
      if (!prev) return null;
      const s = new Set();
      for (const i of mem) { const p = prev.get(i); if (p != null) s.add(p); }
      return s;
    });
    const childCount = new Map();       // parentId → 孩子数
    for (const s of parentsOf) if (s && s.size === 1) { const [p] = [...s]; childCount.set(p, (childCount.get(p) || 0) + 1); }
    const ids = new Map(), colorOf = new Map(), regions = [];
    const usedParent = new Set();
    comps.forEach((mem, ci) => {
      const ps = parentsOf[ci];
      let id;
      if (!ps || ps.size === 0) id = nextId++;
      else if (ps.size > 1) id = nextId++;                       // 合并 → 新身份
      else {
        const p = [...ps][0];
        // 同一父的第一个（最大的）孩子继承父 id，其余（分裂出来的）拿新 id
        if (!usedParent.has(p)) { usedParent.add(p); id = p; }
        else id = nextId++;
      }
      const colorIndex = (id - 1) % paletteSize;
      for (const i of mem) { ids.set(i, id); colorOf.set(i, colorIndex); }
      regions.push({ id, colorIndex, cells: mem.length, segmentsCells: mem.slice() });
    });
    layers.push({ h, ids, colorOf, regions });
    idsByLayer.set(h, ids);
    prev = ids;
  }
  let regionCount = 0;
  for (const l of layers) for (const r of l.regions) if (r.id > regionCount) regionCount = r.id;
  return { maxH: H, layers, idsByLayer, regionCount };
}

/** 便捷：给定层与格下标，取区域 id。 */
export function regionIdAt(result, h, cellIndex) {
  const m = result?.idsByLayer?.get(h);
  return m ? (m.get(cellIndex) ?? null) : null;
}

/**
 * courtyard-grass.js — 庭院草地生成规则（纯函数，不 import three / MeshWriter）。
 *
 * 裁判口径（只读 REACode）：
 *   · src/courtyard.js detectInterior：从边界洪水填充、填不到的才是「内部」——
 *     触发词是 enclosed（封闭），一个缺口就漏，不是"内部有一块空地"。
 *   · src/townmesh.js 后院段：连通地面组件碰不到水/网格边 → 组件内**每个**地面格
 *     都铺草地（yard[cell]=1 全格），不存在"半个院长草"。
 *   · 1238474550511308800 帧证据：草地先整片铺上（两帧之间一次到位），
 *     小径网络 +0.083s 后才叠上去——**小径在草上面**，所以小径格的底色仍是草。
 *   · 矮墙（courtyards.js lowWalls）：分区不封院——封闭组件被矮墙切成若干子区，
 *     每个子区照常长草；矮墙只影响分区记录（subregions），不影响草地判定。
 *
 * 输入是 classifyCourtyards 的结果（不重复判定，也不改它）：
 *   components    封闭组件（元素 = 单元数组）
 *   openComponents 带开口组件（任一开口 → 整组件一格草不铺）
 *   subregions    与 components 同序的矮墙子区
 */
export function planCourtyardGrass(world, courtyard, { path = null } = {}) {
  if (!world || !world.cells || !courtyard) throw new TypeError('planCourtyardGrass(world, courtyard)');
  const n = world.cells.length;
  const grass = new Uint8Array(n);
  const components = [];
  for (let c = 0; c < courtyard.components.length; c++) {
    const comp = courtyard.components[c];
    // classifyCourtyards 的 subregions 形态：无矮墙时是扁平 id 数组（一个隐式子区），
    // 有矮墙时是子区数组（每个子区 = id 数组）。统一成子区数组。
    const raw = courtyard.subregions?.[c] ?? null;
    const subregions = raw ? (typeof raw[0] === 'number' ? [[...raw]] : raw.map((s) => [...s])) : null;
    let grassCells = 0, pathCells = 0;
    for (const cell of comp) {
      grass[cell.id] = 1; grassCells++;
      if (path && path[cell.id]) pathCells++;
    }
    components.push({
      cells: comp.map((c2) => c2.id),
      subregions,
      subregionCount: subregions ? subregions.length : 1,
      grassCells, pathCells,
      // 草在小径底下：pathCells 仍计入 grassCells，渲染时先铺草再叠径
      grassUnderPath: pathCells,
    });
  }
  let openCells = 0;
  for (const oc of courtyard.openComponents || []) openCells += oc.cells.length;
  return {
    grass, components,
    stats: {
      enclosed: courtyard.components.length,
      grassCells: grass.reduce((a, b) => a + b, 0),
      openComponents: (courtyard.openComponents || []).length,
      openCellsSkipped: openCells,
      lowWallEdges: (courtyard.lowWallEdges || []).length,
    },
  };
}

/** 单格渲染决策：'grass'（整格草）/ 'grass+path'（草底 + 小径叠面）/ 'paving'（无草）。 */
export function groundFinish(yard, hasPath) {
  if (!yard) return 'paving';
  return hasPath ? 'grass+path' : 'grass';
}

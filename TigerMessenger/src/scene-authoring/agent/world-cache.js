// Worker 内共用：按半径缓存网格（buildQuadGrid 是确定性的，与游戏里的网格一致），解码 / 编码 World。
import { rea } from './rea.js';
const mods = Promise.all([
  import(rea('src/core/grid.js')), import(rea('src/core/spatial.js')), import(rea('src/core/world.js')), import(rea('src/world/save.js')),
]).then(([g, s, w, sv]) => ({ buildQuadGrid: g.buildQuadGrid, decorateCells: s.decorateCells, World: w.World, encodeWorld: sv.encodeWorld, decodeWorld: sv.decodeWorld, peekGridRadius: sv.peekGridRadius }));
const grids = new Map();
export async function worldFrom(data) {
  const m = await mods;
  const radius = m.peekGridRadius(data);
  if (!grids.has(radius)) grids.set(radius, m.decorateCells(m.buildQuadGrid({ radius, hexSize: 1 })));
  const w = new m.World(grids.get(radius));
  const scene = m.decodeWorld(data, w);
  return { world: w, scene, encode: (x) => m.encodeWorld(x, scene) };
}

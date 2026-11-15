// 第 53 批 G5 组共用夹具：真实网格（四边 / 混合）+ generateBadNorth 小岛 + 真实 Battle（view 用桩）。
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
export const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const ctx2d = new Proxy({}, { get: (t, k) => k in t ? t[k] : (k === 'measureText' ? () => ({ width: 10 }) : String(k).startsWith('create') ? () => ({ addColorStop() {} }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : () => {}), set: (t, k, v) => (t[k] = v, true) });
const el = () => ({ style: {}, appendChild() {}, remove() {}, addEventListener() {}, getContext: () => ctx2d, width: 0, height: 0, set innerHTML(v) {}, set textContent(v) {} });
globalThis.document ??= new Proxy({ createElement: el, body: el(), createElementNS: el, getElementById: () => el() }, { get: (t, k) => k in t ? t[k] : () => el() });
export const THREE = await import('three');
const { World } = await import('../../src/core/world.js');
const { buildQuadGrid, buildMixedGrid } = await import('../../src/core/grid.js');
const { decorateCells, buildCellIndex } = await import('../../src/core/spatial.js');
const { generateBadNorth } = await import('../../src/badnorth/island.js');
export const { Battle } = await import('../../src/badnorth/battle.js');
export { World };

/** kind: 'quad' | 'mixed'。返回 { world, index, view, grid } —— 不开战，调用方自己 new Battle(view)。 */
export function makeIsland(kind = 'quad', seed = 7) {
  const grid = (kind === 'mixed' ? buildMixedGrid : buildQuadGrid)({ radius: kind === 'mixed' ? 9 : 8, seed });
  decorateCells(grid);
  const world = new World(grid);
  generateBadNorth(world, seed);
  const index = buildCellIndex(grid);
  return { grid, world, index, view: makeView(world, index) };
}

/** 任意 World 的 view 桩（字段与 battle.js 读取的一致）。 */
export function makeView(world, index, extra = {}) {
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 200);
  camera.position.set(0, 14, 14); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
  return { scene: new THREE.Group(), levelHeight: .5, index, mesh: new THREE.Mesh(new THREE.BufferGeometry()), worldMesh: { chimneys: [], builtVersion: world.version }, navLayer: null,
    effects: { fireSources: [], showFire() {} }, smoke: { sources: [], fireCoupling: false, ignited: [], setFireCoupling(on) { this.fireCoupling=!!on; }, ignite(i) { if(!Number.isInteger(i)||i<0||i>=this.sources.length)throw Error('invalid smoke source');this.ignited.push(i); } }, atmosphere: { sample: () => new THREE.Vector3(1, 0, 0) }, camera, debugState: {}, goreOff: false, ...extra };
}

/** 方格条带世界（测试里手工造地形用）。cols×rows，格心 (i, j)。 */
export function stripWorld(cols, rows = 1) {
  const id = (i, j) => (i < 0 || j < 0 || i >= cols || j >= rows) ? -1 : j * cols + i;
  const cells = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const vid = (a, b) => b * (cols + 1) + a;
    cells.push({ id: id(i, j), n: 4, cx: i, cz: j,
      pts: [{ x: i - .5, z: j - .5, id: vid(i, j) }, { x: i + .5, z: j - .5, id: vid(i + 1, j) }, { x: i + .5, z: j + .5, id: vid(i + 1, j + 1) }, { x: i - .5, z: j + .5, id: vid(i, j + 1) }],
      // 边 k: pts[k]→pts[k+1]；0 = 下（j-1）、1 = 右（i+1）、2 = 上（j+1）、3 = 左（i-1）
      edgeNeighbors: [id(i, j - 1), id(i + 1, j), id(i, j + 1), id(i - 1, j)] });
  }
  const vertexCells = new Map();
  for (const c of cells) for (const p of c.pts) { if (!vertexCells.has(p.id)) vertexCells.set(p.id, []); vertexCells.get(p.id).push(c.id); }
  const grid = { cells, vertexCells };
  const world = new World(grid);
  const index = { cellAt(x, z) { const i = Math.round(x), j = Math.round(z); if (Math.abs(x - i) > .5 || Math.abs(z - j) > .5) return null; const k = id(i, j); return k < 0 ? null : cells[k]; } };
  return { cells, world, index, at: (i, j) => cells[id(i, j)] };
}

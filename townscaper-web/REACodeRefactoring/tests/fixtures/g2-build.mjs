// Shared node fixture for G2 building tests: real app grids, real scenes, real MeshWriter.
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const { buildQuadGrid, buildMixedGrid } = await import('../../src/core/grid.js');
const { decorateCells } = await import('../../src/core/spatial.js');
const { World } = await import('../../src/core/world.js');
const { buildScene } = await import('../../src/world/scenes.js');
const { MeshWriter } = await import('../../src/core/meshwriter.js');
const { buildBuildings } = await import('../../src/build/buildings.js');
const { PALETTES, BUILD } = await import('../../src/core/palette.js');
const THREE = await import('three');
export { BUILD, PALETTES };
export const L = 0.5;
export const GRIDS = { quad: () => buildQuadGrid({ radius: 14, hexSize: 1.0 }), mixed: () => buildMixedGrid({ radius: 22, hexSize: 0.62 }) };
const cache = new Map();
export function grid(kind) { if (!cache.has(kind)) cache.set(kind, decorateCells(GRIDS[kind]())); return cache.get(kind); }
export function world(kind, scene = 'town', seed = 7) { const w = new World(grid(kind)); w.palette = PALETTES.town; buildScene(w, scene, seed); return w; }
/** Build meshes with a recording writer; returns stats + triangle count + the raw writer. */
export function build(w, flags = {}, { capture = null } = {}) {
  const old = {}; for (const [k, v] of Object.entries(flags)) { old[k] = w[k]; w[k] = v; }
  const m = new MeshWriter(); const tris = [];
  if (capture) { const tri = m.tri.bind(m); m.tri = (a, b, c, dir, color, ...rest) => { const hex = color?.getHexString?.(); if (capture.includes(hex)) tris.push({ hex, p: [a, b, c] }); return tri(a, b, c, dir, color, ...rest); }; }
  const r = buildBuildings(m, w, { L });
  for (const k of Object.keys(flags)) w[k] = old[k];
  return { r, m, tris, verts: m.pos.length / 3 };
}
export const voxels = (w) => [w.solid.slice(), w.rock.slice(), w.color.slice(), w.river.slice()];
export const hexOf = (css) => new THREE.Color(css).getHexString();
export { World, MeshWriter, buildBuildings, root };

import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(process.cwd()+'/vendor/three.module.js').href)},shortCircuit:true};return n(s,c);}`));
const { World } = await import('./src/core/world.js');
const { buildQuadGrid, buildMixedGrid } = await import('./src/core/grid.js');
const { decorateCells } = await import('./src/core/spatial.js');
const { shapeTerrain } = await import('./src/terrain/shape.js');
const { rockTopology } = await import('./src/core/rock-topology.js');
const { rockScene, capUndersideArea } = await import('./src/terrain/rockforms-c09.js');
const G = { quad: [() => buildQuadGrid({ radius: 14, hexSize: 1 }),1], mixed: [() => buildMixedGrid({ radius: 22, hexSize: 0.62 }),0.62] };
for (const [k,[mk,s]] of Object.entries(G)) for (const kind of ['ridge','dolmen']) {
  const w = new World(decorateCells(mk())); const rep = rockScene(w, { kind, s: 1 });
  const sh = shapeTerrain(w, {}); const sh0 = shapeTerrain(w, {guardCells:false});
  console.log(k, kind, JSON.stringify(rep), JSON.stringify((({spans,...o})=>o)(rockTopology(w))), JSON.stringify(capUndersideArea(w, sh)), JSON.stringify(capUndersideArea(w, sh0)), sh.guard?.guardedSlices);
}
for (const [k,[mk]] of Object.entries(G)) { const cs = decorateCells(mk()).cells; const c=cs[0]; const nb=cs[c.edgeNeighbors.find(i=>i>=0)]; console.log(k, cs.length, Math.hypot(c.cx-nb.cx,c.cz-nb.cz), Math.max(...cs.map(c=>Math.hypot(c.cx,c.cz)))); }

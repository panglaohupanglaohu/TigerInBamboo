// G5 r55 tileforce: 3D prefab + splice pipeline shared by tests/prefab-splice.mjs and prefab.html.
import {synthesizeModulePatch,spliceModulePatch,halfEdgeClosure} from '../../src/core/module-patch.js';
import {findModulePatches} from '../../src/core/module-search.js';
import {layerGrid,liftFootprint,solveWithPrefab} from '../../src/core/wfc.js';
import {TILESET_FORT,expandTiles,labelCompatible} from '../../src/build/tile-assembly.js';
// "clip" module of 1751932427272909032: 4 squares + 3 triangles closing a 3.3.3.4.4 vertex
export const CLIP={sides:[4,4,3,3,3,4,4],adj:[[1,4,6],[0,2,5],[1,3],[2,4],[0,3],[1],[0]]};
export function fortCatalog(lattice){const tiles=[];for(const n of new Set(lattice.cells.map(c=>c.n)))tiles.push(...expandTiles(TILESET_FORT,n-2));return tiles;}
/** allowed per lattice cell: ground level needs a solid base or air; top level only roof/air faces up. */
export function fortAllowed(lattice,tiles){const a={};for(const c of lattice.cells)a[c.id]=tiles.filter(t=>t.edges.length===c.n&&(c.level>1||t.edges.at(-1).label==='S'||!t.solid)&&(c.level<lattice.H||['A','R'].includes(t.edges.at(-2).label))).map(t=>t.id);return a;}
/** prefab sockets: walls all round, one door on part 0 at its lowest level, roof on top, stone below */
export function prefabSocket(lattice,mapping,from){const inside=new Set(mapping);let door=null;
 return(i,e,c)=>{const n=c.n-2;if(e===n)return{label:'R',v:1,solid:true};if(e===n+1)return{label:'S',v:-1,solid:true};
  if(door===null&&c.level===from&&!inside.has(c.edgeNeighbors[e])&&c.edgeNeighbors[e]>=0)door=c.id+':'+e;
  return{label:door===c.id+':'+e?'D':'W',v:0};};}
/** whole pipeline: look for the footprint; if none, synthesize the bit of grid and splice it in; then force the prefab */
export function forcePrefab(grid,{pattern=CLIP,H=3,from=2,levels=2,seed=1,at={x:0,z:0},forceSplice=false}={}){
 let g=grid,spliced=null,found=forceSplice?{matches:[]}:findModulePatches(grid,pattern,{limit:6});
 if(!found.matches.length){const s=synthesizeModulePatch(pattern,{scale:grid.hexSize??1});g=spliceModulePatch(grid,s.grid,at);spliced=g.splice;found={matches:[s.mapping.map(i=>g.splice.patchCellIds[i])]};}
 const lattice=layerGrid(g,H),tiles=fortCatalog(lattice),allowed=fortAllowed(lattice,tiles),compatible=labelCompatible(TILESET_FORT.joins);
 for(const base of found.matches){const mapping=liftFootprint(lattice,base,from,levels);
  const r=solveWithPrefab(lattice,{tiles,mapping,socket:prefabSocket(lattice,mapping,from),allowed,compatible,seed,weighted:true,traceLimit:256});
  if(r.ok)return{grid:g,lattice,tiles,base,mapping,result:r,spliced,closure:halfEdgeClosure(g)};}
 return{grid:g,lattice,ok:false,spliced};
}

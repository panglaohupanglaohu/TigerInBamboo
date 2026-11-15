import assert from 'node:assert/strict';
import {buildQuadGrid,buildMixedGrid,buildHexGrid,signedArea} from '../src/core/grid.js';
import {World} from '../src/core/world.js';
import {generateTerrain} from '../src/terrain/generate.js';
import {gridVertexDual,dualFoliageSites} from '../src/core/vertex-dual.js';
import {pointInQuad} from '../src/core/spatial.js';
const stats={};
for(const [name,g] of [['quad',buildQuadGrid({radius:7,seed:3})],['mixed',buildMixedGrid({radius:9,seed:3})],['hex',buildHexGrid({radius:7,cellSize:.8})]]){
 // 1) 多边形网格上的重心对偶：每格被它的角楔块精确铺满，总面积守恒
 const d=gridVertexDual(g),cellArea=g.cells.reduce((s,c)=>s+Math.abs(signedArea(c.pts)),0),dualArea=d.cells.reduce((s,c)=>s+c.area,0);
 assert(Math.abs(cellArea-dualArea)<1e-8);assert.equal(d.cells.length,g.verts.length);
 const per=new Map();for(const c of d.cells)for(const w of c.wedges)per.set(w.cell,(per.get(w.cell)||0)+w.area);for(const c of g.cells)assert(Math.abs(per.get(c.id)-Math.abs(signedArea(c.pts)))<1e-10);
 for(const c of d.cells)if(!c.boundary)assert.equal(c.wedges.length,g.vertexCells.get(c.vertex).length);
 // 2) 共享 World 上的落点：都在陆地顶面、不在房顶/河道，跨崖的对偶格只留最高台地那几块楔
 const w=new World(g);generateTerrain(w,{seed:11});
 const someLand=g.cells.find(c=>w.ground(c)>0&&!w.river[c.id]);w.setSolid(someLand,w.top(someLand)+1,true);
 const before=JSON.stringify(w.snapshot()),r=dualFoliageSites(w,{spacing:0});
 assert(r.sites.length>10,name);assert.equal(JSON.stringify(w.snapshot()),before);
 let straddle=0;for(const s of r.sites){const cs=s.cells.map(id=>g.cells[id]);for(const c of cs){assert.equal(w.ground(c),s.level);assert(!w.topIsBuilt(c)&&!w.river[c.id]);}
  assert(cs.some(c=>pointInQuad(c.pts,s.x,s.z)),'site inside its terrace wedges');assert.equal(s.y,s.level*.5);
  if(s.clipped){straddle++;const all=d.cells.find(x=>x.vertex===s.vertex).cells.map(id=>g.cells[id]);assert(all.some(c=>w.ground(c)<s.level||w.topIsBuilt(c)||w.river[c.id]));}}
 assert(!r.sites.some(s=>s.cells.includes(someLand.id)),'built cell excluded');
 // 3) 间距：贪心后任两点距离 ≥ spacing；limit 生效；确定性
 const sp=dualFoliageSites(w,{spacing:1.2,limit:40});for(let i=0;i<sp.sites.length;i++)for(let j=0;j<i;j++)assert(Math.hypot(sp.sites[i].x-sp.sites[j].x,sp.sites[i].z-sp.sites[j].z)>=1.2-1e-12);
 assert(sp.sites.length<=40);assert.deepEqual(dualFoliageSites(w,{spacing:1.2,limit:40}),sp);
 stats[name]={verts:g.verts.length,sites:r.sites.length,straddle,spaced:sp.sites.length};
}
assert.throws(()=>dualFoliageSites(new World(buildHexGrid({radius:1})),{spacing:-1}));
console.log(stats,'PASS polygon-grid barycentric dual exact coverage; shared-World foliage sites on terraces (cliff/river/built wedges clipped), spacing/limit deterministic');

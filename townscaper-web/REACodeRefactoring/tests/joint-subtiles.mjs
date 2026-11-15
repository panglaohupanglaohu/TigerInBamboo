import assert from 'node:assert/strict';
import {buildSquareGrid,buildQuadGrid,buildMixedGrid,buildTriangularSubgrid} from '../src/core/grid.js';
import {solveWFC,findWFCConflicts,jointSubtileCatalog} from '../src/core/wfc.js';
import {World} from '../src/core/world.js';
import {selfCheck} from '../src/core/adjacency.js';
// 四个对角子三角 = 一个四边形模块：只靠插槽相等的半边 WFC 把同一父格的四个子格绑成同一个 tile
const quadTiles=Array.from({length:16},(_,i)=>({id:'q'+i,edges:[0,1,2,3].map(e=>(i>>e)&1)})),triTiles=Array.from({length:8},(_,i)=>({id:'t'+i,edges:[0,1,2].map(e=>(i>>e)&1)}));
let groupsChecked=0;
for(const [name,source] of [['square',buildSquareGrid({radius:2})],['quad',buildQuadGrid({radius:3,seed:4})],['mixed',buildMixedGrid({radius:4,seed:5})]]){
 const sub=buildTriangularSubgrid(source),before=JSON.stringify(source),{tiles,allowed,decode}=jointSubtileCatalog(sub,{quadTiles,triTiles});
 assert.equal(selfCheck(sub,new World(sub)).mismatched,0);
 for(const seed of[1,7,23]){
  const r=solveWFC(sub,{tiles,allowed,seed});assert(r.ok,name+' '+r.reason);assert.deepEqual(findWFCConflicts(sub,r.tiles,tiles),[]);
  const parent=decode(r.tiles),parentCatalog=[...quadTiles,...triTiles];
  assert.equal(Object.keys(parent).length,source.cells.length);
  // 解回父网格后本身就是一个合法 WFC 解（父格之间的共享边插槽一致）
  assert.deepEqual(findWFCConflicts(source,parent,parentCatalog),[]);
  for(const g of sub.subdivision.groups)if(g.children.length===4){const set=new Set(g.children.map(id=>r.tiles[id].split('#')[0]));assert.equal(set.size,1);groupsChecked++;}
  // 钉一个子格 → 同组另外三个跟着变成同一模块
  const g=sub.subdivision.groups.find(x=>x.children.length===4),pinCell=g.children[0],pin=allowed[pinCell].find(id=>id.startsWith('quad:q9#'));
  const p=solveWFC(sub,{tiles,allowed,seed,pins:{[pinCell]:pin}});assert(p.ok);for(const id of g.children)assert(p.tiles[id].startsWith('quad:q9#'));
 }
 // 手动拆散一组：decode 拒绝
 const r=solveWFC(sub,{tiles,allowed,seed:3}),g=sub.subdivision.groups.find(x=>x.children.length===4),bad={...r.tiles};
 const other=allowed[g.children[1]].find(id=>id.split('#')[0]!==bad[g.children[1]].split('#')[0]);bad[g.children[1]]=other;assert.throws(()=>decode(bad),/joint/);
 assert.equal(JSON.stringify(source),before);
}
assert.throws(()=>jointSubtileCatalog(buildSquareGrid({radius:1}),{quadTiles}));assert.throws(()=>jointSubtileCatalog(buildTriangularSubgrid(buildSquareGrid({radius:1})),{quadTiles:[{id:1,edges:[0,0,0]}]}));
console.log({groupsChecked},'PASS joint four-subtile quad modules via spoke sockets; decoded parent assignment is a valid parent WFC solution; pins propagate to whole group');

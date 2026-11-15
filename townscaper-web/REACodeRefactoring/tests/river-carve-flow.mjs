// REACode/engine/rivers.js + src/navgraph.js (1769691526924292506 depth-first rivers,
// 1795831296952041691 faster downstream, 1582293326815862786 simplified nav graph):
// carve order persisted in World.riverFlow, read by shared buildNav on flat reaches; findPath /
// route stats / junction-graph interfaces over the same directed costs.
import assert from'node:assert/strict';
import{World}from'../src/core/world.js';import{buildMixedGrid,buildQuadGrid}from'../src/core/grid.js';
import{generateTerrain,carveRivers}from'../src/terrain/generate.js';import{buildNav,findNavPath,riverRouteStats,simplifyNav}from'../src/world/navgraph.js';
// Synthetic flat river row: mouth distance cannot tell direction when the reach is closed at both ends,
// carve order can.
function row(n){return Array.from({length:n},(_,id)=>({id,n:4,cx:id,cz:0,pts:[{x:id-.5,z:-.5},{x:id+.5,z:-.5},{x:id+.5,z:.5},{x:id-.5,z:.5}],edgeNeighbors:[id>0?id-1:-1,id+1<n?id+1:-1,-1,-1]}))}
{const w=new World({cells:row(6)}),c=w.cells;for(let i=0;i<6;i++){w.fill(c[i],2,{rock:true});w.river[i]=1;}
 let nav=buildNav(w);assert.equal(nav.flowSource,'mouthDistance');assert.equal(nav.riverDirection(c[1],c[2]),0);
 const flowTo=new Int32Array(6).fill(-1);for(let i=0;i<5;i++)flowTo[i]=i+1;w.riverFlow={flowTo,paths:[[0,1,2,3,4,5]],mouths:[],version:w.version};
 nav=buildNav(w);assert.equal(nav.flowSource,'carve');assert.equal(nav.riverDirection(c[1],c[2]),1);assert.equal(nav.cost(c[1],c[2]),.3);assert.equal(nav.cost(c[2],c[1]),.65);
 const s=riverRouteStats(w,nav,c[0],c[5]);assert.equal(s.steps,5);assert.ok(Math.abs(s.upDownRatio-.65/.3)<1e-12);assert.ok(Math.abs(s.speedup-1/.3)<1e-12);assert.ok(Math.abs(s.detour-.3)<1e-12);
 const sim=simplifyNav(w,nav);assert.deepEqual(sim.nodes,[0,5]);assert.equal(sim.edges.length,2);const e=sim.edges.find(x=>x.from===0);assert.deepEqual(e.via,[1,2,3,4]);assert.ok(Math.abs(e.cost-1.5)<1e-12&&Math.abs(e.reverseCost-3.25)<1e-12);
 w.setSolid(c[3],5,true);nav=buildNav(w);assert.equal(nav.flowSource,'mouthDistance','stale carve order ignored after edit');
 assert.deepEqual(findNavPath(w,nav,c[0],null),{path:[],cost:Infinity});}
// Real generated terrain, both grid kinds.
let fixed=0,flatTotal=0;const out={};
for(const[name,grid]of[['mixed',buildMixedGrid({radius:9,seed:7})],['quad',buildQuadGrid({radius:9,seed:7})]])for(const seed of[1,3,7,19]){
 const w=new World(grid),r=generateTerrain(w,{seed,rivers:3}),f=w.riverFlow,nav=buildNav(w);
 assert.equal(f.version,w.version);assert.equal(nav.flowSource,'carve');assert.ok(f.paths.length>0);
 for(const p of f.paths){for(let i=0;i+1<p.length;i++)assert.ok(w.cells[p[i]].edgeNeighbors.includes(p[i+1]),'carve path adjacency');for(const id of p)assert.equal(w.river[id],1);}
 for(const m of f.mouths)assert.equal(w.ground(w.cells[m]),0);
 for(let id=0;id<w.cells.length;id++){const to=f.flowTo[id];if(to<0)continue;const a=w.cells[id],b=w.cells[to];
  if(nav.hgt[a.id]===nav.hgt[b.id]){flatTotal++;assert.equal(nav.riverDirection(a,b),1);assert.equal(nav.riverDirection(b,a),-1);const rd=nav.riverDist;if(rd[a.id]<0||rd[b.id]<0||rd[a.id]<=rd[b.id])fixed++;}}
 // Route stats from the highest walkable river cell to the last walkable cell of its path.
 const longest=f.paths.reduce((a,b)=>b.length>a.length?b:a);const from=w.cells[longest[0]],to=w.cells[longest[longest.length-1]];
 const st=riverRouteStats(w,nav,from,to);if(st&&st.riverCells>1){assert.ok(st.speedup>=1);assert.ok(st.upDownRatio>=1);assert.ok(st.costRiver<=st.costSamePathWalk+1e-9);}
 const edge=(id)=>nav.walk[id]&&w.cells[id].edgeNeighbors.some(o=>o<0||nav.hgt[o]!==nav.hgt[id]);
 const sim=simplifyNav(w,nav,{keep:edge});assert.ok(sim.walkable>0&&sim.compression<1);for(const e of sim.edges){assert.ok(Number.isFinite(e.cost));for(const v of e.via)assert.equal(simplifyNav(w,nav,{keep:edge}).nodes.includes(v),false);}
 out[name+seed]={paths:f.paths.map(p=>p.length),nodes:sim.nodes.length,walk:sim.walkable,speedup:st?+st.speedup.toFixed(2):null};
}
assert.ok(flatTotal>0&&fixed>0,'carve order resolves flat reaches the mouth-distance heuristic left neutral/wrong');
// carveRivers keeps returning the cell list for existing callers.
{const w=new World(buildQuadGrid({radius:6,seed:3}));generateTerrain(w,{seed:3,rivers:0});assert.equal(w.riverFlow,null);const cellsOut=carveRivers(w,{seed:4,count:2});assert.ok(Array.isArray(cellsOut));assert.equal(w.riverFlow.version,w.version);}
console.log('PASS carve-order flow persisted + nav reads it (flat',flatTotal,'fixed vs heuristic',fixed+'), stale invalidation, findPath/stats/simplify',JSON.stringify(out));

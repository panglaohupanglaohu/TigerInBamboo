import assert from 'node:assert/strict';
import {World} from '../src/core/world.js';
import {buildMixedGrid,buildQuadGrid} from '../src/core/grid.js';
import {buildLayeredNav} from '../src/world/layerednav.js';
import {castNavVisibility} from '../src/core/nav-visibility.js';
const cells=Array.from({length:5},(_,id)=>({id,n:4,cx:id,cz:0,pts:[{x:id-.5,z:-.5},{x:id+.5,z:-.5},{x:id+.5,z:.5},{x:id-.5,z:.5}],edgeNeighbors:[-1,id<4?id+1:-1,-1,id>0?id-1:-1]}));
const w=new World({cells});for(const c of cells)w.fill(c,1,{rock:true});w.setSolid(cells[2],3,true,{rock:true});let g=buildLayeredNav(w),start=g.at(cells[0],1);let r=castNavVisibility(g,start,{rays:4});assert.equal(r.rays[0].path.length,5);assert.equal(r.rays[0].range,4.5);assert.ok(r.visibleNodes.every(id=>g.nodes[id].floor===1),'roof is not tunnel');
assert.equal(castNavVisibility(g,start,{rays:4,maxRange:.25}).rays[0].range,.25);
w.setSolid(cells[2],2,true,{rock:true});g=buildLayeredNav(w);r=castNavVisibility(g,g.at(cells[0],1),{rays:4});assert.equal(r.rays[0].range,1.5);assert.equal(r.rays[0].path.length,2);
assert.throws(()=>castNavVisibility(g,0,{rays:0}));assert.throws(()=>castNavVisibility(g,0,{origin:{x:200,z:200}}));assert.equal(castNavVisibility(g,-1).ok,false);
for(const [kind,grid]of [['mixed',buildMixedGrid({radius:5,seed:5})],['quad',buildQuadGrid({radius:4,seed:5})]]){const world=new World(grid);for(const c of world.cells)world.fill(c,1,{rock:true});const nav=buildLayeredNav(world),s=nav.nodes.reduce((a,b)=>Math.hypot(a.x,a.z)<Math.hypot(b.x,b.z)?a:b),res=castNavVisibility(nav,s.id,{rays:96,maxRange:2});assert.ok(res.visibleNodes.length>1);assert.ok(res.rays.every(r=>r.range<=2&&Number.isFinite(r.x)));const reversed={...nav,adj:nav.adj.map(a=>[...a].reverse())};assert.deepEqual(castNavVisibility(reversed,s.id,{rays:96,maxRange:2}),res);console.log('PASS nav visibility',kind,{visible:res.visibleNodes.length,...res.stats});}
// A walkable turn is not a curved line of sight.
const lCells=[...cells.slice(0,2),{...cells[2],id:2,cx:1,cz:1,pts:[{x:.5,z:.5},{x:1.5,z:.5},{x:1.5,z:1.5},{x:.5,z:1.5}],edgeNeighbors:[1,-1,-1,-1]}];lCells[0]={...lCells[0],edgeNeighbors:[-1,1,-1,-1]};lCells[1]={...lCells[1],edgeNeighbors:[-1,-1,2,0]};const lw=new World({cells:lCells});for(const c of lCells)lw.fill(c,1,{rock:true});const ln=buildLayeredNav(lw);assert.equal(ln.search(0,2).path.length,3);assert.ok(!castNavVisibility(ln,0,{rays:4}).rays[0].path.includes(2));
console.log('PASS tunnel/roof separation, thin wall, range, turn, invalid input and adjacency order');
const steps=new World({cells:cells.slice(0,3).map((c,id)=>({...c,edgeNeighbors:[-1,id<2?id+1:-1,-1,id>0?id-1:-1]}))});steps.cells.forEach((c,i)=>steps.fill(c,i+1,{rock:true}));const sn=buildLayeredNav(steps);assert.equal(castNavVisibility(sn,0,{rays:4,maxFloorDelta:1}).rays[0].path.length,2);assert.equal(castNavVisibility(sn,0,{rays:4,maxFloorDelta:2}).rays[0].path.length,3);
assert.equal(castNavVisibility(buildLayeredNav(new World({cells:[]})),-1).ok,false);
// A 0.01-wide blocking column between samples at x=.85 and x=1.20.
const limits=[[0,1],[1,1.01],[1.01,2]],thinCells=limits.map(([a,b],id)=>({id,n:4,cx:(a+b)/2,cz:0,pts:[{x:a,z:-.5},{x:b,z:-.5},{x:b,z:.5},{x:a,z:.5}],edgeNeighbors:[-1,id<2?id+1:-1,-1,id>0?id-1:-1]})),thin=new World({cells:thinCells});thinCells.forEach((c,i)=>thin.fill(c,i===1?2:1,{rock:true}));const tg=buildLayeredNav(thin);const hit=castNavVisibility(tg,tg.at(thinCells[0],1),{rays:4}).rays[0];assert.equal(hit.x,1);assert.equal(hit.path.length,1);console.log('PASS 0.01-wide blocker cannot be skipped');

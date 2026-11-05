import assert from 'node:assert/strict';
import {buildMixedGrid,buildSquareGrid,buildTriangularSubgrid} from '../src/core/grid.js';
import {solveWFC,findWFCConflicts} from '../src/core/wfc.js';
import {selfCheck} from '../src/core/adjacency.js';
import {World} from '../src/core/world.js';
const area=pts=>Math.abs(pts.reduce((a,p,i)=>{const q=pts[(i+1)%pts.length];return a+p.x*q.z-q.x*p.z;},0))/2;
for(const source of [buildSquareGrid({radius:1}),buildMixedGrid({radius:4,seed:5}),buildMixedGrid({radius:4,seed:5,mergeRate:0})]){
 const before=JSON.stringify(source),g=buildTriangularSubgrid(source),q=source.cells.filter(c=>c.n===4).length;
 assert.equal(g.cells.length,source.cells.length+q*3);assert.equal(g.verts.length,source.verts.length+q);assert.ok(g.cells.every(c=>c.n===3&&c.convex));
 for(const group of g.subdivision.groups){const parent=source.cells.find(c=>c.id===group.sourceCell);assert.equal(group.children.length,parent.n===4?4:1);assert.ok(Math.abs(group.children.reduce((s,id)=>s+area(g.cells[id].pts),0)-area(parent.pts))<1e-9);for(const id of group.children)assert.equal(g.cells[id].sourceCell,parent.id);
 if(parent.n===4){const children=group.children.map(id=>g.cells[id]),common=children[0].pts.find(p=>children.every(c=>c.pts.includes(p)));assert.ok(common);for(const [a,b] of [[parent.pts[0],parent.pts[2]],[parent.pts[1],parent.pts[3]]])assert.ok(Math.abs((b.x-a.x)*(common.z-a.z)-(b.z-a.z)*(common.x-a.x))<1e-9);}}
 const w=new World(g);assert.equal(selfCheck(g,w).mismatched,0);
 const tiles=Array.from({length:8},(_,i)=>({id:String(i),edges:[i&1,(i>>1)&1,(i>>2)&1]})),a=solveWFC(g,{tiles,seed:7}),b=solveWFC({...g,cells:[...g.cells].reverse()},{tiles:[...tiles].reverse(),seed:7});assert.ok(a.ok);assert.deepEqual(a.tiles,b.tiles);assert.deepEqual(findWFCConflicts(g,a.tiles,tiles),[]);assert.equal(JSON.stringify(source),before);
 console.log({parent:source.cells.length,quads:q,children:g.cells.length,slots:selfCheck(g,w).slots});
}
const source=buildSquareGrid({radius:0});source.cells[0].pts.reverse();assert.throws(()=>buildTriangularSubgrid(source));
console.log('PASS parent ownership/area, 4 triangles per quad, source unchanged, reciprocal geometry, real World and deterministic WFC');

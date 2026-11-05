import assert from 'node:assert/strict';
import {buildMixedGrid,buildQuadGrid} from '../src/core/grid.js';
import {World} from '../src/core/world.js';
import {enumerateHouseTiles,validateHouseTiles,commitHouseTiles,placeHouseTiles} from '../src/build/multicell.js';
const reports=[];
for(const [kind,make]of [['mixed',()=>buildMixedGrid({radius:6,seed:5})],['quad',()=>buildQuadGrid({radius:4,seed:5})]]){
 const world=new World(make());for(const c of world.cells)world.fill(c,2,{rock:true});const before=world.snapshot(),version=world.version,kinds=kind==='mixed'?[4,3]:[4,4],options=enumerateHouseTiles(world,{kinds});assert.ok(options.length);const p=options[0];assert.equal(p.boundary.length,kinds.reduce((a,b)=>a+b)-2);
 assert.equal(commitHouseTiles(world,[p,p]).reason,'overlap');assert.equal(world.version,version);assert.deepEqual(world.snapshot(),before);
 const invalid={...p,cells:[p.cells[0],world.cells.find(c=>c.id!==p.cells[0]&&!world.cells[p.cells[0]].edgeNeighbors.includes(c.id)).id]};assert.equal(validateHouseTiles(world,[invalid]).reason,'disconnected');
 world.river[p.cells[1]]=1;assert.equal(commitHouseTiles(world,[p]).ok,false);world.river[p.cells[1]]=0;
 assert.equal(commitHouseTiles(world,[p]).ok,true);assert.equal(world.version,version+1);assert.ok(p.cells.every(id=>world.isBuilt(world.cells[id],3)));assert.deepEqual(world.rock,before.rock);assert.equal(commitHouseTiles(world,[p]).ok,false);
 world.restore(before);const batch=placeHouseTiles(world,{seed:7,count:8});assert.ok(batch.placements.length);const result=world.snapshot();world.restore(before);const again=placeHouseTiles(world,{seed:7,count:8});assert.deepEqual(again.placements,batch.placements);assert.deepEqual(world.snapshot(),result);
 world.restore(before);const a=world.cells[p.cells[0]],b=world.cells[p.cells[1]];world.fill(b,3,{rock:true});assert.ok(!enumerateHouseTiles(world,{kinds}).some(t=>t.id===p.id));assert.equal(commitHouseTiles(world,[p]).ok,false);
 world.restore(before);assert.equal(placeHouseTiles(world,{count:0}).placements.length,0);assert.deepEqual(world.snapshot(),before);assert.throws(()=>placeHouseTiles(world,{count:-1}));assert.throws(()=>enumerateHouseTiles(world,{stories:0}));reports.push({kind,candidates:options.length,placed:batch.placements.length,footprint:kinds});
}
console.log('PASS multi-cell transactions',reports);

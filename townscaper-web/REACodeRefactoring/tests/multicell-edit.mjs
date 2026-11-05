import assert from 'node:assert/strict';
import {buildMixedGrid,buildQuadGrid} from '../src/core/grid.js';
import {World} from '../src/core/world.js';
import {enumerateHouseTiles,commitHouseTiles,editHouseTiles} from '../src/build/multicell.js';
import {encodeWorld,decodeWorld} from '../src/world/save.js';
for(const [kind,make]of [['mixed',()=>buildMixedGrid({radius:6,seed:5})],['quad',()=>buildQuadGrid({radius:4,seed:5})]]){
 const world=new World(make());for(const c of world.cells)world.fill(c,2,{rock:true});const initial=world.snapshot(),p=enumerateHouseTiles(world,{kinds:kind==='mixed'?[4,3]:[4,4]})[0];
 const placed=commitHouseTiles(world,[p],{color:3});assert.ok(placed.ok);const built=world.snapshot();assert.ok(Object.isFrozen(placed.receipt.entries[0].before[0]));assert.throws(()=>placed.receipt.entries[0].placement.cells.push(900));
 let v=world.version;const fail=editHouseTiles(world,{remove:placed.receipt,placements:[{...p,stories:99}]});assert.equal(fail.ok,false);assert.equal(world.version,v);assert.deepEqual(world.snapshot(),built);
 const replaced=editHouseTiles(world,{remove:placed.receipt,placements:[{...p,stories:2}],color:4});assert.ok(replaced.ok);assert.equal(world.version,v+1);assert.ok(p.cells.every(id=>world.isBuilt(world.cells[id],4)));assert.deepEqual(world.rock,initial.rock);
 const high=world.snapshot();const save=encodeWorld(world,'fusion');world.reset();assert.equal(decodeWorld(save,world),'fusion');assert.deepEqual(world.snapshot(),high); // actual v5 voxel roundtrip, identity not encoded
 const unrelated=world.cells.find(c=>!p.cells.includes(c.id));world.setSolid(unrelated,3,true);v=world.version;assert.ok(editHouseTiles(world,{remove:replaced.receipt}).ok);assert.equal(world.version,v+1);assert.ok(world.isBuilt(unrelated,3));for(const id of p.cells){assert.equal(world.solid[id],initial.solid[id]);assert.equal(world.color[id],initial.color[id]);}
 world.restore(high);const c=world.cells[p.cells[0]];world.setSolid(c,5,true);const foreign=world.snapshot();v=world.version;assert.equal(editHouseTiles(world,{remove:replaced.receipt}).reason,'stale-receipt');assert.deepEqual(world.snapshot(),foreign);assert.equal(world.version,v);
 world.restore(high);assert.ok(editHouseTiles(world,{remove:replaced.receipt}).ok);world.restore(built);assert.ok(editHouseTiles(world,{remove:placed.receipt}).ok);assert.deepEqual(world.snapshot(),initial);
 world.restore(built);const dupe={entries:[...placed.receipt.entries,...placed.receipt.entries]};assert.equal(editHouseTiles(world,{remove:dupe}).reason,'receipt');assert.deepEqual(world.snapshot(),built);assert.throws(()=>commitHouseTiles(world,[],{color:31}));
 console.log('PASS whole-footprint remove/replace, stale rejection, rollback, undo and v5 voxel save',kind);
}

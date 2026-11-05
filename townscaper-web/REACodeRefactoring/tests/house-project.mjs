import assert from 'node:assert/strict';
import {World} from '../src/core/world.js';import{buildMixedGrid,buildQuadGrid}from'../src/core/grid.js';import{placeHouseTiles,editHouseTiles}from'../src/build/multicell.js';import{exportHouseProject,importHouseProject}from'../src/ui/house-project.js';
for(const make of [()=>buildMixedGrid({radius:5,seed:7}),()=>buildQuadGrid({radius:4,seed:7})]){
 const world=new World(make());for(const c of world.cells)world.fill(c,2,{rock:true});const placed=placeHouseTiles(world,{count:2});assert(placed.count>0);const entries=placed.receipt.entries,ids=entries.map((_,i)=>`stable:${i}`),saved=exportHouseProject(world,entries,{instanceIds:ids}),snapshot=world.snapshot();world.reset();let version=world.version;
 const restored=importHouseProject(world,saved);assert.equal(world.version,version+1);assert.deepEqual(world.snapshot(),snapshot);assert.deepEqual(restored.instanceIds,ids);assert(Object.isFrozen(restored.entries[0].before));
 assert(editHouseTiles(world,{remove:{entries:[restored.entries[0]]}}).ok);assert(restored.entries[0].placement.cells.every(id=>world.top(world.cells[id])===2));
 importHouseProject(world,saved);const before=world.snapshot(),bad=JSON.parse(saved),cases=[];
 bad.instances[0].entry.before[0].rock=0;cases.push(JSON.stringify(bad));const dupe=JSON.parse(saved);dupe.instances.push(dupe.instances[0]);cases.push(JSON.stringify(dupe));const truncated=JSON.parse(saved);truncated.voxel=truncated.voxel.slice(0,-3);cases.push(JSON.stringify(truncated));const mismatch=JSON.parse(saved);mismatch.grid+='x';cases.push(JSON.stringify(mismatch));cases.push('{');const wrongScene=JSON.parse(saved);wrongScene.scene='town';cases.push(JSON.stringify(wrongScene));
 for(const text of cases){version=world.version;assert.throws(()=>importHouseProject(world,text));assert.equal(world.version,version);assert.deepEqual(world.snapshot(),before)}
 const tombstone=exportHouseProject(world,[null],{instanceIds:['removed:1']});assert.deepEqual(importHouseProject(world,tombstone).entries,[null]);
 console.log('PASS project identity, continued whole-house edit, atomic malformed-data rejection',world.cells.length);
}

import assert from 'node:assert/strict';import {World} from '../src/core/world.js';import {classifyCourtyards} from '../src/core/courtyards.js';
const cells=Array.from({length:9},(_,id)=>({id,n:4})),grid={cells,neighbors:[]};const w=new World(grid);
w.neighbor=(c,i)=>{const x=c.id%3,y=Math.floor(c.id/3),[dx,dy]=[[1,0],[-1,0],[0,1],[0,-1]][i];return x+dx>=0&&x+dx<3&&y+dy>=0&&y+dy<3?cells[(y+dy)*3+x+dx]:null;};
for(const c of cells)w.fill(c,3);w.fill(cells[4],1);assert.equal(classifyCourtyards(w).mask[4],1);
w.setSolid(cells[1],2,false);assert.equal(w.top(cells[1]),3);let r=classifyCourtyards(w);assert.equal(r.mask[4],0);assert.ok(r.openComponents[0].openings.some(o=>o.neighbor===1));
w.setSolid(cells[1],2,true);assert.equal(classifyCourtyards(w).mask[4],1);
w.fill(cells[1],1,{rock:true});assert.equal(classifyCourtyards(w).mask[4],0);
w.fill(cells[1],1);assert.equal(classifyCourtyards(w).mask[4],0);
console.log('PASS enclosure at wall layer, elevated void, low rock, outside path and reseal');

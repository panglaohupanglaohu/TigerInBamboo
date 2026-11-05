import assert from 'node:assert/strict';
import {World} from '../src/core/world.js';import {BattleNavigation} from '../src/world/battle-navigation.js';
const cell=(id,x,z)=>({id,cx:x,cz:z,n:4,pts:[{x:x-.5,z:z-.5},{x:x+.5,z:z-.5},{x:x+.5,z:z+.5},{x:x-.5,z:z+.5}],edgeNeighbors:[-1,-1,-1,-1]});
const cells=[cell(0,0,0),cell(1,1,0)];cells[0].edgeNeighbors[1]=1;cells[1].edgeNeighbors[3]=0;
const world=new World({cells});for(const c of cells)world.fill(c,1,{rock:true});const index={cellAt(x,z){return Math.abs(z)<=.5?cells.find(c=>Math.abs(x-c.cx)<=.5)??null:null}};
const nav=new BattleNavigation(world,index,{radius:.1});let u={x:0,z:0,y:.5,navFloor:1};let plan=nav.plan(u,cells[1],1);
assert.ok(nav.move(u,.49,0,plan),'disk spans open portal');plan=nav.plan(u,cells[1],1);assert.ok(nav.move(u,.7,0,plan));
u={x:0,z:0,y:.5,navFloor:1};plan=nav.plan(u,cells[0],1);assert.equal(nav.move(u,0,.45,plan),false,'center inside is insufficient at closed boundary');assert.equal(u.z,0,'rejected move is atomic');assert.ok(nav.move(u,0,.39,plan));
assert.equal(nav.move(u,NaN,0,plan),false);assert.throws(()=>new BattleNavigation(world,index,{radius:-1}));
// Swept test: a segment can exit the floor and re-enter despite both endpoints
// being valid. Endpoint-only checks miss this notch.
const notchIndex={cellAt(x,z){if(x>.1&&x<.2)return null;return index.cellAt(x,z)}};
const swept=new BattleNavigation(world,notchIndex,{radius:.04});u={x:0,z:0,y:.5,navFloor:1};plan=swept.plan(u,cells[1],1);assert.equal(swept.move(u,.8,0,plan),false);assert.equal(u.x,0);
console.log('PASS radius at closed edges, open portal overlap, atomic swept moves and missing-floor notch');

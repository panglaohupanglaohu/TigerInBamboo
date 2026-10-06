import assert from 'node:assert/strict';
import * as T from '../../vendor/three.module.js';
import {woodlandCell,woodlandOnSurface} from '../../src/world/citadel/mountainWoodland.js';
import {plantStudyMountains} from '../../src/world/citadel/mountainPlanting.js';
const cells=[];for(let z=0;z<40;z++)for(let x=0;x<40;x++)cells.push(woodlandCell(x,z));assert.deepEqual([...cells].reverse(),[...cells].reverse().map(c=>woodlandCell(...c.id.split(',').map(Number))));
for(const c of cells){assert(c.size<=.88);assert.equal(woodlandOnSurface(c,{height:40,slope:1}),null);if(c.isTree&&c.eligible){assert(woodlandOnSurface(c,{height:10,slope:1}).isTree);assert(!woodlandOnSurface(c,{height:10,slope:1,crest:true}).isTree);assert(!woodlandOnSurface(c,{height:26,slope:1})?.isTree);}}
assert(cells.some(c=>c.isTree&&c.eligible));
globalThis.location={search:'?citadelWoodlandPass=1'};
function run(rail=[]){const castle=new T.Group();castle.position.y=175;const geo=new T.PlaneGeometry(60,60,10,10);geo.rotateX(-Math.PI/2);const surface=new T.Mesh(geo,new T.MeshBasicMaterial({side:T.DoubleSide}));surface.name='citadel-oskar-grid-mountain-surface';castle.add(surface);castle.updateMatrixWorld(true);const before=Array.from(geo.attributes.position.array);const root=plantStudyMountains(castle,[surface],{radius:160,rail});assert.deepEqual(Array.from(geo.attributes.position.array),before);const p=root.userData.planting;assert([...p.trees,...p.shrubs].every(r=>r.footSpread<=.7&&r.cellId));return p;}
const a=run(),b=run();assert(a.trees.length>0);assert(a.shrubs.length>0);assert.deepEqual(a.trees,b.trees);assert.deepEqual(a.shrubs,b.shrubs);const protectedRun=run([new T.Vector3(0,175,0)]);for(const r of[...protectedRun.trees,...protectedRun.shrubs])assert(new T.Vector3(...r.world).distanceTo(new T.Vector3(0,175,0))>11.95);
console.log(JSON.stringify({ok:true,trees:a.trees.length,shrubs:a.shrubs.length,checks:['cell RNG order independent','crest suppression','high altitude suppression','real five-point support','unchanged source','repeat deterministic','rail clearance'],candidate:'not visually accepted; synthetic plane only'}));

import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {coastalStackGeometry} from '../../src/world/seaStackCoastalGeometry.js';
import {plantSeaStackTerraces} from '../../src/world/seaStackVegetation.js';
function rock(seed=2){const g=coastalStackGeometry(12,48,seed),o=new T.Mesh(g,new T.MeshBasicMaterial());o.userData.seaStack={height:48};o.updateMatrixWorld(true);return o;}
test('actual coastal final triangles support denser deterministic meadow scrub and trees',()=>{
 for(const seed of[0,2,5]){const r=rock(seed),before=r.geometry.attributes.position.array.slice();const roots=plantSeaStackTerraces(r),audit=r.getObjectByName('sea-stack-terrace-turf').userData.planting;assert.ok(audit.targetBareFraction<.19);assert.ok(roots.length>10);assert.ok(audit.clusters>0);assert.ok(audit.smallTrees>0);assert.ok(audit.smallTrees<=7);assert.deepEqual(r.geometry.attributes.position.array,before);
 const ray=new T.Raycaster(),material=r.material;material.side=T.DoubleSide;
 for(const name of['sea-stack-terrace-shrubs','sea-stack-coastal-grass','sea-stack-coastal-trees'])for(const p of r.getObjectByName(name).userData.roots){ray.set(new T.Vector3(p[0],p[1]+.03,p[2]),new T.Vector3(0,-1,0));ray.far=.08;const hit=ray.intersectObject(r,false)[0];assert.ok(hit,name+' unsupported');assert.ok(Math.abs(hit.point.y-p[1])<.001);}
 const again=rock(seed);assert.deepEqual(plantSeaStackTerraces(again),roots);
 }
});
test('complete protected canopy boxes reject trees without planting in forbidden volume',()=>{const r=rock(2);plantSeaStackTerraces(r,{protectedBoxes:[new T.Box3(new T.Vector3(-100,-100,-100),new T.Vector3(100,100,100))]});assert.equal(r.getObjectByName('sea-stack-coastal-trees').count,0);});

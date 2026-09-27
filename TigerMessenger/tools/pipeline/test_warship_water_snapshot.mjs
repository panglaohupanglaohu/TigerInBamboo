import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from '../../vendor/three.module.js';
const threeURL=new URL('../../vendor/three.module.js',import.meta.url).href;
const raySource=(await readFile(new URL('../../src/world/staticMeshRaycast.js',import.meta.url),'utf8')).replace("'three'",JSON.stringify(threeURL));
const {createStaticMeshRaycast}=await import('data:text/javascript;base64,'+Buffer.from(raySource).toString('base64'));
const routeSource=(await readFile(new URL('../../src/world/warshipWaterRoutes.js',import.meta.url),'utf8'))
  .replace(/^import .*\n/gm,'').replace('export function createWarshipWaterRoutes','function createWarshipWaterRoutes');
const context=vm.createContext({THREE,createStaticMeshRaycast,
  createWarshipClearance(){throw Error('Invalid dock must exit before mesh search');},
  findDockConnector(){throw Error('Unexpected connector search');},placeDockConnector:()=>false,
  orientWarship:(boat)=>boat.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),.25)});
vm.runInContext(routeSource,context);
const direction=new THREE.Vector3(1,0,0);
function fixture({bed=160,land=true}={}) {
  const scene=new THREE.Scene(),material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
  const water=new THREE.Mesh(new THREE.SphereGeometry(160.5,48,32),material);water.name='planet-v8-curved-ocean';scene.add(water);
  const planet=new THREE.Mesh(new THREE.SphereGeometry(bed,48,32),material);planet.name='planet-surface';scene.add(planet);
  const kun=new THREE.Group();kun.name='leviathanGroup';scene.add(kun);
  const island=new THREE.Group();island.name='leviathan-island';kun.add(island);
  const plate=new THREE.Mesh(new THREE.BoxGeometry(.4,8,8),material);plate.name='leviathan-crust-plate';plate.position.x=161;island.add(plate);
  const canopy=new THREE.Mesh(new THREE.BoxGeometry(2,4,4),material);canopy.name='saihoji-pine-crown';canopy.position.x=7;plate.add(canopy);
  if(!land)island.visible=false;
  let traversals=0;const traverse=scene.traverse.bind(scene);scene.traverse=fn=>{traversals++;return traverse(fn);};
  const solver=context.createWarshipWaterRoutes(scene,160);
  return {scene,water,planet,kun,island,plate,canopy,solver,traversals:()=>traversals};
}
{
  const f=fixture(),sample=f.solver.surface(direction);
  assert(Math.abs(sample.water-160.5)<1e-5);assert(Math.abs(sample.seabed-160)<1e-5);
  assert(Math.abs(sample.ground-161.2)<1e-5);assert.equal(sample.object,'leviathan-crust-plate','tree canopy is not a walkable shore');
  assert(f.solver.obstacles.some(g=>g.meshes.some(m=>m.mesh===f.canopy&&m.support===false)),'tree remains a hull collision obstacle');
  assert(f.solver.obstacles.some(g=>g.meshes.some(m=>m.mesh===f.plate&&m.support===true)));
  const before=f.traversals();for(let i=0;i<100;i++)assert.equal(f.solver.surface(direction),sample);
  assert.equal(f.traversals(),before,'surface cache checks do not traverse whole scene');
}
{
  const f=fixture({land:false});assert.equal(f.solver.clear(direction),false,'0.5m water over real bed rejects vessel');
  f.planet.geometry=new THREE.SphereGeometry(157.8,48,32);
  assert.equal(f.solver.surface(direction),null,'cached surface refuses replaced geometry');
  assert.equal(f.solver.clear(direction),false);
  const rebuilt=context.createWarshipWaterRoutes(f.scene,160),sample=rebuilt.surface(direction);
  assert(sample.water-sample.seabed>2.69);assert.equal(rebuilt.clear(direction),true,'new actual bed geometry admits depth');
}
for(const change of [
  f=>{f.planet.geometry.attributes.position.needsUpdate=true;},
  f=>{f.planet.geometry.index.needsUpdate=true;},
  f=>{f.planet.userData.terrainGeometryVersion=1;},
  f=>{f.planet.position.y=.1;},
  f=>{f.water.geometry=f.water.geometry.clone();},
  f=>{f.water.geometry.attributes.position.needsUpdate=true;},
  f=>{f.water.rotation.z=.01;},
  f=>{f.kun.rotation.z=.01;},
  f=>{f.island.rotation.z=.01;},
  f=>{f.kun.userData.navigationGeometryVersion=1;},
]) {
  const f=fixture();assert(f.solver.surface(direction));change(f);
  assert.equal(f.solver.currentGeometry(),false);assert.equal(f.solver.surface(direction),null);
}
for(const change of [
  f=>{f.plate.position.y+=1;},
  f=>{f.canopy.position.z+=2;},
  f=>{f.canopy.geometry.attributes.position.needsUpdate=true;},
  f=>{f.canopy.visible=false;},
  f=>{f.plate.add(new THREE.Group());},
]) {
  const f=fixture();const sample=f.solver.surface(direction);assert(sample);
  change(f);assert.equal(f.solver.validateSnapshot(),false,'batch validation catches child mutation beneath stationary roots');
  assert.equal(f.solver.surface(direction),null,'cached result cannot escape invalidation');
  assert.equal(f.solver.clear(direction),false);
  assert.equal(f.solver.berth(direction,[],{maxDistance:0}),null);
  assert.equal(f.solver.dock(new THREE.Group(),direction).reason,'stale-navigation-snapshot');
  assert.equal(f.solver.route(direction,new THREE.Vector3(.99,.1,0).normalize()),null);
  assert.equal(f.solver.route.lastFailure.reason,'stale-navigation-snapshot');
}
{
  const f=fixture({land:false}),boat=new THREE.Group();boat.position.set(1,2,3);
  const path={points:[direction,new THREE.Vector3(1,.05,0).normalize()],length:8};
  assert.equal(f.solver.place(boat,path,.2),true,'successful movement explicitly returns true');
  const position=boat.position.clone(),quaternion=boat.quaternion.clone();
  f.canopy.position.z=2;
  assert.equal(f.solver.place(boat,path,.4),false,'motion validates child transforms once before moving');
  assert(boat.position.equals(position));assert(boat.quaternion.equals(quaternion));
  f.canopy.position.z=0;
  assert.equal(f.solver.currentGeometry(),false,'invalidated solver cannot revive cached answers');
  assert.equal(f.solver.surface(direction),null);
}
console.log('PASS: real water/bed rays and depth gate, Kun ground versus canopy classification, geometry/attribute/root/child invalidation, no per-sample scene traversal, stale cached samples and motion rejected without changing boat pose');

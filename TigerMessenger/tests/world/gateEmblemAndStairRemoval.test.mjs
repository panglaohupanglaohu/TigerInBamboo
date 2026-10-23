import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import data from '../../assets/models/optimized/gate-of-sighs/gateTargetData.js';
import {filterGateLegacyApproachPart,installGateTarget,createGatePlayerGround} from '../../src/world/gateTarget.js';
import {installGateSite} from '../../src/world/gateSite.js';
import {installGateMoebiusV10} from '../../src/world/gateMoebiusV10.js';
import {installGateTargetThirty} from '../../src/world/gateTargetThirty.js';
import {installGateLighting} from '../../src/world/gateLighting.js';
import {createLightPool} from '../../src/render/lighting/lightPool.js';
import {MOEBIUS_PALETTE as P} from '../../src/world/moebiusPalette.js';
function release(group){const gs=new Set(),ms=new Set();group.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])ms.add(m);});for(const g of gs)g.dispose();for(const m of ms)m.dispose();group.clear();}

test('remove only complete baked legacy staircase shells; preserve the entire meeting platform and every unrelated part',()=>{
 let removed=0;for(const p of data.parts){const result=filterGateLegacyApproachPart(p);removed+=result.removedTriangles;
  if(!['Gate_stone.016_walk','Gate_edge.016_solid'].includes(p.name)){assert.equal(result.part,p);continue;}
  assert.equal(result.part.positions.length,result.part.normals.length);assert.ok(result.part.positions.every(Number.isFinite));
  const retained=new Set();for(let i=0;i<result.part.positions.length;i+=9)retained.add(result.part.positions.slice(i,i+9).join(','));
  for(let i=0;i<p.positions.length;i+=9)if(Math.max(p.positions[i+2],p.positions[i+5],p.positions[i+8])>=-24.99)assert.ok(retained.has(p.positions.slice(i,i+9).join(',')),'platform triangle removed');
 }
 assert.equal(filterGateLegacyApproachPart(data.parts.find(p=>p.name==='Gate_stone.016_walk')).removedTriangles,1320);assert.equal(removed,3960);
});

test('default factory physically omits all thirty stairs from raycast grounding and clears the retired approach route',()=>{
 const seat=new T.Group();seat.position.y=160;const root=installGateTarget(seat),oldSeat=new T.Group(),legacy=installGateTarget(oldSeat,{legacyApproachStairs:true});oldSeat.position.y=160;
 seat.updateMatrixWorld(true);oldSeat.updateMatrixWorld(true);const ground=createGatePlayerGround(seat),oldGround=createGatePlayerGround(oldSeat),ray=new T.Raycaster();
 for(let i=0;i<30;i++){const y=-3.76+i*.24,z=-36.8+i*.4,point=seat.localToWorld(new T.Vector3(-23,y+.1,z));assert.equal(ground(point),null,'deleted step '+i+' remains walkable');assert.ok(Number.isFinite(oldGround(point)),'rollback stair absent');}
 const deck=root.getObjectByName('Gate_stone.016_walk');ray.set(new T.Vector3(-23,165,-20),new T.Vector3(0,-1,0));ray.far=5;assert.ok(ray.intersectObject(deck).length,'meeting deck removed');
 assert.equal(root.userData.removedApproachStairs.triangles,3960);assert.equal(legacy.userData.removedApproachStairs.triangles,0);
 const scene=new T.Group(),site=installGateSite(scene,seat);assert.deepEqual(site.userData.approachRoute,[]);assert.equal(site.userData.retiredLegacyApproachRoute.length,1);
 seat.getObjectByName('gate-lighting').userData.dispose();oldSeat.getObjectByName('gate-lighting').userData.dispose();release(seat);release(oldSeat);release(scene);
});

test('actual crown rings remain one semantic draw batch and use the unchanged fixed light pool',()=>{
 const previous=globalThis.location;globalThis.location={search:'?gateThirty=21&gateSeaStacks=0&seaStackWfc=0&seaStackTerraces=0'};
 const scene=new T.Scene(),seat=new T.Group(),site=new T.Group(),arch=new T.Group(),gate=new T.Group();scene.add(seat,site);seat.add(arch);seat.userData.siteRoot=site;gate.userData.seatRoot=seat;
 installGateTarget(seat);installGateMoebiusV10(gate);const actualArch=seat.userData.moebiusV10;
 const lighting=installGateLighting(seat),pointCount=()=>{let n=0;lighting.traverse(o=>{if(o.isPointLight)n++;});return n;};assert.equal(pointCount(),15);assert.equal(installGateLighting(seat),lighting);
 installGateTargetThirty(gate);assert.equal(actualArch.userData.crownEmblems.length,8);const badge=actualArch.getObjectByName('g30-crown-emblems');assert.ok(badge?.userData.gateCrownEmblem);assert.ok(badge.material.isMeshStandardMaterial);assert.equal(badge.material.color.getHex(),new T.Color(P.brass).getHex());
 // Lighting was created before the late architecture batch: explicit binding
 // refresh must find that batch without adding any renderer lights.
 lighting.userData.bindArchitecture?.();lighting.userData.update(0);
 assert.equal(pointCount(),15);assert.equal(lighting.userData.report.emblemSources,8);assert.equal(lighting.userData.report.emblemMeshes,1);assert.ok(badge.material.emissiveIntensity>.5&&badge.material.emissiveIntensity<1);
 scene.updateMatrixWorld(true);const receivers=[];actualArch.traverse(o=>{if(o.isMesh&&o.material?.isMeshStandardMaterial&&o.material.color.getHex()===new T.Color(P.blue).getHex())receivers.push(o);});assert.ok(receivers.length>0);
 const lamp=lighting.getObjectByName('sighs-emblem-1-0');assert.ok(lamp);assert.equal(lamp.distance,5.5);assert.ok(lamp.intensity>0&&!lamp.castShadow);
 const ray=new T.Raycaster(lamp.position,new T.Vector3(-1.4,-1.5,0).normalize(),0,3);assert.ok(ray.intersectObjects(receivers).length,'actual blue pier is outside badge light vicinity');
 const camera=new T.PerspectiveCamera();camera.position.copy(lamp.position).add(new T.Vector3(1,1,1));const pool=createLightPool({scene,getCamera:()=>camera,capacity:8});pool.update(.25);assert.equal(pool.capacity,8);let visible=[];scene.traverse(o=>{if(o.isPointLight&&o.visible)visible.push(o);});assert.equal(visible.length,8);assert.ok(visible.some(l=>l.userData.sourceLightName===lamp.name));
 lighting.userData.update(.5);pool.update(.25);assert.equal(pointCount(),15);assert.equal(badge.material.emissiveIntensity,.12);assert.ok(visible.every(l=>l.visible));
 pool.dispose();lighting.userData.dispose();lighting.userData.dispose();release(scene);globalThis.location=previous;
});

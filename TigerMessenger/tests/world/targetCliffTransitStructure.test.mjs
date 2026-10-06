import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createTargetCityDetailCandidate} from '../../src/world/citadel/targetCityDetailCandidate.js';
import {createTargetCliffTransitStructure} from '../../src/world/citadel/targetCliffTransitStructure.js';
import {actualCliffTransitFixture} from './targetCliffTransitStructure.fixture.mjs';

const targets={old:[-32.23116164579317,17.3,3.7674098192195498],new:[51,12,39]};

test('actual released curves build replacement double deck, supported stairs and a two-lane waterfall crossing',()=>{
 const f=actualCliffTransitFixture(),before=f.terrain.geometry.attributes.position.array.slice(),sourcePoints=Object.fromEntries(Object.entries(f.release.curves).map(([k,c])=>[k,c.getPointAt(.6).toArray()]));
 const c=createTargetCityDetailCandidate({castle:f.castle,cliffTransitRelease:f.release,fitSunShadow:false});
 try{
  const r=c.report.cliffTransit;assert.equal(r.newCityTransitLinks,null);assert.equal(c.root.getObjectByName('target-new-city-transit-links'),undefined);assert.equal(r.built,true);assert.equal(r.accepted,false);assert.equal(r.finitePass,true,JSON.stringify(r.issues));assert.equal(r.vehicleClearance.pass,true);assert.equal(r.vehicleClearance.envelope.top,5.36);assert.equal(r.walkwayHeight,6.9);assert.ok(r.vehicleClearance.poses>700);assert.equal(r.railsCreated,false);assert.equal(c.report.frontRail,null);assert.equal(c.report.frontRailSuppressedByCliffTransit,true);
  assert.equal(c.root.getObjectByName('citadel-target-city-bay-bridge'),undefined);assert.ok(c.root.getObjectByName('citadel-target-cliff-transit-structure'));assert.equal(c.report.bridge.replacesLegacyBridge,true);
  assert.ok(c.report.sourceSurfaces.foundationTerrain.some(m=>m.name==='planet-surface'));
  for(const gallery of Object.values(r.galleries)){assert.equal(gallery.vehicleClearance.pass,true);assert.equal(gallery.terrainClearance.pass,true);assert.equal(gallery.foundationSampledPass,true);assert.equal(gallery.supportSamples.pass,true);assert.ok(gallery.openings.every(o=>o.genuineOpening));}
  for(const link of r.connections){assert.equal(link.width,2.4);assert.ok(link.maximumRiser<=.15+1e-8);assert.ok(link.minimumRun>=.28);assert.equal(link.groundPass,true);assert.equal(link.foundationPass,true);assert.deepEqual(link.end,targets[link.id]);assert.equal(link.continuousRamp,false);}
  assert.ok(r.railOpeningChanges.length>=4);assert.ok(r.performance.triangles>4000);
  assert.equal(c.report.waterfallRailReach.accepted,true);assert.ok(c.report.waterfallRailReach.centerlineCrossings.red.length);assert.ok(c.report.waterfallRailReach.centerlineCrossings.blue.length);assert.ok(c.report.waterfall.geometry.outboardReach>0&&c.report.waterfall.geometry.outboardReach<=30);assert.equal(c.report.waterfall.surfaceSamplingPassed,true);assert.equal(c.report.waterfallRailRelocation.jointSurvey,true);
  assert.deepEqual(f.terrain.geometry.attributes.position.array,before);for(const[k,p]of Object.entries(sourcePoints))assert.deepEqual(f.release.curves[k].getPointAt(.6).toArray(),p);
  c.root.traverse(mesh=>{if(mesh.geometry?.attributes.position)for(const n of mesh.geometry.attributes.position.array)assert.ok(Number.isFinite(n));});
 }finally{c.dispose();f.dispose();}
});

test('actual provider supports and clears both connections in both directions and across .8m body-centre band',()=>{
 const f=actualCliffTransitFixture(),c=createTargetCityDetailCandidate({castle:f.castle,cliffTransitRelease:f.release,fitSunShadow:false});f.castle.add(c.root);const provider=c.getPlayerSupport(),failures=[];let queries=0;
 try{
  for(const route of c.report.cliffTransit.connections){const direction=new T.Vector3(...route.end).sub(new T.Vector3(...route.start));direction.y=0;direction.normalize();const side=new T.Vector3(direction.z,0,-direction.x);
   for(const reverse of[false,true])for(const lateral of[-.4,0,.4]){const points=reverse?[...route.walkPath].reverse():route.walkPath;let previous=new T.Vector3(...points[0]).addScaledVector(side,lateral).applyMatrix4(f.castle.matrixWorld);const initial=provider.ground(previous);if(initial!==null)previous.setLength(initial);
    for(let j=1;j<points.length;j++){const A=new T.Vector3(...points[j-1]).addScaledVector(side,lateral),B=new T.Vector3(...points[j]).addScaledVector(side,lateral),steps=Math.ceil(A.distanceTo(B)/.10);
     for(let i=1;i<=steps;i++){const world=A.clone().lerp(B,i/steps).applyMatrix4(f.castle.matrixWorld),radius=provider.ground(world);queries++;if(radius===null||Math.abs(radius-world.length())>.3)failures.push({route:route.id,reverse,lateral,j,i,type:'support',radius});if(radius!==null)world.setLength(radius);const proposed=world.clone(),velocity=world.clone().sub(previous);if(provider.walls(previous,proposed,velocity))failures.push({route:route.id,reverse,lateral,j,i,type:'body',diagnostic:provider.report().lastWall});previous=world;}
    }
   }
  }
  // Continue through the existing short dock connector to surveyed tread 14.
  const dock=c.report.bridgeConnector.dock,arrival=c.report.bridgeConnector.endpoint;
  for(const reverse of[false,true]){const A=new T.Vector3(...(reverse?arrival:dock)),B=new T.Vector3(...(reverse?dock:arrival)),steps=Math.ceil(A.distanceTo(B)/.1);let previous=A.clone().applyMatrix4(f.castle.matrixWorld);const first=provider.ground(previous);assert.notEqual(first,null);previous.setLength(first);for(let i=1;i<=steps;i++){const world=A.clone().lerp(B,i/steps).applyMatrix4(f.castle.matrixWorld),height=provider.ground(world);queries++;if(height===null)failures.push({route:'dock-to-tread-14',reverse,i,type:'support'});else world.setLength(height);if(provider.walls(previous,world.clone(),world.clone().sub(previous)))failures.push({route:'dock-to-tread-14',reverse,i,type:'body',diagnostic:provider.report().lastWall});previous=world;}}
  assert.ok(queries>5000);assert.deepEqual(failures,[]);
  // Radial gallery floors, not non-walkable roof cornices or handrail tops.
  for(const[key,g]of Object.entries(c.report.cliffTransit.galleries)){const path=g.upperPath;for(let i=0;i<path.length;i+=3){const p=new T.Vector3(...path[i]).applyMatrix4(f.castle.matrixWorld),radius=provider.ground(p);assert.ok(radius!==null&&Math.abs(radius-p.length())<.06,key+' '+i);}}
 }finally{c.dispose();f.dispose();}
});

test('missing real sea bed stays unresolved, geometry failure cleans stage, borrowed release remains alive',()=>{
 const f=actualCliffTransitFixture();const a=createTargetCliffTransitStructure({release:f.release,sampleTerrain:()=>null,sampleSea:()=>-10,connectionTargets:targets});
 try{assert.equal(a.report.finitePass,false);assert.ok(a.report.issues.some(i=>i.type==='gallery-foundation-unresolved'));assert.ok(a.report.issues.some(i=>i.type==='connection-foundation-unresolved'));assert.equal(a.report.accepted,false);}
 finally{a.dispose();a.dispose();}
 assert.ok(Number.isFinite(f.release.curves.red.getPointAt(.5).x));
 assert.throws(()=>createTargetCliffTransitStructure({release:f.release,sampleTerrain:()=>0,sampleSea:()=>0,connectionTargets:{old:[0,0,0],new:[NaN,0,0]}}),/connection/);
 assert.throws(()=>createTargetCliffTransitStructure({release:f.release,sampleTerrain:()=>NaN,sampleSea:()=>0,connectionTargets:targets}),/nonfinite/);f.dispose();
});

test('candidate resources dispose once while original planet/terrain and release curves remain owned by caller',()=>{
 const f=actualCliffTransitFixture(),c=createTargetCityDetailCandidate({castle:f.castle,cliffTransitRelease:f.release,fitSunShadow:false}),geometries=new Set(),materials=new Set();f.castle.add(c.root);
 c.root.traverse(o=>{if(!o.isMesh)return;geometries.add(o.geometry);for(const m of(Array.isArray(o.material)?o.material:[o.material]))materials.add(m);});let gd=0,md=0,source=0;for(const g of geometries)g.addEventListener('dispose',()=>gd++);for(const m of materials)m.addEventListener('dispose',()=>md++);f.terrain.geometry.addEventListener('dispose',()=>source++);f.scene.getObjectByName('planet-surface').geometry.addEventListener('dispose',()=>source++);
 c.dispose();c.dispose();assert.equal(gd,geometries.size);assert.equal(md,materials.size);assert.equal(source,0);assert.equal(c.root.children.length,0);assert.ok(f.scene.getObjectByName('planet-surface'));assert.ok(f.release.curves.blue.getLength()>200);f.dispose();
});


test('loaded robot freight cannot pass the earlier empty-wagon ceiling',()=>{
 const f=actualCliffTransitFixture(),a=createTargetCliffTransitStructure({release:f.release,sampleTerrain:()=>-120,sampleSea:()=>-10,connectionTargets:targets,walkwayHeight:5.2});
 try{assert.equal(a.report.vehicleClearance.envelope.top,5.36);assert.equal(a.report.vehicleClearance.pass,false);assert.ok(a.report.vehicleClearance.collisions.some(c=>c.hits.some(h=>/ceiling|deck/.test(h.mesh))));assert.equal(a.report.finitePass,false);}finally{a.dispose();f.dispose();}
});

test('late candidate construction failure restores source scene and disposes every already-owned geometry',()=>{
 const f=actualCliffTransitFixture(),before=[...f.castle.children],material=f.terrain.material,geometry=f.terrain.geometry,counts=new Map();
 assert.throws(()=>createTargetCityDetailCandidate({castle:f.castle,cliffTransitRelease:f.release,cliffTransitStructureOptions:{sampleStep:3},fitSunShadow:false,onOwned(handle){(handle.group??handle.root)?.traverse?.(mesh=>{const g=mesh.geometry;if(!g||counts.has(g))return;counts.set(g,0);g.addEventListener('dispose',()=>counts.set(g,counts.get(g)+1));});}}),/sampling step/);
 assert.deepEqual(f.castle.children,before);assert.equal(f.terrain.material,material);assert.equal(f.terrain.geometry,geometry);assert.ok(counts.size>50);for(const count of counts.values())assert.equal(count,1);f.dispose();
});

test('actual instance transforms are included in cargo clearance, not only a mesh origin proxy',()=>{
 const f=actualCliffTransitFixture(),curve=f.release.curves.red,point=curve.getPointAt(.6),tangent=curve.getTangentAt(.6),right=point.clone().normalize().cross(tangent).normalize(),up=tangent.clone().cross(right).normalize(),local=point.addScaledVector(up,2).applyMatrix4(f.release.castleMatrix.clone().invert());
 const geometry=new T.BoxGeometry(.8,.8,.8),material=new T.MeshBasicMaterial(),instance=new T.InstancedMesh(geometry,material,1);instance.name='instance-at-actual-rail';instance.setMatrixAt(0,new T.Matrix4().makeTranslation(...local.toArray()));const obstacles=new T.Group();obstacles.add(instance);
 const a=createTargetCliffTransitStructure({release:f.release,sampleTerrain:()=>-120,sampleSea:()=>-10,connectionTargets:targets,obstacleGroups:[obstacles]});
 try{assert.equal(a.report.vehicleClearance.pass,false);assert.ok(a.report.vehicleClearance.collisions.some(c=>c.hits.some(h=>h.mesh===instance.name&&h.instanceId===0)));}finally{a.dispose();geometry.dispose();material.dispose();f.dispose();}
});

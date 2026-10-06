import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {actualUserMarkedStructureFixture} from './targetUserMarkedStructure.fixture.mjs';
import {createTargetCityDetailCandidate} from '../../src/world/citadel/targetCityDetailCandidate.js';

// This is a NEW release and NEW final terrain, not the previous inner-route fixture.
// Keep the old foundation collision artifacts; this checks actual narrower piers.
test('new user-marked three-line terrain, narrow old-shore piers, independent bridge and waterfall jointly clear cargo and finite pedestrians',()=>{
 const f=actualUserMarkedStructureFixture(),terrainBefore=f.terrain.geometry.attributes.position.array.slice(),c=createTargetCityDetailCandidate({castle:f.castle,cliffTransitRelease:f.release,cliffTransitStructureOptions:{galleryPierWidths:{oldShore:.9}},fitSunShadow:false});f.castle.add(c.root);const provider=c.getPlayerSupport(),r=c.report.cliffTransit,failures=[],routes=[],referenceWalkables=[];c.root.traverse(o=>{if(o.isMesh&&(o.userData.targetWalkable===true||/^surveyed-route-tread-/.test(o.name)))referenceWalkables.push(o);});const inverse=f.castle.matrixWorld.clone().invert(),chartDown=new T.Vector3(0,-1,0).transformDirection(f.castle.matrixWorld),chartUp=chartDown.clone().negate(),referenceRay=new T.Raycaster();let groundQueries=0,wallQueries=0;
 const hashes=Object.fromEntries(['src/world/citadel/targetCliffTransitStructure.js','src/world/citadel/targetCityDetailCandidate.js','src/world/citadel/targetUserMarkedTransitRelease.js','src/world/citadel/targetTerrainCandidate.js','src/world/citadel/targetOldShoreApronField.js'].map(p=>[p,createHash('sha256').update(readFileSync(new URL('../../'+p,import.meta.url))).digest('hex')]));
 try{
  assert.equal(f.release.version,'user-marked-transit-release-1');assert.equal(r.finitePass,true,JSON.stringify(r.issues));assert.equal(r.vehicleClearance.pass,true);assert.ok(r.vehicleClearance.poses>900);assert.notEqual(r.vehicleClearance.poses,776);assert.equal(r.galleries.oldShore.structuralParameters.pierWidth,.9);
  assert.equal(r.independentWalkingBridge.vehicleClearance.pass,true);assert.equal(r.independentWalkingBridge.terrainClearance.pass,true);assert.equal(c.report.waterfallRailReach.accepted,true);assert.ok(c.report.waterfallRailReach.centerlineCrossings.red.length);assert.ok(c.report.waterfallRailReach.centerlineCrossings.blue.length);assert.ok(c.report.waterfallRailReach.requiredReach<=30);
  for(const gallery of Object.values(r.galleries)){assert.equal(gallery.foundationSampledPass,true);assert.equal(gallery.vehicleClearance.pass,true);assert.equal(gallery.terrainClearance.pass,true);assert.equal(gallery.supportSamples.pass,true);assert.ok(gallery.foundations.every(p=>p.seated));}
  routes.push({id:'short-bridge-and-tread14',points:[...r.independentWalkingBridge.path,c.report.bridgeConnector.endpoint]});
  for(const[key,g]of Object.entries(r.galleries))routes.push({id:key,points:g.upperPath});
  // A dedicated seam path crosses exact independently generated section ends.
  routes.push({id:'new-central-seam',points:[...r.galleries.newShore.upperPath.slice(-3),...r.galleries.central.upperPath.slice(0,3)]},{id:'central-old-seam',points:[...r.galleries.central.upperPath.slice(-3),...r.galleries.oldShore.upperPath.slice(0,3)]});
  for(const route of routes){for(const reverse of[false,true])for(const lateral of[-.4,0,.4]){
   const points=(reverse?[...route.points].reverse():route.points).map(p=>new T.Vector3(...p).applyMatrix4(f.castle.matrixWorld));
   const sides=points.map((p,i)=>p.clone().normalize().cross(points[Math.min(points.length-1,i+1)].clone().sub(points[Math.max(0,i-1)])).normalize());let previous=null;
   for(let j=1;j<points.length;j++){const a=points[j-1].clone().addScaledVector(sides[j-1],lateral),b=points[j].clone().addScaledVector(sides[j],lateral),n=Math.max(1,Math.ceil(a.distanceTo(b)/.1));for(let i=0;i<=n;i++){
    const p=a.clone().lerp(b,i/n);if(route.id==='short-bridge-and-tread14'){const local=p.clone().applyMatrix4(inverse);referenceRay.set(local.clone().add(new T.Vector3(0,1,0)).applyMatrix4(f.castle.matrixWorld),chartDown);referenceRay.near=0;referenceRay.far=4;const hit=referenceRay.intersectObjects(referenceWalkables,false).find(h=>h.face&&h.face.normal.clone().applyMatrix3(new T.Matrix3().getNormalMatrix(h.object.matrixWorld)).normalize().dot(chartUp)>.5);if(hit)p.copy(hit.point);else failures.push({route:route.id,type:'independent-walk-triangle-missing',reverse,lateral,j,i,local:local.toArray()});}const height=provider.ground(p),ctx={route:route.id,reverse,lateral,j,i,local:p.clone().applyMatrix4(f.castle.matrixWorld.clone().invert()).toArray()};groundQueries++;if(height===null||Math.abs(height-p.length())>.3)failures.push({...ctx,type:'ground',height,difference:height===null?null:height-p.length(),hit:provider.report().lastGround});if(height!==null)p.setLength(height);if(previous){wallQueries++;if(provider.walls(previous,p.clone(),p.clone().sub(previous)))failures.push({...ctx,type:'body',hit:provider.report().lastWall});}previous=p;
   }}
  }console.log(JSON.stringify({route:route.id,groundQueries,wallQueries,failures:failures.length}));}
  const evidence={version:'user-marked-actual-structure-cpu-1',sourceHashes:hashes,walkReference:'short connector uses independent castle-vertical ray on actual targetWalkable triangles; galleries use authored upperPath',releaseVersion:f.release.version,terrain:f.terrainReport,startup:f.startupReport,report:c.report,walk:{step:.1,lateral:[-.4,0,.4],groundQueries,wallQueries,failures,routes:routes.map(x=>({id:x.id,points:x.points.length}))},gpuVerified:false};
  if(process.env.CITADEL_MARKED_STRUCTURE_REPORT)writeFileSync(process.env.CITADEL_MARKED_STRUCTURE_REPORT,JSON.stringify(evidence,null,2)+'\n');
  assert.ok(wallQueries>24000);assert.deepEqual(failures,[]);assert.deepEqual(f.terrain.geometry.attributes.position.array,terrainBefore);
 }finally{c.dispose();f.dispose();}
});

test('production release structural defaults merge by section and caller overrides stay authoritative',()=>{
 const f=actualUserMarkedStructureFixture();f.release.structureOptions={galleryPierWidths:{oldShore:.9,newShore:1.2},galleryMaxSpans:{oldShore:18}};
 const c=createTargetCityDetailCandidate({castle:f.castle,cliffTransitRelease:f.release,cliffTransitStructureOptions:{galleryPierWidths:{newShore:1.0}},fitSunShadow:false});
 try{const g=c.report.cliffTransit.galleries;assert.equal(g.oldShore.structuralParameters.pierWidth,.9);assert.equal(g.newShore.structuralParameters.pierWidth,1);assert.equal(g.oldShore.structuralParameters.maxSpan,18);assert.equal(f.release.structureOptions.galleryPierWidths.newShore,1.2);}finally{c.dispose();f.dispose();}
});

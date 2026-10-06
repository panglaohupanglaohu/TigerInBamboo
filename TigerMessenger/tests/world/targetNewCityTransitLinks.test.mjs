import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';import{writeFileSync}from'node:fs';
import {actualUserMarkedStructureFixture}from'./targetUserMarkedStructure.fixture.mjs';
import {createTargetCityDetailCandidate}from'../../src/world/citadel/targetCityDetailCandidate.js';
import {createTargetNewCityTransitLinks}from'../../src/world/citadel/targetNewCityTransitLinks.js';
import {buildMountainSurfaceIndex}from'../../src/world/citadel/mountainSurfaceIndex.js';
function samplers(f){const matrix=f.castle.matrixWorld,inverse=matrix.clone().invert(),down=new T.Vector3(0,-1,0).transformDirection(matrix),sample=mesh=>{const index=buildMountainSurfaceIndex([mesh]);return(x,z)=>{const h=index.sample(new T.Ray(new T.Vector3(x,250,z).applyMatrix4(matrix),down),0,700);return h?.point.clone().applyMatrix4(inverse).y??null;};};return{sampleTerrain:sample(f.terrain),sampleSea:sample(f.ocean)};}

test('two opt-in B links use actual flat plaza floors, keep loaded railway clear and join actual player ground/walls',()=>{
 const f=actualUserMarkedStructureFixture();f.release.walkingConnection={kind:'stacked-connected'};f.release.structureOptions={galleryPierWidths:{oldShore:.9}};
 const oldPositions=f.terrain.geometry.attributes.position.array.slice(),c=createTargetCityDetailCandidate({castle:f.castle,cliffTransitRelease:f.release,cliffTransitStructureOptions:{newCityTransitLinks:true},fitSunShadow:false});f.castle.add(c.root);f.scene.updateMatrixWorld(true);
 const r=c.report.cliffTransit,l=r.newCityTransitLinks,provider=c.getPlayerSupport(),failures=[];let groundQueries=0,bodyQueries=0;
 try{
  assert.equal(l.built,true);assert.equal(l.finitePass,true,JSON.stringify(l.issues));assert.equal(r.finitePass,true,JSON.stringify(r.issues));assert.equal(l.vehicleClearance.pass,true);assert.equal(l.vehicleClearance.poses,949);assert.equal(l.accepted,false);assert.equal(l.links.length,2);assert.deepEqual(l.links.map(p=>p.station),[55,65]);
  const m=f.castle.matrixWorld,inv=m.clone().invert();
  for(const link of l.links){assert.ok(link.length<=16);assert.equal(link.width,2.4);assert.ok(link.maximumRiser<=.15+1e-8);assert.ok(link.minimumRun>=.28);assert.equal(link.endpointActualFloorSamples.length,9);assert.ok(link.foundations.every(f=>Number.isFinite(f.bottom)));assert.equal(link.terrainFailures.length,0);
   const start=new T.Vector3(...link.start),end=new T.Vector3(...link.end),forward=end.clone().sub(start).setY(0).normalize(),side=new T.Vector3(forward.z,0,-forward.x),curve=f.release.segments.center.newShore,p=curve.getPointAt(link.u),t=curve.getTangentAt(link.u).normalize(),rr=p.clone().normalize().cross(t).normalize(),up=t.clone().cross(rr).normalize(),galleryCenter=p.clone().addScaledVector(up,6.9).applyMatrix4(inv),s=samplers(f),beyond=end.clone().addScaledVector(forward,1.3);beyond.y=s.sampleTerrain(beyond.x,beyond.z);
   const path=[galleryCenter.toArray(),...link.walkPath,beyond.toArray()];
   for(const reverse of[false,true])for(const lateral of[-.4,0,.4]){const points=(reverse?[...path].reverse():path).map(q=>new T.Vector3(...q).addScaledVector(side,lateral).applyMatrix4(m));let previous=null;
    for(let j=1;j<points.length;j++){const a=points[j-1],b=points[j],n=Math.max(1,Math.ceil(a.distanceTo(b)/.1));for(let i=0;i<=n;i++){
     const p=a.clone().lerp(b,i/n),y=provider.ground(p),context={station:link.station,reverse,lateral,j,i,point:p.clone().applyMatrix4(inv).toArray()};groundQueries++;if(y===null||Math.abs(y-p.length())>.3)failures.push({...context,type:'ground',actual:y,expected:p.length(),hit:provider.report().lastGround});if(y!==null)p.setLength(y);if(previous){bodyQueries++;if(provider.walls(previous,p.clone(),p.clone().sub(previous)))failures.push({...context,type:'body',hit:provider.report().lastWall});}previous=p;
    }}
   }
  }
  const evidence={report:l,joinedStructureVehicle:r.vehicleClearance,railOpenings:r.railOpeningChanges,walk:{groundQueries,bodyQueries,failures},gpuValidated:false};if(process.env.CITADEL_NEW_LINKS_REPORT){writeFileSync(process.env.CITADEL_NEW_LINKS_REPORT,JSON.stringify(evidence,null,2));writeFileSync(process.env.CITADEL_NEW_LINKS_REPORT.replace(/\.json$/,'-geometry.json'),JSON.stringify(c.root.getObjectByName('target-new-city-transit-links').toJSON()));}
  assert.deepEqual(failures,[]);assert.ok(groundQueries>1800);assert.deepEqual(f.terrain.geometry.attributes.position.array,oldPositions);
  const newMeshes=[];c.root.getObjectByName('target-new-city-transit-links').traverse(o=>{if(o.isMesh)newMeshes.push(o);});assert.equal(newMeshes.length,3);assert.equal(newMeshes.filter(o=>o.userData.targetWalkable).length,1);
 }finally{c.dispose();f.dispose();}
});

test('missing floors and protected landmarks reject explicitly; owned buffers/materials dispose once',()=>{
 const f=actualUserMarkedStructureFixture(),samples=samplers(f);
 try{
  const missing=createTargetNewCityTransitLinks({release:f.release,sampleTerrain:()=>null,sampleSea:samples.sampleSea});assert.equal(missing.report.finitePass,false);assert.equal(missing.report.built,false);assert.equal(missing.group.children.length,0);missing.dispose();
  f.release.walkingConnection={kind:'stacked-connected'};f.release.structureOptions={galleryPierWidths:{oldShore:.9}};const children=[...f.castle.children];assert.throws(()=>createTargetCityDetailCandidate({castle:f.castle,cliffTransitRelease:f.release,cliffTransitStructureOptions:{newCityTransitLinks:{protectedDiscs:[{id:'all',center:[50,84],radius:30}]}},fitSunShadow:false}),/New city transit links rejected/);assert.deepEqual(f.castle.children,children,'rejected opt-in cannot publish partial scene');
  const blocked=createTargetNewCityTransitLinks({release:f.release,...samples,protectedDiscs:[{id:'all-plaza',center:[50,84],radius:30}]});assert.equal(blocked.report.finitePass,false);blocked.dispose();
  const a=createTargetNewCityTransitLinks({release:f.release,...samples});let geoms=0,mats=0;a.group.traverse(o=>{if(o.isMesh){o.geometry.addEventListener('dispose',()=>geoms++);o.material.addEventListener('dispose',()=>mats++);for(const v of o.geometry.attributes.position.array)assert.ok(Number.isFinite(v));}});a.dispose();a.dispose();assert.equal(geoms,3);assert.equal(mats,3);
  assert.throws(()=>createTargetNewCityTransitLinks({release:f.release,...samples,walkwayHeight:6}),/>=6.9/);assert.throws(()=>createTargetNewCityTransitLinks({release:f.release,...samples,width:2}),/>=2.4/);
 }finally{f.dispose();}
});

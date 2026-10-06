import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createTargetNewCityStairs,TARGET_NEW_CITY_STAIR_ROUTE} from '../../src/world/citadel/targetNewCityStairs.js';
import {createTargetNewCityMain} from '../../src/world/citadel/targetNewCityMain.js';
import {compileOfficialOcean} from '../../src/world/waterV8/officialOcean.js';
import {applyTargetTerrainCandidate} from '../../src/world/citadel/targetTerrainCandidate.js';
import {createTargetStairSurfaceSampler,createTargetNewCityStairRoute} from '../../src/world/citadel/targetNewCityStairRoute.js';
const near=(a,b,e=1e-5)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);

test('stairs supply finite detailed geometry, 36 true treads, six safe flank houses and endpoints',()=>{
 const a=createTargetNewCityStairs();
 assert.equal(a.report.stepCount,36);assert.equal(a.report.houses.length,6);assert.equal(a.report.rejectedHouses.length,0);
 assert.ok(a.report.performance.triangles<18000);assert.equal(a.report.support.sampledPass,null);
 a.group.traverse(o=>{if(o.isMesh){assert.ok(o.material.isMeshStandardMaterial);assert.equal(o.userData.preserveCitadelMaterials,true);for(const attr of Object.values(o.geometry.attributes))for(const n of attr.array)assert.ok(Number.isFinite(n),o.name);}});
 const p=new THREE.Vector3(...a.report.endpoints.plazaNorth).applyAxisAngle(new THREE.Vector3(0,1,0),-55*Math.PI/180).add(new THREE.Vector3(74,12,33));
 [62,3,64].forEach((n,i)=>near(p.getComponent(i),n));
 a.dispose();
});

test('actual every tread and landing support the full 5.6m corridor with standing clearance',()=>{
 const a=createTargetNewCityStairs();a.group.updateMatrixWorld(true);
 let previous=0;
 for(const w of a.report.walkSurfaces){
   assert.ok(w.rise<=.25+1e-6);assert.ok(w.topY<=previous+1e-6);assert.ok(previous-w.topY<=.25+1e-6);previous=w.topY;
   const[l0,l1,r1,r0]=w.polygon;
   for(const t of [.07,.25,.5,.75,.93]){
     const x=(l0[0]+l1[0])*.5*(1-t)+(r0[0]+r1[0])*.5*t,z=(l0[1]+l1[1])*.5*(1-t)+(r0[1]+r1[1])*.5*t;
     const ray=new THREE.Raycaster(new THREE.Vector3(x,w.topY+3,z),new THREE.Vector3(0,-1,0),0,3.2),hits=ray.intersectObject(a.group,true);
     assert.ok(hits.length,w.id);assert.equal(hits[0].object.name,w.id,`headroom obstruction ${w.id}: ${hits[0].object.name}`);near(hits[0].point.y,w.topY);
   }
 }
 // Consecutive slabs share their entire cross-section, avoiding corner cracks.
 for(let i=1;i<a.report.walkSurfaces.length;i++){
   const p=a.report.walkSurfaces[i-1].polygon,q=a.report.walkSurfaces[i].polygon;
   for(let axis=0;axis<2;axis++){near(p[1][axis],q[0][axis]);near(p[2][axis],q[3][axis]);}
 }
 a.dispose();
});

test('main hall entry and new staircase join without changing existing main geometry',()=>{
 const main=createTargetNewCityMain(),stairs=createTargetNewCityStairs(),root=new THREE.Group();root.add(main.group,stairs.group);root.updateMatrixWorld(true);
 assert.deepEqual(stairs.report.endpoints.mainApproach,main.report.stairs.bottom);
 for(const z of [13.2,12.8,11.6,10.2,8.8,7.2,6.8]){
   const hits=new THREE.Raycaster(new THREE.Vector3(0,2.5,z),new THREE.Vector3(0,-1,0),0,3).intersectObject(root,true);
   assert.ok(hits.length,`missing entry support ${z}`);assert.ok(hits[0].point.y>=-1e-6&&hits[0].point.y<=1.20001);
 }
 assert.equal(stairs.report.validation.terrainChanged,false);main.dispose();stairs.dispose();
});

test('optional terrain samples report obstruction or missing support, never alter terrain',()=>{
 const route=TARGET_NEW_CITY_STAIR_ROUTE.map(p=>[...p]);let called=0;
 const a=createTargetNewCityStairs({includeHouses:false,surfaceHeightAt:()=>{called++;return 2;}});
 assert.ok(called>100);assert.equal(a.report.support.sampledPass,false);assert.ok(a.report.support.buriedCount>0);assert.deepEqual(a.report.route,route);a.dispose();
 const b=createTargetNewCityStairs({includeHouses:false,surfaceHeightAt:()=>null});assert.ok(b.report.support.missingCount>0);assert.equal(b.report.support.sampledPass,false);b.dispose();
 assert.throws(()=>createTargetNewCityStairs({route:[[0,0,0],[0,1,1]]}),/descend/);
 assert.throws(()=>createTargetNewCityStairs({width:0}),/width/);
 assert.throws(()=>createTargetNewCityStairs({foundationBottom:0}),/foundation/);
});

test('dispose only removes owned candidate resources and is idempotent',()=>{
 const a=createTargetNewCityStairs(),root=new THREE.Group(),sibling=new THREE.Group();root.add(a.group,sibling);
 const gs=new Set(),ms=new Set();a.group.traverse(o=>{if(o.isMesh){gs.add(o.geometry);ms.add(o.material);}});let g=0,m=0;
 for(const o of gs)o.addEventListener('dispose',()=>g++);for(const o of ms)o.addEventListener('dispose',()=>m++);
 a.dispose();a.dispose();assert.equal(g,gs.size);assert.equal(m,ms.size);assert.deepEqual(root.children,[sibling]);
});

test('sampled tall foundations have real recessed arches and retained load-bearing backs inside the old envelope',()=>{
 const a=createTargetNewCityStairs({surfaceHeightAt:(x,z)=>.8*x-.25*z-4});a.group.updateMatrixWorld(true);
 const bases=a.report.houseFoundations.filter(f=>f.arcades.length);assert.ok(bases.length>=3);assert.ok(a.report.performance.triangles<35000);
 for(const f of bases){
  assert.equal(f.publicThroughPassage,false);assert.ok(f.draws<=4);assert.equal(f.footprintExpanded,false);
  a.group.getObjectByName(f.id).traverse(m=>{if(m.isMesh)for(const attr of Object.values(m.geometry.attributes))for(const n of attr.array)assert.ok(Number.isFinite(n));});
  const house=a.group.getObjectByName(f.id),fp=a.report.footprints.find(p=>p.id===f.id),minX=Math.min(...fp.polygon.map(p=>p[0])),maxX=Math.max(...fp.polygon.map(p=>p[0])),minZ=Math.min(...fp.polygon.map(p=>p[1])),maxZ=Math.max(...fp.polygon.map(p=>p[1]));
  const bounds=new THREE.Box3();house.traverse(m=>{if(m.isMesh&&m.name.includes('foundation-batched'))bounds.union(new THREE.Box3().setFromObject(m));});
  assert.ok(bounds.min.x>=minX-1e-5&&bounds.max.x<=maxX+1e-5&&bounds.min.z>=minZ-1e-5&&bounds.max.z<=maxZ+1e-5,'new foundation must stay in the proven footprint');
  for(const arch of f.arcades){
   assert.ok(arch.minimumGroundClearance>=.119);assert.ok(arch.jambWidth>1);assert.equal(arch.throughPassage,false);
   const origin=new THREE.Vector3(...arch.centreLocal).addScaledVector(new THREE.Vector3(...arch.outwardLocal),.1),direction=new THREE.Vector3(...arch.outwardLocal).negate();
   const hits=new THREE.Raycaster(origin,direction,0,2).intersectObject(house,true);assert.ok(hits.length,'retained back wall must exist');assert.ok(hits[0].distance>.64&&hits[0].distance<.8,`front arch is genuinely empty until inset back: ${hits[0].distance}`);
  }
 }
 a.dispose();
});

test('missing facade terrain never invents an open arcade or through passage',()=>{
 const a=createTargetNewCityStairs({surfaceHeightAt:(x,z)=>z>30?null:-12});
 for(const f of a.report.houseFoundations){for(const facade of f.facades||[])if(!facade.allSampled)assert.ok(!f.arcades.some(arch=>arch.side===facade.side));assert.equal(f.publicThroughPassage,false);}
 a.dispose();
});

test('house relocation accepts only explicit known IDs and finite local XZ offsets',()=>{
 for(const houseOffsets of[[],null,{'unknown-house':[1,2]},{'new-city-stair-house-1--1':[1,NaN]},{'new-city-stair-house-1--1':[1,2,3]}])assert.throws(()=>createTargetNewCityStairs({houseOffsets}),/houseOffsets/);
 const offsets={'new-city-stair-house-1--1':[1,2]},a=createTargetNewCityStairs({houseOffsets:offsets});offsets['new-city-stair-house-1--1'][0]=99;assert.deepEqual(a.report.houseOffsets['new-city-stair-house-1--1'],[1,2]);a.dispose();
});

function frozenHouseSpacingScene() {
  const scene = new THREE.Group(), castle = new THREE.Group(); scene.add(castle);
  castle.matrixAutoUpdate = false;
  castle.matrix.fromArray([-.5771265090244172,.12463062405961449,.807088718870361,0,.6354855835814281,.689249750214348,.3479839865419536,0,-.5129162364767383,.7137240288626759,-.4769852670498,0,124.43456408079132,72.61606956254715,90.15650671642375,1]);
  const source = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({side: THREE.DoubleSide}));
  source.name = 'citadel-oskar-grid-mountain-surface'; castle.add(source);
  const previous = globalThis.location;
  globalThis.location = {search: '?citadelTerrainFirst=1&citadelTargetRemesh=1&citadelTerraceAprons=1&citadelRecessedSaddle=1&citadelValleyBenches=1'};
  try {const obsolete = source.geometry; applyTargetTerrainCandidate(castle); obsolete.dispose();}
  finally {if (previous === undefined) delete globalThis.location; else globalThis.location = previous;}
  const compiled = compileOfficialOcean().ocean, geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(compiled.positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(compiled.indices, 1)); geometry.computeVertexNormals();
  const ocean = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({side: THREE.DoubleSide})); ocean.name = 'planet-v8-curved-ocean'; scene.add(ocean);
  const originalBuilding = new THREE.Group(); originalBuilding.name = 'old-city-preserved'; castle.add(originalBuilding);
  scene.updateMatrixWorld(true);
  return {scene, castle, source, ocean, originalBuilding, dispose() {for (const m of [source, ocean]) {m.geometry.dispose(); m.material.dispose();}}};
}


test('r32 six full house envelopes are separated, resampled and clear of actual surveyed stairs and bridge',async()=>{
 const fs=await import('node:fs'),data=JSON.parse(fs.readFileSync(new URL('../../artifacts/pipeline/citadel-four-hour-20261005/r32-plaza-original-landmarks-target-front-plants-terrain.json',import.meta.url),'utf8')).cityDetail;
 const f=frozenHouseSpacingScene(),sample=createTargetStairSurfaceSampler(f.castle,[f.source]),yaw=-55*Math.PI/180,offsets=data.newCityStairs.authored.houseOffsets,a=createTargetNewCityStairs({houseOffsets:offsets,surfaceHeightAt:(x,z)=>sample(74+x*Math.cos(yaw)+z*Math.sin(yaw),33-x*Math.sin(yaw)+z*Math.cos(yaw))?.height-12});
 const fps=a.report.footprints.filter(p=>p.role==='stair-flank-house'),min=(p,k)=>Math.min(...p.polygon.map(p=>p[k])),max=(p,k)=>Math.max(...p.polygon.map(p=>p[k]));let minGap=Infinity;
 for(let i=0;i<fps.length;i++)for(let j=i+1;j<fps.length;j++){const gap=Math.max(...[0,1].map(k=>Math.max(min(fps[i],k)-max(fps[j],k),min(fps[j],k)-max(fps[i],k))));assert.ok(gap>=.4,`${fps[i].id}/${fps[j].id} gap ${gap}`);minGap=Math.min(minGap,gap);}
 assert.equal(a.report.houseLayoutAdjustments.length,3);assert.deepEqual(a.report.houseLayoutAdjustments.find(h=>h.id==='new-city-stair-house-1-1').offset,[0,-1.8]);assert.deepEqual(a.report.houseOffsets,offsets);
 for(const h of a.report.houses){const before=data.newCityStairs.authored.houses.find(p=>p.id===h.id);if(h.id==='new-city-stair-house-1-1'){near(h.position[0],before.position[0]);near(h.position[2],before.position[2]-1.8);}else if(h.id==='new-city-stair-house-2--1'){near(h.position[0],before.position[0]+1.3*Math.cos(yaw));near(h.position[2],before.position[2]+1.3*Math.sin(yaw));}else if(h.id==='new-city-stair-house-0--1'){near(h.position[0],before.position[0]+Math.cos(yaw)+Math.sin(yaw));near(h.position[2],before.position[2]+Math.sin(yaw)-Math.cos(yaw));}else h.position.forEach((v,i)=>near(v,before.position[i]));}
 const movedId='new-city-stair-house-1-1',moved=a.report.houses.find(h=>h.id===movedId),support=a.report.support.samples.filter(s=>s.id===movedId);assert.equal(support.length,4);assert.ok(support.every(s=>Number.isFinite(s.terrainY)&&s.buriedBy===0&&s.foundationGap===0));
 for(const s of support){const expected=sample(74+s.x*Math.cos(yaw)+s.z*Math.sin(yaw),33-s.x*Math.sin(yaw)+s.z*Math.cos(yaw)).height-12;near(s.terrainY,expected);assert.ok(moved.position[1]>=expected+.07999);}
 // Full real mesh envelope separation is stronger than centreline rays for the
 // pair: all ornaments / roofs / structural foundations remain inside each plot.
 a.group.updateMatrixWorld(true);for(const fp of fps){const box=new THREE.Box3().setFromObject(a.group.getObjectByName(fp.id));assert.ok(box.min.x>=min(fp,0)-1e-5&&box.max.x<=max(fp,0)+1e-5&&box.min.z>=min(fp,1)-1e-5&&box.max.z<=max(fp,1)+1e-5);}
 const polygonSeparated=(A,B)=>[A,B].some(poly=>poly.some((p,i)=>{const q=poly[(i+1)%poly.length],nx=-(q[1]-p[1]),nz=q[0]-p[0],aa=A.map(v=>v[0]*nx+v[1]*nz),bb=B.map(v=>v[0]*nx+v[1]*nz);return Math.max(...aa)<=Math.min(...bb)+1e-8||Math.max(...bb)<=Math.min(...aa)+1e-8;}));
 const worldFps=fps.map(fp=>({id:fp.id,polygon:fp.polygon.map(([x,z])=>[74+x*Math.cos(yaw)+z*Math.sin(yaw),33-x*Math.sin(yaw)+z*Math.cos(yaw)])})),publicSurfaces=[...data.newCityStairs.surveyed.selected.treads.map(t=>({id:'tread',polygon:t.polygon})),...data.bridge.walkSurfaces,...data.bridgeConnector.walkSurfaces];
 for(const fp of worldFps)for(const w of publicSurfaces)assert.ok(polygonSeparated(fp.polygon,w.polygon),`${fp.id} overlaps public ${w.id}`);

 const localBoxes=[];for(const fp of fps)a.group.getObjectByName(fp.id).traverse(m=>{if(m.isMesh)localBoxes.push({id:m.name,box:new THREE.Box3().setFromObject(m)});});
 for(const id of a.report.houseLayoutAdjustments.map(h=>h.id)){const probes=a.report.support.samples.filter(s=>s.id===id);assert.equal(probes.length,4);assert.ok(probes.every(s=>Number.isFinite(s.terrainY)&&s.buriedBy===0&&s.foundationGap===0));}
 const houses=[];for(const child of [...a.group.children])if(!/^new-city-stair-house-/.test(child.name))a.group.remove(child);a.group.position.set(74,12,33);a.group.rotation.y=yaw;f.castle.add(a.group);f.scene.updateMatrixWorld(true);a.group.traverse(m=>{if(m.isMesh)houses.push(m);});let rays=0;
 // The recorded r32 route contains the actual support-height-adjusted .5 m
 // points. Add bridge and connector paths; no mesh is ignored or reclassified.
 const full=JSON.parse(fs.readFileSync(new URL('../../artifacts/pipeline/citadel-four-hour-20261005/r32-plaza-original-landmarks-target-front-plants-terrain.json',import.meta.url),'utf8')),paths=[full.landmarkIntegration?.route?.map(r=>r.position)||full.landmarkSurvey.route.map(r=>r.position),data.bridge.nodes,[data.bridgeConnector.dock,data.bridgeConnector.endpoint]],up=new THREE.Vector3(0,1,0).transformDirection(f.castle.matrixWorld);
 for(const path of paths)for(let i=1;i<path.length;i++)for(const height of[.05,.55,1.2,1.8])for(const side of[-.4,0,.4]){const A=new THREE.Vector3(...path[i-1]),B=new THREE.Vector3(...path[i]),d=B.clone().sub(A),l=Math.hypot(d.x,d.z)||1,o=new THREE.Vector3(-d.z/l*side,0,d.x/l*side);A.add(o).applyMatrix4(f.castle.matrixWorld).addScaledVector(up,height);B.add(o).applyMatrix4(f.castle.matrixWorld).addScaledVector(up,height);const v=B.clone().sub(A);if(v.lengthSq()<1e-12)continue;rays++;assert.equal(new THREE.Raycaster(A,v.clone().normalize(),0,v.length()).intersectObjects(houses,false).length,0);}

 const {createTargetCityBayBridge}=await import('../../src/world/citadel/targetCityBayBridge.js'),{createTargetBridgeStairConnector}=await import('../../src/world/citadel/targetBridgeStairConnector.js');
 const stairs=createTargetNewCityStairRoute({sampleSurface:sample,start:data.newCityStairs.surveyed.authoredStart,terminalAccess:{from:[72,68],width:2.4}}),connector=createTargetBridgeStairConnector({stairReport:stairs.report,groundHeightAt:(x,z)=>sample(x,z)?.height??null}),sea=createTargetStairSurfaceSampler(f.castle,[f.ocean]),bridge=createTargetCityBayBridge({path:data.bridge.path,maxSpan:36,pierWidth:1.8,groundHeightAt:(x,z)=>sample(x,z)?.height??null,oceanHeightAt:(x,z)=>sea(x,z)?.height??null,sideOpeningFootprints:connector.sideOpeningFootprints}),main=createTargetNewCityMain();stairs.setSideOpeningFootprints(connector.sideOpeningFootprints);f.castle.add(stairs.group,connector.group,bridge.group,main.group);main.group.position.set(74,12,33);main.group.rotation.y=yaw;f.scene.updateMatrixWorld(true);
 const localFromWorld=a.group.matrixWorld.clone().invert(),publicMeshes=[];for(const asset of[stairs,connector,bridge,main])asset.group.traverse(m=>{if(m.isMesh)publicMeshes.push(m);});const triangle=new THREE.Triangle(),geometryCollisions=[];let checkedTriangles=0;
 for(const mesh of publicMeshes){mesh.geometry.computeBoundingBox();const positions=mesh.geometry.attributes.position,index=mesh.geometry.index,matrices=[];if(mesh.isInstancedMesh){for(let k=0;k<mesh.count;k++){const m=new THREE.Matrix4();mesh.getMatrixAt(k,m);matrices.push(new THREE.Matrix4().multiplyMatrices(localFromWorld,mesh.matrixWorld).multiply(m));}}else matrices.push(new THREE.Matrix4().multiplyMatrices(localFromWorld,mesh.matrixWorld));
  for(const matrix of matrices){const broad=mesh.geometry.boundingBox.clone().applyMatrix4(matrix),candidates=localBoxes.filter(h=>h.box.intersectsBox(broad));if(!candidates.length)continue;for(let i=0,n=index?.count??positions.count;i<n;i+=3){triangle.a.fromBufferAttribute(positions,index?index.getX(i):i).applyMatrix4(matrix);triangle.b.fromBufferAttribute(positions,index?index.getX(i+1):i+1).applyMatrix4(matrix);triangle.c.fromBufferAttribute(positions,index?index.getX(i+2):i+2).applyMatrix4(matrix);checkedTriangles++;for(const h of candidates)if(h.box.intersectsTriangle(triangle))geometryCollisions.push({house:h.id,mesh:mesh.name,triangle:i/3});}}
 }
 assert.deepEqual(geometryCollisions,[],'actual public triangles must not enter any residential mesh envelope');for(const asset of[stairs,connector,bridge,main])asset.dispose();
 console.log(JSON.stringify({r32HouseSpacing:{minimumAxisSeparation:minGap,changedHouse:moved.id,foundationProbeCount:a.report.support.samples.filter(s=>a.report.houseLayoutAdjustments.some(h=>h.id===s.id)).length,rays,bodyCollisions:0,publicFootprintOverlaps:0,publicMeshes:publicMeshes.length,checkedTriangles,geometryCollisions:geometryCollisions.length}}));a.dispose();f.dispose();
});

test('v4 inherits powder-blue palette and square windows; thin cornices remain inside unchanged residential envelopes',()=>{
 const a=createTargetNewCityStairs({housingProfile:'original'});assert.equal(a.report.revision,'target-new-city-stairs-5-stepped-flanks');assert.equal(a.report.palette.blue,'#80c8eb');assert.equal(a.report.palette.stone,'#f3dfc6');
 for(const h of a.report.houses){const root=a.group.getObjectByName(h.id),cornice=root.getObjectByName(h.id+'-upper-cornice');assert.ok(cornice);for(const window of root.children.filter(o=>o.isGroup&&o.name.startsWith(h.id+'-front-'))){const frame=window.getObjectByName(window.name+'-white-frame');frame.geometry.computeBoundingBox();const size=frame.geometry.boundingBox.getSize(new THREE.Vector3());assert.ok(size.y/size.x<1.1&&size.y<.75);}
  const fp=a.report.footprints.find(f=>f.id===h.id),bounds=new THREE.Box3().setFromObject(root);assert.ok(bounds.min.x>=Math.min(...fp.polygon.map(p=>p[0]))-1e-5&&bounds.max.x<=Math.max(...fp.polygon.map(p=>p[0]))+1e-5);assert.ok(bounds.min.z>=Math.min(...fp.polygon.map(p=>p[1]))-1e-5&&bounds.max.z<=Math.max(...fp.polygon.map(p=>p[1]))+1e-5);
 }a.dispose();
});

test('v5 lowers flank hierarchy with true setback terraces while preserving route and house support footprints',()=>{
 const old=createTargetNewCityStairs({housingProfile:'original'}),next=createTargetNewCityStairs();assert.deepEqual(next.report.walkSurfaces,old.report.walkSurfaces);assert.deepEqual(next.report.endpoints,old.report.endpoints);
 for(let i=0;i<next.report.houses.length;i++){const h=next.report.houses[i],previous=old.report.houses[i];assert.deepEqual(h.position,previous.position);assert.ok(h.size[1]<previous.size[1]);const a=next.report.footprints.find(p=>p.id===h.id),b=old.report.footprints.find(p=>p.id===h.id);assert.deepEqual(a.polygon,b.polygon);assert.equal(a.floorY,b.floorY);assert.ok(a.roofY<b.roofY);const house=next.group.getObjectByName(h.id);assert.equal(!!house.getObjectByName(h.id+'-setback-storey'),h.row<2);assert.equal(house.getObjectByName(h.id+'-cream-turret'),undefined);
 house.updateWorldMatrix(true,true);const box=new THREE.Box3().setFromObject(house);assert.ok(box.min.x>=Math.min(...a.polygon.map(p=>p[0]))-1e-5&&box.max.x<=Math.max(...a.polygon.map(p=>p[0]))+1e-5);assert.ok(box.min.z>=Math.min(...a.polygon.map(p=>p[1]))-1e-5&&box.max.z<=Math.max(...a.polygon.map(p=>p[1]))+1e-5);
 }old.dispose();next.dispose();
});

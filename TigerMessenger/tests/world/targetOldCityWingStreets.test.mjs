import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {createTargetOldCity} from '../../src/world/citadel/targetOldCity.js';

const ROOT=new URL('../../',import.meta.url),OUT=new URL('artifacts/pipeline/citadel-old-wing-streets-20261006/',ROOT);
const snapshot=a=>{const rows=[];a.group.updateWorldMatrix(true,true);a.group.traverse(o=>{if(o.isMesh)rows.push({object:o,geometry:o.geometry,material:o.material,position:[...o.geometry.attributes.position.array],matrix:o.matrix.toArray()});});return rows;};
function unchanged(rows){for(const r of rows){assert.equal(r.object.geometry,r.geometry);assert.equal(r.object.material,r.material);assert.deepEqual([...r.geometry.attributes.position.array],r.position);assert.deepEqual(r.object.matrix.toArray(),r.matrix);}}
function publicRays(root){let count=0;const failures=[];root.updateWorldMatrix(true,true);const transform=root.parent.matrixWorld;
 const cast=(a,b)=>{const p=new T.Vector3(...a).applyMatrix4(transform),q=new T.Vector3(...b).applyMatrix4(transform),d=q.clone().sub(p),length=d.length();const hits=new T.Raycaster(p,d.normalize(),0,length).intersectObject(root,true);count++;if(hits.length)failures.push({a,b,name:hits[0].object.name});};
 for(const z of[-7.6,2.4,12.4])for(const dz of[-.4,0,.4])for(const h of[.55,1.2,1.8])cast([-29,(z<0?8.3:z<5?4.3:.3)+h,z+dz],[29,(z<0?8.3:z<5?4.3:.3)+h,z+dz]);
 for(let i=0;i<40;i++)for(const dx of[-.4,0,.4])for(const h of[.55,1.2,1.8]){const z=9.75-i*.5,y=.3+(i+1)*.2+h;cast([dx,y,z+.24],[dx,y,z-.24]);}
 for(const h of[.55,1.2,1.8])for(const dx of[-.4,0,.4])cast([dx,.3+h,18],[dx,.3+h,13]);return{count,failures,scope:'added wing geometry versus unchanged old central stair, gate and three cross-street body bands'};
}

test('default off and awaiting post-placement preserve every original mesh, plot and public interface',()=>{
 const a=createTargetOldCity(),b=createTargetOldCity({wingStreets:true}),rows=snapshot(a);
 assert.equal(a.completeWingStreets({get sampleSurface(){throw Error('off should not inspect sampling');}}),null);
 assert.equal(b.report.wingStreets.status,'awaiting-actual-surface');assert.equal(a.report.wingStreets.enabled,false);
 for(const key of['footprints','houses','entry','exits','stairs','walkable','bounds','performance'])assert.deepEqual(a.report[key],b.report[key]);unchanged(rows);a.dispose();b.dispose();
});

test('post-placement pairs have true doors, one shared wall, finite geometry, unchanged public routes and reversible ownership',()=>{
 const a=createTargetOldCity({wingStreets:true}),before=structuredClone(a.report),rows=snapshot(a),materialSet=new Set(rows.map(r=>r.material));
 const wing=a.completeWingStreets({sampleSurface:()=>0});assert.equal(wing.report.modules.length,8);assert.equal(new Set(wing.report.modules.map(m=>m.cluster)).size,4);
 assert.equal(wing.report.performance.meshes,14);assert.equal(wing.report.performance.newMaterials,0);assert.ok(wing.report.performance.triangles<3000);assert.equal(a.report.bounds.max[1],33.000000005960464);
 assert.throws(()=>a.completeWingStreets({enabled:true,sampleSurface:()=>0}),/ALREADY/);
 for(const key of['houses','footprints','entry','exits','stairs','walkable','towerWindows'])assert.deepEqual(a.report[key],before[key]);unchanged(rows);
 const count={geometry:0,material:0};wing.group.traverse(o=>{if(!o.isMesh)return;assert.ok(materialSet.has(o.material));o.geometry.addEventListener('dispose',()=>count.geometry++);o.material.addEventListener('dispose',()=>count.material++);assert.ok([...o.geometry.attributes.position.array].every(Number.isFinite));assert.equal(o.userData.targetWalkable,false);});
 a.group.updateMatrixWorld(true);
 for(const door of wing.report.doors){const p=new T.Vector3(...door.position),normal=new T.Vector3(...door.normal),origin=p.clone().addScaledVector(normal,.35);origin.y+=1;const ray=new T.Raycaster(origin,normal.clone().negate(),0,1.5);assert.equal(ray.intersectObject(wing.group,true).length,0,door.moduleId+' door is a real void');origin.z+=1;assert.ok(new T.Raycaster(origin,normal.clone().negate(),0,1).intersectObject(wing.group,true).length,door.moduleId+' jamb exists');}
 const body=publicRays(wing.group);assert.equal(body.failures.length,0);
 wing.dispose();wing.dispose();assert.equal(count.geometry,14);assert.equal(count.material,0);assert.deepEqual(a.report,before);unchanged(rows);a.dispose();
});

test('missing support, excessive cliff drop, protected path and actual obstacle triangles reject pairs before publication',()=>{
 const a=createTargetOldCity();assert.throws(()=>a.completeWingStreets({enabled:true}),/ACTUAL_SURFACE/);
 assert.throws(()=>a.completeWingStreets({enabled:true,sampleSurface:()=>0,protectedFootprints:[{polygon:[[0,0],[2,0],[1,.5],[2,2],[0,2]]}]}),/CONVEX/);
 let w=a.completeWingStreets({enabled:true,sampleSurface:()=>null});assert.equal(w.report.modules.length,0);assert.ok(w.report.rejected.every(r=>r.reason.kind==='missing-actual-support'));w.dispose();
 w=a.completeWingStreets({enabled:true,sampleSurface:(x,z)=>z*2});assert.equal(w.report.modules.length,0);assert.ok(w.report.rejected.every(r=>r.reason.kind==='unsupported-height-spread'));w.dispose();
 const obstacle=new T.Mesh(new T.BoxGeometry(.4,3,1),new T.MeshBasicMaterial());obstacle.name='actual-supplied-public-pier';obstacle.position.set(22.05,2,-3.95);obstacle.visible=false;obstacle.updateMatrixWorld(true);
 w=a.completeWingStreets({enabled:true,sampleSurface:()=>0,collisionGroups:[obstacle],protectedFootprints:[{id:'future-exit',polygon:[[-24,3],[-20,3],[-20,11],[-24,11]]}]});assert.equal(w.report.modules.length,4);assert.ok(w.report.rejected.some(r=>r.reason.kind==='actual-obstacle-triangle'));assert.ok(w.report.rejected.some(r=>r.reason.id==='future-exit'));w.dispose();obstacle.geometry.dispose();obstacle.material.dispose();a.dispose();
});

function loadedAudit(root,curves){
 root.updateWorldMatrix(true,true);const records=[];root.traverse(m=>{if(!m.isMesh)return;const p=m.geometry.attributes.position,ix=m.geometry.index,triangles=[],box=new T.Box3();for(let i=0;i<(ix?.count??p.count);i+=3){const pts=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,ix?ix.getX(i+j):i+j).applyMatrix4(m.matrixWorld)),bounds=new T.Box3().setFromPoints(pts);triangles.push({pts,bounds});box.union(bounds);}records.push({name:m.name,triangles,box});});
 const body=new T.Box3(new T.Vector3(-2.35,-.136,-3.59),new T.Vector3(2.35,5.71,3.59)),result={poses:0,triangleTests:0,contacts:[],intervalMetres:.5,body:{min:body.min.toArray(),max:body.max.toArray()},scope:'both entire actual final global curves versus ONLY added wings; finite loaded OBBs'};
 for(const lane of['red','blue']){const c=curves[lane],n=Math.ceil(c.getLength()/.5);for(let i=0;i<=n;i++){result.poses++;const u=i/n,p=c.getPointAt(u),t=c.getTangentAt(u).normalize(),r=p.clone().normalize().cross(t).normalize(),up=t.clone().cross(r).normalize(),matrix=new T.Matrix4().makeBasis(r,up,t).setPosition(p),inv=matrix.clone().invert(),bounds=body.clone().applyMatrix4(matrix);for(const mesh of records){if(!mesh.box.intersectsBox(bounds))continue;for(const tri of mesh.triangles){if(!tri.bounds.intersectsBox(bounds))continue;result.triangleTests++;if(body.intersectsTriangle(new T.Triangle(...tri.pts.map(p=>p.clone().applyMatrix4(inv))))){result.contacts.push({lane,u,mesh:mesh.name});break;}}}}}return result;
}

function actualWalkPaths(root,paths,castleMatrix){
 const result={queries:0,contacts:[],step:.15,laterals:[-.4,0,.4],bodyHeights:[.55,1.2,1.8],scope:'all actual assembled gallery and two city-connection paths versus added wings; finite body rays only'};
 for(const path of paths){const points=path.points.map(p=>new T.Vector3(...p).applyMatrix4(castleMatrix));for(let j=1;j<points.length;j++){const a=points[j-1],b=points[j],n=Math.max(1,Math.ceil(a.distanceTo(b)/.15));for(let i=0;i<n;i++){const p=a.clone().lerp(b,i/n),q=a.clone().lerp(b,(i+1)/n),up=p.clone().normalize(),d=q.clone().sub(p);d.addScaledVector(up,-d.dot(up));const length=d.length();if(length<1e-8)continue;d.normalize();const side=up.clone().cross(d).normalize();for(const height of result.bodyHeights)for(const lateral of result.laterals){const origin=p.clone().addScaledVector(up,height).addScaledVector(side,lateral),hits=new T.Raycaster(origin,d,0,length+.4).intersectObject(root,true);result.queries++;if(hits.length)result.contacts.push({path:path.id,j,i,height,lateral,mesh:hits[0].object.name});}}}}
 return result;
}

test('actual strict-final terrain and assembled crossing city support six rooms, reject west cliff pair and preserve finite public/cargo clearance',async()=>{
 const {eastCliffFinalSurfaceFixture}=await import('../../tools/pipeline/east_cliff_final_surface_fixture.mjs'),{installEastCliffStartupTerrain}=await import('../../src/world/citadel/targetEastCliffStartupTerrain.js'),{createTargetEastGlobalCrossingRelease}=await import('../../src/world/citadel/targetEastGlobalCrossingRelease.js'),{createTargetUserMarkedProductionRelease}=await import('../../src/world/citadel/targetUserMarkedProductionRelease.js'),{createTargetCityDetailCandidate}=await import('../../src/world/citadel/targetCityDetailCandidate.js');
 const read=p=>JSON.parse(fs.readFileSync(new URL(p,ROOT))),base='artifacts/pipeline/citadel-east-shore-route-20261006/',artifact=read(base+'remesh-final-surface-geometry.json'),f=eastCliffFinalSurfaceFixture(),strict=installEastCliffStartupTerrain({enabled:true,castle:f.castle,artifact});
 const bundle=createTargetEastGlobalCrossingRelease({enabled:true,sourceCurves:f.sourceCurves,retainedRelease:createTargetUserMarkedProductionRelease({sourceCurves:f.sourceCurves}),candidateInput:read(base+'remesh-expanded-shift-audit.json').candidateInput,terrainArtifact:artifact});
 let city,a,original;
 try{
  city=createTargetCityDetailCandidate({castle:f.castle,sceneRoot:f.scene,terrainMeshes:[f.terrain],oceanMesh:f.ocean,fitSunShadow:false,includeFrontRail:false,cliffTransitRelease:bundle.release,cliffTransitStructureOptions:bundle.structureOptions});f.castle.add(city.root);
  original=city.root.getObjectByName('citadel-target-old-city');a=createTargetOldCity({seed:city.report.oldCity.geometry.seed,palette:city.report.oldCity.geometry.palette});a.group.position.copy(original.position);a.group.quaternion.copy(original.quaternion);original.removeFromParent();city.root.add(a.group);f.scene.updateMatrixWorld(true);
  const local=a.group.matrix.clone(),inverse=local.clone().invert(),sampler=city.getSurfaceSamplers().terrain;
  const sample=(x,z)=>{const q=new T.Vector3(x,0,z).applyMatrix4(local),hit=sampler(q.x,q.z);return hit?new T.Vector3(q.x,hit.height,q.z).applyMatrix4(inverse).y:null;};
  const rows=snapshot(a),oldInterfaces=JSON.stringify([a.report.footprints,a.report.exits,a.report.entry,a.report.stairs]);
  const w=a.completeWingStreets({enabled:true,sampleSurface:sample,collisionGroups:city.root.children.filter(g=>g!==a.group)});
  assert.equal(w.report.modules.length,6,JSON.stringify(w.report.rejected));assert.equal(w.report.rejected.length,1);assert.equal(w.report.rejected[0].reason.kind,'unsupported-height-spread');assert.ok(w.report.rejected[0].reason.spread>2.4);
  assert.ok(w.report.modules.every(m=>m.foundationMaximumHeight<.4));unchanged(rows);assert.equal(JSON.stringify([a.report.footprints,a.report.exits,a.report.entry,a.report.stairs]),oldInterfaces);
  let supports=0;for(const m of w.report.modules)for(const p of m.supportSamples){assert.ok(Math.abs(sample(p.x,p.z)-p.height)<1e-8);assert.ok(m.position[1]>p.height);supports++;}assert.equal(supports,432);
  const body=publicRays(w.group),loaded=loadedAudit(w.group,bundle.startupPreview.curves),walkPaths=actualWalkPaths(w.group,city.report.cliffTransit.walkPaths,f.castle.matrixWorld);assert.equal(body.failures.length,0);assert.equal(loaded.contacts.length,0);assert.equal(walkPaths.contacts.length,0,JSON.stringify(walkPaths.contacts.slice(0,10)));
  const report={version:'old-wing-streets-1',sourceEpoch:strict.report.sourceEpoch.position,sourceFrame:artifact.origin,actualFinalTerrain:true,actualAssembledCity:true,defaultEnabled:false,visualAccepted:false,gpuVerified:false,modules:w.report,publicBody:body,walkPaths,loaded,cityBounds:a.report.bounds,protectedInterfacesUnchanged:true,limitations:['No production installation, full continuous player/actor audit or GPU visual evidence.','Added houses remain outside the 15 editable WFC plots; they are protected candidate architecture.','West-front pair is rejected; no artificial higher plinth conceals its 2.44m cliff drop.']};
  fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(new URL('actual-final-cpu.json',OUT),JSON.stringify(report,null,2));
 }finally{a?.dispose();if(original&&city)city.root.add(original);city?.dispose();strict.rollback();f.dispose();}
});

import * as T from 'three';import fs from 'node:fs';
import {actualCliffTransitFixture} from '../../tests/world/targetCliffTransitStructure.fixture.mjs';
import {createTargetUserMarkedProductionRelease} from '../../src/world/citadel/targetUserMarkedProductionRelease.js';
import {createTargetEastCliffProductionRelease} from '../../src/world/citadel/targetEastCliffProductionRelease.js';
import {createFreightVehicle} from '../../src/assets/freightTrain.js';
import {productionTransportRobots} from '../../tests/world/robotTransportEnvelope.fixture.mjs';
import {createWarshipClearance} from '../../src/world/warshipClearance.js';
const ROOT=new URL('../../',import.meta.url),read=p=>JSON.parse(fs.readFileSync(new URL(p,ROOT))),base='artifacts/pipeline/citadel-east-shore-route-20261006/',out='artifacts/pipeline/citadel-global-approach-support-20261006/';
const artifact=read(base+'remesh-final-surface-geometry.json'),audit=read(base+'remesh-expanded-shift-audit.json'),f=actualCliffTransitFixture(),retainedRelease=createTargetUserMarkedProductionRelease({sourceCurves:f.sourceCurves}),prepared=createTargetEastCliffProductionRelease({enabled:true,sourceCurves:f.sourceCurves,retainedRelease,candidateInput:audit.candidateInput,terrainArtifact:artifact,cityGalleryScope:true}),prior=read(out+'support-audit.json');
const historical=read(out+'support-candidate-geometry.json'),support=new T.ObjectLoader().parse(historical);support.name='rejected-approach-support-history';support.updateMatrixWorld(true);
function groupRecord(group){const meshes=[];group.updateMatrixWorld(true);group.traverse(mesh=>{if(!mesh.isMesh)return;mesh.geometry.computeBoundingBox();meshes.push({mesh,box:mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld)});});return{box:new T.Box3().setFromObject(group),meshes};}
const rails=new T.Group(),railMat=new T.MeshBasicMaterial();
for(const lane of['red','blue']){const curve=prepared.startupPreview.curves[lane],approach=prepared.release.segments[lane].globalApproach,points=Array.from({length:513},(_,i)=>approach.getPointAt(i/512));
 for(const side of[-1,1]){const control=Array.from({length:720},(_,i)=>{const p=curve.getPointAt(i/720),right=p.clone().normalize().cross(curve.getTangentAt(i/720)).normalize();return p.clone().addScaledVector(right,side*.875).normalize().multiplyScalar(p.length()+.06);});const full=new T.TubeGeometry(new T.CatmullRomCurve3(control,true,'centripetal',.5),520,.035,5,true),p=full.attributes.position,idx=full.index,kept=[];
  for(let i=0;i<idx.count;i+=3){const vs=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,idx.getX(i+j))),mid=vs[0].clone().add(vs[1]).add(vs[2]).multiplyScalar(1/3);if(Math.min(...points.map(v=>v.distanceToSquared(mid)))>1.3**2)continue;kept.push(...vs.flatMap(v=>v.toArray()));}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(kept,3));const m=new T.Mesh(g,railMat);m.name='actual-new-approach-'+lane+'-rail-'+side;rails.add(m);full.dispose();
 }}
const records=[groupRecord(support)],railRecords=[groupRecord(rails)],results=[];
try{
 const vehicles=await productionTransportRobots();
 for(const{robot,box}of vehicles){const car=createFreightVehicle({wagon:0});robot.position.y=.65-box.min.y;car.add(robot);car.updateMatrixWorld(true);const structureAudit=createWarshipClearance(car,records),railAudit=createWarshipClearance(car,railRecords),hits=[];
  for(const pose of prior.report.vehicleClearance.collisions){const curve=prepared.startupPreview.curves[pose.lane],p=curve.getPointAt(pose.u),t=curve.getTangentAt(pose.u).normalize().multiplyScalar(pose.lane==='blue'?-1:1),right=p.clone().normalize().cross(t).normalize(),up=t.clone().cross(right).normalize(),q=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(right,up,t)).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),-Math.PI/2)),position=p.clone().addScaledVector(up,.12),s=structureAudit.clear(position,q),r=railAudit.clear(position,q);
   if(!s.clear||!r.clear)hits.push({lane:pose.lane,u:pose.u,world:p.toArray(),castle:p.clone().applyMatrix4(f.castle.matrixWorld.clone().invert()).toArray(),structure:s,rail:r});
  }
  results.push({cargo:robot.userData.robotType,triangles:structureAudit.triangleCount,poses:prior.report.vehicleClearance.collisions.length,structureContacts:hits.filter(x=>!x.structure.clear).length,railContacts:hits.filter(x=>!x.rail.clear).length,hits});
  const gs=new Set(),ms=new Set();car.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)ms.add(o.material);});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());
 }
 const r={accepted:false,installed:false,method:'Actual production heavy flatcar + each of three real transport cargo models; production pose transform; createWarshipClearance triangle-edge/triangle crossing. No material masks, no wheel exclusions. Tests the 80 full-route OBB rejected poses. Rail geometry uses production Catmull/Tube and selects new approach triangles within1.3m of its exact curve. Finite surface crossing, not continuous sweep or coplanar/solid-containment proof.',results};fs.writeFileSync(new URL(out+'retained-crossing-diagnosis.json',ROOT),JSON.stringify(r,null,2));console.log(JSON.stringify(results.map(({hits,...r})=>({...r,first:hits[0]})),null,2));
}finally{for(const group of[support,rails]){group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}f.dispose();}

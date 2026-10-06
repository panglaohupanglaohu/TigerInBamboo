import * as THREE from 'three';
import {createTargetStairSurfaceSampler} from './targetNewCityStairRoute.js';
const V=(a)=>new THREE.Vector3(...a);
function identity(o,castle){if(!o)return null;o.updateWorldMatrix(true,true);const world=o.getWorldPosition(new THREE.Vector3()),ancestors=[],children=[];for(let p=o;p;p=p.parent)ancestors.push({uuid:p.uuid,name:p.name,visible:p.visible});o.traverse(p=>children.push({uuid:p.uuid,name:p.name,type:p.type,visible:p.visible}));return{uuid:o.uuid,name:o.name,parentUUID:o.parent?.uuid,worldPosition:world.toArray(),castleLocal:castle.worldToLocal(world.clone()).toArray(),matrixWorld:o.matrixWorld.toArray(),position:o.position.toArray(),quaternion:o.quaternion.toArray(),scale:o.scale.toArray(),sourceId:o.userData.sourceId,ancestors,children};}
function actors({castle,range}){return{statue:castle.getObjectByName('citadel-plaza-hero-statue'),horse:range?.trojanHorse,controller:range?.nightInfiltration};}
export function surveyTargetCityLandmarks({castle,sceneRoot,range,terrainMeshes,stairRouteReport}={}){
 if(!castle?.isObject3D)throw new TypeError('castle required');castle.updateWorldMatrix(true,true);const a=actors({castle,range});
 const meshes=terrainMeshes||[castle.getObjectByName('citadel-oskar-grid-mountain-surface')].filter(Boolean);
 const sample=meshes.length?createTargetStairSurfaceSampler(castle,meshes):()=>null;
 const report={version:'target-landmarks-1',terrainMutation:false,statue:identity(a.statue,castle),horse:identity(a.horse,castle),controllerState:a.controller?.getState?.()||null,placementState:a.controller?.getPlacementState?.()||null,surfaceSources:meshes.map(m=>({uuid:m.uuid,name:m.name,geometry:m.geometry.uuid,version:m.geometry.attributes.position.version})),candidates:{},route:stairRouteReport||null};
 const yaw=-55*Math.PI/180;
 for(const[k,cx,cz,offsets]of[['statue',56,78,[[0,0],...Array.from({length:8},(_,i)=>[1.6*Math.cos(i*Math.PI/4),1.6*Math.sin(i*Math.PI/4)])]],['horse',72,78,[[-1.836,-1.944],[1.836,-1.944],[-1.836,1.944],[1.836,1.944],[0,0]]]]){
  const candidates=[];for(const dx of[0,-1,1,-2,2,-3,3])for(const dz of[0,-1,1,-2,2,-3,3]){const x=cx+dx,z=cz+dz,feet=offsets.map(([ox,oz])=>{const px=x+ox*Math.cos(yaw)+oz*Math.sin(yaw),pz=z-ox*Math.sin(yaw)+oz*Math.cos(yaw);return{x:px,z:pz,surface:sample(px,pz)};});const heights=feet.map(f=>f.surface?.height),valid=heights.every(Number.isFinite),min=valid?Math.min(...heights):null,max=valid?Math.max(...heights):null;const y=valid?max+.06:null;
   candidates.push({position:[x,y,z],yaw,feet,minimum:min,maximum:max,spread:valid?max-min:null,supported:valid&&max-min<=.65&&Math.abs(max-3)<=1.5,score:dx*dx+dz*dz+(valid?(max-min)*5:1e6)});}
  candidates.sort((a,b)=>a.score-b.score);report.candidates[k]={selected:candidates.find(c=>c.supported)||null,samples:candidates};
 }
 report.ready=!!(a.statue&&a.horse&&a.controller?.relocateGround&&report.candidates.statue.selected&&report.candidates.horse.selected&&report.placementState?.safeToRelocate);
 report.limitations=['Finite final-triangle foot samples; not a full collision proof.','Building/vegetation/route clearance requires caller validation.','Survey does not move actors or modify visibility.'];return report;
}

const active = new WeakMap();
/** Explicit candidate transaction. Routes are WORLD coordinates verified by caller;
 * this module does not infer a navigable connection from terrain samples. */
export function applyTargetCityLandmarksCandidate(options={}) {
 const {castle,range,routes,clearanceVerified=false}=options;
 if(active.has(castle))return {ok:false,reason:'already-applied'};
 const report=surveyTargetCityLandmarks(options),a=actors(options);
 if(!report.ready)return {ok:false,reason:'survey-not-ready',report};
 if(!clearanceVerified||!routes?.stairRoute?.length)return {ok:false,reason:'verified-clearance-and-world-routes-required',report};
 // The four contact offsets in the survey belong to the original .72-scale actor.
 const ws=a.horse.getWorldScale(new THREE.Vector3());
 if(Math.max(...ws.toArray().map(n=>Math.abs(n-.72)))>1e-5)return {ok:false,reason:'unexpected-horse-scale',report};
 const meshes=options.terrainMeshes||[castle.getObjectByName('citadel-oskar-grid-mountain-surface')].filter(Boolean);
 const sample=createTargetStairSurfaceSampler(castle,meshes);
 const group=new THREE.Group();group.name='target-original-landmark-paving';group.userData.candidateOnly=true;group.userData.preserveCitadelMaterials=true;
 const material=new THREE.MeshStandardMaterial({color:0xd5d3bd,roughness:1});
 material.userData.preserveCitadelMaterial=true;
 const owned=[];report.paving=[];
 const release=()=>{group.removeFromParent();for(const g of owned)g.dispose();material.dispose();};
 for(const kind of ['statue','horse']){
  const selected=report.candidates[kind].selected,[x,,z]=selected.position,radius=kind==='statue'?2.3:3.2;
  const probes=[];for(const ratio of[0,.5,1])for(let i=0;i<(ratio?24:1);i++){
   const px=x+radius*ratio*Math.cos(i*Math.PI/12),pz=z+radius*ratio*Math.sin(i*Math.PI/12);probes.push({x:px,z:pz,height:sample(px,pz)?.height});
  }
  const heights=probes.map(p=>p.height);
  if(!heights.every(Number.isFinite)||Math.max(...heights)-Math.min(...heights)>.8){release();return{ok:false,reason:'paving-support-failed',report};}
  const top=Math.max(...heights)+.06,bottom=Math.min(...heights)-.2;
  selected.position[1]=top;
  const geometry=new THREE.CylinderGeometry(radius,radius,top-bottom,48);owned.push(geometry);
  const mesh=new THREE.Mesh(geometry,material);mesh.name=`target-${kind}-paving`;mesh.position.set(x,(top+bottom)/2,z);mesh.userData.walkable=true;mesh.userData.landmarkSupport=kind;group.add(mesh);
  report.paving.push({kind,radius,top,bottom,probes,geometryUUID:geometry.uuid});
 }
 const old={parent:a.statue.parent,position:a.statue.position.clone(),quaternion:a.statue.quaternion.clone(),scale:a.statue.scale.clone()};
 const statueScale=a.statue.getWorldScale(new THREE.Vector3()),castleScale=castle.getWorldScale(new THREE.Vector3());
 if(Math.max(castleScale.x,castleScale.y,castleScale.z)-Math.min(castleScale.x,castleScale.y,castleScale.z)>1e-6){release();return{ok:false,reason:'nonuniform-castle-scale',report};}
 const h=report.candidates.horse.selected,s=report.candidates.statue.selected;
 const cq=castle.getWorldQuaternion(new THREE.Quaternion()),up=new THREE.Vector3(0,1,0).applyQuaternion(cq),right=new THREE.Vector3(1,0,0).applyQuaternion(cq);
 const hp=castle.localToWorld(V(h.position));
 const relocation=a.controller.relocateGround({...routes,worldPosition:hp,horseGround:hp.clone(),worldQuaternion:cq.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),h.yaw)),siteUp:up,siteRight:right});
 if(!relocation.ok){release();return{ok:false,reason:relocation.reason,report};}
 castle.add(group);castle.add(a.statue);a.statue.position.copy(V(s.position));a.statue.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),s.yaw);a.statue.scale.copy(statueScale.divide(castleScale));a.statue.updateMatrixWorld(true);
 const visibilityExemptions=[];for(const actor of[a.statue,a.horse])actor.traverse(o=>visibilityExemptions.push(o));
 report.applied=true;report.originalIdentityPreserved=true;report.placementRevision=relocation.revision;report.visibilityExemptions=visibilityExemptions.map(o=>o.uuid);
 report.externalObligations=['Caller must exempt these original objects from legacy visibility suppression.','Caller must synchronize external rangeLocal/placement metadata and its rollback after this transaction.','Paving uses finite radial support samples; full route/collision clearance remains caller-verified.'];
 let restored=false;const result={ok:true,report,group,visibilityExemptions,rollback(){
  if(restored)return{ok:false,reason:'already-restored'};
  const r=relocation.rollback();if(!r.ok)return r;
  if(old.parent)old.parent.add(a.statue);else a.statue.removeFromParent();a.statue.position.copy(old.position);a.statue.quaternion.copy(old.quaternion);a.statue.scale.copy(old.scale);a.statue.updateMatrixWorld(true);
  release();restored=true;active.delete(castle);return{ok:true};
 }};result.dispose=result.rollback;active.set(castle,result);return result;
}

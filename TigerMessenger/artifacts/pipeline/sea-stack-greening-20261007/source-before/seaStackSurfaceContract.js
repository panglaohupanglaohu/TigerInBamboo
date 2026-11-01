import * as THREE from 'three';
import {bindCoastalMesh} from './seaStackLighting.js';

const ROLES=new Set(['sea-stack-terrace-turf','sea-stack-terrace-shrubs','sea-stack-coastal-grass']);
function signature(text){let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);return (h>>>0).toString(16);}
function meshStamp(mesh){return {objectUuid:mesh.uuid,geometryUuid:mesh.geometry?.uuid,positionVersion:mesh.geometry?.attributes.position?.version??null,indexVersion:mesh.geometry?.index?.version??null,worldMatrix:mesh.matrixWorld.toArray()};}

// A local post-build contract, not a global transaction or a new water sampler.
export function publishSeaStackSurfaceContract(scene,rocks,ocean){
 scene.updateMatrixWorld(true);
 const water=meshStamp(ocean),waterRevision=`water-${signature(JSON.stringify(water))}`;
 const report={version:1,scope:'approved-gate-left-sector',waterRevision,water,stacks:[],removedVegetation:0,disposedExclusiveGeometries:0,errors:[],atomicGlobalPublish:false};
 const discarded=[];
 for(const rock of rocks){
  const data=rock.userData.seaStack;
  if(!rock.visible||rock.userData.excludedSeaStack||!data)continue;
  const revision=rock.userData.coastalSurface?.revision;
  if(!revision){report.errors.push({detailId:data.detailId,reason:'missing-final-lighting-surface-revision'});continue;}
  const finalVegetation=[];
  for(const role of ROLES){
   const candidates=rock.children.filter(o=>o.name===role),latest=candidates.at(-1);
   for(const child of candidates){
    // Only explicitly matching revisions can be published as supported.
    const stale=child.userData.surfaceRevision&&child.userData.surfaceRevision!==revision;
    if(child!==latest||stale){rock.remove(child);discarded.push(child);report.removedVegetation++;if(child===latest&&stale)report.errors.push({detailId:data.detailId,role,reason:'stale-vegetation-revision'});}
    else if(child?.userData.surfaceRevision===revision){bindCoastalMesh(child,rock);finalVegetation.push(child);}
    else if(child)report.errors.push({detailId:data.detailId,role,reason:'missing-vegetation-revision'});
   }
  }
  const anchor=new THREE.Vector3(...data.seaAnchor),surface=meshStamp(rock);
  const contract={detailId:data.detailId,surfaceRevision:revision,waterRevision,surface,waterObjectUuid:ocean.uuid,waterGeometryUuid:ocean.geometry.uuid,anchorWorld:anchor.toArray(),anchorRockLocal:rock.worldToLocal(anchor.clone()).toArray(),anchorOceanLocal:ocean.worldToLocal(anchor.clone()).toArray(),fieldCoordinates:'rock-local XZ; height is local Y; final rock matrix converts to world',waterCoordinates:'actual ocean mesh local coordinates; seat uses rendered triangle radial raycast',lightingMethod:rock.userData.coastalSurface.method};
  rock.userData.surfaceContract=contract;
  rock.userData.coastalSurface.waterRevision=waterRevision;
  for(const child of finalVegetation)child.userData.surfaceContract={detailId:data.detailId,surfaceRevision:revision,waterRevision};
  const details=rock.parent.children.filter(o=>o.userData.stackOwner===data.detailId&&o.visible);
  const shore=rock.getObjectByName('sea-stack-shore-contact');
  if(shore){
   const c=shore.userData.shoreContact;
   if(c?.surfaceRevision!==revision||c?.waterRevision!==waterRevision)report.errors.push({detailId:data.detailId,reason:'shore-contact-revision-mismatch'});
   else shore.traverse(o=>{o.userData.surfaceContract={detailId:data.detailId,surfaceRevision:revision,waterRevision};});
  }
  for(const detail of details)detail.userData.surfaceContract={detailId:data.detailId,surfaceRevision:revision,waterRevision,waterObjectUuid:ocean.uuid,geometryPositionVersion:detail.geometry?.attributes.position?.version??null};
  report.stacks.push({...contract,vegetationRoles:finalVegetation.map(o=>o.name),shoreContact:shore?.userData.shoreContact??null,foamObjects:[...details.filter(o=>o.name==='gate-sea-stack-surf').map(o=>o.uuid),...(shore?.children.filter(o=>o.name==='sea-stack-contact-foam').map(o=>o.uuid)||[])]});
 }
 // Never dispose materials: factories may share them with surviving instances.
 // Dispose removed geometry only if no live scene object still references it.
 const liveGeometry=new Set();scene.traverse(o=>{if(o.geometry)liveGeometry.add(o.geometry);});
 const oldGeometry=new Set();for(const old of discarded)old.traverse(o=>{if(o.geometry)oldGeometry.add(o.geometry);});
 for(const geometry of oldGeometry)if(!liveGeometry.has(geometry)){geometry.dispose();report.disposedExclusiveGeometries++;}
 scene.userData.seaStackSurfaceContract=report;
 return report;
}

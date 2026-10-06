import * as T from 'three';
import {createChristchurchTramSourceCurves} from '../tramSystem.js';
import {createEastCliffAlignmentCandidate} from './targetEastCliffAlignmentCandidate.js';
import {createEastCliffRemeshPreview} from './targetEastCliffRemeshPreview.js';
import {createEastCliffVegetationRefresh} from './targetEastCliffVegetationRefresh.js';
import {prepareEastCliffCompanionRefresh} from './targetEastCliffCompanionRefresh.js';
import {buildMountainSurfaceIndex} from './mountainSurfaceIndex.js';

/** On-demand survey of actual live instances. Never attaches terrain or applies
 * vegetation changes. It is a snapshot, not actor-motion or gameplay clearance. */
export function prepareEastCliffLiveVegetation({castle,scene,runtime,tramSystem,artifact,candidateInput}){
 const source=castle.getObjectByName('citadel-oskar-grid-mountain-surface');
 const ocean=scene.getObjectByName('planet-v8-curved-ocean');
 const statue=scene.getObjectByName('citadel-plaza-hero-statue');
 const horse=scene.getObjectByName('citadel-trojan-horse');
 if(!source||!ocean||!statue||!horse||!runtime?.root||!tramSystem?.citadelTransitRelease)throw new Error('actual terrain/ocean/city/landmark/release objects required');
 scene.updateMatrixWorld(true);
 const preview=createEastCliffRemeshPreview({enabled:true,castle,sourceMesh:source,artifact});
 let planting,companions,clouds;
 try{
  preview.mesh.updateMatrix();preview.mesh.matrixWorld.multiplyMatrices(castle.matrixWorld,preview.mesh.matrix);
  // Keep it detached. The surface sampler consumes the explicit final matrix.
  preview.mesh.matrixAutoUpdate=false;preview.mesh.matrixWorldAutoUpdate=false;
  const align=createEastCliffAlignmentCandidate({enabled:true,input:candidateInput,sourceCurves:createChristchurchTramSourceCurves(),retainedRelease:tramSystem.citadelTransitRelease,castleMatrix:castle.matrixWorld});
  if(!align.curves)throw new Error('candidate rail replay rejected');
  const protectedMeshes=new Set();
  for(const root of[runtime.root,statue,horse])root.traverseVisible(o=>{if(o.isMesh&&!o.userData.skipColliders&&!/waterfall|water-sheet|foam/.test(o.name))protectedMeshes.add(o);});
  const water=buildMountainSurfaceIndex([ocean]),matrix=castle.matrixWorld.clone(),inverse=matrix.clone().invert(),down=new T.Vector3(0,-1,0).transformDirection(matrix);
  const sampleSea=(x,z)=>{const hit=water.sample(new T.Ray(new T.Vector3(x,250,z).applyMatrix4(matrix),down),0,700);return hit?hit.point.clone().applyMatrix4(inverse).y:null;};
  planting=createEastCliffVegetationRefresh({enabled:true,castle,surfaces:[preview.mesh],previousSurfaces:[source],protectedMeshes:[...protectedMeshes],railCurves:Object.values(align.curves),sampleSea,maxDistance:24});
  const report={at:new Date().toISOString(),scope:'actual live canopy instances and current city/statue/horse geometry; diagnostic preparation only',applied:false,sourceEpoch:preview.report,vegetation:planting.report,limitations:['All original live instances/hidden zero-scale slots are used.','Only present city/statue/horse triangles are reserves; future moving actor envelopes and rebuilding other consumer caches remain unverified.','Original navigation and traffic consumers are not refreshed; not gameplay acceptance.']};
  const finalIndex=buildMountainSurfaceIndex([preview.mesh]);
  const sampleTerrain=(x,z)=>{const hit=finalIndex.sample(new T.Ray(new T.Vector3(x,250,z).applyMatrix4(matrix),down),0,700);return hit?{height:hit.point.clone().applyMatrix4(inverse).y,mesh:source.name,faceIndex:hit.faceIndex}:null;};
  return {preview,planting,report,
   applyVisual(){
    try{
     // Explicit visual preview: cloud animations and companion instance owners
     // participate, but the original terrain collider/traffic remain unchanged.
     clouds=runtime.prepareCloudRefresh({surfaceIndex:finalIndex,rail:Object.values(align.curves).flatMap(c=>c.getSpacedPoints(Math.ceil(c.getLength())))});clouds.commit();
     if(!planting.apply())throw new Error('actual vegetation epoch or support rejected');
     companions=prepareEastCliffCompanionRefresh({enabled:true,castle,candidateRoot:runtime.root,vegetationReport:planting.report,sampleTerrain,sampleSea,surfaces:[preview.mesh]});
     report.companions=companions.report;report.clouds=clouds.report;
     if(!companions.report.ready||!companions.commit())throw new Error('actual companion refresh rejected: '+companions.report.failures.join('; '));
     report.applied=true;return true;
    }catch(error){companions?.dispose();planting.dispose();clouds?.rollback();throw error;}
   },
   dispose(){companions?.dispose();planting.dispose();clouds?.rollback();preview.dispose();report.applied=false;}
  };
 }catch(error){planting?.dispose();preview.dispose();throw error;}
}
export function surveyEastCliffLiveVegetation(options){
 const prepared=prepareEastCliffLiveVegetation(options);
 try{return JSON.parse(JSON.stringify(prepared.report));}finally{prepared.dispose();}
}

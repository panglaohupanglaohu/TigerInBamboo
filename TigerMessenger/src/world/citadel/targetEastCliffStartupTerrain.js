import * as T from 'three';
import {createEastCliffRemeshPreview} from './targetEastCliffRemeshPreview.js';

/** Called inside mountainStudy AFTER retained-route rock refinement and BEFORE
 * any mountain sampling/planting consumers exist. This is not the live-edit
 * transaction: a loaded city must use its full consumer refresh transaction. */
export function installEastCliffStartupTerrain({enabled=false,castle,artifact}={}){
 const report={enabled,installed:false,accepted:false,phase:'after-refine-before-sampling'};
 if(!enabled)return{report,rollback(){}};
 if(!castle?.isObject3D||!artifact?.sourceHash)throw new Error('strict startup terrain inputs required');
 if(castle.userData.mountainStudy||castle.userData.targetCityRuntime||castle.userData.eastCliffStartupTerrain||castle.getObjectByName('citadel-mountain-canopy-candidate'))throw new Error('terrain consumers already exist; use full refresh transaction');
 const source=castle.getObjectByName('citadel-oskar-grid-mountain-surface');
 const prepared=createEastCliffRemeshPreview({enabled:true,castle,sourceMesh:source,artifact});
 const previous=source.geometry,geometry=prepared.mesh.geometry;
 const transform=source.matrixWorld.clone().invert().multiply(castle.matrixWorld).multiply(new T.Matrix4().makeTranslation(...artifact.origin));
 geometry.applyMatrix4(transform);geometry.computeBoundingBox();geometry.computeBoundingSphere();
 source.geometry=geometry;report.installed=true;report.sourceEpoch=artifact.sourceHash;report.triangles=(geometry.index?.count??geometry.attributes.position.count)/3;report.sourceMeshUUID=source.uuid;
 let rolledBack=false;
 const handle={report,rollback(){
  if(rolledBack)return;
  if(castle.userData.mountainStudy||castle.userData.targetCityRuntime)throw new Error('startup rollback requires scene teardown or consumer transaction');
  if(source.geometry!==geometry)throw new Error('terrain changed after startup installation');
  source.geometry=previous;prepared.dispose();report.installed=false;rolledBack=true;delete castle.userData.eastCliffStartupTerrain;
 }};
 castle.userData.eastCliffStartupTerrain=handle;return handle;
}

import * as T from 'three';
import {createEastCliffRemeshPreview,inspectEastCliffSourceEpoch} from './targetEastCliffRemeshPreview.js';
import {buildMountainSurfaceIndex} from './mountainSurfaceIndex.js';

// Commit structures/samplers first, then cloud clearance, then tree/companion
// placement; navigation must snapshot the final installed objects last.
const requiredConsumers=['foundations','clouds','vegetation','navigation'];
const sameMatrix=(a,b)=>a.elements.every((v,i)=>Math.abs(v-b.elements[i])<1e-9);
/** Default-off startup transaction. Keeps the real terrain Mesh identity.
 * Consumers prepare synchronous commit/rollback handles using the NEW index;
 * every required binding must join the transaction before source replacement.
 * This is an installation primitive, not visual or clearance approval. */
export function prepareEastCliffTerrainTransaction(options={}){
 const enabled=options.enabled===true;
 const report={enabled,applied:false,accepted:false,consumers:[],requiredConsumers:[...requiredConsumers],indexRebuilt:false};
 if(!enabled)return{report,apply:()=>false,dispose(){}};
 const {castle,sourceMesh,surfaces,artifact}=options;
 let ancestor=sourceMesh;while(ancestor&&ancestor!==castle)ancestor=ancestor.parent;
 if(ancestor!==castle||!Array.isArray(surfaces)||!surfaces.includes(sourceMesh)||!artifact?.sourceHash)throw new Error('actual attached source, complete surface list and strict epoch artifact required');
 const preview=createEastCliffRemeshPreview({enabled:true,castle,sourceMesh,artifact});
 const original=sourceMesh.geometry,originalMatrix=sourceMesh.matrixWorld.clone();
 const geometry=preview.mesh.geometry;
 // A preview uses castle-local origin. Preserve the actual source Mesh frame.
 const toSource=sourceMesh.matrixWorld.clone().invert().multiply(castle.matrixWorld).multiply(new T.Matrix4().makeTranslation(...artifact.origin));
 geometry.applyMatrix4(toSource);geometry.computeBoundingBox();geometry.computeBoundingSphere();
 const shadow=new T.Mesh(geometry,sourceMesh.material);shadow.matrixAutoUpdate=false;shadow.matrixWorld.copy(sourceMesh.matrixWorld);
 let index;
 try{index=buildMountainSurfaceIndex(surfaces.map(m=>m===sourceMesh?shadow:m));}catch(error){preview.dispose();throw error;}
 const epochs=surfaces.map(m=>({mesh:m,geometry:m.geometry,version:m.geometry.attributes.position.version,index:m.geometry.index,indexVersion:m.geometry.index?.version,matrix:m.matrixWorld.clone()}));
 const baseline=inspectEastCliffSourceEpoch({castle,sourceMesh});
 let disposed=false,applied=false,prepared=[];
 const matches=e=>e.mesh.geometry===e.geometry&&e.mesh.geometry.attributes.position.version===e.version&&e.mesh.geometry.index===e.index&&e.mesh.geometry.index?.version===e.indexVersion&&sameMatrix(e.mesh.matrixWorld,e.matrix);
 const fresh=()=>epochs.every(matches);
 const candidateVersion=geometry.attributes.position.version;
 const actualHit=hit=>{if(hit?.object===shadow)hit.object=sourceMesh;return hit;};
 const snapshot={stats:index.stats,sample(ray,near,far,accept){if(disposed)throw new Error('east terrain index disposed');if((applied&&(sourceMesh.geometry!==geometry||geometry.attributes.position.version!==candidateVersion||!sameMatrix(sourceMesh.matrixWorld,originalMatrix)))||epochs.some(e=>e.mesh!==sourceMesh&&!matches(e)))throw new Error('terrain changed; rebuild dependent index');return actualHit(index.sample(ray,near,far,accept?hit=>accept(actualHit(hit)):null));}};
 report.indexRebuilt=true;report.indexStats=index.stats;report.sourceEpoch=baseline;report.geometryOrigin=artifact.origin.slice();report.lifecycle='prepared; no source mutation';
 const undo=()=>{const errors=[];for(const p of [...prepared].reverse()){try{p.rollback();}catch(e){errors.push(String(e.message??e));}}sourceMesh.geometry=original;applied=false;report.applied=false;report.lifecycle='rolled-back';if(errors.length)report.rollbackErrors=errors;};
 return{report,geometry,surfaceIndex:snapshot,
  apply({consumers}={}){
   if(disposed)throw new Error('terrain transaction disposed');if(applied)return true;
   castle.updateWorldMatrix(true,true);
   if(!fresh()||!sameMatrix(sourceMesh.matrixWorld,originalMatrix))throw new Error('terrain source changed after preparation');
   if(!consumers||requiredConsumers.some(id=>typeof consumers[id]!=='function'))throw new Error('all navigation/vegetation/foundation/cloud bindings required');
   prepared=[];
   try{
    for(const id of requiredConsumers){const h=consumers[id]({sourceMesh,geometry,surfaceIndex:snapshot});if(h?.then||typeof h?.commit!=='function'||typeof h?.rollback!=='function')throw new Error(id+' must prepare a synchronous commit/rollback binding');prepared.push(h);}
    if(!fresh())throw new Error('consumer preparation mutated terrain');
    sourceMesh.geometry=geometry;
    for(const h of prepared){const result=h.commit();if(result?.then||result===false)throw new Error('consumer commit must succeed synchronously');}
    applied=true;report.applied=true;report.consumers=[...requiredConsumers];report.lifecycle='applied; visual/gameplay acceptance still required';return true;
   }catch(error){undo();throw error;}
  },
  dispose(){if(disposed)return;if(applied)undo();disposed=true;preview.dispose();report.lifecycle='disposed';}
 };
}

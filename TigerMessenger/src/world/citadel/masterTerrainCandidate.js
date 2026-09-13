import {citadelRevision} from "./layoutRelease.js";
import * as THREE from 'three';

// Await the candidate before scene construction, so later physics preparation
// sees the same geometry that is rendered. The default URL uses the released terrain; legacy remains available.
const revision=typeof location==='undefined'?null:citadelRevision('citadelMasterTerrain');
const loaders={
 '9':()=>import('../../../assets/models/optimized/citadel-master-terrain/masterTerrainR09.js'),
 '8':()=>import('../../../assets/models/optimized/citadel-master-terrain/masterTerrainR08.js'),
 '7':()=>import('../../../assets/models/optimized/citadel-master-terrain/masterTerrainR07.js'),
 '6':()=>import('../../../assets/models/optimized/citadel-master-terrain/masterTerrainR06.js'),
 '2':()=>import('../../../assets/models/optimized/citadel-master-terrain/masterTerrainR02.js'),
 '3':()=>import('../../../assets/models/optimized/citadel-master-terrain/masterTerrainR03.js'),
 '4':()=>import('../../../assets/models/optimized/citadel-master-terrain/masterTerrainR04.js'),
 '5':()=>import('../../../assets/models/optimized/citadel-master-terrain/masterTerrainR05.js'),
};
const data=loaders[revision]?(await loaders[revision]()).default:null;
export function loadMasterTerrainCandidate(castle) {
 if(!data)return;
 try{
  castle.updateWorldMatrix(true,true);
  const work=[];
  // Validate every source coordinate before mutating any mesh.
  for(const part of data.parts){
   const mesh=castle.getObjectByName(part.name),a=mesh?.geometry?.attributes.position;
   if(!a||a.count!==part.vertexCount)throw new Error('Master terrain source changed: '+part.name);
   const forward=new THREE.Matrix4().multiplyMatrices(castle.matrixWorld.clone().invert(),mesh.matrixWorld),back=forward.clone().invert();
   const p=new THREE.Vector3();
   for(const row of part.changes){
    p.fromBufferAttribute(a,row[0]).applyMatrix4(forward);
    if(p.distanceTo(new THREE.Vector3(...row.slice(1,4)))>.002)throw new Error('Master terrain coordinates changed: '+part.name);
   }
   work.push({mesh,back,part});
  }
  for(const {mesh,back,part}of work){
   const old=mesh.geometry,g=old.clone(),p=new THREE.Vector3();
   for(const row of part.changes){p.set(...row.slice(4)).applyMatrix4(back);g.attributes.position.setXYZ(row[0],p.x,p.y,p.z);}
   g.attributes.position.needsUpdate=true;g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();mesh.geometry=g;
   mesh.userData.masterTerrainSource=data.source;
   // The rim layer is derived from the terrain, not a separate mountain.
   // Keep its material/offset while replacing stale pre-edit geometry.
   const rim=castle.getObjectByName('backlit-highlight-'+part.name);
   if(rim){const previous=rim.geometry;rim.geometry=g.clone();if(previous!==old)previous.dispose();rim.userData.masterTerrainSource=data.source;}
   // Existing objects keep their identity; no story or battle references move.
  }
  castle.userData.masterTerrainCandidate={status:'ready',source:data.source,changed:work.map(w=>({name:w.part.name,count:w.part.changes.length}))};
 }catch(error){castle.userData.masterTerrainCandidate={status:'error',message:error.message};throw error;}
}

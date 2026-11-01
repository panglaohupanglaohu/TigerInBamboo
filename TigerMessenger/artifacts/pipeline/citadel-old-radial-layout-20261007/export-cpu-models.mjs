import * as T from 'three';
import {writeFileSync} from 'node:fs';
import {createTargetOldCity} from '../../../src/world/citadel/targetOldCity.js';
const models=[];
for(const layout of['axial','radial']){
 const a=createTargetOldCity({layout});a.group.updateMatrixWorld(true);const meshes=[];
 a.group.traverse(m=>{if(!m.isMesh)return;const geometry=m.geometry,p=geometry.attributes.position,index=geometry.index;
  for(let instance=0;instance<(m.isInstancedMesh?m.count:1);instance++){
   const matrix=m.matrixWorld.clone();if(m.isInstancedMesh){const im=new T.Matrix4();m.getMatrixAt(instance,im);matrix.multiply(im);if(Math.abs(matrix.determinant())<1e-12)continue;}
   const vs=Array.from({length:p.count},(_,i)=>new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(matrix).toArray()),triangles=[];
   for(let i=0;i<(index?.count??p.count);i+=3)triangles.push([0,1,2].map(j=>vs[index?index.getX(i+j):i+j]));
   meshes.push({name:m.name,color:'#'+m.material.color.getHexString(),triangles});
  }
 });models.push({layout,report:a.report,meshes});a.dispose();
}
writeFileSync(new URL('./cpu-models.json',import.meta.url),JSON.stringify(models));

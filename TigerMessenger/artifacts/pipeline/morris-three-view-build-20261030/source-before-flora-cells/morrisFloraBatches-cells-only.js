import * as T from 'three';

// Static botanical instances retain their exact transforms and shared meshes.
// Small spatial bounds let a close riding camera cull the far side of the island.
export function partitionMorrisFlora({root,meshes,cellSize=20}){
 const matrix=new T.Matrix4(),position=new T.Vector3();let originalInstances=0,batches=0,partitionedMeshes=0;
 for(const source of meshes){
  if(!source.isInstancedMesh||source.count<256)continue;
  const cells=new Map();
  for(let i=0;i<source.count;i++){
   source.getMatrixAt(i,matrix);position.setFromMatrixPosition(matrix);
   const key=Math.floor(position.x/cellSize)+','+Math.floor(position.z/cellSize);
   if(!cells.has(key))cells.set(key,[]);cells.get(key).push(i);
  }
  originalInstances+=source.count;partitionedMeshes++;
  for(const[key,indices]of cells){
   const part=new T.InstancedMesh(source.geometry,source.material,indices.length);
   part.name=(source.name||'morris-bloom-hearts')+'-cell-'+key;
   part.position.copy(source.position);part.quaternion.copy(source.quaternion);part.scale.copy(source.scale);
   part.castShadow=source.castShadow;part.receiveShadow=source.receiveShadow;
   part.renderOrder=source.renderOrder;part.layers.mask=source.layers.mask;
   part.userData={...source.userData,staticFloraCell:key,originalInstanceIndices:indices};
   for(let j=0;j<indices.length;j++){
    source.getMatrixAt(indices[j],matrix);part.setMatrixAt(j,matrix);
    if(source.instanceColor){const color=new T.Color();source.getColorAt(indices[j],color);part.setColorAt(j,color);}
   }
   part.computeBoundingBox();part.computeBoundingSphere();root.add(part);batches++;
  }
  root.remove(source);source.dispose();
 }
 return{revision:'exact-transform-spatial-flora-r1',cellSize,originalInstances,batches,partitionedMeshes};
}

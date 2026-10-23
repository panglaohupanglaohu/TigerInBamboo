import * as T from 'three';

// Petals share their flower's falling/sucking transform. Keep source nodes and
// geometry for recovery; the pulsing core, stamens and halo remain independent.
export function installSwampFlowerRenderBatch(inner){
 if(inner.userData.flowerRenderBatch)return inner.userData.flowerRenderBatch;
 const records=[];
 for(const flower of inner.userData.giantFlowers||[]){
  const petals=flower.children.filter(n=>n.name==='v2-cupped-petal'&&n.isMesh&&n.visible);
  if(petals.length!==7)continue;
  const first=petals[0].material;
  if(petals.some(n=>n.position.lengthSq()>0||n.rotation.x||n.rotation.y||n.rotation.z||n.scale.x!==1||n.scale.y!==1||n.scale.z!==1||n.material.type!==first.type||n.material.side!==first.side||n.material.color.getHex()!==first.color.getHex()||n.material.customProgramCacheKey()!==first.customProgramCacheKey()))continue;
  const parts=petals.map(n=>n.geometry.index?n.geometry.toNonIndexed():n.geometry.clone());
  const keys=Object.keys(parts[0].attributes);
  if(parts.some(g=>Object.keys(g.attributes).join()!==keys.join())){parts.forEach(g=>g.dispose());continue;}
  const geometry=new T.BufferGeometry();
  for(const key of keys){const base=parts[0].attributes[key],values=new base.array.constructor(parts.reduce((sum,g)=>sum+g.attributes[key].array.length,0));let offset=0;
   for(const g of parts){values.set(g.attributes[key].array,offset);offset+=g.attributes[key].array.length;}
   geometry.setAttribute(key,new T.BufferAttribute(values,base.itemSize,base.normalized));
  }
  geometry.computeBoundingSphere();const mesh=new T.Mesh(geometry,first);mesh.name='swamp-giant-flower-petal-batch';flower.add(mesh);
  petals.forEach(p=>{p.visible=false;});parts.forEach(g=>g.dispose());records.push({flower,petals,mesh});
 }
 const report={version:1,records,drawsSaved:records.length*6,scope:'seven rigid petals per animated flower; core/halo/stamens unchanged'};
 inner.userData.flowerRenderBatch=report;return report;
}

import * as T from 'three';
// Render copies only. Existing troopers, rigid-joint matrices, geometry and
// gameplay objects remain authoritative. Material arrays keep their groups.
export function createBatianTroopRenderBatch(squad){
 const root=new T.Group();root.name='batian-command-troop-batches';root.userData.noDistanceCulling=true;squad.parent.add(root);
 const groups=new Map(),hidden=new Map(),batches=[],inverse=new T.Matrix4(),matrix=new T.Matrix4();
 const signature=m=>m.userData.sourceMaterialUUID||m.uuid;
 squad.updateWorldMatrix(true,true);
 squad.traverse(mesh=>{if(!mesh.isMesh||mesh.children.length||mesh.isSkinnedMesh||mesh.isInstancedMesh||!mesh.geometry?.attributes.position?.count||mesh.userData.transientFx)return;const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];if(mats.some(m=>!m||m.transparent||m.isShaderMaterial))return;const key=[mesh.geometry.uuid,...mats.map(signature),mesh.castShadow,mesh.receiveShadow,mesh.renderOrder,mesh.layers.mask].join('|');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(mesh);});
 for(const list of groups.values()){if(list.length<2)continue;const first=list[0],mesh=new T.InstancedMesh(first.geometry,first.material,list.length);mesh.name='batian-original-troop-plates';mesh.userData.noDistanceCulling=true;mesh.castShadow=first.castShadow;mesh.receiveShadow=first.receiveShadow;mesh.renderOrder=first.renderOrder;mesh.layers.mask=first.layers.mask;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.raycast=()=>{};root.add(mesh);for(const s of list){hidden.set(s,s.visible);s.visible=false;}batches.push({mesh,list});}
 const visible=o=>{for(let p=o;p;p=p.parent)if(!(hidden.has(p)?hidden.get(p):p.visible))return false;return true;};
 let instances=0;
 return {enforceVisibility(){for(const source of hidden.keys())source.visible=false;},update(){squad.updateWorldMatrix(true,true);root.updateWorldMatrix(true,false);inverse.copy(root.matrixWorld).invert();instances=0;for(const b of batches){let n=0;for(const source of b.list){if(!visible(source))continue;matrix.multiplyMatrices(inverse,source.matrixWorld);b.mesh.setMatrixAt(n++,matrix);}b.mesh.count=n;b.mesh.visible=n>0;b.mesh.instanceMatrix.needsUpdate=true;if(n)b.mesh.computeBoundingSphere();instances+=n;}},snapshot:()=>({sourceMeshes:hidden.size,batches:batches.length,instances}),dispose(){for(const [m,v]of hidden)m.visible=v;for(const b of batches)b.mesh.dispose();root.removeFromParent();}};
}

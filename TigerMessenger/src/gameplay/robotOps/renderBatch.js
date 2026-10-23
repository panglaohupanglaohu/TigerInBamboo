import * as T from 'three';

// Render-only copies of shared rigid plates. Original actors, joints and raycasts
// remain the authority; no robot is removed, frozen, or replaced by a silhouette.
export function createRobotRenderBatch(modelRoot,{enabled=new URLSearchParams(globalThis.location?.search||'').get('robotRenderBatch')==='1'}={}){
 const root=new T.Group();root.name='robot-rigid-render-batches';modelRoot.parent.add(root);
 const report={version:1,enabled,sourceMeshes:0,batches:0,instances:0,frames:0};
 root.userData.report=report;
 let actors=[],sources=[],batches=[];
 const inverse=new T.Matrix4(),matrix=new T.Matrix4();
 function clear(){
  for(const s of sources)s.mesh.visible=s.wasVisible;
  for(const b of batches){root.remove(b.mesh);b.mesh.dispose();}
  sources=[];batches=[];
 }
 function rebuild(){
  clear();actors=[...modelRoot.children];const groups=new Map(),buckets=new Map(),kindCounts=new Map();
  // Keep same-type trios independent. A planet-wide instance sphere would submit
  // every distant robot and its shadows whenever any one plate enters view.
  for(const actor of actors){const kind=actor.userData.robotType||'other',n=kindCounts.get(kind)||0;kindCounts.set(kind,n+1);buckets.set(actor,kind+':'+Math.floor(n/3));}
  modelRoot.traverse(mesh=>{
   const m=mesh.material,g=mesh.geometry;
   if(!mesh.isMesh||mesh.children.length||mesh.isSkinnedMesh||mesh.isInstancedMesh||!g?.attributes.position||g.morphAttributes.position?.length||Array.isArray(m)||!m?.visible||m.transparent||m.displacementMap||m.isShaderMaterial||(!m.userData.robotRigidInstanceSafe&&m.onBeforeCompile!==T.Material.prototype.onBeforeCompile)||mesh.onBeforeRender!==T.Object3D.prototype.onBeforeRender)return;
   let actor=mesh;while(actor.parent&&actor.parent!==modelRoot)actor=actor.parent;
   const key=[buckets.get(actor),g.uuid,m.uuid,mesh.castShadow,mesh.receiveShadow,mesh.renderOrder,mesh.layers.mask].join(':');
   if(!groups.has(key))groups.set(key,[]);groups.get(key).push(mesh);
  });
  for(const list of groups.values()){
   if(list.length<2)continue;const first=list[0],m=first.material;
   const batch=new T.InstancedMesh(first.geometry,m,list.length);batch.name='robot-rigid-plate-batch';batch.castShadow=first.castShadow;batch.receiveShadow=first.receiveShadow;batch.renderOrder=first.renderOrder;batch.layers.mask=first.layers.mask;batch.instanceMatrix.setUsage(T.DynamicDrawUsage);batch.raycast=()=>{};batch.userData.noDistanceCulling=true;root.add(batch);
   // Only geometry leaves are suppressed; descendants such as muzzles, decals
   // and separate moving attachments can never disappear with their parent.
   // Three raycasts and Box3 do not use visible, and keep reading the originals.
   const members=list.map(mesh=>{const s={mesh,material:m,wasVisible:mesh.visible};sources.push(s);mesh.visible=false;return s;});batches.push({mesh:batch,members});
  }
  report.sourceMeshes=sources.length;report.batches=batches.length;
 }
 function visible(source){if(!source.wasVisible)return false;for(let p=source.mesh.parent;p;p=p.parent)if(!p.visible)return false;return true;}
 function update(){
  if(!enabled)return;
  if(actors.length!==modelRoot.children.length||actors.some((a,i)=>a!==modelRoot.children[i]))rebuild();
  modelRoot.updateWorldMatrix(true,true);root.updateWorldMatrix(true,false);inverse.copy(root.matrixWorld).invert();let instances=0;
  for(const b of batches){let count=0;
   for(const s of b.members){if(!visible(s)||!s.material.visible)continue;matrix.multiplyMatrices(inverse,s.mesh.matrixWorld);b.mesh.setMatrixAt(count++,matrix);}
   b.mesh.count=count;b.mesh.visible=count>0;b.mesh.instanceMatrix.needsUpdate=true;
   if(count){b.mesh.computeBoundingSphere();b.mesh.boundingSphere.radius+=1e-5;}
   instances+=count;
  }
  report.instances=instances;report.frames++;
 }
 function dispose(){clear();root.removeFromParent();actors=[];}
 return{root,report,update,dispose};
}

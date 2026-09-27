import * as THREE from 'three';
import {mergeStaticGroup} from './geometryMerge.js';

// Only the static V9/V10 ornament kit. Preserve glass sorting, prism-local
// shader coordinates, original tower roots, habitat floors and gameplay anchors.
export function batchCrystalOrnaments(city){
 for(const record of city.crystals){
  const root=record.group.userData.v9Root;if(!root||root.userData.renderBatched)return;
  root.updateWorldMatrix(true,true);
  const selected=new Set();
  root.traverseVisible(o=>{
   if(o.isMesh&&!Array.isArray(o.material)&&!o.material.transparent&&
      /^v(9|10|11)-/.test(o.name)&&!o.userData.isOutline)selected.add(o);
  });
  // Keep line children before source meshes are detached by the merger.
  for(const o of selected)for(const child of [...o.children])root.attach(child);
  const merged=mergeStaticGroup(root,{skip:o=>!selected.has(o),skipOutline:()=>true});
  for(const o of merged.surfaces)o.name='crystal-static-ornament-batch';
  // Static ink segments share one material, but are spatially batched per tower.
  const lines=new Map();root.traverseVisible(o=>{if(!o.isLineSegments)return;let a=lines.get(o.material);if(!a)lines.set(o.material,a=[]);a.push(o)});
  const inverse=root.matrixWorld.clone().invert();
  for(const [material,objects] of lines){if(objects.length<2)continue;const positions=[];
   for(const o of objects){const g=o.geometry,p=g.attributes.position,m=inverse.clone().multiply(o.matrixWorld),v=new THREE.Vector3();
    for(let i=0;i<(g.index?.count??p.count);i++){v.fromBufferAttribute(p,g.index?g.index.getX(i):i).applyMatrix4(m);positions.push(v.x,v.y,v.z)}
   }
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeBoundingSphere();
   const line=new THREE.LineSegments(g,material);line.name='crystal-static-ink-batch';root.add(line);objects.forEach(o=>o.removeFromParent());
  }
  root.userData.renderBatched={sourceMeshes:selected.size,drawMeshes:merged.surfaces.length};
 }
}

export function batchGateOrnaments(root){
 if(root.userData.ornamentsBatched)return;
 const selected=new Set();
 root.traverseVisible(o=>{
  if(o.isMesh&&!o.userData.citadelSolidExterior&&!o.userData.gateWalkable&&
     !Array.isArray(o.material)&&!o.material.transparent&&
     o.material.onBeforeCompile===THREE.Material.prototype.onBeforeCompile)selected.add(o);
 });
 for(const o of selected)for(const child of [...o.children])root.attach(child);
 const merged=mergeStaticGroup(root,{skip:o=>!selected.has(o),skipOutline:()=>true});
 for(const o of merged.surfaces)o.name='gate-static-ornament-batch';
 root.updateWorldMatrix(true,true);const inverse=root.matrixWorld.clone().invert(),lines=new Map();
 root.traverseVisible(o=>{if(!o.isLine||o.isLineLoop)return;let a=lines.get(o.material);if(!a)lines.set(o.material,a=[]);a.push(o)});
 for(const [material,objects]of lines){if(objects.length<2)continue;const positions=[];
  for(const o of objects){const p=o.geometry.attributes.position,idx=o.geometry.index,count=idx?.count??p.count,m=inverse.clone().multiply(o.matrixWorld),v=new THREE.Vector3();
   const step=o.isLineSegments?2:1;
   for(let i=0;i<count-1;i+=step)for(const j of [i,i+1]){v.fromBufferAttribute(p,idx?idx.getX(j):j).applyMatrix4(m);positions.push(v.x,v.y,v.z)}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeBoundingSphere();const line=new THREE.LineSegments(g,material);line.name='gate-static-ink-batch';root.add(line);objects.forEach(o=>o.removeFromParent());
 }
 root.userData.ornamentsBatched={sourceMeshes:selected.size,drawMeshes:merged.surfaces.length};
}

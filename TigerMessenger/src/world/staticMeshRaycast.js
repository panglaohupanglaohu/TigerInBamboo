import * as THREE from 'three';
// Snapshot of one static, non-instanced mesh in world space. Recreate after edits.
export function createStaticMeshRaycast(mesh){
 mesh.updateWorldMatrix(true,false);
 const p=mesh.geometry.attributes.position,index=mesh.geometry.index,items=[];
 const side=mesh.material.side;
 for(let i=0;i<(index?.count??p.count);i+=3){
  const a=new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(mesh.matrixWorld);
  const b=new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i+1):i+1).applyMatrix4(mesh.matrixWorld);
  const c=new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i+2):i+2).applyMatrix4(mesh.matrixWorld);
  const box=new THREE.Box3().setFromPoints([a,b,c]);items.push({a,b,c,box,center:box.getCenter(new THREE.Vector3())});
 }
 function build(rows){const box=new THREE.Box3();for(const row of rows)box.union(row.box);if(rows.length<=12)return{box,rows};const s=box.getSize(new THREE.Vector3()),axis=s.x>s.y&&s.x>s.z?'x':s.y>s.z?'y':'z';rows.sort((a,b)=>a.center[axis]-b.center[axis]);const half=rows.length>>1;return{box,left:build(rows.slice(0,half)),right:build(rows.slice(half))};}
 const root=build(items),boxHit=new THREE.Vector3(),triHit=new THREE.Vector3();
 return {firstHit(ray,far=Infinity){let best=far,point=null;
  function visit(node){if(!ray.intersectBox(node.box,boxHit))return;if(!node.box.containsPoint(ray.origin)&&ray.origin.distanceTo(boxHit)>best)return;
   if(node.rows){for(const t of node.rows){const hit=side===THREE.BackSide?ray.intersectTriangle(t.c,t.b,t.a,true,triHit):ray.intersectTriangle(t.a,t.b,t.c,side!==THREE.DoubleSide,triHit);if(!hit)continue;const d=hit.distanceTo(ray.origin);if(d<=best){best=d;point=hit.clone();}}return;}
   visit(node.left);visit(node.right);
  }visit(root);return point?{point,distance:best}:null;
 }};
}

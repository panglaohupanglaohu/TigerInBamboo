import * as THREE from 'three';

/** Snapshot final world-space mountain triangles without modifying source meshes.
 * Rebuild after any source geometry/transform/material-side change. Static, plain
 * BufferGeometry and InstancedMesh only; morph/skinned surfaces are unsupported.
 * World BVH is broadphase only (1e-9 m conservative box expansion). Exact
 * intersections use the inverse-transformed ray and original local triangles,
 * matching THREE arithmetic even on grid-aligned boundaries.
 * sample(ray, near, far) follows Raycaster side/drawRange semantics and returns
 * local face.normal, so callers may use the source object's normal matrix.
 */
export function buildMountainSurfaceIndex(surfaces) {
 const triangles=[];let order=0;
 for(const object of surfaces){
  if(object.isSkinnedMesh||object.geometry?.morphAttributes?.position?.length)throw new Error('Mountain surface index requires static unmorphed geometry');
  const geometry=object.geometry,position=geometry?.attributes.position;if(!position)continue;
  const index=geometry.index,total=index?.count??position.count,start=geometry.drawRange.start,end=Math.min(total,start+geometry.drawRange.count);
  const groups=Array.isArray(object.material)?geometry.groups:[{start:0,count:total,materialIndex:0}];
  // Deliberately do not update source matrices: caller supplies final matrices.
  for(let instanceId=0;instanceId<(object.isInstancedMesh?object.count:1);instanceId++){
   const matrix=object.matrixWorld.clone();if(object.isInstancedMesh){const im=new THREE.Matrix4();object.getMatrixAt(instanceId,im);matrix.multiply(im);}
   const inverse=matrix.clone().invert();
   for(const group of groups){const material=Array.isArray(object.material)?object.material[group.materialIndex]:object.material;if(!material)continue;
    for(let i=Math.max(start,group.start);i<Math.min(end,group.start+group.count);i+=3){
     const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j),local=ids.map(j=>new THREE.Vector3().fromBufferAttribute(position,j)),normal=new THREE.Triangle(...local).getNormal(new THREE.Vector3());
     const world=local.map(v=>v.clone().applyMatrix4(matrix));
     const box=new THREE.Box3().setFromPoints(world).expandByScalar(1e-9);triangles.push({local,inverse,matrix,a:world[0],b:world[1],c:world[2],box,center:box.getCenter(new THREE.Vector3()),object,instanceId:object.isInstancedMesh?instanceId:undefined,faceIndex:Math.floor(i/3),face:{a:ids[0],b:ids[1],c:ids[2],normal,materialIndex:group.materialIndex},side:material.side,order:order++});
    }
   }
  }
 }
 let nodes=0,leaves=0;
 function build(items){nodes++;const box=new THREE.Box3(),centroids=new THREE.Box3();for(const tri of items){box.union(tri.box);centroids.expandByPoint(tri.center);}if(items.length<=12){leaves++;return {box,items};}const s=centroids.getSize(new THREE.Vector3()),axis=s.x>=s.y&&s.x>=s.z?'x':s.y>=s.z?'y':'z';items.sort((a,b)=>a.center[axis]-b.center[axis]||a.order-b.order);const mid=items.length>>1;return {box,left:build(items.slice(0,mid)),right:build(items.slice(mid))};}
 const root=build(triangles),scratch=new THREE.Vector3(),point=new THREE.Vector3();
 function sample(ray,near=0,far=Infinity,accept=null){let best=null,distance=far;const stack=[root],localRays=new Map();while(stack.length){const node=stack.pop(),entry=ray.intersectBox(node.box,scratch);if(!entry||(!node.box.containsPoint(ray.origin)&&entry.distanceTo(ray.origin)>distance))continue;if(!node.items){stack.push(node.right,node.left);continue;}for(const tri of node.items){let localRay=localRays.get(tri.inverse);if(!localRay){localRay=ray.clone().applyMatrix4(tri.inverse);localRays.set(tri.inverse,localRay);}const [a,b,c]=tri.local;const hit=tri.side===THREE.BackSide?localRay.intersectTriangle(c,b,a,true,point):localRay.intersectTriangle(a,b,c,tri.side!==THREE.DoubleSide,point);if(!hit)continue;hit.applyMatrix4(tri.matrix);const d=hit.distanceTo(ray.origin);if(d<near||d>distance||best&&d===distance&&tri.order>=best.order)continue;const candidate={object:tri.object,point:hit.clone(),distance:d,faceIndex:tri.faceIndex,instanceId:tri.instanceId,face:{...tri.face,normal:tri.face.normal.clone()},order:tri.order};if(accept&&!accept(candidate))continue;distance=d;best=candidate;}}if(best)delete best.order;return best;}
 return {sample,stats:Object.freeze({triangles:triangles.length,nodes,leaves,maxLeaf:12,coordinateSpace:'world broadphase / source-local exact intersection',boxPadding:1e-9,sourceMutation:false})};
}

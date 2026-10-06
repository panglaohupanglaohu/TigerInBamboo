// Read-only diagnostic world-triangle BVH. Never installs Mesh.raycast overrides.
export async function buildCitadelSurfaceRayIndex(THREE, meshes, yieldWork=async()=>{}) {
 const triangles=[];let sequence=0;
 for(const mesh of meshes){mesh.updateWorldMatrix(true,false);const g=mesh.geometry,p=g?.attributes?.position;if(!p)continue;
  const index=g.index,total=index?.count??p.count,start=g.drawRange?.start??0,end=Math.min(total,start+(g.drawRange?.count??Infinity));
  const groups=Array.isArray(mesh.material)?g.groups:[{start:0,count:total,materialIndex:0}];
  for(let instance=0;instance<(mesh.isInstancedMesh?mesh.count:1);instance++){
   const matrix=mesh.matrixWorld.clone();if(mesh.isInstancedMesh){const im=new THREE.Matrix4();mesh.getMatrixAt(instance,im);matrix.multiply(im);}
   for(const group of groups){const material=Array.isArray(mesh.material)?mesh.material[group.materialIndex]:mesh.material;if(!material)continue;
    for(let j=Math.max(start,group.start);j<Math.min(end,group.start+group.count);j+=3){
     const vertices=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,index?index.getX(j+k):j+k).applyMatrix4(matrix));
     if(matrix.determinant()<0)[vertices[0],vertices[2]]=[vertices[2],vertices[0]];
     const box=new THREE.Box3().setFromPoints(vertices),center=box.getCenter(new THREE.Vector3());
     triangles.push({a:vertices[0],b:vertices[1],c:vertices[2],box,center,mesh,instanceId:mesh.isInstancedMesh?instance:undefined,faceIndex:Math.floor(j/3),side:material.side,order:sequence++});
     if(sequence%4000===0)await yieldWork();
    }
   }
  }
 }
 let nodes=0,leaves=0;
 async function build(items){nodes++;const box=new THREE.Box3();for(const item of items)box.union(item.box);if(items.length<=12){leaves++;return {box,items};}
  const cb=new THREE.Box3();for(const item of items)cb.expandByPoint(item.center);const size=cb.getSize(new THREE.Vector3()),axis=size.x>=size.y&&size.x>=size.z?'x':size.y>=size.z?'y':'z';items.sort((a,b)=>a.center[axis]-b.center[axis]||a.order-b.order);const mid=Math.floor(items.length/2);if(nodes%200===0)await yieldWork();return {box,left:await build(items.slice(0,mid)),right:await build(items.slice(mid))};
 }
 const root=await build(triangles),scratch=new THREE.Vector3(),hitPoint=new THREE.Vector3();
 function intersect(ray,near=0,far=Infinity){let best=null,bestDistance=far;const stack=[root];while(stack.length){const node=stack.pop();const boxHit=ray.intersectBox(node.box,scratch);if(!boxHit||(!node.box.containsPoint(ray.origin)&&boxHit.distanceTo(ray.origin)>bestDistance))continue;
   if(node.items){for(const tri of node.items){const point=tri.side===THREE.BackSide?ray.intersectTriangle(tri.c,tri.b,tri.a,true,hitPoint):ray.intersectTriangle(tri.a,tri.b,tri.c,tri.side!==THREE.DoubleSide,hitPoint);if(!point)continue;const distance=point.distanceTo(ray.origin);if(distance<near||distance>bestDistance)continue;if(best&&distance===bestDistance&&tri.order>=best.order)continue;bestDistance=distance;best={distance,point:point.clone(),object:tri.mesh,faceIndex:tri.faceIndex,instanceId:tri.instanceId,order:tri.order};}}
   else {stack.push(node.right,node.left);}
  }return best;}
 return {intersect,stats:{triangles:triangles.length,nodes,leaves,maxLeaf:12,method:'world triangle BVH, longest centroid extent median split; exact THREE.Ray.intersectTriangle; material Front/Back/DoubleSide retained'}};
}

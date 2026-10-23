import * as T from 'three';

// Real static shoreline triangles clipped to the actor's vertical band. This
// replaces the water-disc radius, which is wider than the bowl at water level.
export function createSwampActivitySolids(inner,low=24.1,high=29){
 inner.updateWorldMatrix(true,true);
 const meshes=[...(inner.userData.gregSpatialPlan?.walkMeshes||[]),...(inner.userData.tigerWalkSurfaces||[]),inner.getObjectByName('swamp-sinkhole-wall'),inner.getObjectByName('greg-natural-cliff-rock')].filter(Boolean),polygons=[];
 inner.getObjectByName('swamp-ancient-world-tree')?.traverse(o=>{if(o.isMesh&&!o.userData.isOutline&&!o.isInstancedMesh&&o.geometry)meshes.push(o);});
 const inv=inner.matrixWorld.clone().invert();
 const clip=(poly,y,above)=>{const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=(a.y-y)*(above?1:-1),db=(b.y-y)*(above?1:-1);if(da>=0)out.push(a);if(da*db<0)out.push(a.clone().lerp(b,da/(da-db)));}return out;};
 for(const mesh of meshes){const p=mesh.geometry.attributes.position,idx=mesh.geometry.index,m=inv.clone().multiply(mesh.matrixWorld);for(let i=0;i<(idx?.count||p.count);i+=3){let poly=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,idx?idx.getX(i+j):i+j).applyMatrix4(m));poly=clip(clip(poly,low,true),high,false);if(poly.length<3)continue;polygons.push({points:poly,minX:Math.min(...poly.map(v=>v.x)),maxX:Math.max(...poly.map(v=>v.x)),minZ:Math.min(...poly.map(v=>v.z)),maxZ:Math.max(...poly.map(v=>v.z)),source:mesh.name});}}
 function clearance(x,z,limit=Infinity){let best=limit;for(const poly of polygons){if(x<poly.minX-best||x>poly.maxX+best||z<poly.minZ-best||z>poly.maxZ+best)continue;let inside=false;for(let i=0,j=poly.points.length-1;i<poly.points.length;j=i++){
   const a=poly.points[i],b=poly.points[j],dx=b.x-a.x,dz=b.z-a.z,k=T.MathUtils.clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1),0,1);best=Math.min(best,Math.hypot(x-a.x-dx*k,z-a.z-dz*k));
   if((a.z>z)!==(b.z>z)&&x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x)inside=!inside;
  }if(inside)return 0;}return best;}

 const tri=new T.Triangle(),transform=new T.Matrix4(),rotation=new T.Matrix4();
 function boxesClear(x,z,angle,boxes){
  transform.makeTranslation(-x,-25.1,-z);rotation.makeRotationY(angle);transform.premultiply(rotation);
  for(const poly of polygons){
   for(let i=1;i<poly.points.length-1;i++){
    tri.a.copy(poly.points[0]).applyMatrix4(transform);tri.b.copy(poly.points[i]).applyMatrix4(transform);tri.c.copy(poly.points[i+1]).applyMatrix4(transform);
    for(const box of boxes)if(box.intersectsTriangle(tri))return false;
   }
  }return true;
 }
 return {polygons,meshes,low,high,clearance,boxesClear};
}

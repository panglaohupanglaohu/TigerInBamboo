import * as T from 'three';
import {finishMountainRockSurface} from './mountainRockSurfaceFinish.js';
// Split the actual final triangles at the cut's transition planes before
// lowering the seaward side. Keeps all attributes and exact protected side.
export function clipShipHeadlandGeometry(source,{toChart=new T.Matrix4(),castleMatrix=new T.Matrix4(),seaAt,cutX=-91,keepX=-90,shipWorldBoxes=[],railWorldBoxes=[],protectedWorldBoxes=[]}={}){
 if(typeof seaAt!=='function'||!Number.isFinite(cutX)||!Number.isFinite(keepX)||cutX>=keepX)throw new TypeError('actual sea sampler and ordered finite cut planes required');
 const p=source.attributes.position,ix=source.index,inv=toChart.clone().invert(),specs=Object.entries(source.attributes),out=Object.fromEntries(specs.map(([name])=>[name,[]]));
 const beforeTriangles=(ix?.count??p.count)/3,changedFaces=[],preserveNormals=[];
 const report={version:1,cutX,keepX,beforeTriangles,afterTriangles:0,movedVertices:0,maxDrop:0,rejectedProtectedFaces:0,seaMisses:0,shipBoxes:shipWorldBoxes.length,railBoxes:railWorldBoxes.length,clearanceVerified:false,railUnchanged:true};
 const lerp=(a,b,t)=>({point:a.point.clone().lerp(b.point,t),attrs:Object.fromEntries(specs.map(([name])=>[name,a.attrs[name].map((v,i)=>v+(b.attrs[name][i]-v)*t)])),mobility:a.mobility+(b.mobility-a.mobility)*t});
 function split(poly,x,keepRight){const result=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],fa=a.point.x-x,fb=b.point.x-x,ain=keepRight?fa>=0:fa<=0,bin=keepRight?fb>=0:fb<=0;if(ain)result.push(a);if(ain!==bin){const v=lerp(a,b,fa/(fa-fb));v.point.x=x;result.push(v);}}return result;}
 const worldTriangle=new T.Triangle(),protectedBoxes=[...railWorldBoxes,...protectedWorldBoxes].map(b=>b.box||b);
 const locked=new Set(),pointKey=v=>v.toArray().join(',');
 for(let f=0;f<beforeTriangles;f++){
  const points=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(p,ix?ix.getX(f*3+k):f*3+k).applyMatrix4(toChart));
  worldTriangle.set(...points.map(v=>v.clone().applyMatrix4(castleMatrix)));
  if(protectedBoxes.some(b=>b.intersectsTriangle(worldTriangle)))for(const v of points)locked.add(pointKey(v));
 }
 for(let f=0;f<beforeTriangles;f++){
  const vertices=[0,1,2].map(k=>{const id=ix?ix.getX(f*3+k):f*3+k;return{point:new T.Vector3().fromBufferAttribute(p,id).applyMatrix4(toChart),attrs:Object.fromEntries(specs.map(([name,a])=>[name,Array.from({length:a.itemSize},(_,j)=>a.array[id*a.itemSize+j])]))};});
  for(const v of vertices)v.mobility=locked.has(pointKey(v.point))?0:1;
  const transformed=vertices.map(v=>v.point.clone().applyMatrix4(castleMatrix));worldTriangle.set(...transformed);
  const blocked=protectedBoxes.some(b=>b.intersectsTriangle(worldTriangle));
  if(blocked&&vertices.some(v=>v.point.x<keepX))report.rejectedProtectedFaces++;
  let pieces=[vertices];if(!blocked)for(const x of[cutX,keepX]){const next=[];for(const poly of pieces){if(poly.some(v=>v.point.x<x)&&poly.some(v=>v.point.x>x)){next.push(split(poly,x,true),split(poly,x,false));}else next.push(poly);}pieces=next;}
  for(const poly of pieces){const modified=poly.map(v=>{
   let y=v.point.y;if(!blocked&&v.point.x<keepX){const sea=seaAt(v.point.x,v.point.z);if(!Number.isFinite(sea)){report.seaMisses++;}else{const w=1-T.MathUtils.smoothstep(v.point.x,cutX,keepX);y=T.MathUtils.lerp(y,Math.min(y,sea-4),w*v.mobility);}}
   const d=v.point.y-y;if(d>1e-7){report.movedVertices++;report.maxDrop=Math.max(report.maxDrop,d);}const point=v.point.clone();point.y=y;point.applyMatrix4(inv);return{...v,local:point,moved:d>1e-7};});
   for(let k=1;k<modified.length-1;k++){const tri=[modified[0],modified[k],modified[k+1]];if(new T.Triangle(...tri.map(v=>v.local)).getArea()<1e-10)continue;
    changedFaces.push(tri.some(v=>v.moved));preserveNormals.push(...tri.map(v=>!tri.some(q=>q.moved)||v.point.x>=keepX));
    for(const v of tri)for(const[name]of specs)out[name].push(...(name==='position'?v.local.toArray():v.attrs[name]));report.afterTriangles++;
   }
  }
 }
 const geometry=new T.BufferGeometry();for(const[name,a]of specs)geometry.setAttribute(name,new T.Float32BufferAttribute(out[name],a.itemSize));// Retain original corner normals, including interpolated normals on split
 // but unmoved faces. Only displaced triangles receive newly derived shading.
 const retained=geometry.attributes.normal?.array.slice();
 const finished=finishMountainRockSurface(geometry,{enabled:true,relax:false,toCastle:toChart});
 const smooth=finished.geometry.attributes.normal,values=new Float32Array(smooth.array);
 let preservedCorners=0;
 if(retained)for(let i=0;i<preserveNormals.length;i++)if(preserveNormals[i]){for(let k=0;k<3;k++)values[i*3+k]=retained[i*3+k];preservedCorners++;}
 geometry.setAttribute('normal',new T.BufferAttribute(values,3));finished.geometry.dispose();
 report.normalPolicy={unchanged:'original corner normals preserved; split corners barycentrically interpolated',changed:'shared-edge semantic fans; no position relaxation',preservedCorners,changedTriangles:changedFaces.filter(Boolean).length};
 geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.userData={...source.userData,shipHeadlandClip:report};
 // Actual final surface to actual supplied hull AABB distance, not vertex-only.
 const gp=geometry.attributes.position,a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),tri=new T.Triangle(),closest=new T.Vector3();
 report.shipClearances=shipWorldBoxes.map(entry=>{const box=entry.box||entry,center=box.getCenter(new T.Vector3());let intersections=0,minCenterSurface=Infinity;for(let i=0;i<gp.count;i+=3){a.fromBufferAttribute(gp,i).applyMatrix4(toChart).applyMatrix4(castleMatrix);b.fromBufferAttribute(gp,i+1).applyMatrix4(toChart).applyMatrix4(castleMatrix);c.fromBufferAttribute(gp,i+2).applyMatrix4(toChart).applyMatrix4(castleMatrix);tri.set(a,b,c);if(box.intersectsTriangle(tri))intersections++;tri.closestPointToPoint(center,closest);minCenterSurface=Math.min(minCenterSurface,closest.distanceTo(center));}return{surfaceIntersections:intersections,minCenterSurface,conservativeHullSeparation:minCenterSurface-box.getSize(new T.Vector3()).length()*.5};});
 report.clearanceVerified=report.shipClearances.length>0&&report.shipClearances.every(r=>r.conservativeHullSeparation>=3&&r.surfaceIntersections===0)&&report.seaMisses===0&&report.rejectedProtectedFaces===0;
 return{geometry,report};
}

import * as T from 'three';
import {guardMountainDisplacement} from './guardMountainDisplacement.js';
import {finishMountainRockSurface} from './mountainRockSurfaceFinish.js';
// Split the actual final triangles at the cut's transition planes before
// lowering the seaward side. Keeps all attributes and exact protected side.
export function clipShipHeadlandGeometry(source,{toChart=new T.Matrix4(),castleMatrix=new T.Matrix4(),seaAt,cutX=-91,keepX=-90,shipWorldBoxes=[],railWorldBoxes=[],protectedWorldBoxes=[],rearRadialCut=false}={}){
 if(typeof seaAt!=='function'||!Number.isFinite(cutX)||!Number.isFinite(keepX)||cutX>=keepX)throw new TypeError('actual sea sampler and ordered finite cut planes required');
 const p=source.attributes.position,ix=source.index,inv=toChart.clone().invert(),specs=Object.entries(source.attributes),out=Object.fromEntries(specs.map(([name])=>[name,[]]));
 const radialInverse=castleMatrix.clone().invert();
 const beforeTriangles=(ix?.count??p.count)/3,changedFaces=[],preserveNormals=[],originalPositions=[];
 let quantizedCollapsedCutTriangles=0;
 const report={version:1,cutX,keepX,rearRadialCut,radialPolicy:rearRadialCut?{x:[18,26,114,122],z:[-14,-10],radiusMapping:'min(r,128+.05*r)',note:'mask evaluated on radius160 sphere; strictly increasing radial map preserves direction and submerged thickness'}:null,beforeTriangles,afterTriangles:0,movedVertices:0,maxDrop:0,rejectedProtectedFaces:0,seaMisses:0,shipBoxes:shipWorldBoxes.length,railBoxes:railWorldBoxes.length,clearanceVerified:false,railUnchanged:true};
 const lerp=(a,b,t)=>({point:a.point.clone().lerp(b.point,t),attrs:Object.fromEntries(specs.map(([name])=>[name,a.attrs[name].map((v,i)=>v+(b.attrs[name][i]-v)*t)])),mobility:a.mobility+(b.mobility-a.mobility)*t});
 function split(poly,x,keepRight,axis='x'){const result=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],fa=a.point[axis]-x,fb=b.point[axis]-x,ain=keepRight?fa>=0:fa<=0,bin=keepRight?fb>=0:fb<=0;if(ain)result.push(a);if(ain!==bin){const v=lerp(a,b,fa/(fa-fb));v.point[axis]=x;result.push(v);}}return result;}
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
  let pieces=[vertices];const planes=rearRadialCut?[[18,'x'],[26,'x'],[114,'x'],[122,'x'],[-14,'z'],[-10,'z']]:[[cutX,'x'],[keepX,'x']];if(!blocked)for(const [x,axis]of planes){const next=[];for(const poly of pieces){if(poly.some(v=>v.point[axis]<x)&&poly.some(v=>v.point[axis]>x)){next.push(split(poly,x,true,axis),split(poly,x,false,axis));}else next.push(poly);}pieces=next;}
  for(const poly of pieces){const modified=poly.map(v=>{
   let y=v.point.y;if(!rearRadialCut&&!blocked&&v.point.x<keepX){const sea=seaAt(v.point.x,v.point.z);if(!Number.isFinite(sea)){report.seaMisses++;}else{const w=1-T.MathUtils.smoothstep(v.point.x,cutX,keepX);y=T.MathUtils.lerp(y,Math.min(y,sea-4),w*v.mobility);}}
   const point=v.point.clone();point.y=y;
   if(rearRadialCut&&!blocked){const world=point.clone().applyMatrix4(castleMatrix),r=world.length(),seaPoint=world.clone().setLength(160).applyMatrix4(radialInverse);const w=T.MathUtils.smoothstep(seaPoint.x,18,26)*(1-T.MathUtils.smoothstep(seaPoint.x,114,122))*(1-T.MathUtils.smoothstep(seaPoint.z,-14,-10))*v.mobility;
    if(w>0){world.setLength(T.MathUtils.lerp(r,Math.min(r,128+.05*r),w));point.copy(world.applyMatrix4(radialInverse));}}
   const d=point.distanceTo(v.point);if(d>1e-7){report.movedVertices++;report.maxDrop=Math.max(report.maxDrop,d);}point.applyMatrix4(inv);return{...v,local:point,moved:d>1e-7};});
   for(let k=1;k<modified.length-1;k++){let tri=[modified[0],modified[k],modified[k+1]];if(new T.Triangle(...tri.map(v=>v.local)).getArea()<1e-10)continue;
    // Validate the actual storage precision. A cut infinitesimally beside a
    // source corner can make a valid double-precision fan sliver whose corners
    // become identical in Float32. Never emit that zero-area synthetic face.
    tri=tri.map(v=>({...v,local:new T.Vector3(Math.fround(v.local.x),Math.fround(v.local.y),Math.fround(v.local.z))}));
    if(new T.Triangle(...tri.map(v=>v.local)).getArea()<1e-10){quantizedCollapsedCutTriangles++;continue;}
    for(const v of tri)originalPositions.push(...v.attrs.position);changedFaces.push(tri.some(v=>v.moved));preserveNormals.push(...tri.map(v=>!tri.some(q=>q.moved)||(!rearRadialCut&&v.point.x>=keepX)));
    for(const v of tri)for(const[name]of specs)out[name].push(...(name==='position'?v.local.toArray():v.attrs[name]));report.afterTriangles++;
   }
  }
 }
 report.quantizedCollapsedCutTriangles=quantizedCollapsedCutTriangles;
 const geometry=new T.BufferGeometry();for(const[name,a]of specs)geometry.setAttribute(name,new T.Float32BufferAttribute(out[name],a.itemSize));// Retain original corner normals, including interpolated normals on split
 // but unmoved faces. Only displaced triangles receive newly derived shading.
 if(rearRadialCut){report.displacementGuard=guardMountainDisplacement(new T.Float32BufferAttribute(originalPositions,3),geometry.attributes.position);report.maxDrop=report.displacementGuard.maxDisplacement;report.movedVertices=report.displacementGuard.movedCorners;}
 const retained=geometry.attributes.normal?.array.slice();
 const finished=finishMountainRockSurface(geometry,{enabled:true,relax:false,toCastle:toChart});
 const smooth=finished.geometry.attributes.normal,values=new Float32Array(smooth.array);
 let preservedCorners=0;
 if(retained)for(let i=0;i<preserveNormals.length;i++)if(preserveNormals[i]){for(let k=0;k<3;k++)values[i*3+k]=retained[i*3+k];preservedCorners++;}
 geometry.setAttribute('normal',new T.BufferAttribute(values,3));finished.geometry.dispose();
 report.normalPolicy={unchanged:'original corner normals preserved; split corners barycentrically interpolated',changed:'shared-edge semantic fans; no position relaxation',preservedCorners,changedTriangles:changedFaces.filter(Boolean).length};
 const originals=new T.Float32BufferAttribute(originalPositions,3),pa=geometry.attributes.position,va=new T.Vector3(),vb=new T.Vector3(),vc=new T.Vector3(),oldN=new T.Vector3(),newN=new T.Vector3();let newDegenerate=0,reverse=0,differentialReverse=0;
 const mapRadial=p=>{const w=p.clone().applyMatrix4(toChart).applyMatrix4(castleMatrix),r=w.length(),sp=w.clone().setLength(160).applyMatrix4(radialInverse),weight=T.MathUtils.smoothstep(sp.x,18,26)*(1-T.MathUtils.smoothstep(sp.x,114,122))*(1-T.MathUtils.smoothstep(sp.z,-14,-10));return w.setLength(T.MathUtils.lerp(r,Math.min(r,128+.05*r),weight)).applyMatrix4(radialInverse).applyMatrix4(inv);};
 for(let i=0;i<pa.count;i+=3){va.fromBufferAttribute(originals,i);vb.fromBufferAttribute(originals,i+1);vc.fromBufferAttribute(originals,i+2);oldN.crossVectors(vb.sub(va),vc.sub(va));va.fromBufferAttribute(pa,i);vb.fromBufferAttribute(pa,i+1);vc.fromBufferAttribute(pa,i+2);newN.crossVectors(vb.sub(va),vc.sub(va));if(oldN.lengthSq()>1e-12&&newN.lengthSq()<1e-12)newDegenerate++;if(oldN.dot(newN)<-1e-10)reverse++;
 if(rearRadialCut&&oldN.lengthSq()>1e-12&&newN.lengthSq()>1e-12){const A=new T.Vector3().fromBufferAttribute(originals,i),B=new T.Vector3().fromBufferAttribute(originals,i+1),C=new T.Vector3().fromBufferAttribute(originals,i+2),center=A.clone().add(B).add(C).multiplyScalar(1/3),base=mapRadial(center),u=mapRadial(center.clone().addScaledVector(B.sub(A).normalize(),.001)).sub(base),v=mapRadial(center.clone().addScaledVector(C.sub(A).normalize(),.001)).sub(base);if(u.cross(v).dot(newN)<-1e-12)differentialReverse++;}}

 report.faceDirectionAudit={newDegenerate,reverse,differentialReverse,note:'relative source-face orientation; large legitimate rotations can also reverse dot sign'};
 geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.userData={...source.userData,shipHeadlandClip:report};
 // Actual final surface to actual supplied hull AABB distance, not vertex-only.
 const gp=geometry.attributes.position,a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),tri=new T.Triangle(),closest=new T.Vector3();
 report.shipClearances=shipWorldBoxes.map(entry=>{const box=entry.box||entry,center=box.getCenter(new T.Vector3());let intersections=0,minCenterSurface=Infinity;for(let i=0;i<gp.count;i+=3){a.fromBufferAttribute(gp,i).applyMatrix4(toChart).applyMatrix4(castleMatrix);b.fromBufferAttribute(gp,i+1).applyMatrix4(toChart).applyMatrix4(castleMatrix);c.fromBufferAttribute(gp,i+2).applyMatrix4(toChart).applyMatrix4(castleMatrix);tri.set(a,b,c);if(box.intersectsTriangle(tri))intersections++;tri.closestPointToPoint(center,closest);minCenterSurface=Math.min(minCenterSurface,closest.distanceTo(center));}return{surfaceIntersections:intersections,minCenterSurface,conservativeHullSeparation:minCenterSurface-box.getSize(new T.Vector3()).length()*.5};});
 report.clearanceVerified=report.shipClearances.length>0&&report.shipClearances.every(r=>r.conservativeHullSeparation>=3&&r.surfaceIntersections===0)&&report.seaMisses===0&&report.rejectedProtectedFaces===0;
 return{geometry,report};
}

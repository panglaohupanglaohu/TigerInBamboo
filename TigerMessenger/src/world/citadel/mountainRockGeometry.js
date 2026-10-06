import * as THREE from 'three';
import {applyRockCornerNormals} from './mountainRockNormals.js';

const refinementTraces=new WeakMap();
export const getRockRefinementTrace=geometry=>refinementTraces.get(geometry)||null;

// Subdivide large rock faces without moving their boundary or any authored
// route. The face interior receives shallow fractured relief, not random
// displacement of the entire city foundation. All source attributes survive.
export function refineRockFaces(source,{maxEdge=4,amplitude=.65,selectTriangle=()=>true,surfaceNormals=null,trace=false}={}){
 const p=source.attributes.position,index=source.index,arrays={},specs=Object.entries(source.attributes).filter(([name])=>name!=='normal');
 for(const [name]of specs)arrays[name]=[];
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),ab=new THREE.Vector3(),ac=new THREE.Vector3(),normal=new THREE.Vector3();
 let refined=0,maxOffset=0;const ranges=[];const faces=[],barycentric=[];
 const emit=(ids,u,v)=>{
  const w=1-u-v,edge=Math.min(u,v,w),point=a.clone().multiplyScalar(w).addScaledVector(b,u).addScaledVector(c,v);
  if(surfaceNormals)barycentric.push(u,v);
  const noise=Math.sin(point.x*1.73+point.z*.91)*.55+Math.sin(point.y*2.13-point.x*.7)*.30+Math.cos(point.z*3.4-point.y*.81)*.15;
  const offset=amplitude*Math.min(1,Math.max(0,edge*8))*noise;
  maxOffset=Math.max(maxOffset,Math.abs(offset));point.addScaledVector(normal,offset);
  for(const [name,attr]of specs){const dst=arrays[name];if(name==='position'){dst.push(point.x,point.y,point.z);continue;}
   for(let k=0;k<attr.itemSize;k++)dst.push(attr.array[ids[0]*attr.itemSize+k]*w+attr.array[ids[1]*attr.itemSize+k]*u+attr.array[ids[2]*attr.itemSize+k]*v);
  }
 };
 const count=index?.count??p.count;
 for(let i=0;i<count;i+=3){
  const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j);a.fromBufferAttribute(p,ids[0]);b.fromBufferAttribute(p,ids[1]);c.fromBufferAttribute(p,ids[2]);
  normal.crossVectors(ab.subVectors(b,a),ac.subVectors(c,a)).normalize();
  const edge=Math.max(a.distanceTo(b),a.distanceTo(c),b.distanceTo(c));
  const n=edge>maxEdge&&selectTriangle(a,b,c,normal)?Math.min(6,Math.max(3,Math.ceil(edge/maxEdge))):1;
  const traceStart=trace?arrays.position.length/9:0;
  const face=surfaceNormals?{ids,n,normal:normal.clone(),start:arrays.position.length/3}:null;
  if(n>1)refined++;
  for(let row=0;row<n;row++)for(let col=0;col<n-row;col++){
   emit(ids,col/n,row/n);emit(ids,(col+1)/n,row/n);emit(ids,col/n,(row+1)/n);
   if(col+row<n-1){emit(ids,(col+1)/n,row/n);emit(ids,(col+1)/n,(row+1)/n);emit(ids,col/n,(row+1)/n);}
  }
  if(trace)ranges.push({inputFace:i/3,start:traceStart,end:arrays.position.length/9});
  if(face){face.end=arrays.position.length/3;faces.push(face);}
 }
 const geometry=new THREE.BufferGeometry();
 for(const [name,attr]of specs)geometry.setAttribute(name,new THREE.Float32BufferAttribute(arrays[name],attr.itemSize));
 geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
 geometry.userData={...source.userData,rockRefinement:{refined,sourceTriangles:count/3,triangles:geometry.attributes.position.count/3,maxOffset}};
 if(surfaceNormals)applyRockCornerNormals(geometry,source,faces,barycentric,surfaceNormals);
 if(trace)refinementTraces.set(geometry,{source,ranges,mapping:'input face to emitted final triangle half-open range'});
 return geometry;
}

// Closed, asymmetric block with broken ledges: avoids the smooth ellipsoid
// silhouette that makes procedural boulders look like piled balloons.
export function cragGeometry(seed=1){
 const vertices=[],indices=[],sides=7,rings=6;
 const rnd=n=>{const v=Math.sin(seed*17.13+n*41.7)*43758.5453;return v-Math.floor(v);};
 for(let r=0;r<rings;r++)for(let j=0;j<sides;j++){
  const angle=j/sides*Math.PI*2,profile=[.65,1,.88,.84,.63,.32][r],jitter=.80+rnd(j)*.35;
  const x=Math.cos(angle)*profile*jitter+Math.sin(r*1.8+seed)*.09;
  const z=Math.sin(angle)*profile*(.80+rnd(j+27)*.30)+Math.cos(r*1.3+seed)*.07;
  vertices.push(x,-1+r/(rings-1)*2+(r===0?0:(rnd(j+51)-.5)*.17),z);
 }
 for(let r=0;r<rings-1;r++)for(let j=0;j<sides;j++){
  const a=r*sides+j,b=r*sides+(j+1)%sides,c=b+sides,d=a+sides;
  indices.push(a,d,b,b,d,c);
 }
 for(let j=1;j<sides-1;j++)indices.push(0,j,(j+1));
 const top=(rings-1)*sides;for(let j=1;j<sides-1;j++)indices.push(top,top+j+1,top+j);
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();return g;
}

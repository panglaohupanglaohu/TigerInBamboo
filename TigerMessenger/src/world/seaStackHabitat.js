import * as THREE from 'three';

// Project habitat model: edge-connected final rock faces, not an XZ projection.
// Matching positions also supports non-indexed meshes; vertically separated
// terraces never connect merely because their plan-view footprints overlap.
export function buildSeaStackHabitat(geometry,{minimumNormalY=.70,cellSize=1}={}){
 const p=geometry.attributes.position,index=geometry.index,count=(index?.count??p.count)/3;
 const faceComponents=new Int32Array(count).fill(-1),parents=new Int32Array(count).fill(-1),edges=new Map(),faces=[],tri=new THREE.Triangle(),normal=new THREE.Vector3();
 const key=v=>[v.x,v.y,v.z].map(n=>Math.round(n*1e5)).join(',');
 const root=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
 for(let face=0;face<count;face++){
  const ids=[0,1,2].map(j=>index?index.getX(face*3+j):face*3+j);
  [tri.a,tri.b,tri.c].forEach((v,j)=>v.fromBufferAttribute(p,ids[j]));tri.getNormal(normal);
  if(normal.y<minimumNormalY||tri.getArea()<1e-10)continue;
  parents[face]=face;faces.push(face);const vertices=[tri.a.clone(),tri.b.clone(),tri.c.clone()];
  for(let j=0;j<3;j++){const a=vertices[j],b=vertices[(j+1)%3],ka=key(a),kb=key(b),edgeKey=ka<kb?ka+'|'+kb:kb+'|'+ka;let e=edges.get(edgeKey);if(!e){e={a,b,faces:[]};edges.set(edgeKey,e);}e.faces.push(face);}
 }
 for(const e of edges.values())for(let j=1;j<e.faces.length;j++){const a=root(e.faces[0]),b=root(e.faces[j]);if(a!==b)parents[b]=a;}
 const ids=new Map(),components=[];
 for(const face of faces){const r=root(face);if(!ids.has(r)){ids.set(r,components.length);components.push({faces:0,boundaries:[],grid:new Map()});}const id=ids.get(r);faceComponents[face]=id;components[id].faces++;}
 const bucketKey=(x,y,z)=>x+','+y+','+z;
 for(const e of edges.values()){
  if(e.faces.length===2)continue;
  const component=components[faceComponents[e.faces[0]]],id=component.boundaries.length;component.boundaries.push(e);
  const lo=e.a.clone().min(e.b).divideScalar(cellSize).floor(),hi=e.a.clone().max(e.b).divideScalar(cellSize).floor();
  for(let x=lo.x;x<=hi.x;x++)for(let y=lo.y;y<=hi.y;y++)for(let z=lo.z;z<=hi.z;z++){const k=bucketKey(x,y,z);if(!component.grid.has(k))component.grid.set(k,[]);component.grid.get(k).push(id);}
 }
 function distance(point,componentId,maximum=Infinity){
  const c=components[componentId];if(!c)return 0;let best=maximum*maximum,candidates;
  if(Number.isFinite(maximum)){const ids=new Set(),r=Math.ceil(maximum/cellSize),x=Math.floor(point.x/cellSize),y=Math.floor(point.y/cellSize),z=Math.floor(point.z/cellSize);for(let dx=-r;dx<=r;dx++)for(let dy=-r;dy<=r;dy++)for(let dz=-r;dz<=r;dz++)for(const id of c.grid.get(bucketKey(x+dx,y+dy,z+dz))||[])ids.add(id);candidates=[...ids].map(i=>c.boundaries[i]);}else candidates=c.boundaries;
  for(const {a,b} of candidates){const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,den=dx*dx+dy*dy+dz*dz;const t=den?THREE.MathUtils.clamp(((point.x-a.x)*dx+(point.y-a.y)*dy+(point.z-a.z)*dz)/den,0,1):0;const x=point.x-a.x-dx*t,y=point.y-a.y-dy*t,z=point.z-a.z-dz*t;best=Math.min(best,x*x+y*y+z*z);}return Math.sqrt(best);
 }
 return {faceComponents,distance,audit:{method:'edge-connected-final-face-components-3d-boundary-distance',minimumNormalY,positionWeldTolerance:1e-5,cellSize,componentCount:components.length,acceptedFaces:faces.length,boundaryEdges:components.reduce((n,c)=>n+c.boundaries.length,0),components:components.map((c,id)=>({id,faces:c.faces,boundaryEdges:c.boundaries.length}))}};
}

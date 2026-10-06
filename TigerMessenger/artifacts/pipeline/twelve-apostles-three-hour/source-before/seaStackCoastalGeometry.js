import * as THREE from 'three';
import {solveCoastalStackWfc} from './seaStackWfc.js';

// Connected coastal volumes, not concentric rings. WFC selects the vertical
// coastal vocabulary; the authored lateral volumes and tetrahedral iso-surface
// extraction are a separate modeling stage, not a claim of 3D WFC.
export function coastalStackGeometry(radius,height,seed){
 const started=performance.now();
 const enabled=new URLSearchParams(globalThis.location?.search||'').get('seaStackWfc')!=='0';
 const solution=solveCoastalStackWfc(enabled?seed:0);
 const phase=seed*2.399963;
 const lowerWidth=solution.modules[2].top,terraceWidth=solution.modules[3].top,upperWidth=solution.modules[4].top;
 const variant=solution.modules[3].id.includes('narrow')?'isolated-remnant':solution.modules[2].id.includes('jointed')?'low-double-shoulder':'shouldered-stack';
 const shoulder=(variant==='isolated-remnant'?.20:variant==='low-double-shoulder'?.52:.36)+(1-terraceWidth)*.12+.035*Math.sin(seed*1.37),low=(variant==='low-double-shoulder'?.32:.18)+.025*Math.cos(seed*2.1);
 const angle=phase*.37,cs=Math.cos(angle),sn=Math.sin(angle);
 const shore=solution.modules[1].id==='deep-wave-notch'?.17:.10;
 const crown=solution.modules[5].top;
 const field=(x,y,z)=>{
  const t=(y+height*.5)/height;
  const xx=(x*cs+z*sn)/radius,zz=(-x*sn+z*cs)/radius;
  const notch=shore*Math.exp(-Math.pow((t-.14)/.047,2));
  // Broad bedding changes, a shallow diagonal joint and asymmetric broken sides.
  const bands=[[0,.98],[.16,.90],[.29,1.03],[.46,1.05],[.65,.91],[.79,.84],[1,.68+(upperWidth-.66)*.35]];
  let profile=bands.at(-1)[1];for(let i=1;i<bands.length;i++)if(t<=bands[i][0]){const q=THREE.MathUtils.clamp((t-bands[i-1][0])/(bands[i][0]-bands[i-1][0]),0,1);profile=bands[i-1][1]+(bands[i][1]-bands[i-1][1])*q;break;}
  profile*=.96+lowerWidth*.04;
  const joint=.035*Math.exp(-Math.pow((xx+.24-.17*t)/.055,2))*Math.max(0,t-.34);
  function slab(cx,cz,rx,rz,top){
   const u=(xx-cx)/rx,v=(zz-cz)/rz,a=Math.atan2(v,u);
   const polygon=Math.pow(Math.pow(Math.abs(u),3)+Math.pow(Math.abs(v),3),1/3);
   const broken=.035*Math.sin(a*3+phase)+.022*Math.cos(a*7-phase);
   const wall=(profile+broken-polygon-joint-notch*(.25+.75*Math.max(0,Math.cos(a-phase))))*radius;
   return Math.min(wall,(top-t)*height,t*height);
  }
  // Main remnant is offset beside a lower cliff shoulder. Its top is blunt and
  // weathered, while the shoulder and low remnant have genuine flat substrates.
  const top=(variant==='low-double-shoulder'?.79:.96)+.012*Math.sin(xx*6+phase)+.009*Math.cos(zz*8-phase)-.022*Math.max(0,xx+.1)+(crown-.55)*.05;
  const main=slab(.20,.10,.60,.53,top);
  const flank=slab(variant==='isolated-remnant'?-.25:-.33,-.06,(variant==='isolated-remnant'?.38:.50)+(1-terraceWidth)*.18,variant==='isolated-remnant'?.36:.54,shoulder);
  const toe=slab(.10,variant==='isolated-remnant'?-.22:-.38,variant==='isolated-remnant'?.36:.51,variant==='isolated-remnant'?.32:.43,low);
  return Math.max(main,flank,toe);
 };
 const nx=18,ny=32,nz=18;
 const min=[-radius*1.20,-height*.52,-radius*1.20],max=[radius*1.20,height*.53,radius*1.20];
 const points=[],values=[];
 const gi=(x,y,z)=>x+(nx+1)*(y+(ny+1)*z);
 for(let z=0;z<=nz;z++)for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){
  const p=[min[0]+(max[0]-min[0])*x/nx,min[1]+(max[1]-min[1])*y/ny,min[2]+(max[2]-min[2])*z/nz];points.push(p);values.push(field(...p));
 }
 const tet=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
 const edgePairs=[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
 const vertices=[],indices=[],cache=new Map();
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const sub=(a,b)=>a.map((v,i)=>v-b[i]);
 const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
 const norm=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l);};
 function intersection(a,b){
  if(a>b)[a,b]=[b,a];const key=a+':'+b;if(cache.has(key))return cache.get(key);
  const u=values[a]/(values[a]-values[b]),p=points[a].map((v,i)=>v+(points[b][i]-v)*u);
  if(Math.abs(p[1]+height*.5)<1e-5)p[1]=-height*.5;
  const id=vertices.length;vertices.push(p);cache.set(key,id);return id;
 }
 for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
  const cube=[gi(x,y,z),gi(x+1,y,z),gi(x+1,y+1,z),gi(x,y+1,z),gi(x,y,z+1),gi(x+1,y,z+1),gi(x+1,y+1,z+1),gi(x,y+1,z+1)];
  const positives=cube.reduce((s,i)=>s+(values[i]>=0),0);if(!positives||positives===8)continue;
  for(const ids of tet){
   const ids4=ids.map(i=>cube[i]),poly=[];
   for(const [a,b] of edgePairs)if((values[ids4[a]]>=0)!==(values[ids4[b]]>=0))poly.push(intersection(ids4[a],ids4[b]));
   if(poly.length<3)continue;
   const center=[0,0,0];for(const i of poly)vertices[i].forEach((v,j)=>center[j]+=v/poly.length);
   // Use the tetrahedron's planar cut, not a nonlinear field gradient at
   // a min/max seam: the latter can reverse triangles or misorder a quad.
   const positive=[0,0,0],negative=[0,0,0];let np=0,nn=0;
   for(const id of ids4){const dest=values[id]>=0?positive:negative;points[id].forEach((v,j)=>dest[j]+=v);if(values[id]>=0)np++;else nn++;}
   const outward=negative.map((v,j)=>v/nn-positive[j]/np);
   let gradient=norm(cross(sub(vertices[poly[1]],vertices[poly[0]]),sub(vertices[poly[2]],vertices[poly[0]])));
   if(dot(gradient,outward)<0)gradient=gradient.map(v=>-v);
   const u=norm(sub(vertices[poly[0]],center)),v=norm(cross(gradient,u));
   poly.sort((a,b)=>Math.atan2(dot(sub(vertices[a],center),v),dot(sub(vertices[a],center),u))-Math.atan2(dot(sub(vertices[b],center),v),dot(sub(vertices[b],center),u)));
   for(let i=1;i<poly.length-1;i++){
    let b=poly[i],c=poly[i+1];const normal=cross(sub(vertices[b],vertices[poly[0]]),sub(vertices[c],vertices[poly[0]]));
    if(dot(normal,gradient)<0)[b,c]=[c,b];indices.push(poly[0],b,c);
   }
  }
 }
 // Exact iso values at a lattice corner can be reached through several grid
 // edges. Weld those positions before discarding collapsed triangles.
 const welded=[],lookup=new Map(),remap=vertices.map(p=>{
  const q=p.map(v=>Math.round(v*1e5)/1e5),key=q.join(',');
  if(!lookup.has(key)){lookup.set(key,welded.length);welded.push(q);}return lookup.get(key);
 });
 const faces=[];for(let i=0;i<indices.length;i+=3){const a=remap[indices[i]],b=remap[indices[i+1]],c=remap[indices[i+2]];if(a!==b&&b!==c&&a!==c)faces.push(a,b,c);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(welded.flat(),3));g.setIndex(faces);g.computeVertexNormals();
 // Area-weighted normals suppress tetrahedron diagonals. Flat ledges remain
 // planar in geometry; their interior vertices keep exact upward normals.
 const p=g.attributes.position,n=g.attributes.normal,colors=[],color=new THREE.Color();
 const sun=new THREE.Vector3(-.65,.7,.3).normalize(),normal=new THREE.Vector3(),dark=new THREE.Color(0x526c80),light=new THREE.Color(0xacbcc0),shelf=new THREE.Color(0x9eaead),wet=new THREE.Color(0x344f60);
 let footprintRadius=0;
 for(let i=0;i<p.count;i++){
  normal.fromBufferAttribute(n,i);const shade=.18+.82*Math.max(0,normal.dot(sun));color.copy(dark).lerp(light,shade);
  if(normal.y>.88)color.lerp(shelf,.5);
  const t=(p.getY(i)+height*.5)/height;if(t<.19)color.lerp(wet,.40*(1-t/.19));
  colors.push(color.r,color.g,color.b);footprintRadius=Math.max(footprintRadius,Math.hypot(p.getX(i),p.getZ(i)));
 }
 g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeBoundingBox();g.computeBoundingSphere();
 if(enabled)g.userData.wfc={...solution,modules:solution.modules.map(m=>m.id),scope:'1D module vocabulary; authored connected coastal volumes + marching tetrahedra surface'};
 g.userData.terraces={revision:3,seed,variant,levels:[low,shoulder],mode:'connected-coastal-volumes',footprintRadius,modules:solution.modules.map(m=>m.id),socketMismatches:solution.socketMismatches,grid:[nx,ny,nz],triangles:faces.length/3,constructionMs:performance.now()-started};
 return g;
}

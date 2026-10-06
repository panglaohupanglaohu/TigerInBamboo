import * as THREE from 'three';
import {createCoastalMaterial,bindCoastalMesh} from './seaStackLighting.js';
import {buildSeaStackHabitat} from './seaStackHabitat.js';
import {createCoastalScrubGeometry} from './seaStackScrubGeometry.js';
// Lighting is bound after planting, using the same final rock surface revision.

export function plantSeaStackTerraces(rock) {
 if(new URLSearchParams(globalThis.location?.search||'').get('seaStackStudy')==='0')return plantSeaStackTerracesLegacy(rock);
 const g=rock.geometry,p=g.attributes.position,index=g.index,h=rock.userData.seaStack.height;
 const seed=g.userData.terraces.seed,revision=rock.userData.coastalSurface?.revision||g.userData.surfaceRevision||`coastal-${seed}-study1`;
 const faces=[],positions=[],colors=[],turfNormals=[],turfCoverage=[],roots=[],clumps=[],fringe=[],patches=[];
 const tri=new THREE.Triangle(),n=new THREE.Vector3(),center=new THREE.Vector3();
 const turfLight=new THREE.Color(0x94ab79),turfDark=new THREE.Color(0x638566);
 const rawField=v=>Math.sin(v.x*.47+seed*1.7)+.72*Math.cos(v.z*.54-seed)+.38*Math.sin((v.x+v.z)*.72)+.16*Math.sin(v.x*1.1+Math.cos(v.z*.8));
 let habitatCut=0;
 const field=v=>rawField(v)-habitatCut;
 let state=(seed+9173)>>>0;
 const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const normalAt=i=>new THREE.Vector3().fromBufferAttribute(g.attributes.normal,i);
 const habitat=buildSeaStackHabitat(g,{minimumNormalY:.70}),habitatInset=.40,habitatFade=.20;
 const edgeDistance=(v,component)=>habitat.distance(v,component,habitatInset+habitatFade+.05);
 const signedHabitat=(v,component)=>Math.min(field(v),edgeDistance(v,component)-habitatInset,v.y+h*.24);
 function collectPatch(a,b,c,normal,surface,depth=0){
  if(Math.max(a.distanceToSquared(b),b.distanceToSquared(c),c.distanceToSquared(a))>.16&&depth<5){
   const ab=a.clone().add(b).multiplyScalar(.5),bc=b.clone().add(c).multiplyScalar(.5),ca=c.clone().add(a).multiplyScalar(.5);
   collectPatch(a,ab,ca,normal,surface,depth+1);collectPatch(ab,b,bc,normal,surface,depth+1);collectPatch(ca,bc,c,normal,surface,depth+1);collectPatch(ab,bc,ca,normal,surface,depth+1);return;
  }
  const area=new THREE.Triangle(a,b,c).getArea();
  patches.push({a,b,c,normal:normal.clone(),surface,area,value:rawField(a.clone().add(b).add(c).multiplyScalar(1/3))});
 }
 function clip(poly,surface) {
  const out=[];
  for(let i=0;i<poly.length;i++){
   const a=poly[i],b=poly[(i+1)%poly.length],fa=Math.min(field(a),a.y+h*.24),fb=Math.min(field(b),b.y+h*.24);
   if(fa>=0)out.push(a);
   if((fa>=0)!==(fb>=0))out.push(a.clone().lerp(b,fa/(fa-fb)));
  }
  return out;
 }
 function supportedTriangles(a,b,c,surface,out,depth=0){
  const center=a.clone().add(b).add(c).multiplyScalar(1/3),radius=Math.max(center.distanceTo(a),center.distanceTo(b),center.distanceTo(c));
  const d=edgeDistance(center,surface.component);
  // Distance to any closed boundary set is 1-Lipschitz. This lower bound
  // certifies every point of the triangle, not only linearly clipped vertices.
  if(d-radius>=habitatInset+.00001){out.push([a,b,c]);return true;}
  if(d+radius<habitatInset||radius<=.01||depth>=18)return false;
  const before=out.length,ab=a.distanceToSquared(b),bc=b.distanceToSquared(c),ca=c.distanceToSquared(a);let first,second;
  // Bisect the longest edge to avoid multiplying very skinny source triangles.
  if(ab>=bc&&ab>=ca){const mid=a.clone().add(b).multiplyScalar(.5);first=supportedTriangles(a,mid,c,surface,out,depth+1);second=supportedTriangles(mid,b,c,surface,out,depth+1);}
  else if(bc>=ca){const mid=b.clone().add(c).multiplyScalar(.5);first=supportedTriangles(a,b,mid,surface,out,depth+1);second=supportedTriangles(a,mid,c,surface,out,depth+1);}
  else{const mid=c.clone().add(a).multiplyScalar(.5);first=supportedTriangles(a,b,mid,surface,out,depth+1);second=supportedTriangles(mid,b,c,surface,out,depth+1);}
  // Two fully certified children cover the original triangle exactly.
  if(first&&second){out.length=before;out.push([a,b,c]);return true;}return false;
 }
 function patch(a,b,c,normal,surface,depth=0){
  const longest=Math.max(a.distanceToSquared(b),b.distanceToSquared(c),c.distanceToSquared(a));
  if(longest>1.1&&depth<3){
   const ab=a.clone().add(b).multiplyScalar(.5),bc=b.clone().add(c).multiplyScalar(.5),ca=c.clone().add(a).multiplyScalar(.5);
   patch(a,ab,ca,normal,surface,depth+1);patch(ab,b,bc,normal,surface,depth+1);patch(ca,bc,c,normal,surface,depth+1);patch(ab,bc,ca,normal,surface,depth+1);return;
  }
  const poly=clip([a,b,c],surface);if(poly.length<3)return;
  const supported=[];for(let i=1;i<poly.length-1;i++)supportedTriangles(poly[0],poly[i],poly[i+1],surface,supported);
  for(const vertices of supported){
   const stored=vertices.map(v=>new THREE.Vector3(Math.fround(v.x),Math.fround(v.y+.001),Math.fround(v.z)));
   if(new THREE.Triangle(...stored).getArea()<1e-10)continue;
   for(let j=0;j<3;j++){const v=vertices[j];
   // Intersections lie on the final triangle: never project an arbitrary plane over a cliff.
   // A single offset direction keeps the shared edges sewn. Independent
   // per-face normal offsets opened hairline cracks between grass triangles.
   // Keep thickness below narrow rock lips; polygonOffset handles depth ties.
   const rendered=stored[j];
   positions.push(rendered.x,rendered.y,rendered.z);
   // Interpolate at the actual stored position. Long, thin source triangles
   // amplify Float32 rounding if normals are calculated before quantization.
   const bary=THREE.Triangle.getBarycoord(rendered.clone().add(new THREE.Vector3(0,-.001,0)),surface.a,surface.b,surface.c,new THREE.Vector3());
   const smooth=surface.normals[0].clone().multiplyScalar(bary.x).addScaledVector(surface.normals[1],bary.y).addScaledVector(surface.normals[2],bary.z).normalize();
   turfNormals.push(smooth.x,smooth.y,smooth.z);
   turfCoverage.push(THREE.MathUtils.clamp(Math.min((edgeDistance(v,surface.component)-habitatInset)/habitatFade,field(v)/.40,(v.y+h*.24)/.18),0,1));
   const tint=turfLight.clone().lerp(turfDark,.34+.16*Math.sin(v.x*.16+v.z*.12+seed));
   colors.push(tint.r,tint.g,tint.b);
   }
  }
 }
 for(let i=0;i<(index?index.count:p.count);i+=3){
  const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j);
  [tri.a,tri.b,tri.c].forEach((v,j)=>v.fromBufferAttribute(p,ids[j]));tri.getNormal(n);tri.getMidpoint(center);
  const component=habitat.faceComponents[i/3];
  if(component<0||Math.max(tri.a.y,tri.b.y,tri.c.y)<-h*.24)continue;
  faces.push({a:tri.a.clone(),b:tri.b.clone(),c:tri.c.clone(),n:n.clone(),id:i/3,component});
  const surface={a:tri.a.clone(),b:tri.b.clone(),c:tri.c.clone(),normals:ids.map(normalAt),component};
  // Subdivide the final supported surface BEFORE evaluating habitat distances.
  // No original-triangle vertex slope cut: that created long triangular turf edges.
  collectPatch(tri.a.clone(),tri.b.clone(),tri.c.clone(),n,surface);
 }
 // Coastal scrub grows in pockets, leaving exposed mineral between them.
 // An area-weighted threshold avoids both an unbroken grass cap and seed-
 // dependent empty habitats; the final boundary still follows one smooth field.
 const eligiblePatches=patches.filter(p=>{const c=p.a.clone().add(p.b).add(p.c).multiplyScalar(1/3);return edgeDistance(c,p.surface.component)>habitatInset&&c.y> -h*.24;}),eligibleArea=eligiblePatches.reduce((sum,p)=>sum+p.area,0),bareFraction=.48+.04*Math.sin(seed*1.31);
 let accumulated=0;for(const candidate of [...eligiblePatches].sort((a,b)=>a.value-b.value)){
  accumulated+=candidate.area;habitatCut=candidate.value;if(accumulated>=eligibleArea*bareFraction)break;
 }
 for(const p of patches)patch(p.a,p.b,p.c,p.normal,p.surface,3);
 function sample(x,z){
  let best=null;
  for(const f of faces){
   const {a,b,c}=f,den=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);if(Math.abs(den)<1e-9)continue;
   const u=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/den,v=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/den,w=1-u-v;
   if(u<0||v<0||w<0)continue;
   const y=u*a.y+v*b.y+w*c.y;if(!best||y>best.p.y)best={p:new THREE.Vector3(x,y,z),normal:f.n,triangle:f.id,component:f.component,barycentric:[u,v,w]};
  }
  return best;
 }
 g.computeBoundingBox();const box=g.boundingBox;
 for(let x=box.min.x+.2;x<box.max.x-.2;x+=.92)for(let z=box.min.z+.2;z<box.max.z-.2;z+=.92){
  const hit=sample(x+(random()-.5)*.55,z+(random()-.5)*.55);if(!hit||hit.p.y< -h*.24||hit.normal.y<.84||signedHabitat(hit.p,hit.component)<.025)continue;
  const sparse=random();if(sparse>.52)continue;
  const atEdge=signedHabitat(hit.p,hit.component)<.18||field(hit.p)<.38||sparse>.22||hit.normal.y<.92;
  const supportRadius=atEdge?.16:.60;
  const edgeSamples=[[supportRadius,0],[-supportRadius,0],[0,supportRadius],[0,-supportRadius]].map(([dx,dz])=>sample(hit.p.x+dx,hit.p.z+dz));
  const safe=edgeSamples.every(q=>q&&q.component===hit.component&&Math.abs(q.p.y-hit.p.y)<.32&&signedHabitat(q.p,q.component)>.015);
  if(!safe)continue;
  const r=hit.p.toArray();roots.push(r);
  if(atEdge)fringe.push({hit,size:.30+random()*.36});
  else clumps.push({hit,size:.56+random()**2*.86,angle:random()*Math.PI*2});
 }
 const turfGeometry=new THREE.BufferGeometry();turfGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));turfGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));turfGeometry.setAttribute('normal',new THREE.Float32BufferAttribute(turfNormals,3));
 turfGeometry.setAttribute('coastalCoverage',new THREE.Float32BufferAttribute(turfCoverage,1));
 const turf=new THREE.Mesh(turfGeometry,createCoastalMaterial({kind:'turf',vertexColors:true,height:h,transparent:true,depthWrite:false,alphaTest:.015}));turf.material.polygonOffset=true;turf.material.polygonOffsetFactor=-2;turf.material.polygonOffsetUnits=-2;turf.name='sea-stack-terrace-turf';rock.add(turf);bindCoastalMesh(turf,rock);
 const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0),canopyRoots=[];
 const shrubs=new THREE.InstancedMesh(createCoastalScrubGeometry(),createCoastalMaterial({kind:'scrub',color:0xffffff,vertexColors:true,height:h}),clumps.length*5);shrubs.name='sea-stack-terrace-shrubs';
 clumps.forEach(({hit,size,angle},i)=>{
  for(let j=0;j<5;j++){
   const a=angle+j*2.399,offset=j?size*.32:0;
   const candidate=sample(hit.p.x+Math.cos(a)*offset,hit.p.z+Math.sin(a)*offset);
   const rooted=candidate&&candidate.component===hit.component&&signedHabitat(candidate.p,candidate.component)>.025?candidate:hit;
   const ySize=size*(j===0?.42:.25),base=rooted.p.clone();
   // Low, overlapping wind-clipped lobes; avoid a row of equally round balls.
   // Scrub branch origin is local y=-.88: seat that actual vertex, not
   // the old ellipsoid center. Each lobe follows its own supporting face.
   q.setFromUnitVectors(up,rooted.normal);
   matrix.compose(base.clone().addScaledVector(rooted.normal,ySize*.88-.005),q,new THREE.Vector3(size*(j===0?.76:.48),ySize,size*(j%2?.46:.59)));
   shrubs.setMatrixAt(i*5+j,matrix);shrubs.setColorAt(i*5+j,new THREE.Color([0xd3e0bc,0xe3e6c7,0xb9d3bf][(i+j)%3]));canopyRoots.push(base.toArray());
  }
 });
 shrubs.userData.roots=canopyRoots;shrubs.userData.surfaceRevision=revision;rock.add(shrubs);bindCoastalMesh(shrubs,rock);
 const blades=[];for(let j=0;j<5;j++){
  const a=j*2.399,dx=Math.cos(a),dz=Math.sin(a),length=.52+(j%3)*.13,width=.047;
  blades.push(-dz*width,0,dx*width,dz*width,0,-dx*width,dx*.23,length,dz*.23);
 }
 const bladeGeometry=new THREE.BufferGeometry();bladeGeometry.setAttribute('position',new THREE.Float32BufferAttribute(blades,3));bladeGeometry.computeVertexNormals();
 // A blade tuft can straddle a final-face fold even when its center is valid.
 // Keep only tufts whose ten actual Float32 base-edge endpoints all retain
 // the same 3mm contact depth; do not lift or globally bury the other tufts.
 const bladePosition=bladeGeometry.attributes.position;let rejectedGrassContacts=0;
 for(let i=fringe.length-1;i>=0;i--){const {hit,size}=fringe[i];q.setFromUnitVectors(up,hit.normal);matrix.compose(hit.p.clone().addScaledVector(hit.normal,-.003),q,new THREE.Vector3(size,size,size));matrix.elements=matrix.elements.map(Math.fround);let supported=true;
  for(let blade=0;blade<5&&supported;blade++)for(let end=0;end<2;end++){const point=new THREE.Vector3().fromBufferAttribute(bladePosition,blade*3+end).applyMatrix4(matrix),support=sample(point.x,point.z);if(!support||support.component!==hit.component||Math.abs(point.clone().sub(support.p).dot(support.normal)+.003)>4e-5){supported=false;break;}}
  if(!supported){fringe.splice(i,1);rejectedGrassContacts++;const root=roots.findIndex(r=>r[0]===hit.p.x&&r[1]===hit.p.y&&r[2]===hit.p.z);if(root>=0)roots.splice(root,1);}
 }
 const grass=new THREE.InstancedMesh(bladeGeometry,createCoastalMaterial({kind:'grass',color:0x96a57a,side:THREE.DoubleSide,height:h}),fringe.length);grass.name='sea-stack-coastal-grass';
 fringe.forEach(({hit,size},i)=>{q.setFromUnitVectors(up,hit.normal);matrix.compose(hit.p.clone().addScaledVector(hit.normal,-.003),q,new THREE.Vector3(size,size,size));grass.setMatrixAt(i,matrix);});
 grass.userData.roots=fringe.map(f=>f.hit.p.toArray());grass.userData.surfaceRevision=revision;rock.add(grass);bindCoastalMesh(grass,rock);
 turf.userData.surfaceRevision=revision;
 turf.userData.planting={triangles:positions.length/9,clusters:clumps.length,grassTufts:fringe.length,rejectedGrassContacts,seed,surfaceRevision:revision,method:'component-boundary-distance-on-subdivided-final-surface',habitat:{...habitat.audit,inset:habitatInset,fade:habitatFade,distance:'3D Euclidean segment distance within same edge-connected component',triangleSafety:'centroid distance minus triangle radius certifies entire triangle via 1-Lipschitz bound',boundaryRefineRadius:.01,safetyMargin:.00001,queryCap:habitatInset+habitatFade+.05},rootCount:roots.length,habitatCut,eligibleArea,targetBareFraction:bareFraction,turfOffset:[0,.001,0]};
 rock.userData.vegetationAudit={habitat:turf.userData.planting.habitat,surfaceRevision:revision,roots:roots.length,shrubCanopies:canopyRoots.length,patchTriangles:positions.length/9,rootConstruction:'barycentric-final-surface; independently ray-checked in pipeline'};
 return roots;
}

// Project-authored surface dressing: coherent turf patches, then low scrub.
// Surface occupancy comes from actual cliff triangles, not independent sky points.
function plantSeaStackTerracesLegacy(rock) {
 const g=rock.geometry,p=g.attributes.position,index=g.index,h=rock.userData.seaStack.height;
 const seed=g.userData.terraces.seed,positions=[],colors=[],roots=[],sizes=[];
 const tri=new THREE.Triangle(),normal=new THREE.Vector3(),center=new THREE.Vector3();
 const dark=new THREE.Color(0x50654d),light=new THREE.Color(0x899771);
 let state=(seed+9173)>>>0;
 const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 for(let i=0;i<(index?index.count:p.count);i+=3){
  [tri.a,tri.b,tri.c].forEach((v,j)=>v.fromBufferAttribute(p,index?index.getX(i+j):i+j));
  tri.getNormal(normal);tri.getMidpoint(center);
  if(normal.y<.86||center.y< -h*.24)continue;
  // Low-frequency field makes broad connected green regions and bare rock gaps.
  const field=Math.sin(center.x*.34+seed*1.7)+.65*Math.cos(center.z*.39-seed)+.35*Math.sin((center.x+center.z)*.61);
  if(field<-.55)continue;
  const tint=light.clone().lerp(dark,THREE.MathUtils.clamp(.28+(1-normal.y)*2+.15*Math.sin(center.x*.18+seed),0,1));
  for(const v of [tri.a,tri.b,tri.c]){positions.push(v.x,v.y+.045,v.z);colors.push(tint.r,tint.g,tint.b);}
  // Sparse wind-clipped scrub emerges only within the accepted turf area.
  const safe=2*tri.getArea()/(3*Math.max(tri.a.distanceTo(tri.b),tri.b.distanceTo(tri.c),tri.c.distanceTo(tri.a)));
  if(safe<.22||random()>.20||roots.some(r=>new THREE.Vector3(...r).distanceToSquared(center)<3.2))continue;
  roots.push(center.toArray());sizes.push(Math.min(.78,safe*.9));
 }
 const turfGeometry=new THREE.BufferGeometry();
 turfGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 turfGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));turfGeometry.computeVertexNormals();
 const turf=new THREE.Mesh(turfGeometry,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.FrontSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));
 turf.name='sea-stack-terrace-turf';rock.add(turf);
 const geo=new THREE.IcosahedronGeometry(1,0),mat=new THREE.MeshBasicMaterial({color:0xffffff});
 const shrubs=new THREE.InstancedMesh(geo,mat,roots.length*3),matrix=new THREE.Matrix4(),q=new THREE.Quaternion();
 shrubs.name='sea-stack-terrace-shrubs';
 roots.forEach((r,i)=>{const size=sizes[i];for(let j=0;j<3;j++){
  const a=j*Math.PI*2/3+seed,offset=size*.18;
  matrix.compose(new THREE.Vector3(r[0]+Math.cos(a)*offset,r[1]+size*.17+.045,r[2]+Math.sin(a)*offset),q,new THREE.Vector3(size*.58,size*(j===0?.30:.21),size*.53));
  shrubs.setMatrixAt(i*3+j,matrix);shrubs.setColorAt(i*3+j,new THREE.Color([0x4e674e,0x627b58,0x78895f][(i+j)%3]));
 }});
 shrubs.userData.roots=roots;rock.add(shrubs);
 // Tiny tapered fans soften patch silhouettes. Every fan shares a supported root.
 const blades=[];for(let j=0;j<5;j++){const a=j*2.399,dx=Math.cos(a),dz=Math.sin(a),length=.5+(j%3)*.15,width=.055;
  blades.push(-dz*width,0,dx*width,dz*width,0,-dx*width,dx*.15,length,dz*.15);
 }
 const bladeGeometry=new THREE.BufferGeometry();bladeGeometry.setAttribute('position',new THREE.Float32BufferAttribute(blades,3));
 const grass=new THREE.InstancedMesh(bladeGeometry,new THREE.MeshBasicMaterial({color:0x8d9b70,side:THREE.DoubleSide}),roots.length);
 grass.name='sea-stack-coastal-grass';
 roots.forEach((r,i)=>{const size=sizes[i];q.setFromAxisAngle(new THREE.Vector3(0,1,0),i*2.399+seed);matrix.compose(new THREE.Vector3(...r).add(new THREE.Vector3(0,.045,0)),q,new THREE.Vector3(size,size*.7,size));grass.setMatrixAt(i,matrix);});
 grass.userData.roots=roots;rock.add(grass);
 turf.userData.planting={triangles:positions.length/9,clusters:roots.length,seed,method:'surface-masked-turf-and-clustered-scrub'};
 return roots;
}

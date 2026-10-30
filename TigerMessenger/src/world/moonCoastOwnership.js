import * as T from 'three';
import {worldToFlatXZ} from './hills.js';
import {flatToWorld} from './sphereMath.js';

export const MOON_COAST_WINDOW=Object.freeze({minAngle:20,maxAngle:70,innerRadius:64,outerRadius:78,edgeFadeDegrees:12});
const smooth=u=>{u=Math.max(0,Math.min(1,u));return u*u*(3-2*u);};
export function moonCoastOwns(x,z,{shellLimit=109,protectedSites=[]}={}){
 const radius=Math.hypot(x,z),angle=Math.atan2(z,x)*180/Math.PI;
 if(angle<=20||angle>=70||radius>shellLimit)return false;
 if(radius<=64)return false;
 return !protectedSites.some(p=>Math.hypot(x-p.x,z-p.z)<=p.r);
}

/** R4 real curved bank over the ORIGINAL island radius72, and a finite clearing
 * mask covering only the actual old square shell footprint in this city-facing sector.
 * Old terrain positions stay intact; the owned local patch has real curved triangles.
 */
export function installMoonCoastOwnership({platforms=[],hills,trackCurves=[],colliders=[],R=160}={}){
 if(hills?.moonCoastOwnership)return hills.moonCoastOwnership;
 if(!hills?.mesh||!hills?.skirt)return null;
 const shells=platforms.filter(p=>p.mesh?.userData?.authoredMainIslandShell);
 if(!shells.length)return hills.moonCoastOwnership={revision:'moon-coast-r4d-20261025',status:'main-shell-not-found'};
 const protectedSites=[],protect=(position,radius)=>{if(Math.abs(position.length()-(R+.6))>3)return;const f=worldToFlatXZ(position,R);if(!f)return;const a=Math.atan2(f.z,f.x)*180/Math.PI,r=Math.hypot(f.x,f.z);if(a<17||a>73||r<61||r>112)return;if(protectedSites.some(p=>Math.hypot(f.x-p.x,f.z-p.z)<Math.min(p.r,radius)*.75))return;protectedSites.push({x:f.x,z:f.z,r:radius});};
 for(const curve of trackCurves.filter(Boolean))for(const p of curve.getSpacedPoints(1200))protect(p,2.6);
 for(const c of colliders)if(c?.position)protect(c.position,Math.max(1.3,(c.radius??.6)+.7));
 let shellLimit=0;for(const p of shells){p.mesh.updateWorldMatrix(true,false);const a=p.mesh.geometry.attributes.position;for(let i=0;i<a.count;i++){const v=new T.Vector3().fromBufferAttribute(a,i).applyMatrix4(p.mesh.matrixWorld),f=worldToFlatXZ(v,R);if(f)shellLimit=Math.max(shellLimit,Math.hypot(f.x,f.z));}}shellLimit+=.2;
 const mask={shellLimit,protectedSites},report={revision:'moon-coast-r4d-20261025',status:'preparing',window:MOON_COAST_WINDOW,shellLimit,protectedSites,terrainEdited:true,globalSeaEdited:false,raySamples:0,triangleQueries:0,rayMisses:0};
 const originalGround=[hills.mesh,hills.skirt];originalGround.forEach(m=>m.updateWorldMatrix(true,false));
 // Source bank heights are sampled only once during construction, from actual
 // source triangles. Runtime support uses the small spatial index below.
 const constructionRay=new T.Raycaster(),point=new T.Vector3(),dir=new T.Vector3(),sourceGround=[...originalGround,...shells.map(p=>p.mesh)];
 const sourceSurface=(x,z)=>{const world=flatToWorld(x,20,z,R,point);dir.copy(world).normalize();constructionRay.set(world,dir.clone().negate());constructionRay.far=45;const hit=constructionRay.intersectObjects(sourceGround,false)[0];if(!hit)return{h:-.3,normal:dir.clone(),color:new T.Color(0x6f9c91)};
  const object=hit.object,normal=(hit.normal??dir).clone().applyNormalMatrix(new T.Matrix3().getNormalMatrix(object.matrixWorld)),color=(object.material.color??new T.Color(0xffffff)).clone(),attr=object.geometry.attributes.color;
  if(attr&&hit.face){const p=object.geometry.attributes.position,f=hit.face,q=object.worldToLocal(hit.point.clone()),weights=new T.Vector3();T.Triangle.getBarycoord(q,new T.Vector3().fromBufferAttribute(p,f.a),new T.Vector3().fromBufferAttribute(p,f.b),new T.Vector3().fromBufferAttribute(p,f.c),weights);const c=new T.Color().setRGB(0,0,0);for(const[i,w]of[[f.a,weights.x],[f.b,weights.y],[f.c,weights.z]]){c.r+=attr.getX(i)*w;c.g+=attr.getY(i)*w;c.b+=attr.getZ(i)*w;}color.multiply(c);}
  return{h:hit.point.length()-R,normal,color};};
 const angles=108,rings=32,positions=[],colours=[],indices=[],sourceNormals=[],normalWeights=[],grass=new T.Color(0x55875f),sand=new T.Color(0xa6a382),wet=new T.Color(0x6f9c91),color=new T.Color();
 for(let j=0;j<=angles;j++){const angle=20+50*j/angles,a=angle*Math.PI/180,angleBlend=smooth(Math.min((angle-20)/MOON_COAST_WINDOW.edgeFadeDegrees,(70-angle)/MOON_COAST_WINDOW.edgeFadeDegrees));
  for(let i=0;i<=rings;i++){const radius=63.3+(78+(shellLimit-78)*(1-angleBlend)-63.3)*i/rings,x=radius*Math.cos(a),z=radius*Math.sin(a),source=sourceSurface(x,z),old=source.h;
   const dry=.6+Math.max(0,old-.6)*(1-smooth((radius-64)/6)),target=radius<=71?dry:.6-.85*smooth((radius-71)/7);
   let blend=angleBlend*smooth((radius-64)/1.5);for(const p of protectedSites)blend*=smooth((Math.hypot(x-p.x,z-p.z)-p.r)/1.8);
   const h=old+(target-old)*blend+.006,w=flatToWorld(x,h,z,R,new T.Vector3());positions.push(w.x,w.y,w.z);
   color.copy(grass).lerp(sand,smooth((radius-70.4)/2)).lerp(wet,smooth((radius-73)/3));color.lerp(source.color,1-blend);colours.push(color.r,color.g,color.b);sourceNormals.push(source.normal);normalWeights.push(blend);
  }
 }
 for(let j=0;j<angles;j++)for(let i=0;i<rings;i++){const a=j*(rings+1)+i,b=a+rings+1;indices.push(a,b,a+1,b,b+1,a+1);}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('color',new T.Float32BufferAttribute(colours,3));geo.setIndex(indices);geo.computeVertexNormals();const normals=geo.attributes.normal,n=new T.Vector3();for(let i=0;i<normals.count;i++){n.fromBufferAttribute(normals,i).lerp(sourceNormals[i],1-normalWeights[i]).normalize();normals.setXYZ(i,n.x,n.y,n.z);}geo.computeBoundingSphere();
 const bank=new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,roughness:1,side:T.DoubleSide}));bank.name='moon-city-facing-rounded-coast';bank.receiveShadow=true;bank.castShadow=true;hills.mesh.parent?.add(bank);
 const protectedCode=protectedSites.map(p=>`if(distance(q,vec2(${p.x.toFixed(6)},${p.z.toFixed(6)}))<=${p.r.toFixed(6)})return false;`).join('');
 const maskGLSL=`bool moonCoastOwned(vec2 q){float r=length(q),a=degrees(atan(q.y,q.x));if(a<=20.0||a>=70.0||r>${shellLimit.toFixed(6)})return false;if(r<=64.0)return false;${protectedCode}return true;}`;
 const compileMask=(base,keepOwned)=>shader=>{base?.(shader);shader.vertexShader='varying vec3 moonCoastWorld;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\n moonCoastWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');shader.fragmentShader='varying vec3 moonCoastWorld;\n'+maskGLSL+'\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>\n vec3 md=normalize(moonCoastWorld);float ma=acos(clamp(md.y,-1.0,1.0));vec2 mq=md.xz*(ma*${R.toFixed(6)}/max(.000001,length(md.xz)));if(${keepOwned?'!':''}moonCoastOwned(mq))discard;`);};
 const materialMask=(mesh,keepOwned=false)=>{const old=mesh.material,m=old.clone();m.onBeforeCompile=compileMask(old.onBeforeCompile.bind(old),keepOwned);m.customProgramCacheKey=()=>`moon-coast-r4d:${keepOwned}:${JSON.stringify(mask)}`;m.userData.shared=false;mesh.material=m;
  const depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,side:T.DoubleSide}),distance=new T.MeshDistanceMaterial({side:T.DoubleSide});for(const sm of[depth,distance]){sm.onBeforeCompile=compileMask(null,keepOwned);sm.customProgramCacheKey=m.customProgramCacheKey;}mesh.customDepthMaterial=depth;mesh.customDistanceMaterial=distance;
 };
 for(const p of shells){materialMask(p.mesh);p.mat=p.mesh.material;}originalGround.forEach(m=>materialMask(m));materialMask(bank,true);
 // Exact geometry rays with a one-time 3m angular triangle index and bounded cache.
 const ray=new T.Ray(),bins=new Map(),triangles=[],cache=new Map(),step=3;
 for(const mesh of[...originalGround,bank]){mesh.updateWorldMatrix(true,false);const g=mesh.geometry,p=g.attributes.position,ix=g.index;for(let k=0;k<(ix?.count??p.count);k+=3){const vertices=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,ix?ix.getX(k+j):k+j).applyMatrix4(mesh.matrixWorld)),flat=vertices.map(v=>worldToFlatXZ(v,R));if(flat.some(f=>!f))continue;const minX=Math.min(...flat.map(f=>f.x)),maxX=Math.max(...flat.map(f=>f.x)),minZ=Math.min(...flat.map(f=>f.z)),maxZ=Math.max(...flat.map(f=>f.z));if(maxX<17||maxZ<17)continue;const n=triangles.push({vertices,owned:mesh===bank})-1;for(let x=Math.floor((minX-.1)/step);x<=Math.floor((maxX+.1)/step);x++)for(let z=Math.floor((minZ-.1)/step);z<=Math.floor((maxZ+.1)/step);z++){const key=x+','+z;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(n);}}}
 const sample=position=>{report.raySamples++;const f=worldToFlatXZ(position,R),key=f.x.toFixed(4)+','+f.z.toFixed(4);if(cache.has(key))return cache.get(key);dir.copy(position).normalize();ray.set(dir.clone().multiplyScalar(R+20),dir.clone().negate());let radius=-Infinity;const hit=new T.Vector3();for(const i of bins.get(Math.floor(f.x/step)+','+Math.floor(f.z/step))??[]){const t=triangles[i];if(!t.owned)continue;report.triangleQueries++;if(ray.intersectTriangle(...t.vertices,false,hit))radius=Math.max(radius,hit.length());}if(radius===-Infinity)report.rayMisses++;if(cache.size>4096)cache.clear();cache.set(key,radius);return radius;};
 const owns=position=>{const f=worldToFlatXZ(position,R);return f&&moonCoastOwns(f.x,f.z,mask);};
 const oldSample=hills.sampleRadius;hills.sampleRadius=position=>owns(position)?sample(position):oldSample?.(position);
 for(const p of shells){const prior=p.topHeightAt.bind(p);p.topHeightAt=position=>owns(position)?sample(position):prior(position);}
 report.status='installed';report.shells=shells.map(p=>p.mesh.uuid);report.newBank={uuid:bank.uuid,vertices:geo.attributes.position.count,triangles:indices.length/3};report.indexedTriangles=triangles.length;report.shadowMasks=true;report.innerSeam='source-colour-normal;geometry overlaps clipping boundary .7m with .006m seating bias';report.endpointFeather='12deg original-surface collar; main curved bank r64..78';hills.moonCoastBank=bank;return hills.moonCoastOwnership=report;
}

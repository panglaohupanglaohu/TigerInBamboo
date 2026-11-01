import * as T from 'three';
import {groundLiftAt,ISLAND_FLAT_R,worldToFlatXZ} from './hills.js';
import {moonCoastOwns} from './moonCoastOwnership.js';

const VERSION='main-island-edge-cleanup-r1-20261026';
/** Source-proven redundant square apron only. No mountain/island-wide deletion. */
export function redundantMainIslandApron(x,z,{limit=110,protectedSites=[],coast=null}={}){
 const r=Math.hypot(x,z);
 if(r<=ISLAND_FLAT_R+.35||r>limit||Math.abs(x)>90||Math.abs(z)>90)return false;
 if(groundLiftAt(x,z)>.61)return false;
 if(coast&&moonCoastOwns(x,z,coast))return false;
 return !protectedSites.some(p=>Math.hypot(x-p.x,z-p.z)<=p.r);
}

/** Install AFTER the moon garden/R4d ownership and all actor/rail placement.
 * The same nearest-texel ownership drives visible, shadow and support queries.
 * Source geometries remain intact; dispose restores all wrapped hooks/materials.
 */
export function installMainIslandEdgeCleanup({platforms=[],hills,colliders=[],trackCurves=[],curves=trackCurves,R=160,resolution=1024}={}){
 if(hills?.mainIslandEdgeCleanup)return hills.mainIslandEdgeCleanup;
 const shells=platforms.filter(p=>p.mesh?.userData?.authoredMainIslandShell);
 if(!hills?.mesh||!shells.length)return {revision:VERSION,status:'source-not-found'};
 const protectedSites=[],protect=(pos,r)=>{if(!pos||Math.abs(pos.length()-R)>12)return;const f=worldToFlatXZ(pos,R);if(!f||Math.hypot(f.x,f.z)<ISLAND_FLAT_R-8)return;
  if(protectedSites.some(p=>Math.hypot(p.x-f.x,p.z-f.z)<.4&&p.r>=r))return;protectedSites.push({...f,r});};
 for(const c of colliders)protect(c?.position,Math.max(2,(c?.radius??.6)+1));
 for(const curve of curves.filter(c=>c?.getSpacedPoints))for(const p of curve.getSpacedPoints(1600))protect(p,3.8);
 const coast=hills.moonCoastOwnership?.status==='installed'?hills.moonCoastOwnership:null;
 let limit=0;const v=new T.Vector3();
 for(const p of shells){p.mesh.updateWorldMatrix(true,false);const a=p.mesh.geometry.attributes.position;for(let i=0;i<a.count;i++){v.fromBufferAttribute(a,i).applyMatrix4(p.mesh.matrixWorld);const f=worldToFlatXZ(v,R);if(f)limit=Math.max(limit,Math.hypot(f.x,f.z));}}
 limit+=.3;const extent=Math.min(112,limit+1),size=Math.max(128,Math.min(2048,Math.round(resolution))),data=new Uint8Array(size*size),options={limit,protectedSites,coast};let cleared=0;
 // Bucket protection sites to avoid a per-pixel scan of thousands of rail samples.
 const bins=new Map(),step=8;for(const p of protectedSites)for(let x=Math.floor((p.x-p.r)/step);x<=Math.floor((p.x+p.r)/step);x++)for(let z=Math.floor((p.z-p.r)/step);z<=Math.floor((p.z+p.r)/step);z++){const k=x+','+z;if(!bins.has(k))bins.set(k,[]);bins.get(k).push(p);}
 for(let j=0;j<size;j++)for(let i=0;i<size;i++){const x=((i+.5)/size*2-1)*extent,z=((j+.5)/size*2-1)*extent;
  if(redundantMainIslandApron(x,z,{...options,protectedSites:bins.get(Math.floor(x/step)+','+Math.floor(z/step))??[]})){data[j*size+i]=255;cleared++;}}
 const texture=new T.DataTexture(data,size,size,T.RedFormat,T.UnsignedByteType);texture.minFilter=texture.magFilter=T.NearestFilter;texture.generateMipmaps=false;texture.needsUpdate=true;
 const owns=position=>{const f=worldToFlatXZ(position,R);if(!f||Math.abs(f.x)>=extent||Math.abs(f.z)>=extent)return false;
  const i=Math.floor((f.x/extent+1)*.5*size),j=Math.floor((f.z/extent+1)*.5*size);return data[j*size+i]===255;};
 const undo=[],compile=base=>shader=>{base?.(shader);shader.uniforms.mainApronMask={value:texture};shader.vertexShader='varying vec3 apronWorld;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\n apronWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
  shader.fragmentShader='uniform sampler2D mainApronMask;varying vec3 apronWorld;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
   float ar=length(apronWorld);vec3 ad=apronWorld/ar;
   if(ad.y>.64 && ar>${(R-2).toFixed(6)} && ar<${(R+1.2).toFixed(6)}){
    vec2 af=ad.xz*(acos(clamp(ad.y,-1.,1.))*${R.toFixed(6)}/max(.000001,length(ad.xz)));
    vec2 au=(af/${extent.toFixed(6)}+1.)*.5;
    if(all(greaterThanEqual(au,vec2(0.)))&&all(lessThan(au,vec2(1.)))&&texture2D(mainApronMask,au).r>.5)discard;
   }`);};
 for(const mesh of [...shells.map(p=>p.mesh),hills.mesh,hills.skirt].filter(Boolean)){
  const original={material:mesh.material,customDepthMaterial:mesh.customDepthMaterial,customDistanceMaterial:mesh.customDistanceMaterial},made=[];
  const wrap=base=>{const m=base.clone();m.onBeforeCompile=compile(base.onBeforeCompile?.bind(base));m.customProgramCacheKey=()=>VERSION+':'+(base.customProgramCacheKey?.()??'');made.push(m);return m;};
  mesh.material=Array.isArray(original.material)?original.material.map(wrap):wrap(original.material);
  const depth=original.customDepthMaterial??new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,side:T.DoubleSide}),distance=original.customDistanceMaterial??new T.MeshDistanceMaterial({side:T.DoubleSide});
  mesh.customDepthMaterial=wrap(depth);mesh.customDistanceMaterial=wrap(distance);if(!original.customDepthMaterial)depth.dispose();if(!original.customDistanceMaterial)distance.dispose();
  undo.push(()=>{Object.assign(mesh,original);made.forEach(m=>m.dispose());});
 }
 for(const p of shells){const oldMat=p.mat,prior=p.topHeightAt;p.mat=p.mesh.material;p.topHeightAt=function(position){return owns(position)?-Infinity:prior.call(this,position);};undo.push(()=>{p.mat=oldMat;p.topHeightAt=prior;});}
 const prior=hills.sampleRadius;hills.sampleRadius=position=>owns(position)?-Infinity:prior?.(position);undo.push(()=>{hills.sampleRadius=prior;});
 const api={revision:VERSION,status:cleared?'installed':'no-redundant-apron',clearedTexels:cleared,texelMetres:extent*2/size,extent,limit,protectedSites:protectedSites.length,coastPreserved:!!coast,sourceGeometryEdited:false,waterEdited:false,shadowMasks:true,visualVerified:false,owns,
  dispose(){undo.reverse().forEach(fn=>fn());texture.dispose();delete hills.mainIslandEdgeCleanup;}};
 hills.mainIslandEdgeCleanup=api;return api;
}

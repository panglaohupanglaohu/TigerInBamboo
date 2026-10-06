import {resolveMountainParams} from './mountainRelease.js';
import * as THREE from 'three';

// Local final-terrain receiver approximation. Retains StandardMaterial's real
// lights; does not claim volumetric GI, cave visibility or character shadows.
const fields=new WeakMap(),bindings=new WeakMap();
const clamp=THREE.MathUtils.clamp;
export function mountainLightOptions(search=globalThis.location?.search||''){
 const q=resolveMountainParams(search).params;
 const palette=q.get('citadelMountainPalette');
 return {light:q.get('citadelMountainLightPass')==='1',occlusion:q.get('citadelMountainOcclusion')!=='0',palette:palette==='3'?3:palette==='2'?2:palette==='1'?1:0,resolution:128};
}
function sourceData(castle,surfaces){
 castle.updateWorldMatrix(true,true);const inverse=castle.matrixWorld.clone().invert();let hash=2166136261;
 const feed=array=>{for(const b of new Uint8Array(array.buffer,array.byteOffset,array.byteLength))hash=Math.imul(hash^b,16777619);};
 const rows=surfaces.map(mesh=>{const matrix=inverse.clone().multiply(mesh.matrixWorld),g=mesh.geometry;
  feed(g.attributes.position.array);if(g.index)feed(g.index.array);feed(new Float64Array(matrix.elements));
  return {mesh,matrix};});
 return {rows,revision:`mountain-field-${(hash>>>0).toString(16)}`};
}
export function prepareMountainLightField(castle,surfaces,{resolution=128}={}){
 resolution=resolution===192?192:128;const {rows,revision}=sourceData(castle,surfaces),old=fields.get(castle);
 if(old?.revision===revision&&old.resolution===resolution&&!old.disposed)return old;
 const bounds=new THREE.Box3(),v=new THREE.Vector3();
 for(const {mesh,matrix}of rows){const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++)bounds.expandByPoint(v.fromBufferAttribute(p,i).applyMatrix4(matrix));}
 if(bounds.isEmpty())return null;
 const minX=bounds.min.x-1,minZ=bounds.min.z-1,width=Math.max(1,bounds.max.x-bounds.min.x+2),depth=Math.max(1,bounds.max.z-bounds.min.z+2),minY=bounds.min.y-1,range=Math.max(1,bounds.max.y-minY+1);
 const heights=new Float32Array(resolution*resolution).fill(-Infinity),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();let triangles=0;
 for(const {mesh,matrix}of rows){const p=mesh.geometry.attributes.position,idx=mesh.geometry.index;
  for(let i=0;i<(idx?.count??p.count);i+=3){[a,b,c].forEach((v,k)=>v.fromBufferAttribute(p,idx?idx.getX(i+k):i+k).applyMatrix4(matrix));
   const det=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);if(Math.abs(det)<1e-10)continue;
   const x0=clamp(Math.floor((Math.min(a.x,b.x,c.x)-minX)/width*resolution-.5),0,resolution-1),x1=clamp(Math.ceil((Math.max(a.x,b.x,c.x)-minX)/width*resolution-.5),0,resolution-1);
   const z0=clamp(Math.floor((Math.min(a.z,b.z,c.z)-minZ)/depth*resolution-.5),0,resolution-1),z1=clamp(Math.ceil((Math.max(a.z,b.z,c.z)-minZ)/depth*resolution-.5),0,resolution-1);
   for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){
    const px=minX+(x+.5)/resolution*width,pz=minZ+(z+.5)/resolution*depth;
    const u=((b.z-c.z)*(px-c.x)+(c.x-b.x)*(pz-c.z))/det,w=((c.z-a.z)*(px-c.x)+(a.x-c.x)*(pz-c.z))/det;
    if(u>=-1e-7&&w>=-1e-7&&u+w<=1+1e-7)heights[z*resolution+x]=Math.max(heights[z*resolution+x],u*a.y+w*b.y+(1-u-w)*c.y);
   }triangles++;
  }
 }
 const data=new Uint8Array(resolution*resolution*4);let valid=0;
 for(let i=0;i<heights.length;i++)if(Number.isFinite(heights[i])){const h=Math.round(clamp((heights[i]-minY)/range,0,1)*65535);data[i*4]=h>>8;data[i*4+1]=h&255;data[i*4+2]=255;data[i*4+3]=255;valid++;}
 const texture=new THREE.DataTexture(data,resolution,resolution,THREE.RGBAFormat);texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;texture.name='citadel-final-mountain-height';
 old?.texture?.dispose();
 const f={castle,revision,resolution,heights,texture,minX,minZ,width,depth,minY,range,disposed:false,sun:new THREE.Vector3(0,1,0),sunPower:0,meshes:old?.meshes||new Set(),removeListener:old?.removeListener,
  audit:{revision,resolution,sourceMeshes:surfaces.length,triangles,validCells:valid,cellSize:[width/resolution,depth/resolution],method:'final-castle-frame-2.5D-top-height-receiver-occlusion',limitations:'terrain only; no canopy/character/city casters, overhangs or multi-layer visibility; aggregate directDiffuse attenuation'}};
 fields.set(castle,f);castle.userData.mountainLightField=f.audit;return f;
}
const isVisible=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
export function updateMountainLightDirection(field,scene,frame){
 if(frame!==undefined&&field.frame===frame&&field.scene===scene)return field.sun;
 let sun=null;scene.traverse(o=>{if(o.isDirectionalLight&&o.intensity>0&&isVisible(o)&&(!sun||(o.castShadow?10:0)+o.intensity>(sun.castShadow?10:0)+sun.intensity))sun=o;});
 field.castle.updateWorldMatrix(true,false);const inverse=field.castle.matrixWorld.clone().invert();
 const worldDirection=new THREE.Vector3(0,1,0);
 if(sun){sun.updateWorldMatrix(true,false);sun.target.updateWorldMatrix(true,false);worldDirection.subVectors(sun.getWorldPosition(new THREE.Vector3()),sun.target.getWorldPosition(new THREE.Vector3())).normalize();}
 field.sun.copy(worldDirection).transformDirection(inverse);field.sunPower=sun?.intensity||0;field.frame=frame;field.scene=scene;
 Object.assign(field.audit,{sunSource:sun?.name||sun?.uuid||'none',sunWorldDirection:worldDirection.toArray(),sunLocalDirection:field.sun.toArray(),sunIntensity:field.sunPower});return field.sun;
}
export function sampleMountainHeight(f,x,z){
 const u=(x-f.minX)/f.width,v=(z-f.minZ)/f.depth;if(u<0||u>1||v<0||v>1)return -Infinity;
 const fx=u*f.resolution-.5,fz=v*f.resolution-.5,ix=Math.floor(fx),iz=Math.floor(fz);let value=0,valid=0;
 for(let dz=0;dz<2;dz++)for(let dx=0;dx<2;dx++){
  const w=(dx?fx-ix:1-fx+ix)*(dz?fz-iz:1-fz+iz),h=f.heights[clamp(iz+dz,0,f.resolution-1)*f.resolution+clamp(ix+dx,0,f.resolution-1)];
  value+=w*(Number.isFinite(h)?h:f.minY);if(Number.isFinite(h))valid+=w;
 }return valid<.95?-Infinity:value;
}
export function sampleMountainOcclusion(f,p,sun=f.sun){
 const cell=Math.max(f.width,f.depth)/f.resolution;let ao=0,blocked=0;
 for(const [x,z]of [[1,0],[-1,0],[0,1],[0,-1]])ao+=clamp((sampleMountainHeight(f,p.x+x*cell*2,p.z+z*cell*2)-p.y-cell*.7)/(cell*3+1),0,1);
 if(sun.y>-.05)for(let k=1;k<=8;k++){const d=cell*(1.5+k*1.5),q=p.clone().addScaledVector(sun,d);blocked=Math.max(blocked,THREE.MathUtils.smoothstep(sampleMountainHeight(f,q.x,q.z)-q.y,cell*.9,cell*2.2));}
 return {ao:1-ao*.065,direct:1-blocked*.24};
}
const fragment=/* glsl */`
varying vec3 mlfP;uniform sampler2D mlfMap;uniform vec4 mlfRect;uniform vec2 mlfRange;
uniform vec3 mlfSun;uniform float mlfCell,mlfActive,mlfSunPower;
float mlfHeight(vec2 p){vec2 uv=(p-mlfRect.xy)/mlfRect.zw;
 if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))return -10000.;
 vec4 h=texture2D(mlfMap,uv);if(h.b<.95)return -10000.;return mlfRange.x+(h.r*65280.+h.g*255.)/65535.*mlfRange.y;}
float mlfAO(vec3 p){float s=0.;float d=mlfCell*2.;
 s+=clamp((mlfHeight(p.xz+vec2(d,0.))-p.y-mlfCell*.7)/(mlfCell*3.+1.),0.,1.);
 s+=clamp((mlfHeight(p.xz-vec2(d,0.))-p.y-mlfCell*.7)/(mlfCell*3.+1.),0.,1.);
 s+=clamp((mlfHeight(p.xz+vec2(0.,d))-p.y-mlfCell*.7)/(mlfCell*3.+1.),0.,1.);
 s+=clamp((mlfHeight(p.xz-vec2(0.,d))-p.y-mlfCell*.7)/(mlfCell*3.+1.),0.,1.);return 1.-s*.065;}
float mlfVisibility(vec3 p){if(mlfSun.y<-.05||mlfSunPower<=0.)return 1.;float s=0.;
 for(int k=1;k<=8;k++){vec3 q=p+mlfSun*(mlfCell*(1.5+float(k)*1.5));s=max(s,smoothstep(mlfCell*.9,mlfCell*2.2,mlfHeight(q.xz)-q.y));}return 1.-s*.24;}
`;
function cloneReceiverMaterial(original,field,options,rock){
 const m=original.clone(),oldCompile=original.onBeforeCompile,oldKey=original.customProgramCacheKey;
 const u={mlfMap:{value:field?.texture||null},mlfRect:{value:new THREE.Vector4()},mlfRange:{value:new THREE.Vector2()},mlfSun:{value:new THREE.Vector3(0,1,0)},mlfCell:{value:1},mlfActive:{value:options.occlusion?1:0},mlfSunPower:{value:0},mlfToField:{value:new THREE.Matrix4()}};
 m.onBeforeCompile=function(shader,renderer){
  oldCompile?.call(this,shader,renderer);
  if(options.palette){
   if(rock&&shader.uniforms.mtBase){
    const colors=options.palette===3?['#b4b3ae','#858b90','#d3cfc4','#647363']:options.palette===2?['#a7a9aa','#747d83','#cec8bb','#647363']:['#929082','#696e69','#c1bda7','#637052'];
    ['mtBase','mtShade','mtChalk','mtVerdure'].forEach((name,i)=>{shader.uniforms[name].value=new THREE.Color(colors[i]);});
    // Limit only rock's procedural moss tint. Real turf/grass is a separate
    // receiver and must keep its actual coverage and green albedo layers.
    if(options.palette===2||options.palette===3){
     if(shader.uniforms.mtMossGain)shader.uniforms.mtMossGain.value=Math.min(.24,shader.uniforms.mtMossGain.value);
     else shader.fragmentShader=shader.fragmentShader.replace(/mtMoss\s*\*\s*(\d*\.\d+|\d+\.?\d*)/g,(_,amount)=>`mtMoss*${Math.min(.24,Number(amount)).toFixed(2)}`);
    }
    if(Number.isFinite(original.userData.effectiveMossGain))m.userData.effectiveMossGain=(options.palette===2||options.palette===3)?Math.min(.24,original.userData.effectiveMossGain):original.userData.effectiveMossGain;
   }
   else if(!rock)shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float mlfLuma=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(mlfLuma),${(options.palette===2||options.palette===3)?'.12)*vec3(.985,1.01,.985)':'.20)*vec3(1.025,1.,.955)'};`);
  }
  if(!options.light)return;
  Object.assign(shader.uniforms,u);
  shader.vertexShader='varying vec3 mlfP;uniform mat4 mlfToField;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
   vec4 mlfPosition=vec4(transformed,1.);
   #ifdef USE_INSTANCING
    mlfPosition=instanceMatrix*mlfPosition;
   #endif
   mlfP=(mlfToField*mlfPosition).xyz;`);
  shader.fragmentShader=fragment+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
   reflectedLight.indirectDiffuse*=mix(1.,mlfAO(mlfP),mlfActive);
   reflectedLight.directDiffuse*=mix(1.,mlfVisibility(mlfP),mlfActive);`);
 };
 m.customProgramCacheKey=()=>`${oldKey.call(original)}|mountain-field-v2-L${+options.light}-P${+options.palette}-R${+rock}`;
 m.userData.mountainLight={sourceRevision:field?.revision||null,light:options.light,palette:options.palette,occlusion:options.occlusion,rock};
 return {material:m,uniforms:u};
}
export function bindMountainLightReceiver(mesh,castle,options=mountainLightOptions(),{rock=false}={}){
 if(!options.light&&!options.palette)return false;
 const previous=bindings.get(mesh),signature=JSON.stringify({...options,rock});
 if(previous?.castle===castle&&previous.signature===signature)return true;
 if(previous)releaseReceiver(mesh);
 const originals=Array.isArray(mesh.material)?mesh.material:[mesh.material];
 if(originals.some(m=>!m.isMeshStandardMaterial))return false;
 const f=fields.get(castle);if(options.light&&!f)return false;
 const entries=originals.map(m=>cloneReceiverMaterial(m,f,options,rock));
 const binding={castle,signature,original:mesh.material,oldRender:mesh.onBeforeRender,entries};bindings.set(mesh,binding);
 mesh.material=Array.isArray(mesh.material)?entries.map(e=>e.material):entries[0].material;
 if(f)f.meshes.add(mesh);
 mesh.onBeforeRender=function(renderer,scene,camera,...args){
  binding.oldRender?.call(this,renderer,scene,camera,...args);
  if(!options.light)return;
  const current=fields.get(castle);if(!current||current.disposed)return;
  updateMountainLightDirection(current,scene,renderer.info?.render?.frame);mesh.updateWorldMatrix(true,false);
  const toField=castle.matrixWorld.clone().invert().multiply(mesh.matrixWorld);
  for(const e of entries){const u=e.uniforms;u.mlfMap.value=current.texture;u.mlfRect.value.set(current.minX,current.minZ,current.width,current.depth);u.mlfRange.value.set(current.minY,current.range);u.mlfCell.value=Math.max(current.width,current.depth)/current.resolution;u.mlfToField.value.copy(toField);u.mlfSun.value.copy(current.sun);u.mlfSunPower.value=current.sunPower;e.material.userData.mountainLight.sourceRevision=current.revision;}
 };
 mesh.userData.mountainLightRevision=f?.revision||'palette-only';return true;
}
function releaseReceiver(mesh){const b=bindings.get(mesh);if(!b)return;mesh.material=b.original;mesh.onBeforeRender=b.oldRender;for(const e of b.entries)e.material.dispose();fields.get(b.castle)?.meshes.delete(mesh);delete mesh.userData.mountainLightRevision;bindings.delete(mesh);}
export function disposeMountainLightField(castle){
 const f=fields.get(castle);if(!f)return;for(const mesh of [...f.meshes])releaseReceiver(mesh);f.texture?.dispose();f.disposed=true;
 if(f.removeListener)castle.removeEventListener('removed',f.removeListener);fields.delete(castle);delete castle.userData.mountainLightField;delete castle.userData.disposeMountainLightField;
}
export function applyMountainLightCandidate(castle,surfaces,{plantingRoot=null,cragRoot=null,options=mountainLightOptions()}={}){
 if(!options.light&&!options.palette)return null;
 let f=options.light?prepareMountainLightField(castle,surfaces,options):fields.get(castle);
 if(!f){f={castle,revision:'palette-only',meshes:new Set(),disposed:false,audit:{revision:'palette-only',method:'palette-only; no heightfield'}};fields.set(castle,f);}
 let accepted=0,skipped=0;const bind=(mesh,rock)=>{if(!mesh.isMesh)return;if(bindMountainLightReceiver(mesh,castle,options,{rock}))accepted++;else skipped++;};
 surfaces.forEach(m=>bind(m,true));cragRoot?.traverse(m=>bind(m,true));plantingRoot?.traverse(m=>bind(m,false));
 if(!f.removeListener){f.removeListener=()=>disposeMountainLightField(castle);castle.addEventListener('removed',f.removeListener);}
 castle.userData.disposeMountainLightField=()=>disposeMountainLightField(castle);
 Object.assign(f.audit,{accepted,skipped,palette:options.palette,occlusion:options.occlusion,light:options.light});castle.userData.mountainLightField=f.audit;return f.audit;
}

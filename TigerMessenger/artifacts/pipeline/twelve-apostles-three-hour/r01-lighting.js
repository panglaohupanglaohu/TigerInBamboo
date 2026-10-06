import * as THREE from 'three';

// Project approximation: final-surface 2.5D height-field occlusion, not Oskar's
// private lighting/GI. A rock and its dressing share the same immutable field.
const surfaces=new WeakMap(), materials=new WeakMap(), lightFrames=new WeakMap();
export const coastalStudyEnabled=()=>new URLSearchParams(globalThis.location?.search||'').get('seaStackStudy')!=='0';
const visible=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
const clamp=THREE.MathUtils.clamp;
const vp=new THREE.Vector3(),target=new THREE.Vector3();
function sceneLight(scene,frame){
 const cached=lightFrames.get(scene);if(frame!==undefined&&cached?.frame===frame)return cached;
 let sun=null,ambient=0,hemi=0;const sky=new THREE.Color(0),ground=new THREE.Color(0);
 scene.traverse(o=>{if(!visible(o))return;
  if(o.isDirectionalLight&&(!sun||(o.castShadow?10:0)+o.intensity>(sun.castShadow?10:0)+sun.intensity))sun=o;
  if(o.isAmbientLight){ambient+=o.intensity;sky.add(o.color.clone().multiplyScalar(o.intensity));}
  if(o.isHemisphereLight){hemi+=o.intensity;sky.add(o.color.clone().multiplyScalar(o.intensity));ground.add(o.groundColor.clone().multiplyScalar(o.intensity));}
 });
 const direction=new THREE.Vector3(0,1,0),color=new THREE.Color(0);
 if(sun){sun.getWorldPosition(vp);sun.target.getWorldPosition(target);direction.subVectors(vp,target).normalize();color.copy(sun.color);}
 const sum=ambient+hemi;if(sum>0)sky.multiplyScalar(1/sum);else sky.setHex(0x8495aa);
 if(hemi>0)ground.multiplyScalar(1/hemi);else ground.copy(sky).multiplyScalar(.78);
 const result={frame,direction,color,intensity:sun?sun.intensity:0,sky,ground,ambient:clamp(.14+ambient*.12+hemi*.19,.14,.72),source:sun?.name||sun?.uuid||'no-sun'};
 lightFrames.set(scene,result);return result;
}
function revisionFor(g){
 let hash=2166136261;const p=g.attributes.position.array;const bytes=new Uint8Array(p.buffer,p.byteOffset,p.byteLength);
 for(let i=0;i<bytes.length;i++)hash=Math.imul(hash^bytes[i],16777619);
 if(g.index)for(const n of g.index.array)hash=Math.imul(hash^n,16777619);
 return `coastal-${(hash>>>0).toString(16)}-${g.attributes.position.count}`;
}
export function prepareSeaStackSurface(rock,scene){
 const revision=revisionFor(rock.geometry),old=surfaces.get(rock);
 if(old?.revision===revision){old.scene=scene;return old.audit;}
 if(old)old.texture.dispose();
 const g=rock.geometry;g.computeBoundingBox();const box=g.boundingBox,p=g.attributes.position,idx=g.index;
 const resolution=64,pad=.7,minX=box.min.x-pad,minZ=box.min.z-pad;
 const width=box.max.x-box.min.x+2*pad,depth=box.max.z-box.min.z+2*pad;
 const minY=box.min.y-1,range=Math.max(1,box.max.y-minY+1),heights=new Float32Array(resolution*resolution).fill(-Infinity);
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();let triangles=0;
 for(let t=0;t<(idx?idx.count:p.count);t+=3){
  a.fromBufferAttribute(p,idx?idx.getX(t):t);b.fromBufferAttribute(p,idx?idx.getX(t+1):t+1);c.fromBufferAttribute(p,idx?idx.getX(t+2):t+2);
  const det=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);if(Math.abs(det)<1e-9)continue;
  const x0=clamp(Math.floor((Math.min(a.x,b.x,c.x)-minX)/width*resolution-.5),0,resolution-1),x1=clamp(Math.ceil((Math.max(a.x,b.x,c.x)-minX)/width*resolution-.5),0,resolution-1);
  const z0=clamp(Math.floor((Math.min(a.z,b.z,c.z)-minZ)/depth*resolution-.5),0,resolution-1),z1=clamp(Math.ceil((Math.max(a.z,b.z,c.z)-minZ)/depth*resolution-.5),0,resolution-1);
  for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){
   const px=minX+(x+.5)/resolution*width,pz=minZ+(z+.5)/resolution*depth;
   const u=((b.z-c.z)*(px-c.x)+(c.x-b.x)*(pz-c.z))/det,v=((c.z-a.z)*(px-c.x)+(a.x-c.x)*(pz-c.z))/det,w=1-u-v;
   if(u>=-1e-6&&v>=-1e-6&&w>=-1e-6)heights[z*resolution+x]=Math.max(heights[z*resolution+x],u*a.y+v*b.y+w*c.y);
  }triangles++;
 }
 const data=new Uint8Array(resolution*resolution*4);let valid=0;
 for(let i=0;i<heights.length;i++)if(Number.isFinite(heights[i])){const packed=Math.round(clamp((heights[i]-minY)/range,0,1)*65535);data[i*4]=packed>>8;data[i*4+1]=packed&255;data[i*4+2]=255;data[i*4+3]=255;valid++;}
 const texture=new THREE.DataTexture(data,resolution,resolution,THREE.RGBAFormat);texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;
 rock.updateWorldMatrix(true,false);
 const seaAnchor=rock.userData.seaStack?.seaAnchor;const wetY=seaAnchor?rock.worldToLocal(new THREE.Vector3(...seaAnchor)).y:box.min.y+6;
 const audit={revision,resolution,validCells:valid,projectedTriangles:triangles,method:'final-rock-local-heightfield-shared-by-dressing',limitations:'2.5D self-occlusion; no other-rock/character caster or underside visibility',wetY};
 const surface={revision,scene,texture,heights,resolution,minX,minZ,width,depth,minY,range,wetY,audit};
 surfaces.set(rock,surface);rock.userData.coastalSurface=audit;
 return audit;
}
function uniforms(){return {
 coastMap:{value:null},coastRect:{value:new THREE.Vector4()},coastRange:{value:new THREE.Vector2()},coastMapSize:{value:64},coastWetY:{value:0},
 coastToField:{value:new THREE.Matrix4()},coastViewToField:{value:new THREE.Matrix4()},coastSun:{value:new THREE.Vector3(0,1,0)},
 coastSunColor:{value:new THREE.Color(1,1,1)},coastSky:{value:new THREE.Color(.6,.7,.8)},coastGround:{value:new THREE.Color(.4,.5,.6)},
 coastSunPower:{value:1},coastAmbient:{value:.45},coastUnlit:{value:0},coastRock:{value:0},coastReady:{value:0}
};}
const fragment=/* glsl */`
varying vec3 coastP; varying vec3 coastN;
uniform sampler2D coastMap; uniform vec4 coastRect;uniform vec2 coastRange;
uniform float coastMapSize,coastWetY,coastSunPower,coastAmbient,coastUnlit,coastRock,coastReady;
uniform vec3 coastSun,coastSunColor,coastSky,coastGround;
float coastalHeight(vec2 xz){
 vec2 uv=(xz-coastRect.xy)/coastRect.zw;
 if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))return -10000.;
 vec4 h=texture2D(coastMap,uv);if(h.b<.95)return -10000.;
 return coastRange.x+(h.r*65280.+h.g*255.)/65535.*coastRange.y;
}
float coastalShadow(vec3 p){
 if(coastSun.y<-.06)return .16;
 float shadow=1.;
 for(int k=1;k<=8;k++){
  float d=float(k)*1.45;vec3 q=p+coastSun*d;
  float h=coastalHeight(q.xz);
  shadow=min(shadow,mix(1.,.48,smoothstep(.6,2.1+float(k)*.15,h-q.y)));
 }return shadow;
}
float coastalAO(vec3 p){
 float delta=0.;float d=1.1;
 delta+=clamp((coastalHeight(p.xz+vec2(d,0.))-p.y-.28)/2.8,0.,1.);
 delta+=clamp((coastalHeight(p.xz-vec2(d,0.))-p.y-.28)/2.8,0.,1.);
 delta+=clamp((coastalHeight(p.xz+vec2(0.,d))-p.y-.28)/2.8,0.,1.);
 delta+=clamp((coastalHeight(p.xz-vec2(0.,d))-p.y-.28)/2.8,0.,1.);
 return 1.-delta*.065;
}
`;
export function createCoastalMaterial({kind='rock',color,vertexColors=false,side=THREE.FrontSide,unlit=false,...options}={}){
 const rock=kind==='rock';delete options.height;
 const m=new THREE.MeshBasicMaterial({color:color??(rock?0x9caebb:0x849276),vertexColors,side,...options});
 const u=uniforms();u.coastRock.value=rock?1:0;u.coastUnlit.value=unlit||new URLSearchParams(globalThis.location?.search||'').get('coastalUnlit')==='1'?1:0;
 materials.set(m,u);m.userData.coastalLighting={kind,method:'shared-heightfield+scene-directional-light',unlit:!!u.coastUnlit.value};
 m.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,u);
  shader.vertexShader='varying vec3 coastP;varying vec3 coastN;uniform mat4 coastToField;uniform mat4 coastViewToField;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )','#if 1');
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
    vec4 coastalPosition=vec4(transformed,1.);
    #ifdef USE_INSTANCING
      coastalPosition=instanceMatrix*coastalPosition;
    #endif
    coastP=(coastToField*coastalPosition).xyz;
    coastN=normalize(mat3(coastViewToField)*transformedNormal);
  `);
  shader.fragmentShader=fragment+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   if(coastReady>.5){
    vec3 n=normalize(coastN);
    #ifdef DOUBLE_SIDED
     if(!gl_FrontFacing)n=-n;
    #endif
    if(coastRock>.5){
     float layers=.018*sin(coastP.y*.34+sin(coastP.x*.22)+cos(coastP.z*.18));
     diffuseColor.rgb*=1.+layers;
     float wet=1.-smoothstep(coastWetY+.25,coastWetY+3.0,coastP.y);
     diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.48,.58,.64),wet*.75);
    }
    float ndl=max(0.,dot(n,coastSun));
    vec3 indirect=mix(coastGround,coastSky,.4+.6*max(0.,n.y))*coastAmbient*coastalAO(coastP);
    vec3 direct=coastSunColor*min(coastSunPower,3.)*.47*ndl*coastalShadow(coastP+n*(max(coastRect.z,coastRect.w)/coastMapSize*1.4+.10));
    diffuseColor.rgb*=mix(indirect+direct,vec3(1.),coastUnlit);
   }
  `);
 };m.customProgramCacheKey=()=> 'coastal-shared-field-v1';return m;
}
export function bindCoastalMesh(mesh,rock){
 const m=mesh.material,u=materials.get(m);if(!u)return mesh;
 const old=mesh.onBeforeRender;
 mesh.onBeforeRender=function(renderer,scene,camera,...args){
  old?.call(this,renderer,scene,camera,...args);
  const f=surfaces.get(rock);if(!f)return;rock.updateWorldMatrix(true,false);mesh.updateWorldMatrix(true,false);
  const inverse=rock.matrixWorld.clone().invert(),light=sceneLight(f.scene,renderer.info?.render?.frame);
  u.coastToField.value.multiplyMatrices(inverse,mesh.matrixWorld);
  // transformedNormal is view-space inverse-transpose (includes instance scale).
  u.coastViewToField.value.multiplyMatrices(inverse,camera.matrixWorld);
  u.coastSun.value.copy(light.direction).transformDirection(inverse);
  u.coastSunColor.value.copy(light.color);u.coastSky.value.copy(light.sky);u.coastGround.value.copy(light.ground);
  u.coastSunPower.value=light.intensity;u.coastAmbient.value=light.ambient;
  u.coastMap.value=f.texture;u.coastRect.value.set(f.minX,f.minZ,f.width,f.depth);u.coastRange.value.set(f.minY,f.range);u.coastWetY.value=f.wetY;u.coastReady.value=1;
  mesh.userData.coastalSurfaceRevision=f.revision;f.audit.sunSource=light.source;f.audit.sunWorldDirection=light.direction.toArray();f.audit.sunIntensity=light.intensity;
 };
 mesh.userData.coastalSurfaceRevision=surfaces.get(rock)?.revision||null;return mesh;
}
export function sampleCoastalLighting(rock,worldPoint,worldNormal){
 const f=surfaces.get(rock);if(!f)return null;rock.updateWorldMatrix(true,false);
 const inverse=rock.matrixWorld.clone().invert(),p=worldPoint.clone().applyMatrix4(inverse),light=sceneLight(f.scene);
 const normal=worldNormal.clone().normalize(),localSun=light.direction.clone().transformDirection(inverse);
 const height=(x,z)=>{
  const u=(x-f.minX)/f.width,v=(z-f.minZ)/f.depth;if(u<0||v<0||u>1||v>1)return -Infinity;
  const fx=u*f.resolution-.5,fz=v*f.resolution-.5,ix=Math.floor(fx),iz=Math.floor(fz);let sum=0,validWeight=0;
  for(let dz=0;dz<2;dz++)for(let dx=0;dx<2;dx++){
   const weight=(dx?fx-ix:1-fx+ix)*(dz?fz-iz:1-fz+iz),h=f.heights[clamp(iz+dz,0,f.resolution-1)*f.resolution+clamp(ix+dx,0,f.resolution-1)];
   sum+=weight*(Number.isFinite(h)?h:f.minY);if(Number.isFinite(h))validWeight+=weight;
  }return validWeight<.95?-Infinity:sum;
 };
 let visibility=localSun.y<-.06?.16:1;
 for(let k=1;k<=8;k++){const q=p.clone().addScaledVector(worldNormal.clone().transformDirection(inverse),Math.max(f.width,f.depth)/f.resolution*1.4+.10).addScaledVector(localSun,k*1.45),delta=height(q.x,q.z)-q.y;visibility=Math.min(visibility,1-.52*THREE.MathUtils.smoothstep(delta,.6,2.1+k*.15));}
 return {surfaceRevision:f.revision,sunWorldDirection:light.direction.toArray(),sunColor:light.color.toArray(),sunIntensity:light.intensity,ambient:light.ambient,diffuse:Math.max(0,normal.dot(light.direction)),terrainVisibility:visibility,heightLocal:height(p.x,p.z),approximation:'2.5D rock-only; dynamic receivers opt-in'};
}

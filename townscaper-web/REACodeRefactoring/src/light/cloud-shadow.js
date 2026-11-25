import * as THREE from 'three';
import {cloudDrift,cloudWindBob} from '../core/cloud-motion.js';
// Fixed first-view silhouette projected in world XZ. Uses the live atlas and
// instance anchors, never camera orientation. Not volumetric cloud scattering.
export const CLOUD_SHADOW_GLSL=`
uniform sampler2D uCloudAtlas;
uniform vec4 uCloudRect;
uniform vec4 uCloudPuffs[64];
uniform int uCloudCount;
uniform float uCloudStrength;
uniform vec3 uCloudSun;
uniform vec4 uCloudPuffsFar[24];
uniform int uCloudCountFar;
uniform float uCloudFarRatio;
float cloudShadowTone(vec3 p){
 if(uCloudStrength<=0. || uCloudSun.y<=.001) return 1.;
 float cover=0.;
 for(int i=0;i<64;i++){
  if(i>=uCloudCount)break;
  vec4 c=uCloudPuffs[i];
  if(c.y<=p.y || c.w<=0.)continue;
  vec2 hit=p.xz+uCloudSun.xz*((c.y-p.y)/uCloudSun.y);
  vec2 uv=(hit-c.xz)/c.w+.5;
  if(uv.x<=0. || uv.y<=0. || uv.x>=1. || uv.y>=1.)continue;
  float a=texture2D(uCloudAtlas,uCloudRect.xy+uv*uCloudRect.zw).a;
  cover=max(cover,smoothstep(.05,.55,a));
 }
 // 远层（deck 第 0 层）：更高更远 → 影子更淡、边更散（宽 ramp + 单独弱档），与近/中层相乘独立退化。
 float farCover=0.;
 for(int i=0;i<24;i++){
  if(i>=uCloudCountFar)break;
  vec4 c=uCloudPuffsFar[i];
  if(c.y<=p.y || c.w<=0.)continue;
  vec2 hit=p.xz+uCloudSun.xz*((c.y-p.y)/uCloudSun.y);
  vec2 uv=(hit-c.xz)/c.w+.5;
  if(uv.x<=0. || uv.y<=0. || uv.x>=1. || uv.y>=1.)continue;
  float a=texture2D(uCloudAtlas,uCloudRect.xy+uv*uCloudRect.zw).a;
  farCover=max(farCover,smoothstep(.02,.92,a));
 }
 return (1.-uCloudStrength*cover)*(1.-uCloudStrength*uCloudFarRatio*farCover);
}`;
export class CloudShadow {
  constructor(view){
  this.view=view;this.enabled=false;this.strength=.35;
  this.farRatio=.42;   // 远层单独弱档（近/中层 0.35 → 远层 ≈0.147），云越高影子越淡
  this.uniforms={uCloudAtlas:{value:null},uCloudRect:{value:new THREE.Vector4()},uCloudPuffs:{value:Array.from({length:64},()=>new THREE.Vector4())},uCloudCount:{value:0},uCloudStrength:{value:0},uCloudSun:{value:new THREE.Vector3()},
   uCloudPuffsFar:{value:Array.from({length:24},()=>new THREE.Vector4())},uCloudCountFar:{value:0},uCloudFarRatio:{value:this.farRatio}};
  this.matrix=new THREE.Matrix4();this.center=new THREE.Vector3();this.scale=new THREE.Vector3();
 }
 setEnabled(on){if(typeof on!=='boolean')throw new TypeError('cloud shadow toggle');this.enabled=on;this.update();}
 update(){
  const v=this.view,f=v.vegetation?.cloudField,u=this.uniforms;
  let visible=!!f;for(let node=f?.mesh;node;node=node.parent)visible=visible&&node.visible;
  u.uCloudStrength.value=this.enabled&&visible?this.strength:0;
  u.uCloudCount.value=0;u.uCloudCountFar.value=0;if(!f)return;
  u.uCloudAtlas.value=f.material.uniforms.uTex.value;
  u.uCloudRect.value.copy(f.material.uniforms.uFrames.value[0]);
  u.uCloudSun.value.copy(v.sunDir);
  if(!u.uCloudStrength.value)return;
  f.mesh.updateWorldMatrix(true,false);
  const count=Math.min(64,f.mesh.count),time=v.waterUniforms.uTime.value;
  // 顶点着色器同款位移：cd = mix(1,max(1,aCloudDepth),uCloudParallax)，漂移与风起伏同除 cd
  const par=f.material.uniforms.uCloudParallax?.value??0,amt=f.material.uniforms.uWindAmt?.value??0;
  for(let i=0;i<count;i++){
   f.mesh.getMatrixAt(i,this.matrix);this.matrix.premultiply(f.mesh.matrixWorld);
   this.center.copy(f.material.uniforms.uCenter.value).applyMatrix4(this.matrix);
   const e=this.matrix.elements,cd=1+par*Math.max(0,(f.depth?.getX(i)??1)-1);
   this.center.x+=cloudDrift(time,f.yaw.getX(i))/cd;
   const[bobX,bobY,bobZ]=cloudWindBob(time,e[12],e[14],amt);
   this.center.x+=bobX/cd;this.center.y+=bobY/cd;this.center.z+=bobZ/cd;
   this.scale.setFromMatrixScale(this.matrix);
   u.uCloudPuffs.value[i].set(this.center.x,this.center.y,this.center.z,f.material.uniforms.uSize.value*this.scale.x);
  }
  u.uCloudCount.value=count;
 }
}

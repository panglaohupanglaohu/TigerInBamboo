import * as THREE from 'three';
import {cloudDrift} from '../core/cloud-motion.js';
// Fixed first-view silhouette projected in world XZ. Uses the live atlas and
// instance anchors, never camera orientation. Not volumetric cloud scattering.
export const CLOUD_SHADOW_GLSL=`
uniform sampler2D uCloudAtlas;
uniform vec4 uCloudRect;
uniform vec4 uCloudPuffs[64];
uniform int uCloudCount;
uniform float uCloudStrength;
uniform vec3 uCloudSun;
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
 return 1.-uCloudStrength*cover;
}`;
export class CloudShadow {
 constructor(view){
  this.view=view;this.enabled=false;this.strength=.35;
  this.uniforms={uCloudAtlas:{value:null},uCloudRect:{value:new THREE.Vector4()},uCloudPuffs:{value:Array.from({length:64},()=>new THREE.Vector4())},uCloudCount:{value:0},uCloudStrength:{value:0},uCloudSun:{value:new THREE.Vector3()}};
  this.matrix=new THREE.Matrix4();this.center=new THREE.Vector3();this.scale=new THREE.Vector3();
 }
 setEnabled(on){if(typeof on!=='boolean')throw new TypeError('cloud shadow toggle');this.enabled=on;this.update();}
 update(){
  const v=this.view,f=v.vegetation?.cloudField,u=this.uniforms;
  let visible=!!f;for(let node=f?.mesh;node;node=node.parent)visible=visible&&node.visible;
  u.uCloudStrength.value=this.enabled&&visible?this.strength:0;
  u.uCloudCount.value=0;if(!f)return;
  u.uCloudAtlas.value=f.material.uniforms.uTex.value;
  u.uCloudRect.value.copy(f.material.uniforms.uFrames.value[0]);
  u.uCloudSun.value.copy(v.sunDir);
  if(!u.uCloudStrength.value)return;
  f.mesh.updateWorldMatrix(true,false);
  const count=Math.min(64,f.mesh.count),time=v.waterUniforms.uTime.value;
  for(let i=0;i<count;i++){
   f.mesh.getMatrixAt(i,this.matrix);this.matrix.premultiply(f.mesh.matrixWorld);
   this.center.copy(f.material.uniforms.uCenter.value).applyMatrix4(this.matrix);
   this.center.x+=cloudDrift(time,f.yaw.getX(i));
   this.scale.setFromMatrixScale(this.matrix);
   u.uCloudPuffs.value[i].set(this.center.x,this.center.y,this.center.z,f.material.uniforms.uSize.value*this.scale.x);
  }
  u.uCloudCount.value=count;
 }
}

import * as THREE from 'three';
// Local 2.5D ground approximation. Casting eligibility uses prominence above
// a local base; zBias acts ONLY on ray depth. No invented UV seams.
export function bakeSurfaceShadow({width,height,heights,stepWorld=1,dx=1,dz=0,slope=1,castHeight=.15,zBias=.02,steps=32}) {
  if(!Number.isInteger(width)||width<2||!Number.isInteger(height)||height<2||heights.length!==width*height||![stepWorld,dx,dz,slope,castHeight,zBias].every(Number.isFinite)||stepWorld<=0||Math.hypot(dx,dz)<1e-9||slope<0||castHeight<0||zBias<0||!Number.isInteger(steps)||steps<1||steps>128||!heights.every(Number.isFinite))throw new RangeError('surface shadow inputs');
  const prominence=new Float32Array(heights.length),shadow=new Uint8Array(heights.length);let eligible=0,hits=0;const len=Math.hypot(dx,dz);dx/=len;dz/=len;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){let sum=0,n=0;for(let oy=-2;oy<=2;oy++)for(let ox=-2;ox<=2;ox++){const qx=Math.max(0,Math.min(width-1,x+ox)),qy=Math.max(0,Math.min(height-1,y+oy));sum+=heights[qy*width+qx];n++}const i=y*width+x;prominence[i]=heights[i]-sum/n;if(prominence[i]>=castHeight)eligible++}
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=y*width+x;if(heights[i]<=0)continue;for(let t=1;t<=steps;t++){const qx=Math.round(x+dx*t),qy=Math.round(y+dz*t);if(qx<0||qx>=width||qy<0||qy>=height)break;const j=qy*width+qx;if(prominence[j]>=castHeight&&heights[j]>heights[i]+slope*t*stepWorld+zBias){shadow[i]=255;hits++;break}}}
  return {shadow,prominence,eligible,hits};
}
export const SURFACE_SHADOW_GLSL=`
uniform sampler2D uSurfaceShadowMap;
uniform vec4 uSurfaceShadowXform;
uniform float uSurfaceShadowStrength;
float surfaceShadowTone(vec3 p){vec2 uv=(p.xz-uSurfaceShadowXform.xy)*uSurfaceShadowXform.zw;if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))return 1.;return 1.-uSurfaceShadowStrength*texture2D(uSurfaceShadowMap,uv).r;}
`;
export class GroundSurfaceShadow {
 constructor(view){this.view=view;this.options={castHeight:.15,zBias:.02,steps:32};this.strength={value:0};this.xform={value:new THREE.Vector4(0,0,1,1)};this.texture=new THREE.DataTexture(new Uint8Array([0,0,0,255]),1,1);this.map={value:this.texture};this.texture.needsUpdate=true;this.key=null}
 set({strength=this.strength.value,castHeight=this.options.castHeight,zBias=this.options.zBias,steps=this.options.steps}={}){if(![strength,castHeight,zBias].every(Number.isFinite)||strength<0||strength>1||castHeight<0||castHeight>2||zBias<0||zBias>2||!Number.isInteger(steps)||steps<1||steps>128)throw new RangeError('surface shadow settings');this.options={castHeight,zBias,steps};this.strength.value=strength;}
 refresh(){if(!this.strength.value)return;const v=this.view,S=v.sunDir,key=JSON.stringify([v.town.version,S.x,S.y,S.z,this.options]);if(key===this.key)return;const start=performance.now(),cells=v.town.cells,minX=Math.min(...cells.map(c=>c.minX)),minZ=Math.min(...cells.map(c=>c.minZ)),span=Math.max(Math.max(...cells.map(c=>c.maxX))-minX,Math.max(...cells.map(c=>c.maxZ))-minZ),res=96,step=span/res,heights=new Float32Array(res*res);for(let z=0;z<res;z++)for(let x=0;x<res;x++){const c=v.index.cellAt(minX+(x+.5)*step,minZ+(z+.5)*step);if(c)heights[z*res+x]=v.town.top(c)*v.levelHeight}const flat=Math.hypot(S.x,S.z);const result=bakeSurfaceShadow({width:res,height:res,heights,stepWorld:step,dx:flat>1e-9?S.x:1,dz:flat>1e-9?S.z:0,slope:flat>1e-9?Math.max(0,S.y)/flat:1e6,...this.options});const data=new Uint8Array(res*res*4);for(let i=0;i<result.shadow.length;i++){data[i*4]=result.shadow[i];data[i*4+3]=255}const tex=new THREE.DataTexture(data,res,res,THREE.RGBAFormat);tex.magFilter=tex.minFilter=THREE.LinearFilter;tex.generateMipmaps=false;tex.needsUpdate=true;this.texture.dispose();this.texture=tex;this.map.value=tex;this.xform.value.set(minX,minZ,1/span,1/span);this.key=key;this.stats={res,eligible:result.eligible,hits:result.hits,version:v.town.version,ms:performance.now()-start};}
 dispose(){this.texture.dispose()}
}

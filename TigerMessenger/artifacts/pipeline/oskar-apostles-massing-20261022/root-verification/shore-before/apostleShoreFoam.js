import * as THREE from 'three';
// A narrow, discontinuous ribbon bound to the finished coast. The two fronts
// advance, break and fade independently; no per-frame geometry allocation.
export function createApostleShoreFoam({segments,bend,surfacePoint=null,seed=0}){
 const P=[],U=[];
 for(const sg of segments){const len=Math.hypot(sg.b[0]-sg.a[0],sg.b[1]-sg.a[1]);if(len<.08)continue;
  const phase=((sg.a[0]*.071+sg.a[1]*.053+seed*.013)%1+1)%1;
  const at=(point,t)=>{const out=-.2+t*1.15,x=point[0]+sg.nx*out,z=point[1]+sg.nz*out;const p=surfacePoint?.(x,z);return p?[p.x,p.y+.065,p.z]:[x,.065-bend(x,z),z];};
  const A=at(sg.a,0),B=at(sg.b,0),C=at(sg.b,1),D=at(sg.a,1);
  P.push(...A,...B,...C,...A,...C,...D);for(const [u,v]of [[0,0],[len,0],[len,1],[0,0],[len,1],[0,1]])U.push(u,v,phase);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(P,3));geometry.setAttribute('foamRibbon',new THREE.Float32BufferAttribute(U,3));
 const material=new THREE.ShaderMaterial({uniforms:{time:{value:0}},transparent:true,depthWrite:false,side:THREE.DoubleSide,
  vertexShader:'attribute vec3 foamRibbon;varying vec3 ribbon;void main(){ribbon=foamRibbon;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`uniform float time;varying vec3 ribbon;
   float front(float lag){float cycle=fract(time/6.4+ribbon.z+lag);float travel=.88-.75*smoothstep(.08,.72,cycle);float fade=smoothstep(0.,.12,cycle)*(1.-smoothstep(.72,1.,cycle));return exp(-pow((ribbon.y-travel)/.14,2.))*fade;}
   void main(){float pieces=.55+.45*sin(ribbon.x*3.7+ribbon.z*23.);float alpha=max(front(0.),.45*front(.47))*pieces*.62;gl_FragColor=vec4(.89,.96,.93,alpha);
#include <tonemapping_fragment>
#include <colorspace_fragment>}`});
 const foam=new THREE.Mesh(geometry,material);foam.name='apostle-foam';foam.renderOrder=2;
 foam.onBeforeRender=()=>{material.uniforms.time.value=performance.now()/1000;};
 foam.userData.shoreAnimation={period:6.4,fronts:2,width:1.15,waterLift:.065,geometryAllocatedPerFrame:false};return foam;
}

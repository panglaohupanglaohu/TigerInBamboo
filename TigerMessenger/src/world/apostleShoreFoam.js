import * as THREE from 'three';
// A narrow, discontinuous ribbon bound to the finished coast. The two fronts
// advance, break and fade independently; no per-frame geometry allocation.
export function createApostleShoreFoam({segments,bend,surfacePoint=null,seed=0}){
 const P=[],U=[];
 for(const sg of segments){const len=Math.hypot(sg.b[0]-sg.a[0],sg.b[1]-sg.a[1]);if(len<.08)continue;
  const phase=((sg.a[0]*.071+sg.a[1]*.053+seed*.013)%1+1)%1;
  const at=(point,t)=>{const out=-.25+t*3.8,x=point[0]+sg.nx*out,z=point[1]+sg.nz*out;const p=surfacePoint?.(x,z);return p?[p.x,p.y+.20,p.z]:[x,.20-bend(x,z),z];};
  const A=at(sg.a,0),B=at(sg.b,0),C=at(sg.b,1),D=at(sg.a,1);
  P.push(...A,...B,...C,...A,...C,...D);for(const [u,v]of [[0,0],[len,0],[len,1],[0,0],[len,1],[0,1]])U.push(u,v,phase);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(P,3));geometry.setAttribute('foamRibbon',new THREE.Float32BufferAttribute(U,3));
 const material=new THREE.ShaderMaterial({uniforms:{time:{value:0}},transparent:true,depthWrite:false,side:THREE.DoubleSide,
  vertexShader:'attribute vec3 foamRibbon;varying vec3 ribbon;void main(){ribbon=foamRibbon;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`uniform float time;varying vec3 ribbon;
   float front(float lag){float cycle=fract(time/5.2+ribbon.z*.22+lag);float travel=.90-.82*smoothstep(.04,.78,cycle);float fade=smoothstep(0.,.10,cycle)*(1.-smoothstep(.77,1.,cycle));float scallop=.035*sin(ribbon.x*2.8+time*.8+ribbon.z*13.);return exp(-pow((ribbon.y-travel+scallop)/.11,2.))*fade;}
   void main(){float pieces=.72+.28*sin(ribbon.x*3.7+ribbon.z*23.);float wash=(1.-smoothstep(.06,.40,ribbon.y))*(.13+.10*sin(time*1.2+ribbon.z*13.));float alpha=max(max(front(0.),.74*front(.49))*pieces*.94,wash);gl_FragColor=vec4(.94,.99,.97,alpha);
#include <tonemapping_fragment>
#include <colorspace_fragment>}`});
 const foam=new THREE.Mesh(geometry,material);foam.name='apostle-foam';foam.renderOrder=2;
 foam.onBeforeRender=()=>{material.uniforms.time.value=performance.now()/1000;};
 foam.userData.shoreAnimation={revision:'readable-surf-2',period:5.2,fronts:2,width:3.8,waterLift:.20,geometryAllocatedPerFrame:false};return foam;
}

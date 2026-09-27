import * as THREE from 'three';
import {puffTexture} from '../world/citadel/ridgeFlowClouds.js';
// Highland cloud lobes, camera-facing shading and smooth dissolution. Emitted
// positions live in world space: a bend cannot drag an existing plume sideways.
export function createFreightSteam(vehicle){
 const count=48,quad=new THREE.PlaneGeometry(1,1),g=new THREE.InstancedBufferGeometry();
 g.index=quad.index;g.setAttribute('position',quad.attributes.position);g.setAttribute('uv',quad.attributes.uv);g.instanceCount=count;
 const pos=new THREE.InstancedBufferAttribute(new Float32Array(count*3),3).setUsage(THREE.DynamicDrawUsage),size=new THREE.InstancedBufferAttribute(new Float32Array(count),1),alpha=new THREE.InstancedBufferAttribute(new Float32Array(count),1);
 g.setAttribute('iPos',pos);g.setAttribute('iSize',size);g.setAttribute('iAlpha',alpha);
 const texture=puffTexture(),mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{map:{value:texture}},vertexShader:`attribute vec3 iPos;attribute float iSize;attribute float iAlpha;varying vec2 vUv;varying float opacity;void main(){vUv=uv;opacity=iAlpha;vec4 p=viewMatrix*vec4(iPos,1.);p.xy+=position.xy*iSize*vec2(1.15,1.);gl_Position=projectionMatrix*p;}`,fragmentShader:`uniform sampler2D map;varying vec2 vUv;varying float opacity;void main(){float a=texture2D(map,vUv).a*opacity;if(a<.003)discard;gl_FragColor=vec4(mix(vec3(.57,.65,.70),vec3(.96,.94,.88),smoothstep(.05,.9,vUv.y)),a);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});
 const mesh=new THREE.Mesh(g,mat);mesh.name='freight-highland-steam';mesh.frustumCulled=false;mesh.userData.noDistanceCulling=true;vehicle.add(mesh);
 const particles=Array.from({length:count},()=>({age:99,p:new THREE.Vector3(),v:new THREE.Vector3()})),origin=new THREE.Vector3(),previous=new THREE.Vector3(),up=new THREE.Vector3(),wind=new THREE.Vector3();let cursor=0,clock=0,ready=false;
 return{mesh,update(dt,travel){if(dt<=0)return;dt=Math.min(dt,.25);vehicle.updateWorldMatrix(true,false);origin.set(-2.1025,2.55,0).applyMatrix4(vehicle.matrixWorld);up.copy(origin).normalize();wind.set(.65,.15,.35).addScaledVector(up,-wind.dot(up));if(ready&&origin.distanceTo(previous)>15)for(const p of particles)p.age=99;previous.copy(origin);ready=true;
 const speed=Math.min(10,Math.abs(travel)/dt),interval=speed>.1?.12:.24;clock+=dt;
 while(clock>=interval){clock-=interval;const p=particles[cursor++%count];p.age=0;p.p.copy(origin);p.v.copy(up).multiplyScalar(1.05).add(wind);}
 for(let i=0;i<count;i++){const p=particles[i];p.age+=dt;const t=p.age/5.5;if(t>=1){alpha.setX(i,0);continue;}p.p.addScaledVector(p.v,dt);pos.setXYZ(i,p.p.x,p.p.y,p.p.z);size.setX(i,.4+p.age*.67);alpha.setX(i,Math.min(1,p.age*7)*Math.pow(1-t,1.4)*.76);}
 pos.needsUpdate=size.needsUpdate=alpha.needsUpdate=true;
 },dispose(){mesh.removeFromParent();g.dispose();quad.dispose();mat.dispose();texture.dispose();}};
}

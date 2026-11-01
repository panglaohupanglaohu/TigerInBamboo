import * as THREE from 'three';
import {puffTexture} from './citadel/ridgeFlowClouds.js';
import {seatTownObject} from './bookshopTownSite.js';
// Same soft multi-lobe texture / billboard shading as the highland ridge clouds.
// Steam rises from chimney mouths before joining high, wind-driven factory banks.
export function createBookshopSteamClouds(districts,R){
 const batches=[],texture=puffTexture();
 for(const d of districts){
  const ant=d.name.startsWith('ant'),sources=[];
  for(let i=0;i<3;i++)sources.push({x:(-9.5+i*1.1)*1.25,z:-10,y:(ant?10+i*2:7+i*1.5)*1.25});
  sources.push({x:-10,z:-31.25,y:ant?18:17.875},{x:17.5,z:-31.25,y:17.875},{x:-7.5,z:-20,y:ant?20.4:14.6},{x:2.5,z:-28,y:14.6},{x:12.5,z:-22,y:14.6});
  for(const s of sources){const marker=new THREE.Group();d.add(marker);seatTownObject(d,marker,s.x,s.z,0,R);marker.updateMatrix();s.origin=new THREE.Vector3(0,s.y,0).applyMatrix4(marker.matrix);s.up=new THREE.Vector3(0,1,0).transformDirection(marker.matrix);marker.removeFromParent();}
  const count=sources.length*12+30,quad=new THREE.PlaneGeometry(1,1),g=new THREE.InstancedBufferGeometry();g.index=quad.index;g.setAttribute('position',quad.attributes.position);g.setAttribute('uv',quad.attributes.uv);g.instanceCount=count;
  const positions=new Float32Array(count*3),sizes=new Float32Array(count),alphas=new Float32Array(count);
  g.setAttribute('iPos',new THREE.InstancedBufferAttribute(positions,3));g.setAttribute('iSize',new THREE.InstancedBufferAttribute(sizes,1));g.setAttribute('iAlpha',new THREE.InstancedBufferAttribute(alphas,1));
  const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{map:{value:texture},tint:{value:new THREE.Color(0xffe9cf)},shade:{value:new THREE.Color(0x839aa7)}},vertexShader:`attribute vec3 iPos;attribute float iSize;attribute float iAlpha;varying vec2 vUv;varying float alpha;void main(){vUv=uv;alpha=iAlpha;vec4 mv=modelViewMatrix*vec4(iPos,1.);mv.xy+=position.xy*iSize*vec2(1.25,1.);gl_Position=projectionMatrix*mv;}`,fragmentShader:`uniform sampler2D map;uniform vec3 tint;uniform vec3 shade;varying vec2 vUv;varying float alpha;void main(){float a=texture2D(map,vUv).a*alpha;if(a<.003)discard;vec3 c=mix(shade,tint,smoothstep(.05,.9,vUv.y));gl_FragColor=vec4(c,a);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace(';#include',';\n#include')});
  const mesh=new THREE.Mesh(g,m);mesh.name='factory-highland-steam-clouds';mesh.frustumCulled=false;mesh.userData.noDistanceCulling=true;mesh.userData.source='citadel/ridgeFlowClouds.js / puffTexture';d.add(mesh);batches.push({g,sources,positions,sizes,alphas,count});
 }
 const p=new THREE.Vector3();let last=-Infinity;
 return t=>{if(t-last<.08)return;last=t;for(const b of batches){for(let i=0;i<b.count;i++){const plume=i<b.sources.length*12,s=b.sources[plume?Math.floor(i/12):(i% b.sources.length)],a=(t*(plume?.055:.019)+i*.381966)%1,fade=Math.sin(a*Math.PI);
   p.copy(s.origin).addScaledVector(s.up,plume?a*12:9+a*7);p.x+=plume?a*a*7:Math.sin(i*4)*6+a*11;p.z+=plume?Math.sin(i)*a*1.7:-a*8;
   b.positions.set(p.toArray(),i*3);b.sizes[i]=plume?1+a*7:10+a*9;b.alphas[i]=fade*(plume?.82:.32);
  }for(const name of['iPos','iSize','iAlpha'])b.g.attributes[name].needsUpdate=true;}};
}

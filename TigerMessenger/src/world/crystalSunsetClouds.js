import * as THREE from 'three';
import {puffTexture} from './citadel/ridgeFlowClouds.js';

// Reuse the holy-city cloud lobes and billboard shading, with an independent
// high-altitude distribution: the holy-city terrain sampler is not transferable.
export function mountCrystalSunsetClouds(scene,swamp){
 if(scene.getObjectByName('crystal-sunset-clouds'))return;
 const geo=new THREE.InstancedBufferGeometry(),quad=new THREE.PlaneGeometry(1,1);
 geo.index=quad.index;geo.setAttribute('position',quad.attributes.position);geo.setAttribute('uv',quad.attributes.uv);
 const count=180,pos=[],sizes=[],alphas=[],rots=[];geo.instanceCount=count;
 let seed=8752;const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 for(let i=0;i<count;i++){
  const bank=Math.floor(i/30),a=bank*Math.PI/3+(rnd()-.5)*.8,r=150+rnd()*150;
  pos.push(Math.cos(a)*r,65+bank%3*22+rnd()*24,Math.sin(a)*r);
  sizes.push(38+rnd()*36);alphas.push(.22+rnd()*.16);rots.push((rnd()-.5)*.25);
 }
 for(const [name,array,size] of [['iPos',pos,3],['iSize',sizes,1],['iAlpha',alphas,1],['iRot',rots,1]])geo.setAttribute(name,new THREE.InstancedBufferAttribute(new Float32Array(array),size));
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {map: {value: puffTexture()}, uTint: {value: new THREE.Color(0xffc6a0)}, uShade: {value: new THREE.Color(0.66, 0.57, 0.80)}, uOpacity: {value: 1}},
    vertexShader: `
      attribute vec3 iPos; attribute float iSize; attribute float iAlpha; attribute float iRot;
      varying vec2 vUv; varying float vAlpha;
      void main(){
        vUv = uv; vAlpha = iAlpha;
        vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
        float c = cos(iRot), s = sin(iRot);
        vec2 q = vec2(position.x * c - position.y * s, position.x * s + position.y * c);
        mv.xy += q * vec2(iSize * 1.65, iSize * 0.85);   // wider than tall: lying mist
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D map; uniform vec3 uTint; uniform vec3 uShade; uniform float uOpacity;
      varying vec2 vUv; varying float vAlpha;
      void main(){
        vec4 t = texture2D(map, vUv);
        float a = t.a * vAlpha * uOpacity;
        if (a < 0.004) discard;
        vec3 col = mix(uShade, vec3(1.0), smoothstep(0.15, 0.85, vUv.y)) * uTint;
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });

 const mesh=new THREE.Mesh(geo,material);mesh.name='crystal-sunset-clouds';
 mesh.position.copy(swamp.position);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),swamp.position.clone().normalize());
 mesh.frustumCulled=false;mesh.renderOrder=7;mesh.userData.stats={particles:count,source:'citadel/ridgeFlowClouds.js',drawCalls:1};
 const start=performance.now();mesh.onBeforeRender=()=>{const t=(performance.now()-start)/1000;const attr=geo.attributes.iPos;for(let i=0;i<count;i++)attr.array[i*3]=pos[i*3]+Math.sin(t*.012+i*.3)*5;attr.needsUpdate=true;};
 scene.add(mesh);return mesh;
}

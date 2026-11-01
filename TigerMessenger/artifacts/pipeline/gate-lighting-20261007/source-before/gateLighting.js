import * as THREE from 'three';
import {registerLocalLight} from '../render/lighting/localLightRegistry.js';
/** Local warm bounce and practical lamps follow the shared clock, never set it. */
export function installGateLighting(seat){
 const root=new THREE.Group();root.name='gate-lighting';seat.add(root);
 const key=new THREE.PointLight(0xffa36f,0,125,2);key.name='gate-sunset-bounce';key.position.set(20,35,-30);root.add(key);
 registerLocalLight(key,{id:'gate:sunset-bounce',owner:'gate',radius:125,priority:1.2});
 const lamps=[],flames=[];
 for(const [i,p] of [[-28,5,-23],[-18,5,-23]].entries()){
  const light=new THREE.PointLight(0xffba63,0,11,2);light.name='gate-meeting-lamp-'+i;light.position.fromArray(p);root.add(light);lamps.push(light);registerLocalLight(light,{id:'gate:meeting:'+i,owner:'gate',radius:11,priority:1.4});
  const post=new THREE.Mesh(new THREE.CylinderGeometry(.06,.10,1.8,6),new THREE.MeshStandardMaterial({color:0x493327,roughness:1}));post.position.set(p[0],p[1]-.9,p[2]);root.add(post);
  const flame=new THREE.Mesh(new THREE.OctahedronGeometry(.17),new THREE.MeshStandardMaterial({color:0xffcd78,emissive:0xff9a38,emissiveIntensity:0,roughness:1}));flame.position.fromArray(p);root.add(flame);flames.push(flame);
 }
 const update=phase=>{const dusk=Math.max(0,1-Math.abs(phase-.75)/.11),dawn=Math.max(0,1-Math.abs(phase-.28)/.08),night=1-THREE.MathUtils.smoothstep(Math.sin((phase-.25)*Math.PI*2),-.15,.25);key.intensity=2300*Math.max(dusk,dawn*.6);for(const l of lamps)l.intensity=24*night;for(const f of flames)f.material.emissiveIntensity=night*2.2;root.userData.phase=phase;};
 root.userData.update=update;update(.5);return root;
}

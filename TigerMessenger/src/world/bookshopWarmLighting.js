import * as THREE from 'three';
import {P} from '../core/params.js';
import {nightWeightAt} from '../render/lighting/highlandLightVolumes.js';
import {seatTownObject,townSurfaceMesh} from './bookshopTownSite.js';
// Logical point lights are adopted by the existing fixed-capacity light pool.
// Soft ground spill preserves distant readability without adding render lights.
export function installBookshopWarmLighting({root,districts,bookshop,R=160}){
 const lamps=[],glows=[],spills=[],windowMaterials=new Set();
 const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d'),g=ctx.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,230,183,1)');g.addColorStop(.2,'rgba(255,193,100,.6)');g.addColorStop(.55,'rgba(255,153,54,.18)');g.addColorStop(1,'rgba(255,137,39,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;
 function spill(parent,x,z,w,d,strength=.35){const mat=new THREE.MeshBasicMaterial({map,color:0xffb85e,transparent:true,opacity:strength,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,blending:THREE.AdditiveBlending});const mesh=townSurfaceMesh(parent,x-w/2,x+w/2,z-d/2,z+d/2,mat,R,1.025,8),uv=[];for(let j=0;j<=8;j++)for(let i=0;i<=8;i++)uv.push(i/8,j/8);mesh.geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));mesh.name='bookshop-warm-ground-spill';spills.push({mat,strength});}
 function fixture(parent,x,y,z,{power=16,range=10,halo=.75,color=0xffbb72,visibleBulb=true}={}){const node=new THREE.Group();node.name='bookshop-warm-fixture';parent.add(node);seatTownObject(parent,node,x,z,0,R);node.position.add(new THREE.Vector3(0,y,0).applyQuaternion(node.quaternion));const light=new THREE.PointLight(color,power,range,2);light.castShadow=false;light.name='bookshop-logical-lamp';node.add(light);lamps.push({light,power});if(visibleBulb){const bulb=new THREE.Mesh(new THREE.SphereGeometry(.09,8,6),new THREE.MeshBasicMaterial({color:0xffdfae}));node.add(bulb);const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,opacity:.6,depthWrite:false,blending:THREE.AdditiveBlending}));sprite.scale.setScalar(halo);sprite.name='bookshop-lamp-soft-halo';node.add(sprite);glows.push(sprite);}return node;}
 for(const district of districts){
  district.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m?.emissive?.getHex()===0xc4883e)windowMaterials.add(m);});
  for(const x of[-5.45,-3.15,-.85]){fixture(district,x*1.25,2.6,2.55,{power:25,range:8,halo:.7});spill(district,x*1.25,5.8,3.4,6,.37);}
  for(const x of[-5.45,-.85]){const p=new THREE.Group();district.add(p);seatTownObject(district,p,x*1.25,3.015,0,R);const mat=new THREE.MeshStandardMaterial({color:0xba8549,emissive:0xffb353,emissiveIntensity:.75,transparent:true,opacity:.34,roughness:.8,depthWrite:false});const pane=new THREE.Mesh(new THREE.PlaneGeometry(2.1,3.1),mat);pane.position.y=1.94;p.add(pane);windowMaterials.add(mat);}
  for(const x of[-8.5,.8,9.8]){fixture(district,x*1.25,3.675,4.6*1.25,{power:24,range:10,halo:.8});spill(district,x*1.25,5.75,5,5,.30);}
  for(const [x,z]of[[.6,-6],[5.8,-6],[.6,-12],[5.8,-12],[-4,-21],[5,-21],[12,-21]])fixture(district,x*1.25,4.4,z*1.25,{power:42,range:14,halo:1.05,color:0xffaf60});
  for(const z of[-17,-26,-34]){fixture(district,19,3.2,z,{power:27,range:11,halo:.85});spill(district,19,z,5,6,.27);}
 }
 for(let i=0;i<=16;i++){const a=-Math.PI/2+i*Math.PI/16,x=Math.sin(a)*40.4,z=32+Math.cos(a)*40.4;if(Math.hypot(x-43,z-53)<4.4)continue;fixture(root,x,2.75,z,{power:23,range:11,halo:.8});spill(root,x,z,6,6,.30);}
 if(bookshop){fixture(bookshop,-1.1,2.2,2.4,{power:16,range:7,halo:.65});fixture(bookshop,1.1,2.2,2.4,{power:16,range:7,halo:.65});}
 const update=t=>{const night=nightWeightAt(P.timeOfDay),gain=.32+.68*night;for(const {light,power}of lamps)light.intensity=power*gain;for(const sprite of glows)sprite.material.opacity=.24+.42*night;for(const {mat,strength}of spills)mat.opacity=strength*(.22+.78*night);for(const mat of windowMaterials)mat.emissiveIntensity=.58+night*.90;};update(0);
 root.userData.warmLighting={lamps:lamps.length,spills:spills.length,emissiveMaterials:windowMaterials.size,update};return update;
}

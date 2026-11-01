import * as THREE from 'three';
import {registerLocalLight} from '../render/lighting/localLightRegistry.js';
import {MOEBIUS_PALETTE} from './moebiusPalette.js';
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
 const practical=[],emitters=[],receivers=new Map();let bound=null;
 const report={version:'sighs-gate-night-lighting-2',bound:false,architectureReceivers:0,practicalLights:0,shadows:false,visualVerified:false};root.userData.report=report;
 function bindArchitecture(){
  const architecture=seat.userData.moebiusV10;if(!architecture||architecture===bound)return;bound=architecture;
  // The blue arch was unlit MeshBasicMaterial: added lamps alone cannot light it.
  // Preserve its ink shader and palette while letting actual local light reach it.
  const colors=['blue','cream','brass'].map(k=>new THREE.Color(MOEBIUS_PALETTE[k]).getHex());
  architecture.traverse(o=>{
   if(!o.isMesh)return;
   const convert=m=>{if(!m?.isMeshBasicMaterial||m.transparent||!colors.includes(m.color.getHex()))return m;
    if(!receivers.has(m)){const lit=new THREE.MeshStandardMaterial({color:m.color,roughness:.92,metalness:0,side:m.side,vertexColors:m.vertexColors,emissive:m.color,emissiveIntensity:.045});lit.name='sighs-lit-'+m.name;lit.onBeforeCompile=m.onBeforeCompile;lit.customProgramCacheKey=m.customProgramCacheKey;receivers.set(m,lit);}report.architectureReceivers++;return receivers.get(m);};
   o.material=Array.isArray(o.material)?o.material.map(convert):convert(o.material);
  });
  const brass=new THREE.MeshStandardMaterial({color:MOEBIUS_PALETTE.brass,roughness:.75,metalness:.2});
  const glow=new THREE.MeshStandardMaterial({color:0xffe2af,emissive:0xffcc83,emissiveIntensity:0,roughness:.7});
  function lamp(id,p,color,power,radius){
   const light=new THREE.PointLight(color,0,radius,2);light.name='sighs-'+id;light.position.fromArray(p);root.add(light);practical.push({light,power});
   registerLocalLight(light,{id:'gate:'+id,owner:'gate',radius,priority:1.6});
   const housing=new THREE.Mesh(new THREE.CylinderGeometry(.23,.30,.16,8),brass);housing.position.fromArray(p).y-=.16;root.add(housing);
   const lens=new THREE.Mesh(new THREE.SphereGeometry(.16,8,6),glow);lens.position.fromArray(p);root.add(lens);emitters.push(lens);
  }
  // Lamps sit against the outside of the eight botanical piers, not in the rail throat.
  for(const side of[-1,1])for(const [i,z]of[-23.76,-7.92,7.92,23.76].entries())lamp('pier-'+side+'-'+i,[side*7.85,10.2,z],0xffd09a,115,12);
  // High arch lights reveal the crown and gold rims; no large sky-facing floodlight.
  for(const [i,z]of[-23.76,-7.92,7.92,23.76].entries())lamp('arch-'+i,[0,18.45,z+.95],0xb4d9ed,100,10);
  // Existing walkway globes remain visible even when outside the shared real-light budget.
  architecture.traverse(o=>{if(o.isMesh&&/^g30-walk-lamp$/.test(o.name)){o.material=glow;emitters.push(o);}});
  report.bound=true;report.practicalLights=practical.length;
 }
 const update=phase=>{bindArchitecture();const dusk=Math.max(0,1-Math.abs(phase-.75)/.11),dawn=Math.max(0,1-Math.abs(phase-.28)/.08),night=1-THREE.MathUtils.smoothstep(Math.sin((phase-.25)*Math.PI*2),-.15,.25);key.intensity=2300*Math.max(dusk,dawn*.6);for(const l of lamps)l.intensity=24*night;for(const f of flames)f.material.emissiveIntensity=night*2.2;for(const {light,power}of practical)light.intensity=power*night;for(const e of emitters)e.material.emissiveIntensity=night*1.6;root.userData.phase=phase;report.night=night;};
 root.userData.update=update;update(.5);return root;
}

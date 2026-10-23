import * as THREE from 'three';
import {registerLocalLight,getLocalLightHub} from '../render/lighting/localLightRegistry.js';
import {MOEBIUS_PALETTE} from './moebiusPalette.js';
/** Local warm bounce and practical lamps follow the shared clock, never set it.
 * All fifteen logical PointLights exist at installation; the existing fixed
 * renderer pool adopts them before rendering and keeps its shader light count. */
export function installGateLighting(seat){
 const existing=seat.getObjectByName('gate-lighting');if(existing)return existing;
 const root=new THREE.Group();root.name='gate-lighting';seat.add(root);
 const registrations=[],register=(light,id,radius,priority)=>{registrations.push(registerLocalLight(light,{id,owner:'gate',radius,priority}));};
 const key=new THREE.PointLight(0xffa36f,0,125,2);key.name='gate-sunset-bounce';key.position.set(20,35,-30);root.add(key);register(key,'gate:sunset-bounce',125,1.2);
 const lamps=[],flames=[];
 for(const [i,p]of [[-28,5,-23],[-18,5,-23]].entries()){
  const light=new THREE.PointLight(0xffba63,0,11,2);light.name='gate-meeting-lamp-'+i;light.position.fromArray(p);root.add(light);lamps.push(light);register(light,'gate:meeting:'+i,11,1.4);
  const post=new THREE.Mesh(new THREE.CylinderGeometry(.06,.10,1.8,6),new THREE.MeshStandardMaterial({color:0x493327,roughness:1}));post.position.set(p[0],p[1]-.9,p[2]);root.add(post);
  const flame=new THREE.Mesh(new THREE.OctahedronGeometry(.17),new THREE.MeshStandardMaterial({color:0xffcd78,emissive:0xff9a38,emissiveIntensity:0,roughness:1}));flame.position.fromArray(p);root.add(flame);flames.push(flame);
 }
 const practical=[],emitters=[],receivers=new Map(),replaced=new Map(),emblemMaterials=new Map();let bound=null,boundEmblem=null,disposed=false;
 const brass=new THREE.MeshStandardMaterial({color:MOEBIUS_PALETTE.brass,roughness:.75,metalness:.2}),glow=new THREE.MeshStandardMaterial({color:0xffe2af,emissive:0xffcc83,emissiveIntensity:0,roughness:.7});
 function lamp(id,p,color,power,radius,emblemIndex=null){
  const light=new THREE.PointLight(color,0,radius,2);light.name='sighs-'+id;light.position.fromArray(p);root.add(light);register(light,'gate:'+id,radius,emblemIndex===null?1.6:1.8);
  // Emblems themselves are the visible emitter: no extra floating bulb beside them.
  const fixtures=[];
  if(emblemIndex===null){const housing=new THREE.Mesh(new THREE.CylinderGeometry(.23,.30,.16,8),brass),lens=new THREE.Mesh(new THREE.SphereGeometry(.16,8,6),glow);housing.position.fromArray(p).y-=.16;lens.position.fromArray(p);root.add(housing,lens);fixtures.push({mesh:housing,offset:[0,-.16,0]},{mesh:lens,offset:[0,0,0]});emitters.push(lens);}
  practical.push({light,power,p:[...p],fixtures,emblemIndex});
 }
 // Reuse eight of the previous twelve architectural lamp requests for the
 // eight existing crown collars. Radius/power only wash the adjacent blue pier.
 let index=0;for(const side of[-1,1])for(const [i,z]of[-23.76,-7.92,7.92,23.76].entries())lamp('emblem-'+side+'-'+i,[side*7.95,20.475,z],0xffcd8c,48,5.5,index++);
 for(const [i,z]of[-23.76,-7.92,7.92,23.76].entries())lamp('arch-'+i,[0,18.45,z+.95],0xb4d9ed,100,10);
 const report={version:'sighs-gate-night-lighting-3',bound:false,architectureReceivers:0,practicalLights:12,logicalPointLights:15,emblemLights:8,emblemMeshes:0,allocation:'existing twelve architectural requests; shared fixed renderer pool',shadows:false,visualVerified:false};root.userData.report=report;
 function bindArchitecture(){
  const architecture=seat.userData.moebiusV10;if(!architecture||(architecture===bound&&architecture.userData.crownEmblemMesh===boundEmblem))return;bound=architecture;boundEmblem=architecture.userData.crownEmblemMesh;report.emblemMeshes=0;
  const colors=['blue','cream','brass'].map(k=>new THREE.Color(MOEBIUS_PALETTE[k]).getHex());
  architecture.traverse(o=>{
   if(!o.isMesh)return;
   const original=o.material,convert=m=>{if(!m?.isMeshBasicMaterial||m.transparent||!colors.includes(m.color.getHex()))return m;
    if(!receivers.has(m)){const lit=new THREE.MeshStandardMaterial({color:m.color,roughness:.92,metalness:0,side:m.side,vertexColors:m.vertexColors,emissive:m.color,emissiveIntensity:.045});lit.name='sighs-lit-'+m.name;lit.onBeforeCompile=m.onBeforeCompile;lit.customProgramCacheKey=m.customProgramCacheKey;receivers.set(m,lit);}report.architectureReceivers++;return receivers.get(m);};
   o.material=Array.isArray(original)?original.map(convert):convert(original);
   if(o.name==='g30-walk-lamp'){o.material=glow;emitters.push(o);}if(o.material!==original&&!replaced.has(o))replaced.set(o,original);
   if(o.userData.gateCrownEmblem){report.emblemMeshes++;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.isMeshStandardMaterial)emblemMaterials.set(m,m.emissiveIntensity);}
  });
  // Meeting-terrace assembly moves pre-existing lamps; crown requests must
  // instead follow the actual final emblem positions in the architecture root.
  architecture.updateWorldMatrix(true,true);root.updateWorldMatrix(true,false);
  for(const p of practical){const mark=architecture.userData.crownEmblems?.[p.emblemIndex],position=mark?new THREE.Vector3(...mark.position).addScaledVector(new THREE.Vector3(...mark.outward),.6):new THREE.Vector3(...p.p);if(mark)root.worldToLocal(architecture.localToWorld(position));p.light.position.copy(position);for(const f of p.fixtures)f.mesh.position.copy(position).add(new THREE.Vector3(...f.offset));}
  report.bound=true;report.emblemSources=architecture.userData.crownEmblems?.length??0;
 }
 const update=phase=>{if(disposed)return;bindArchitecture();const dusk=Math.max(0,1-Math.abs(phase-.75)/.11),dawn=Math.max(0,1-Math.abs(phase-.28)/.08),night=1-THREE.MathUtils.smoothstep(Math.sin((phase-.25)*Math.PI*2),-.15,.25);key.intensity=2300*Math.max(dusk,dawn*.6);for(const l of lamps)l.intensity=24*night;for(const f of flames)f.material.emissiveIntensity=night*2.2;for(const {light,power}of practical)light.intensity=power*night;for(const e of emitters)e.material.emissiveIntensity=night*1.6;for(const m of emblemMaterials.keys())m.emissiveIntensity=.12+.58*night;root.userData.phase=phase;report.night=night;};
 root.userData.update=update;root.userData.dispose=()=>{if(disposed)return;disposed=true;for(const [mesh,original]of replaced)mesh.material=original;for(const [m,value]of emblemMaterials)m.emissiveIntensity=value;const gs=new Set(),ms=new Set([brass,glow,...receivers.values()]);root.traverse(o=>{if(o.isMesh){gs.add(o.geometry);ms.add(o.material);}});for(const g of gs)g.dispose();for(const m of ms)m.dispose();const hub=getLocalLightHub();for(const r of registrations)if(hub.get(r.lightId)?.object===r.object)hub.unregister(r.lightId);root.removeFromParent();root.clear();};update(.5);return root;
}

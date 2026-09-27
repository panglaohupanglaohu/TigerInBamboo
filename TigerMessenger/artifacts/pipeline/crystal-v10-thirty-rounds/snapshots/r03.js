import * as THREE from 'three';
import {installGateMoebiusV10} from './gateMoebiusV10.js';

// V10 is a separate civilization-specific pass; never changes global lighting or holy-city materials.
export const V10_RELEASE_ROUND=3;
export function crystalV10Round(){
 const q=new URLSearchParams(globalThis.location?.search||'');
 if(q.get('crystalV7')==='0'||q.has('crystalV9'))return 0;
 return q.has('crystalV10')?THREE.MathUtils.clamp(Number(q.get('crystalV10'))||0,0,30):V10_RELEASE_ROUND;
}
export function finishCrystalV10Scene({city,gate}){
 const round=crystalV10Round();if(!round)return;
 city.crystals.forEach(r=>r.group.userData.v10Round=round);
 restoreOriginalGate(gate);
 if(round>=2)blueCivilization(city,gate);
 installGateMoebiusV10(gate);
 if(round>=3)for(const [index,r]of city.crystals.entries()){
  const group=r.group.userData.v9Root;
  // Broader clustered silhouettes while retaining root/harbour placement and habitat elevations.
  group.children.filter(o=>o.name==='v9-crystal-prism').forEach((o,i)=>{
   o.position.x*=1.38;o.position.z*=1.38;
   o.scale.set(1.35,i===0?.88:1.03,1.35);
  });
  r.h=60.72*(index===0?1:.55);
 }
}
function blueCivilization(city,gate){
 const crystal=[0x9cdef5,0xd3f6fc,0x63a5d7,0x80c6e8];
 for(const r of city.crystals)r.group.userData.v9Root.traverse(o=>{
  if(!o.isMesh)return;
  if(o.name==='v9-crystal-prism')o.material=crystal.map(color=>new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}));
  else if(/floor|bracket|bridge|frame|stem/.test(o.name))o.material=new THREE.MeshBasicMaterial({color:/frame|stem/.test(o.name)?0x8a7c60:0x425674});
 });
 const rockColor=(mesh)=>{
  const g=mesh.geometry,n=g.attributes.normal,c=[];
  for(let i=0;i<n.count;i++){
   const shade=.68+.3*Math.abs(n.getY(i))+.12*n.getX(i);
   const color=new THREE.Color(0x345989).multiplyScalar(shade);c.push(color.r,color.g,color.b);
  }
  g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));mesh.material=new THREE.MeshBasicMaterial({vertexColors:true});
 };
 city.v7Shores.children.filter(o=>o.name.startsWith('v7-bank-rock-')).forEach(rockColor);
 gate.getObjectByName('gate-canyon-site-blender').children.filter(o=>o.name.startsWith('canyon-shoulder')).forEach(rockColor);
 for(const child of gate.userData.seatRoot.children){
  if(!/^(gate-arch-|leftTowerGroup$|rightTowerGroup$|channel-pier-)/.test(child.name))continue;
  child.traverse(o=>{if(o.isMesh&&!o.userData.isOutline){o.material=o.material.clone();o.material.color.setHex(o.name==='mech-strip'?0x87785d:0x42648b);}});
 }
}
function restoreOriginalGate(gate){
 const seat=gate.userData.seatRoot;
 const target=seat.getObjectByName('gate-target-blender-v1');
 for(const child of target.children){
  if(!child.isMesh)continue;
  // Keep the existing walkable meeting platform/stairs, not an invisible fortress collider.
  child.visible=!!child.userData.gateWalkable;
  child.userData.citadelSolidExterior=child.visible&&!!child.userData.gateSolid;
 }
 for(const child of seat.children){
  if(!/^(gate-arch-|leftTowerGroup$|rightTowerGroup$|channel-pier-)/.test(child.name))continue;
  child.visible=true;
  child.traverse(o=>{if(o.isMesh&&!o.userData.isOutline&&o.name!=='mech-strip'&&o.name!=='rubble')o.userData.citadelSolidExterior=true;});
 }
 for(const mesh of seat.userData.gateDressing||[])if(mesh.parent===seat)mesh.visible=false;
 seat.userData.v10OriginalGateRestored=true;
}

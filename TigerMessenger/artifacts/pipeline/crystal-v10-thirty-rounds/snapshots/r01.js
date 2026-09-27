import * as THREE from 'three';

// V10 is a separate civilization-specific pass; never changes global lighting or holy-city materials.
export const V10_RELEASE_ROUND=1;
export function crystalV10Round(){
 const q=new URLSearchParams(globalThis.location?.search||'');
 if(q.get('crystalV7')==='0'||q.has('crystalV9'))return 0;
 return q.has('crystalV10')?THREE.MathUtils.clamp(Number(q.get('crystalV10'))||0,0,30):V10_RELEASE_ROUND;
}
export function finishCrystalV10Scene({city,gate}){
 const round=crystalV10Round();if(!round)return;
 city.crystals.forEach(r=>r.group.userData.v10Round=round);
 restoreOriginalGate(gate);
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

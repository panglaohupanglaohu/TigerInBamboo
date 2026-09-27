import * as THREE from 'three';
// Distance to the vehicle side, not the locomotive's centre. Long consists can
// be boarded at each wagon; height gate prevents boarding through a high bridge.
export function freightBoardDistance(vehicle,position){
 vehicle.updateWorldMatrix(true,false);
 const p=vehicle.worldToLocal(position.clone());
 const freight=vehicle.userData.vehicleType==='freight'||vehicle.userData.cargoSlot!==undefined;
 const halfLength=vehicle.userData.couplingHalfLength||(freight?2.87:2.5);
 const halfWidth=vehicle.userData.cargoSlot!==undefined?1.65:freight?1.3:1.1;
 if(p.y < -2.3 || p.y > 3.1)return Infinity;
 return Math.hypot(Math.max(0,Math.abs(p.x)-halfLength),Math.max(0,Math.abs(p.z)-halfWidth));
}

import {createFreightSteam} from './freightSteam.js';
import * as THREE from 'three';
import {mergeStaticGroup} from '../world/geometryMerge.js';
// Moving overlays are separate from the existing merged body and its source asset.
export function addFreightMotion(vehicle,{locomotive=false,heavy=false}={}){
 const root=new THREE.Group();root.name='freight-running-gear';vehicle.add(root);
 const metal=new THREE.MeshStandardMaterial({color:0x9c8559,metalness:.55,roughness:.62}),spokes=[],rods=[];
 const radius=heavy?.24:.247,axles=heavy?[-2.49,-1.81,1.81,2.49]:[-1.5,-1.04,1.04,1.5].map(x=>x*1.45),centerY=heavy?.11:.091,sideZ=heavy?.973:1.025;
 for(const x of axles)for(const side of[-1,1]){
  const hub=new THREE.Group();hub.name='freight-wheel-spokes';hub.position.set(x,centerY,side*sideZ);root.add(hub);spokes.push(hub);
  for(let i=0;i<3;i++){const spoke=new THREE.Mesh(new THREE.BoxGeometry(radius*1.66,.022,.018),metal);spoke.rotation.z=i*Math.PI/3;hub.add(spoke);}
  mergeStaticGroup(hub);
 }
 if(locomotive)for(const side of[-1,1])for(const index of[0,2]){
  const length=axles[index+1]-axles[index],rod=new THREE.Mesh(new THREE.BoxGeometry(length+.06,.045,.035),metal);rod.name='freight-piston-link';rod.position.set((axles[index]+axles[index+1])/2,centerY,side*(sideZ+.035));rod.userData.baseX=rod.position.x;root.add(rod);rods.push(rod);
 }
 const steam=locomotive?createFreightSteam(vehicle):null;
 root.traverse(o=>{if(o.isMesh)o.userData.noDistanceCulling=true;});
 let distance=0,time=0;
 return{update(dt,travel=0){time+=dt;distance+=travel;const phase=-distance/radius;for(const wheel of spokes)wheel.rotation.z=phase;for(const rod of rods){rod.position.x=rod.userData.baseX+Math.cos(phase)*radius*.47;rod.position.y=centerY+Math.sin(phase)*radius*.47;}
  steam?.update(dt,travel);
 }};
}

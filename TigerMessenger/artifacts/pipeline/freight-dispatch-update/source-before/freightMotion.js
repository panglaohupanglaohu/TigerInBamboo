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
 let steam=null;const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),scale=new THREE.Vector3(),rotation=new THREE.Quaternion();
 if(locomotive){steam=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshLambertMaterial({color:0xe3e3d2,transparent:true,opacity:.5,depthWrite:false}),10);steam.name='freight-chimney-steam';steam.frustumCulled=false;vehicle.add(steam);}
 root.traverse(o=>{if(o.isMesh)o.userData.noDistanceCulling=true;});if(steam)steam.userData.noDistanceCulling=true;
 let distance=0,time=0;
 return{update(dt,travel=0){time+=dt;distance+=travel;const phase=-distance/radius;for(const wheel of spokes)wheel.rotation.z=phase;for(const rod of rods){rod.position.x=rod.userData.baseX+Math.cos(phase)*radius*.47;rod.position.y=centerY+Math.sin(phase)*radius*.47;}
  if(steam){const speed=dt>0?Math.min(9,Math.abs(travel/dt)):0;for(let i=0;i<10;i++){const age=(time+i*.25)%2.5,size=(.18+age*.27)*Math.min(1,age*6)*Math.min(1,(2.5-age)*3);position.set(-2.1025-age*(.45+speed*.25),2.57+age*.8,Math.sin(i*2.4+age)*.14*age);scale.setScalar(size);matrix.compose(position,rotation,scale);steam.setMatrixAt(i,matrix);}steam.instanceMatrix.needsUpdate=true;}
 }};
}

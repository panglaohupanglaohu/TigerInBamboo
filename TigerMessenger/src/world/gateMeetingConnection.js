import * as THREE from 'three';

// Re-seat the existing meeting terrace against the west gallery, not a new stage.
export function connectGateMeeting(gate,root){
 const seat=gate.userData.seatRoot,target=seat.getObjectByName('gate-target-blender-v1');
 if(target.userData.connectedToGate)return;
 const shift=new THREE.Vector3(9,-3.26,6);
 target.position.add(shift);
 const originals=[...root.children];
 for(const o of originals)if(o.name.startsWith('v8-meeting-')){
  // Open a 3m passage in the terrace's gate-facing railing.
  if(o.name==='v8-meeting-handrail'&&Math.abs(o.position.x+16.45)<.01){
   for(const [a,b]of [[-24.4,-20.8],[-17.8,-15.45]]){const rail=o.clone();rail.geometry=new THREE.BoxGeometry(b-a,.065,.075);rail.position.z=(a+b)/2;rail.position.add(shift);root.add(rail);}o.removeFromParent();continue;
  }
  if(/baluster|finial/.test(o.name)&&Math.abs(o.position.x+16.45)<.02&&o.position.z>-20.8&&o.position.z<-17.8){o.removeFromParent();continue;}
  o.position.add(shift);
 }
 const lights=seat.getObjectByName('gate-lighting');for(const o of lights?.children||[])if(o.name!=='gate-sunset-bounce')o.position.add(shift);
 // Match the opening in the gallery guard, so the visible bridge is walkable.
 for(const o of [...root.children]){
  if(o.name==='v14-side-gallery-rail'&&o.position.x<0){
   for(const [a,b]of [[-23.7,-14.8],[-11.8,23.7]]){const rail=o.clone();rail.geometry=new THREE.BoxGeometry(.07,.07,b-a);rail.position.z=(a+b)/2;root.add(rail);}o.removeFromParent();
  }
  if(o.name==='v14-side-gallery-post'&&o.position.x<0&&o.position.z>-14.8&&o.position.z<-11.8)o.removeFromParent();
 }
 const mat=new THREE.MeshBasicMaterial({color:0xeee0c3});
 const bridge=new THREE.Mesh(new THREE.BoxGeometry(2.6,.3,3),mat);bridge.name='meeting-gallery-connection';bridge.position.set(-6.7,-.15,-13.3);bridge.userData.gateWalkable=true;root.add(bridge);
 for(const z of [-14.8,-11.8]){const rail=new THREE.Mesh(new THREE.BoxGeometry(2.6,.08,.08),new THREE.MeshStandardMaterial({color:0xc1a16d}));rail.position.set(-6.7,1.05,z);rail.name='meeting-bridge-rail';rail.userData.citadelSolidExterior=true;root.add(rail);}
 target.userData.connectedToGate=true;root.userData.meetingShift=shift.toArray();gate.userData.meetingConnection={shift:shift.toArray(),bridgeCenter:[-6.7,0,-13.3],width:3};
}

export function removeRequestedGateMountains(gate){
 const site=gate.userData.seatRoot.userData.siteRoot;
 const removed=[];
 for(const name of ['canyon-shoulder-1','canyon-shoulder--1']){
  const o=site.getObjectByName(name);if(o){o.removeFromParent();removed.push(name);}
 }
 site.userData.removedRequestedMountains=removed;
}

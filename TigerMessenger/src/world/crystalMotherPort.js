import * as THREE from 'three';
import {CRYSTAL_MOTHER_PORT as DATA} from '../assets/crystalMotherPortData.js';
import {createFisherBoat} from '../assets/harbor.js';
import {createBoardingGate} from './citadel/boardingGate.js';
import {toonMat} from '../assets/toon.js';

export function buildCrystalMotherPort({scene,platforms,city,boats}) {
 const expected=new THREE.Vector3(...DATA.mother.dir);
 if(!city?.grand||city.grand.dir.angleTo(expected)>.001||Math.abs(city.grand.root-DATA.mother.root)>.1)return null;
 const root=new THREE.Group();root.name='crystal-mother-port';root.position.fromArray(DATA.berthPosition);root.quaternion.fromArray(DATA.berthQuaternion);scene.add(root);root.updateMatrixWorld(true);
 const records=[],surfaces=[],stone=toonMat(0xb6d2d7),metal=toonMat(0x476775),gold=toonMat(0xd5b16c);
 function platform(a,b,width,thickness,name,mat=stone,parent=root,collision=true){
  const forward=b.clone().sub(a).normalize(),mid=a.clone().add(b).multiplyScalar(.5),up=new THREE.Vector3(0,1,0),right=up.clone().cross(forward).normalize();up.copy(forward).cross(right).normalize();
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(width,thickness,a.distanceTo(b)),mat);mesh.name=name;mesh.position.copy(mid).addScaledVector(up,-thickness/2);mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,forward));mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);surfaces.push(mesh);
  if(collision){const record={mesh,center:new THREE.Vector3(),normal:new THREE.Vector3(),right:new THREE.Vector3(),forward:new THREE.Vector3(),half:new THREE.Vector3(width/2,thickness/2,a.distanceTo(b)/2),topHeight:0};
   record.refresh=()=>{mesh.updateWorldMatrix(true,false);const q=mesh.getWorldQuaternion(new THREE.Quaternion());record.normal.set(0,1,0).applyQuaternion(q);record.right.set(1,0,0).applyQuaternion(q);record.forward.set(0,0,1).applyQuaternion(q);mesh.getWorldPosition(record.center).addScaledVector(record.normal,thickness/2);record.topHeight=record.center.length();};
   record.topHeightAt=pos=>record.center.dot(record.normal)/pos.clone().normalize().dot(record.normal);record.refresh();records.push(record);platforms.push(record);
  }return mesh;
 }
 function box(size,pos,name,mat=metal){const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),mat);mesh.position.set(...pos);mesh.name=name;mesh.castShadow=true;root.add(mesh);surfaces.push(mesh);return mesh;}
 const low=1.45;
 for(const x of [1,6.1])box([.32,13.45,.32],[x,-5.275,7.05],'mother-port-quay-pile');
 platform(new THREE.Vector3(.7,low,6.1),new THREE.Vector3(6.4,low,6.1),2.4,.35,'mother-port-quay');
 platform(new THREE.Vector3(3.57,low,3.3),new THREE.Vector3(3.57,low,5),1,.22,'mother-port-connector');
 const towardBerth=root.position.clone().normalize().addScaledVector(expected,-root.position.clone().normalize().dot(expected)).normalize();
 const landingWorld=expected.clone().multiplyScalar(city.grand.root).addScaledVector(towardBerth,city.grand.r+1.5).normalize().multiplyScalar(city.grand.root+.35);
 const landing=root.worldToLocal(landingWorld.clone()),high=Math.max(low+3,landing.y),liftX=3.57,liftZ=6.1;
 const lift=new THREE.Group();lift.name='mother-port-lift';root.add(lift);
 platform(new THREE.Vector3(liftX,0,liftZ-.9),new THREE.Vector3(liftX,0,liftZ+.9),1.8,.25,'mother-port-lift-floor',gold,lift);
 platform(new THREE.Vector3(liftX-.85,1.05,liftZ+.9),new THREE.Vector3(liftX+.85,1.05,liftZ+.9),.1,.14,'mother-port-lift-rail',metal,lift);
 const fixedRecords=records.slice(0,2),liftRecords=records.slice(2);lift.position.y=low;
 platform(new THREE.Vector3(liftX,high,liftZ-1.1),landing,2.4,.35,'mother-port-upper-walk');
 platform(landing.clone().add(new THREE.Vector3(-1.6,0,0)),landing.clone().add(new THREE.Vector3(1.6,0,0)),3,.35,'mother-port-tower-landing');
 const walkStart=new THREE.Vector3(liftX,high,liftZ-1.1),walkSide=new THREE.Vector3(0,1,0).cross(landing.clone().sub(walkStart).normalize());
 for(const sign of [-1,1]){
  const a=walkStart.clone().addScaledVector(walkSide,sign*1.15),b=landing.clone().addScaledVector(walkSide,sign*1.15);a.y+=1.05;b.y+=1.05;
  platform(a,b,.1,.14,'mother-port-upper-rail',metal);
  for(const t of [0,.33,.66,1]){const point=a.clone().lerp(b,t);box([.1,1,.1],[point.x,point.y-.5,point.z],'mother-port-rail-post');}
 }
 platform(new THREE.Vector3(.7,low+1.05,7.2),new THREE.Vector3(6.4,low+1.05,7.2),.1,.14,'mother-port-quay-rail',metal);
 for(const x of [liftX-1.25,liftX+1.25])box([.24,high+12,.24],[x,(high-12)/2,liftZ],'mother-port-lift-guide');
 // Portal frame stays outside the moving lift, and the upper walk starts at
 // its edge so there is no slab above the passenger's head during ascent.
 box([3,.22,.28],[liftX,high+2.8,liftZ],'mother-port-lift-header');
 root.updateMatrixWorld(true);records.forEach(p=>p.refresh());
 const boat=createFisherBoat();boat.name='crystal-mother-port-boat';boat.scale.setScalar(1.84);boat.position.fromArray(DATA.berthPosition);boat.quaternion.fromArray(DATA.berthQuaternion);scene.add(boat);
 boat.userData.crystalMotherPortResident=true;boat.userData.harborDocked=true;boat.userData.canalPatrol=true;boats?.push(boat);
 const gate=createBoardingGate(p=>{boat.userData.warshipV6.setBoarding(p);boat.userData.warshipV6.update(0,false);});boat.userData.boardingGate=gate;
 const boardingLocal=[new THREE.Vector3(3.57,low,5.2),new THREE.Vector3(3.57,low,3.3),new THREE.Vector3(3.57,1.34,.88)];
 boat.userData.boardingRoute=boardingLocal.map(p=>root.localToWorld(p.clone()));boat.userData.boardingBerthOrigin=boat.position.clone();
 const poses=DATA.poses.map(p=>({p:new THREE.Vector3(...p.position),q:new THREE.Quaternion(...p.quaternion)})),lengths=poses.slice(1).map((p,i)=>p.p.distanceTo(poses[i].p)),total=lengths.reduce((a,b)=>a+b,0);let progress=total,initialTime=null;
 boat.userData.portNavigation={step(dt,thrust){progress=THREE.MathUtils.clamp(progress+thrust*DATA.speed*dt,0,total);let rest=progress;for(let i=1;i<poses.length;i++){if(rest<=lengths[i-1]||i===poses.length-1){const u=THREE.MathUtils.clamp(rest/lengths[i-1],0,1);boat.position.copy(poses[i-1].p).lerp(poses[i].p,u);boat.quaternion.copy(poses[i-1].q).slerp(poses[i].q,u);break;}rest-=lengths[i-1];}},atBerth:()=>progress>=total-.15,get progress(){return progress/total;}};
 function update(time){if(initialTime===null || time<initialTime)initialTime=time;const t=(time-initialTime)%26;const v=t<5?0:t<11?(t-5)/6:t<17?1:t<23?1-(t-17)/6:0;const eased=v*v*(3-2*v);lift.position.y=THREE.MathUtils.lerp(low,high,eased);liftRecords.forEach(p=>p.refresh());}
 fixedRecords[0].update=update;
 function rotateWorld(q) {
  for (const o of [root, boat]) { o.position.applyQuaternion(q); o.quaternion.premultiply(q); o.updateMatrixWorld(true); }
  for (const pose of poses) { pose.p.applyQuaternion(q); pose.q.premultiply(q); }
  boat.userData.boardingRoute.forEach(p=>p.applyQuaternion(q));
  boat.userData.boardingBerthOrigin.applyQuaternion(q);
  landingWorld.applyQuaternion(q);
  records.forEach(p=>p.refresh());
 }
 return {root,boat,surfaces,records,lift,update,rotateWorld,low,high,landing:landingWorld,boardingRoute:boat.userData.boardingRoute,source:DATA};
}

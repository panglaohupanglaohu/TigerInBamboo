import * as THREE from 'three';
import {createBoardingGate} from './boardingGate.js';

/** Isolated authoring controller; installation does not enable production boarding. */
export function installBoardingCandidate(boat, landing) {
  const api=boat.userData.warshipV6;
  if(!api?.refreshStaticGeometry)throw Error('Original warship authoring API required');
  const changes=landing.widthAdjustment.changes;
  const originalUpdate=api.update, originalSetBoarding=api.setBoarding;
  const old=new Map(changes.map(c=>{const n=api.nodes.get(c.id);if(!n)throw Error('Missing ship node '+c.id);n.updateMatrix();return [c.id,n.matrix.clone()];}));
  let progress=1;
  originalSetBoarding(1);originalUpdate(0,0);
  const hinge=api.nodes.get('add:boarding-hinge'),anchor=hinge.position.clone();
  for(const c of changes)new THREE.Matrix4().fromArray(c.matrix).decompose(api.nodes.get(c.id).position,api.nodes.get(c.id).quaternion,api.nodes.get(c.id).scale);
  api.refreshStaticGeometry(Object.fromEntries(changes.filter(c=>c.geometry).map(c=>[c.id,c.geometry])));
  api.setBoarding=value=>{progress=THREE.MathUtils.clamp(value,0,1);originalSetBoarding(progress);};
  api.update=(dt,moving)=>{
    originalUpdate(dt,moving);
    const eased=progress*progress*(3-2*progress);
    hinge.position.copy(anchor);
    hinge.quaternion.setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2+(landing.degrees*Math.PI/180+Math.PI/2)*eased);
    hinge.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),landing.roll*eased));
    api.render();
  };
  api.update(0,0);
  const setProgress=value=>{api.setBoarding(value);api.update(0,0);};
  let lifecycle=null;
  return {setProgress,createLifecycle(){if(!lifecycle){lifecycle=createBoardingGate(setProgress);boat.userData.boardingGate=lifecycle;}return lifecycle;},dispose(){
    if(boat.userData.boardingGate===lifecycle)delete boat.userData.boardingGate;
    api.update=originalUpdate;api.setBoarding=originalSetBoarding;
    for(const [id,m]of old)m.decompose(api.nodes.get(id).position,api.nodes.get(id).quaternion,api.nodes.get(id).scale);
    originalSetBoarding(0);originalUpdate(0,0);api.refreshStaticGeometry();
  }};
}

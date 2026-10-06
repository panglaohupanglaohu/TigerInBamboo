import * as THREE from 'three';
/** Review candidate: retarget the existing sun's shadow camera to the citadel
 * while preserving its light direction, colour and intensity. */
export function fitTargetCitySunShadow(scene,castle){
 const sun=scene.children.find(o=>o.isDirectionalLight&&o.castShadow&&o.visible&&o.name==='');
 if(!sun)return{report:{applied:false,reason:'primary-sun-unavailable'},dispose(){}};
 const camera=sun.shadow.camera,keys=['near','far','left','right','top','bottom'];
 const before={position:sun.position.clone(),target:sun.target.position.clone(),camera:Object.fromEntries(keys.map(k=>[k,camera[k]])),bias:sun.shadow.bias,normalBias:sun.shadow.normalBias};
 const direction=sun.getWorldPosition(new THREE.Vector3()).sub(sun.target.getWorldPosition(new THREE.Vector3())).normalize();
 const focus=castle.localToWorld(new THREE.Vector3(0,12,25));sun.target.position.copy(sun.target.parent?sun.target.parent.worldToLocal(focus.clone()):focus);const p=focus.clone().addScaledVector(direction,250);sun.position.copy(sun.parent?sun.parent.worldToLocal(p):p);sun.updateWorldMatrix(true,false);sun.target.updateWorldMatrix(true,false);
 Object.assign(camera,{near:60,far:440,left:-145,right:145,top:125,bottom:-125});camera.updateProjectionMatrix();sun.shadow.bias=-.00035;sun.shadow.normalBias=.12;sun.shadow.needsUpdate=true;
 const report={applied:true,lightUUID:sun.uuid,direction:direction.toArray(),focus:focus.toArray(),shadowBounds:Object.fromEntries(keys.map(k=>[k,camera[k]])),bias:sun.shadow.bias,normalBias:sun.shadow.normalBias,intensityUnchanged:true,colourUnchanged:true,scope:'review-only primary sun shadow coverage; restore when candidate closes',gpuVerified:false};
 let disposed=false;return{report,dispose(){if(disposed)return;disposed=true;sun.position.copy(before.position);sun.target.position.copy(before.target);Object.assign(camera,before.camera);camera.updateProjectionMatrix();sun.shadow.bias=before.bias;sun.shadow.normalBias=before.normalBias;sun.shadow.needsUpdate=true;}};
}

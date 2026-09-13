import * as THREE from 'three';
import {createOceanHeightSampler} from './oceanSurface.js';

// Current layout: build-time placement, before harbor, actors and collision
// caches are created. This must never be applied later to a running battle.
export function commonSurfaceFrameEnabled(){
 return typeof location!=='undefined'&&new URLSearchParams(location.search).get('citadelCommonFrame')!=='0';
}
export function applyCitadelCommonSurfaceFrame(castle,radius,{pivot=[-10,55]}={}){
 if(castle.userData.commonSurfaceFrame)return castle.userData.commonSurfaceFrame;
 if(!(radius>0))throw new Error('Citadel surface frame needs the real planet radius');
 castle.updateWorldMatrix(true,true);castle.updateMatrix();
 const original=castle.matrix.clone(),sea=createOceanHeightSampler(castle,radius);
 const [x,z]=pivot,anchor=new THREE.Vector3(x,sea(x,z),z);
 const up=castle.localToWorld(anchor.clone()).normalize().transformDirection(castle.matrixWorld.clone().invert());
 const side=new THREE.Vector3(1,0,0).addScaledVector(up,-up.x).normalize();
 const forward=new THREE.Vector3().crossVectors(side,up).normalize();
 const delta=new THREE.Matrix4().makeBasis(side,up,forward);delta.setPosition(anchor);
 delta.multiply(new THREE.Matrix4().makeTranslation(-x,0,-z));
 if(!delta.elements.every(Number.isFinite)||Math.abs(delta.determinant()-1)>1e-6)throw new Error('Invalid citadel surface frame');
 castle.matrix.copy(original).multiply(delta);castle.matrix.decompose(castle.position,castle.quaternion,castle.scale);
 castle.updateWorldMatrix(true,true);
 return castle.userData.commonSurfaceFrame={version:1,pivot:[x,z],radius,originalMatrix:original.toArray(),delta:delta.toArray(),status:'current layout; full battle validation pending'};
}

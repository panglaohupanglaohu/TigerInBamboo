import * as THREE from 'three';
import {officialOceanLevelAt} from '../waterV8/officialOcean.js';
export function oldHarborGradeEnabled(){return typeof location!=='undefined'&&new URLSearchParams(location.search).get('citadelOldHarbor')!=='0';}
/** Build-time original-port placement. Boat and collider adjustment remains in
 * loadCitadel, before logistics/combat/ride initialization captures references. */
export function placeOldHarborAtOcean(castle,harbor,radius=160){
 if(!castle.userData.commonSurfaceFrame)throw new Error('Old harbor grade requires common citadel frame');
 castle.updateWorldMatrix(true,false);harbor.updateWorldMatrix(true,false);
 const sourceX=new THREE.Vector3(0,0,-1).transformDirection(harbor.matrixWorld);
 const parentInverse=harbor.parent.matrixWorld.clone().invert();
 const parentQ=harbor.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
 const corners=[[-3.6,.51,-2.1],[-3.6,.51,2.1],[3.6,.51,-2.1],[3.6,.51,2.1]];
 const altitude=p=>p.length()-radius-officialOceanLevelAt(p);
 const setPose=y=>{
  const point=castle.localToWorld(new THREE.Vector3(-60,y,52)),up=point.clone().normalize();
  const x=sourceX.clone().addScaledVector(up,-sourceX.dot(up)).normalize();
  if(x.lengthSq()<.9)throw new Error('Degenerate harbor forward axis');
  const z=new THREE.Vector3().crossVectors(x,up).normalize();
  harbor.position.copy(point).applyMatrix4(parentInverse);
  harbor.quaternion.copy(parentQ).multiply(new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,up,z)));
  harbor.updateMatrixWorld(true);
 };
 let low=-100,high=50;
 for(let i=0;i<44;i++){const y=(low+high)/2;setPose(y);const min=Math.min(...corners.map(p=>altitude(harbor.localToWorld(new THREE.Vector3(...p)))));if(min>.7)high=y;else low=y;}
 const y=(low+high)/2;setPose(y);
 const report={version:1,castleLocal:[-60,y,52],deckClearances:corners.map(p=>altitude(harbor.localToWorld(new THREE.Vector3(...p)))),frame:'harbor-own-radial-up',status:'current shore layout; automatic logistics and full boarding validation pending'};
 harbor.userData.oldHarborOceanGrade=report;return report;
}

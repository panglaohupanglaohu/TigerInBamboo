import * as THREE from 'three';
import {installBoardingCandidate} from './boardingCandidate.js';
import {buildBoardingRoute} from './boardingRoute.js';

export async function installFrontBoarding(scene,boat) {
  if(boat.userData.boardingInstallation)return;
  boat.userData.boardingInstallation='loading';
  let controller=null,shoe=null,step=null;
  const previousPosition=boat.position.clone(),previousQuaternion=boat.quaternion.clone();
  try {
    const response=await fetch(new URL('../../../assets/models/optimized/citadel-boarding-r04/berth.json',import.meta.url));
    if(!response.ok)throw Error('Boarding berth data '+response.status);
    const data=await response.json(),city=scene.getObjectByName('highland-west-city');
    if(!city||boat.userData.piloted)throw Error('Berth unavailable while boarding data loads');
    city.updateWorldMatrix(true,true);
    const transform=new THREE.Matrix4().compose(new THREE.Vector3().fromArray(data.native.position),new THREE.Quaternion().fromArray(data.native.quaternion),new THREE.Vector3().fromArray(data.native.scale));
    transform.premultiply(city.matrixWorld);transform.decompose(boat.position,boat.quaternion,boat.scale);
    controller=installBoardingCandidate(boat,data.landing);
    const material=new THREE.MeshStandardMaterial({color:0x785438,roughness:.9});
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(data.landing.vertices.flat(),3));geometry.setIndex(data.landing.indices);geometry.computeVertexNormals();
    shoe=new THREE.Mesh(geometry,material);shoe.name='citadel-boarding-bearing';city.add(shoe);
    step=new THREE.Mesh(new THREE.BoxGeometry(...data.step.size),material);step.position.fromArray(data.step.center);step.name='citadel-boarding-step';city.add(step);
    scene.updateMatrixWorld(true);
    const surfaces=[shoe,step];city.traverse(n=>{if(n.name==='integrated-quay-strip')surfaces.push(n);});
    boat.traverse(n=>{if(n.isMesh){if(n.isInstancedMesh)n.computeBoundingSphere();surfaces.push(n);}});
    const route=buildBoardingRoute(boat,city,data,surfaces);
    controller.createLifecycle();
    boat.userData.boardingRoute=route;
    boat.userData.frontHarborBerth={position:boat.position.clone(),exit:route[0].clone(),source:'citadel-boarding-r04',unloadingReady:false};
    delete boat.userData.harborHoldingBerth;
    boat.userData.boardingInstallation='ready';
  } catch(error) {
    controller?.dispose();shoe?.removeFromParent();step?.removeFromParent();
    boat.position.copy(previousPosition);boat.quaternion.copy(previousQuaternion);
    boat.userData.boardingInstallation='failed';boat.userData.boardingError=String(error);
    console.error('Citadel boarding installation failed',error);
  }
}

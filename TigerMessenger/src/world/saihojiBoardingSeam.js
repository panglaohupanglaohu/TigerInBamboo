import * as THREE from 'three';
const installed=new WeakMap();
/** Isolated V11 candidate. A real timber mesh closes the measured 0.476m
 * world-space gap between the inner plank and existing bow landing.
 * This grants no boarding permission; support, body clearance and the full
 * deployment sweep must be checked with the new mesh present.
 */
export function installSaihojiBoardingSeam(boat){
 if(installed.has(boat))return installed.get(boat);
 if(!boat?.userData?.warshipV6?.nodes?.has('add:bow-landing'))throw Error('V11 bow landing required');
 let timber;
 boat.traverse(o=>{if(timber||!o.isMesh)return;const mats=Array.isArray(o.material)?o.material:[o.material];timber=mats.find(m=>/wood|timber|deck|hull/i.test(m?.name||''));});
 const material=timber?.clone()||new THREE.MeshToonMaterial({color:0x805a39});
 material.name='candidate-bow-seam-timber';
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(.44,.045,.42),material);
 mesh.name='saihoji-candidate-bow-seam';mesh.position.set(1.94,.66,.68);
 mesh.castShadow=mesh.receiveShadow=true;
 mesh.userData.walkableShipSupport=true;
 mesh.userData.candidateOnly=true;
 boat.add(mesh);boat.updateWorldMatrix(true,true);
 const controller={mesh,remove(){if(installed.get(boat)!==controller)return false;mesh.removeFromParent();mesh.geometry.dispose();material.dispose();installed.delete(boat);return true;}};
 installed.set(boat,controller);return controller;
}

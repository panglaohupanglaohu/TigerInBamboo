import * as THREE from 'three';
import {orientWarship} from '../warshipNavigation.js';
import {CITADEL_HARBOR_WATER_PLAN as plan} from './harborWaterPlan.js';
import {installFrontBoarding} from './installFrontBoarding.js';

function holdAtReleasedPort(scene,front,boat){
 const city=scene.getObjectByName('highland-west-city'),water=scene.getObjectByName('planet-v8-curved-ocean');
 if(!city||!water)return null;
 city.updateWorldMatrix(true,false);water.updateWorldMatrix(true,false);
 const [x,z]=plan.holdingBerth.center, direction=city.localToWorld(new THREE.Vector3(x,0,z)).normalize();
 const ray=new THREE.Raycaster(direction.clone().multiplyScalar(250),direction.clone().negate(),0,130);
 ray.layers.enableAll();
 const hit=ray.intersectObject(water,false)[0];
 if(!hit)return null;
 if(boat.parent!==scene)scene.attach(boat);
 boat.position.copy(direction).multiplyScalar(hit.point.length()-.25);
 const [hx,hz]=plan.holdingBerth.heading;
 orientWarship(boat,direction,new THREE.Vector3(hx,0,hz).transformDirection(city.matrixWorld));
 // Holding is deliberately separate from the legacy boarding berth: no invented
 // shore exit / instant quay transfer before its connector is built and checked.
 delete boat.userData.frontHarborBerth;
 boat.userData.harborHoldingBerth={position:boat.position.clone(),source:'citadel-released-holding-r01',boardingConnected:false};
 boat.userData.harborDocked=true;boat.userData.needsSnap=false;
 front.userData.residentBoat=boat.name;
 installFrontBoarding(scene,boat);
 return boat;
}

// Measured against the actual front quay and current V11 hull, not a prop clone.
export function dockFrontHarborPatrol(scene, boats) {
 const front=scene.getObjectByName('citadel-front-harbor'),boat=boats?.find(b=>b.userData.oceanPatrol);
 if(!front||!boat||Math.abs(boat.scale.x-1.84)>.001)return null;
 if(front.userData.integratedCandidate)return holdAtReleasedPort(scene,front,boat);
 front.updateWorldMatrix(true,false);
 const position=front.localToWorld(new THREE.Vector3(39.986712877064,-4.403200209945,100.248986480844));
 const q=front.getWorldQuaternion(new THREE.Quaternion()).multiply(new THREE.Quaternion(-.03088737415325818,-.9793345273455887,-.10954532137472281,-.16718156666217138));
 if(boat.parent!==scene)scene.attach(boat);
 boat.position.copy(position);boat.quaternion.copy(q);
 const exit=front.localToWorld(new THREE.Vector3(37.997546407905,-1.643661124769,95.797909951833));
 boat.userData.frontHarborBerth={position:position.clone(),exit,source:'front-port-original-patrol-v1',unloadingReady:false};
 boat.userData.harborDocked=true;boat.userData.needsSnap=false;
 front.userData.residentBoat=boat.name;
 return boat;
}

import * as THREE from 'three';
// Airship escort gulls from REACodeRefactoring/src/life/birds.js (1244892370392489989 "Better Birdies").
// The vendored Birds class builds the flying-gull instanced mesh (wing-flap shader driven by aWing);
// this adapter exposes that mesh with the set/commit API the escort manager drives externally.
import {Birds} from '../vendor/townscaper-rea-refactoring/src/life/birds.js';
export function createGullFlightFlock({max=96}={}){
 const birds=new Birds({max,water:{value:new THREE.Color('#5f9fa8')}});
 const mesh=birds.fly;mesh.removeFromParent();mesh.name='reacode-refactoring-gull-flight-flock';mesh.castShadow=false;mesh.count=0;
 const wingAttr=birds.wingAttr;
 return{mesh,wingAttr,
  set(i,matrix,wing){mesh.setMatrixAt(i,matrix);wingAttr.array[i]=wing;},
  commit(count){mesh.count=Math.min(max,count);mesh.instanceMatrix.needsUpdate=true;wingAttr.needsUpdate=true;},
  dispose(){birds.dispose?.();mesh.geometry.dispose();mesh.material.dispose();}};
}

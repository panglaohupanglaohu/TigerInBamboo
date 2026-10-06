import * as THREE from 'three';
import {bayLayoutEnabled,bayRotation,bayWeight,BAY_SEPARATION_METRES} from './bayLayoutMath.js';

// Runs once, after all authored coast refinements and before actors/route users.
// Rigid spherical relocation preserves the complete new-city hierarchy. Shared
// terrain and the intercity footbridge use the same continuous bay deformation.
export function applyCitadelBayLayout(castle,radius){
 if(!bayLayoutEnabled()||castle.userData.bayLayout)return;
 castle.updateWorldMatrix(true,true);
 const city=castle.getObjectByName('highland-west-city');if(!city)return;
 // This legacy child is authored on the OLD massif despite its parent name.
 // Keep it with that land rather than carrying houses off their foundations.
 const hillside=city.getObjectByName('citadel-target-hillside-houses');if(hillside)castle.attach(hillside);
 const frame=castle.matrixWorld.clone(),inv=frame.clone().invert(),q=bayRotation(frame,radius);
 const rotation=new THREE.Matrix4().makeRotationFromQuaternion(q);
 const oldCityWorld=city.matrixWorld.clone(),newCityWorld=rotation.clone().multiply(oldCityWorld);
 const move=(v,rigid=false)=>{const weight=rigid?1:bayWeight(v.x,v.z);return v.applyMatrix4(frame).applyQuaternion(bayRotation(frame,radius,weight)).applyMatrix4(inv);};
 const bridgeRoute=city.userData.walkRoute.slice(0,7).map(p=>move(new THREE.Vector3(...p)));
 const bridges=[];city.traverse(o=>{if(o.isMesh&&/^west-city-bridge-(deck|pier|landing-0)/.test(o.name))bridges.push(o);});
 const paving=bridges[0]?.material || new THREE.MeshStandardMaterial({color:0xd8d5c6,roughness:.93});
 bridges.forEach(o=>o.removeFromParent());
 const bridge=new THREE.Group();bridge.name='citadel-separated-bay-footbridge';castle.add(bridge);
 const add=(a,b,width,height,offset,name,walk=false)=>{const direction=b.clone().sub(a),length=direction.length();if(length<.01)return;const axis=direction.normalize(),up=new THREE.Vector3(0,1,0).addScaledVector(axis,-axis.y).normalize(),side=new THREE.Vector3().crossVectors(axis,up).normalize();const o=new THREE.Mesh(new THREE.BoxGeometry(length+.12,height,width),paving);o.name=name;o.position.copy(a).lerp(b,.5).addScaledVector(up,-height/2).addScaledVector(side,offset);o.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(axis,up,side));o.userData.westCityWalkable=walk;o.userData.isCitadelTerrain=walk;o.castShadow=true;o.receiveShadow=true;bridge.add(o);};
 for(let i=0;i<bridgeRoute.length-1;i++){const a=bridgeRoute[i],b=bridgeRoute[i+1];add(a,b,3.5,.4,0,'west-city-bridge-deck',true);for(const side of[-1,1])add(a.clone().add(new THREE.Vector3(0,1,0)),b.clone().add(new THREE.Vector3(0,1,0)),.18,.8,side*1.68,'bay-footbridge-parapet');}
 for(const p of bridgeRoute.slice(1,-1)){const world=p.clone().applyMatrix4(frame),bottom=world.clone().normalize().multiplyScalar(radius-2).applyMatrix4(inv);const delta=p.clone().sub(bottom),o=new THREE.Mesh(new THREE.BoxGeometry(1.4,delta.length(),1.4),paving);o.name='bay-footbridge-stone-pier';o.position.copy(p).lerp(bottom,.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());bridge.add(o);}
 const matrix=city.parent.matrixWorld.clone().invert().multiply(newCityWorld);matrix.decompose(city.position,city.quaternion,city.scale);city.updateWorldMatrix(true,true);
 let meshes=0,vertices=0;
 // Shared terrain, cliff skirts and existing foliage outside the city follow
 // their old castle-local X, leaving the entire old-city side fixed.
 const candidates=[];castle.traverse(o=>{if(!o.isMesh||o.isInstancedMesh||!o.geometry?.attributes.position||!/mountain|terrain|cliff|rock|strata|slope/i.test(o.name))return;for(let p=o;p;p=p.parent)if(p===city||p===bridge)return;candidates.push(o);});
 for(const mesh of candidates){
  const localToCastle=inv.clone().multiply(mesh.matrixWorld),back=localToCastle.clone().invert();
  const g=mesh.geometry.clone(),a=g.attributes.position,p=new THREE.Vector3();let changed=0;
  for(let i=0;i<a.count;i++){p.fromBufferAttribute(a,i).applyMatrix4(localToCastle);if(bayWeight(p.x,p.z)<1e-8)continue;const w=bayWeight(p.x,p.z);move(p);
   // Open the expanded seam to the sea instead of stretching one mountain
   // into a broad flat land bridge between the two cities.
   if(w>0&&w<1){p.applyMatrix4(frame);p.setLength(Math.min(p.length(),radius-3+90*Math.pow(Math.abs(2*w-1),3)));p.applyMatrix4(inv);}
   p.applyMatrix4(back);a.setXYZ(i,p.x,p.y,p.z);changed++;}
  if(!changed){g.dispose();continue;}a.needsUpdate=true;g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();mesh.geometry=g;meshes++;vertices+=changed;
 }
 for(const key of ['walkRoute','plazaToKeepRoute','harborRoute','horsePlazaExit','frontHarborRoute'])if(Array.isArray(city.userData[key]))city.userData[key]=city.userData[key].map(p=>move(new THREE.Vector3(...p),key!=='walkRoute'||p[0]>-8).toArray());
 for(const key of ['plazaAnchor','statueAnchor','horseReservation','harborAnchor','processionalEntry'])if(Array.isArray(city.userData[key]))city.userData[key]=move(new THREE.Vector3(...city.userData[key]),true).toArray();
 castle.updateWorldMatrix(true,true);
 castle.userData.bayLayout={version:1,separationArc:BAY_SEPARATION_METRES,sharedMeshes:meshes,sharedVertices:vertices,footbridgeMeshes:bridges.length,rotation:q.toArray(),target:'citadel-bay-layout/approved-target.png'};
 return castle.userData.bayLayout;
}

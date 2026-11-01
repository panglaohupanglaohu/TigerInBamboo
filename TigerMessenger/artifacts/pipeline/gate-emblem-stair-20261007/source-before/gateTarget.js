import * as THREE from 'three';
import data from '../../assets/models/optimized/gate-of-sighs/gateTargetData.js';
import {installGateLighting} from './gateLighting.js';
import {sampleGateSiteGround} from './gateSite.js';
import {createGateHeroes} from './gateHeroes.js';
import {createCitadelPlayerWalls} from './citadel/playerWalls.js';

/** Same Blender mesh for Web and Godot. Existing seat/rail/pods remain authoritative. */
export function installGateTarget(seat){
 const prior=seat.getObjectByName('gate-target-blender-v1');if(prior)return prior;
 const root=new THREE.Group();root.name='gate-target-blender-v1';
 root.userData.source=data.source;root.userData.triangles=data.triangles;root.userData.passage=data.targetRailOpening;
 for(const p of data.parts){
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p.positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(p.normals,3));g.computeBoundingSphere();g.computeBoundingBox();
  const m=new THREE.MeshStandardMaterial({color:new THREE.Color(...p.color),roughness:.96,metalness:0,flatShading:true,side:p.name.includes('cloth')?THREE.DoubleSide:THREE.FrontSide});
  const mesh=new THREE.Mesh(g,m);mesh.name=p.name;mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.gateWalkable=p.walkable;mesh.userData.gateSolid=p.solid;mesh.userData.citadelSolidExterior=p.solid;root.add(mesh);
 }
 for(const child of seat.children){if(/^(gate-arch-|leftTowerGroup$|rightTowerGroup$|channel-pier-)/.test(child.name))child.visible=false;}
 const meeting=new THREE.Object3D();meeting.name='gate-hero-meeting';meeting.position.fromArray(data.meetingAnchor);root.add(meeting);
 const heroes=createGateHeroes();meeting.add(heroes);root.userData.heroes=heroes;
 root.userData.meetingAnchor=meeting;seat.add(root);seat.userData.gateLighting=installGateLighting(seat);return root;
}

export function createGatePlayerWalls(seat){
 if(!seat)return ()=>false;
 let matrix=null,resolve=null;
 const center=new THREE.Vector3();
 return (previous,position,velocity)=>{
  seat.updateWorldMatrix(true,false);center.setFromMatrixPosition(seat.matrixWorld);
  if(center.distanceToSquared(position)>75*75)return false;
  if(!matrix||!matrix.equals(seat.matrixWorld)){
   seat.updateWorldMatrix(true,true);
   matrix=seat.matrixWorld.clone();resolve=createCitadelPlayerWalls(seat.userData.v10OriginalGateRestored?seat:seat.getObjectByName('gate-target-blender-v1'));
  }
  return resolve(previous,position,velocity);
 };
}

/** Near-foot radial grounding; derive world transforms per query so relocating gate is safe. */
export function createGatePlayerGround(seat){
 const root=seat?.getObjectByName('gate-target-blender-v1');if(!root)return ()=>null;
 const siteGround=sampleGateSiteGround(seat.userData.siteRoot);
 const surfaces=[...root.children,...(seat.userData.moebiusV10?.children||[])].filter(o=>o.isMesh&&o.userData.gateWalkable),ray=new THREE.Raycaster();
 const local=new THREE.Vector3(),up=new THREE.Vector3(),origin=new THREE.Vector3(),down=new THREE.Vector3();ray.far=2.5;
 return position=>{
  seat.updateWorldMatrix(true,false);local.copy(position);seat.worldToLocal(local);
  if(local.x< -31||local.x> 8||local.z< -45||local.z> 25||local.y< -8||local.y>7)return siteGround(position);
  root.updateWorldMatrix(false,true);
  up.copy(position).normalize();origin.copy(position).addScaledVector(up,.4);ray.set(origin,down.copy(up).negate());
  for(const hit of ray.intersectObjects(surfaces,false)){
   const n=hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
   if(n.dot(up)>.5)return hit.point.length();
  }
  return siteGround(position);
 };
}

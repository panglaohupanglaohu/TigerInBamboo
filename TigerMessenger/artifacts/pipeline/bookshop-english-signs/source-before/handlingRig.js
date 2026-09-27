import * as THREE from 'three';
import {factoryKit} from '../../assets/factoryArchitecture.js';
import {townSurfacePoint} from '../../world/bookshopTownSite.js';
import {warpFactoryToSphere,subdivideFactorySpans} from '../../world/bookshopSurfaceWarp.js';
import {mergeStaticGroup} from '../../world/geometryMerge.js';
const STATIONS={factory:{front:-31,rear:-53,height:16.1},frontline:{front:-39,rear:-100,height:29.5}};
export function createRobotHandlingRig({base,root,R}){
 const depot=new THREE.Group();depot.name='robot-unloading-gantry';base.add(depot);const kit=factoryKit(depot),{M,box,beam,sign}=kit,unload=STATIONS.frontline;
 // The receiving tracks curve across x=16..57,z=-44..-64. The old z=-58
 // runway left the first red flatcars outside the bridge's reachable rectangle.
 for(const x of[-32,60])for(const z of[unload.front,unload.rear]){box(.55,unload.height,.55,x,unload.height/2,z,M.iron);for(let y=0;y<unload.height-1;y+=2.5)beam([x-.65,y,z],[x+.65,y+2.5,z],.10,M.brass);}
 for(const z of[unload.front,unload.rear]){box(94,.7,.6,14,unload.height-.7,z,M.iron);box(94,.15,.8,14,unload.height-.15,z,M.brass);for(let x=-32;x<60;x+=4)beam([x,unload.height-.7,z],[x+4,unload.height+.4,z],.09,M.brass);box(94,.18,.3,14,unload.height+.4,z,M.iron);}
 sign('整机卸车 · 试验场',15,1.25,14,unload.height-2,unload.front+.35);subdivideFactorySpans(depot);mergeStaticGroup(depot);warpFactoryToSphere(depot,base,R);
 const rigs=new Map(),up=new THREE.Vector3(),forward=new THREE.Vector3(),right=new THREE.Vector3(),matrix=new THREE.Matrix4(),point=new THREE.Vector3();
 function ensure(key){
  if(rigs.has(key))return rigs.get(key);const station=key==='frontline'?STATIONS.frontline:STATIONS.factory,span=station.front-station.rear,rig=new THREE.Group();rig.name='robot-travelling-hoist-'+key;root.add(rig);const k=factoryKit(rig);
  for(const x of[-.55,.55])k.box(.35,.6,span+.8,x,0,0,k.M.iron);
  for(let z=-span/2;z<span/2;z+=3){const end=Math.min(span/2,z+3);k.beam([-.55,.25,z],[.55,.25,end],.075,k.M.brass);k.box(1.5,.15,.15,0,.25,z,k.M.iron);}
  for(const side of[-1,1])k.box(2,.30,1,0,.08,side*span/2,k.M.brass);
  subdivideFactorySpans(rig);mergeStaticGroup(rig);
  const spans=[];rig.traverse(o=>{if(o.isMesh){o.userData.noDistanceCulling=true;o.frustumCulled=false;spans.push({mesh:o,positions:o.geometry.attributes.position.array.slice()});}});
  const trolley=new THREE.Mesh(new THREE.BoxGeometry(1.7,.55,1.35),k.M.brass);trolley.name='robot-hoist-trolley';root.add(trolley);
  const spreader=new THREE.Group();spreader.name='robot-lifting-spreader';root.add(spreader);const sk=factoryKit(spreader);sk.box(2.9,.18,.18,0,0,0,sk.M.iron);for(const x of[-1.3,1.3])sk.box(.16,.18,1.9,x,0,0,sk.M.brass);sk.torus(.22,.055,0,.27,0,sk.M.brass);mergeStaticGroup(spreader);
  const cables=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(Array.from({length:12},()=>new THREE.Vector3())),new THREE.LineBasicMaterial({color:0x504739}));cables.name='robot-hoist-cables';cables.frustumCulled=false;root.add(cables);
  for(const obj of[trolley,spreader])obj.traverse(o=>{if(o.isMesh)o.userData.noDistanceCulling=true;});
  const record={rig,trolley,spreader,cables,spans,station};rigs.set(key,record);return record;
 }
 return {begin(){for(const {rig,trolley,spreader,cables}of rigs.values())rig.visible=trolley.visible=spreader.visible=cables.visible=false;},place(key,model,topHeight){
  const {rig,trolley,spreader,cables,spans,station}=ensure(key),parent=key==='frontline'?base:base.getObjectByName(key+'-bookshop-court');if(!parent)return;
  const ground=model.position.clone().setLength(R+.92),local=parent.worldToLocal(ground),factor=(R+.9)/(local.y+R+.9),x=local.x*factor,z=local.z*factor,railZ=(station.front+station.rear)/2;
  parent.updateWorldMatrix(true,false);
  // Transport every bridge vertex onto the same spherical runways. A single
  // straight bar at the middle floated above the rails at both far ends.
  for(const {mesh,positions}of spans){const attr=mesh.geometry.attributes.position;for(let i=0;i<attr.count;i++){point.set(x+positions[i*3],0,railZ+positions[i*3+2]).applyMatrix4(parent.matrixWorld).setLength(R+.92+station.height+positions[i*3+1]);attr.setXYZ(i,...point.toArray());}attr.needsUpdate=true;mesh.geometry.computeVertexNormals();}
  const anchor=parent.localToWorld(townSurfacePoint(parent,x,z,R,.92+station.height));up.copy(anchor).normalize();forward.set(0,0,1).transformDirection(parent.matrixWorld);right.crossVectors(up,forward).normalize();forward.crossVectors(right,up).normalize();trolley.position.copy(anchor);trolley.quaternion.setFromRotationMatrix(matrix.makeBasis(right,up,forward));
  up.copy(model.position).normalize();const tip=model.position.clone().addScaledVector(up,topHeight+.8);spreader.position.copy(tip);spreader.quaternion.copy(model.quaternion);
  const positions=[];for(const side of[-1,1]){const offset=new THREE.Vector3(side*.25,0,0).applyQuaternion(model.quaternion);positions.push(anchor.clone().add(offset),tip.clone().addScaledVector(up,.3).add(offset));}
  for(const side of[-1,1])for(const front of[-1,1]){positions.push(new THREE.Vector3(side*1.3,0,front*.85).applyQuaternion(model.quaternion).add(tip),new THREE.Vector3(side*1.3,topHeight*.78,front*.85).applyQuaternion(model.quaternion).add(model.position));}
  const attr=cables.geometry.attributes.position;positions.forEach((p,i)=>attr.setXYZ(i,p.x,p.y,p.z));attr.needsUpdate=true;
  rig.userData.reach={x,z,minX:key==='frontline'?-32:-38,maxX:key==='frontline'?60:38,front:station.front,rear:station.rear,inside:x>=(key==='frontline'?-32:-38)&&x<=(key==='frontline'?60:38)&&z>=station.rear&&z<=station.front};
  rig.visible=trolley.visible=spreader.visible=cables.visible=true;
 },depot};
}

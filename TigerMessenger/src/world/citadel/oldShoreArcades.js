import * as THREE from 'three';
import baked from '../../../assets/models/optimized/citadel-shore-arcades/shoreArcadesR01.js';
import {P} from '../../core/params.js';
import {buildHarborArchitecture} from './harborArchitecture.js';
import {solveCastleFacade} from './castleFacadeWfc.js';
import {createOceanHeightSampler} from './oceanSurface.js';
export function buildOldShoreArcades(castle){
 const shore=castle.userData.oldShoreApproach,parent=castle.getObjectByName('citadel-old-shore-approach');
 if(!shore||!parent||parent.getObjectByName('citadel-old-shore-arcades'))return null;
 const root=new THREE.Group();root.name='citadel-old-shore-arcades';parent.add(root);
 const sea=createOceanHeightSampler(castle,160),reports=[],stone=new THREE.MeshStandardMaterial({color:0xbab7a7,roughness:.97});
 for(const [index,landing] of [1,3].entries()){
  const start=new THREE.Vector3(...shore.control[landing]),end=new THREE.Vector3(...shore.control[landing+1]),tangent=end.clone().sub(start);tangent.y=0;tangent.normalize();
  const inward=new THREE.Vector3(-tangent.z,0,tangent.x).negate();
  // Landward side, away from the traffic lane. Front local +Z looks toward stairs.
  if(inward.x>0)inward.negate();
  const center=start.clone().addScaledVector(inward,7),yaw=Math.atan2(-inward.x,-inward.z);
  const solved=solveCastleFacade({rows:1,seed:830+index});
  const kit=buildHarborArchitecture(()=>0,{shops:[{id:'old-shore-arcade-'+index,x:0,z:0,w:6.6,d:3.5,h:index?3.65:3.25,bays:3,facade:solved.grid[0]}],perimeter:false,mooring:false});
  kit.name='old-shore-arcade-tier-'+index;kit.position.copy(center);kit.position.y-=4;kit.rotation.y=yaw;root.add(kit);
  const box=(name,x,y,z,w,h,d)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),stone);m.name=name;m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;m.userData.citadelSolidExterior=true;m.userData.westCityWalkable=true;kit.add(m);return m;};
  kit.updateWorldMatrix(true,true);const floorPoints=[];for(const x of [-3.7,3.7])for(const z of [-2.2,3]){const p=castle.worldToLocal(kit.localToWorld(new THREE.Vector3(x,4,z)));floorPoints.push(sea(p.x,p.z));}
  const bottom=Math.min(...floorPoints)-1.0-center.y+4;
  box('old-shore-arcade-founded-terrace',0,(4+bottom)/2,.4,7.4,4-bottom,5.2);
  // Connect to a flat landing but stop outside the equipped soldier centre lane.
  box('old-shore-arcade-side-landing',index===0?-2.2:0,3.82,4.0,1.6,.36,2.5);
  kit.traverse(o=>{if(o.isMesh)o.userData.citadelSolidExterior=true;});
  const waypoints=index===0?[start.clone().addScaledVector(tangent,-2.2),start.clone().addScaledVector(tangent,-2.2).addScaledVector(inward,4.5),start.clone().addScaledVector(inward,4.5),start.clone().addScaledVector(inward,6.4)]:[start,start.clone().addScaledVector(inward,6.4)];
  const route=[waypoints[0].toArray()];for(let i=1;i<waypoints.length;i++){const a=waypoints[i-1],b=waypoints[i],n=Math.ceil(a.distanceTo(b)/.22);for(let j=1;j<=n;j++)route.push(a.clone().lerp(b,j/n).toArray());}
  reports.push({route,tier:index,center:center.toArray(),yaw,footprint:[7.4,5.2],routeOffset:7,facade:solved,lowestFoundation:bottom+center.y-4});
 }
 if(baked){let partIndex=0;
 root.traverse(o=>{if(!o.isMesh)return;const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry,part=baked.parts[partIndex++];let digest=2166136261;for(const v of g.attributes.position.array)digest=Math.imul(digest^Math.round(v*1e4),16777619)>>>0;
  if(!part||part.name!==o.name||part.digest!==digest)throw new Error('Shore arcade geometry changed: regenerate Blender asset');
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(part.positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(part.normals,3));if(part.uv)geometry.setAttribute('uv',new THREE.Float32BufferAttribute(part.uv,2));o.geometry.dispose();o.geometry=geometry;
 });
 if(partIndex!==baked.parts.length)throw new Error('Shore arcade Blender part count mismatch');}
 root.userData.blenderSource=baked?'assets/models/optimized/citadel-shore-arcades/shore-arcades-r01.blend':null;
 const lights=castle.getObjectByName('highland-light-volumes');
 if(lights){const previous=lights.update;lights.update=lights.userData.update=(time,phase=P.timeOfDay)=>{previous(time,phase);for(const kit of root.children)kit.userData.update?.(phase);};lights.update(0);}
 root.userData.placements=reports;castle.userData.oldShoreArcades=reports;return root;
}

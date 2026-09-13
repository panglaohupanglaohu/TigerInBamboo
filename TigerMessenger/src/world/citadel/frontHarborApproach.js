import gateBaked from '../../../assets/models/optimized/citadel-watergate/watergateR01.js';
import * as THREE from 'three';
import {P} from '../../core/params.js';
import {buildHarborArchitecture} from './harborArchitecture.js';
import {createOceanHeightSampler} from './oceanSurface.js';
import {buildHarborCurtain} from './harborCurtain.js';
import {buildHarborWatergate} from './harborWatergate.js';
import {mergeStaticGroup} from '../geometryMerge.js';
// The original rear port remains the active fleet berth until boarding migrates.
export function buildFrontHarborApproach(castle,radius){
 const city=castle.getObjectByName('highland-west-city');if(!city||city.getObjectByName('citadel-front-harbor'))return;
 const rawSea=createOceanHeightSampler(city,radius),sea=(x,z)=>rawSea(x,z+2),dockY=Math.max(...[30,45].flatMap(x=>[92,96].map(z=>sea(x,z))))+.9;
 const rise=(4-dockY)/2,n=Math.ceil(rise/.18),stairWidth=4,turnWidth=5.4;
 const root=new THREE.Group();root.name='citadel-front-harbor';root.position.z=2;city.add(root);
 const walking=new THREE.Group(),walls=new THREE.Group();root.add(walking,walls);
 const stone=new THREE.MeshStandardMaterial({color:0xc5bfae,roughness:.97});
 const paving=new THREE.MeshStandardMaterial({color:0xd5cdb8,roughness:.94});
 const wood=new THREE.MeshStandardMaterial({color:0x756049,roughness:.97});
 function box(parent,name,x,top,z,w,h,d,mat){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.name=name;m.position.set(x,top-h/2,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 box(walking,'front-harbor-quay',37.5,dockY,94,15,.5,4,paving);
 box(walking,'front-harbor-gate-landing',32,dockY,91.5,4,.3,5,paving);
 const route=[[32,dockY,95],[32,dockY,92.4],[30.5,dockY,92.4],[30.5,dockY,90],[32,dockY,90]];
 const midY=dockY+rise;
 root.add(buildHarborCurtain(sea,midY));
 const flights=[{start:[32,90],end:[39,90],low:dockY,high:midY},{start:[41.5,85.5],end:[41.5,80],low:midY,high:4}];
 for(let f=0;f<flights.length;f++){
  const flight=flights[f],dx=flight.end[0]-flight.start[0],dz=flight.end[1]-flight.start[1],run=Math.hypot(dx,dz),tx=dx/run,tz=dz/run;
  flight.steps=n;flight.width=stairWidth;flight.tread=run/n;
  for(let i=0;i<n;i++){
   const x=flight.start[0]+dx*(i+.5)/n,z=flight.start[1]+dz*(i+.5)/n,top=flight.low+rise*(i+1)/n,bottom=Math.min(sea(x,z)-1.5,flight.low-.6);
   const step=box(walking,'front-harbor-step',x,top,z,run/n+.015,top-bottom,stairWidth,paving);step.rotation.y=-Math.atan2(dz,dx);route.push([x,top,z]);
  }
  for(const side of [-1,1]){
   const a=.4,b=run-.4,ya=flight.low+rise*a/run,yb=flight.low+rise*b/run;
   const shape=new THREE.Shape();shape.moveTo(a,ya);shape.lineTo(b,yb);shape.lineTo(b,yb+.85);shape.lineTo(a,ya+.85);shape.closePath();
   const g=new THREE.ExtrudeGeometry(shape,{depth:.28,bevelEnabled:false});g.translate(0,0,-.14);
   const m=new THREE.Mesh(g,stone);m.name='front-harbor-slope-parapet';m.rotation.y=-Math.atan2(dz,dx);m.position.set(flight.start[0]-tz*side*2.2,0,flight.start[1]+tx*side*2.2);m.castShadow=true;m.receiveShadow=true;walls.add(m);
  }
  route.push([flight.end[0],flight.high,flight.end[1]]);
  if(f===0){
   const bottom=Math.min(dockY-1.5,sea(41.5,90)-1.5);
   box(walking,'front-harbor-turn',41.5,midY,89,turnWidth,midY-bottom,7.2,paving);
   box(walls,'front-harbor-turn-guard',44.35,midY+1,89,.3,1,7.2,stone);
   route.push([41.5,midY,90],[41.5,midY,85.5]);
  }
 }
 box(walking,'front-harbor-plaza-link',46.25,4,78,13.5,.35,4,paving);
 route.push([41.5,4,78],[48,4,78],[51,4,78],[51,4,80]);
 // Broad side court below the plaza: buildings remain off the ceremonial square.
 const terraces=[{id:'quayside-arcade',x:24,z:91.5,y:dockY,w:5.7,d:3.7,h:3.35,bays:3,platformX:25,platformW:8,platformD:6.2,yaw:Math.PI/2},{id:'east-harbor-provisioner',x:35,z:83.8,y:midY,w:4.8,d:3,h:3.7,bays:2,platformX:35,platformW:8,platformD:7,yaw:0}];
 // A level side entrance branches before the upper flight, clear of both sloping parapets.
 box(walking,'front-harbor-court-threshold',38.4,midY,86.5,3.2,.35,2.0,paving);
 const shops=[];
 for(const t of terraces){
  const {platformX,platformW,platformD}=t;
  const bottom=Math.min(sea(platformX,t.z)-1.5,t.y-.6);
  box(walking,'front-harbor-shop-terrace',platformX,t.y,t.z,platformW,t.y-bottom,platformD,paving);
  const kit=buildHarborArchitecture(()=>0,{shops:[{...t,x:0,z:0}],perimeter:false,mooring:false});
  kit.name='front-harbor-landing-shop-'+t.id;kit.position.set(t.x,t.y-4,t.z);kit.rotation.y=t.yaw;root.add(kit);shops.push(kit);
 }
 box(walking,'front-harbor-lower-shop-link',29.75,dockY,92.4,1.5,.35,2.4,paving);
 root.userData.landingShops=terraces;
 const lights=castle.getObjectByName('highland-light-volumes');
 if(lights){const previous=lights.update;lights.update=lights.userData.update=(time,phase=P.timeOfDay)=>{previous(time,phase);for(const kit of shops)kit.userData.update(phase);};lights.update(0);}
 for(const x of [30.7,37.5,44.3])for(const z of [92.6,95.4]){const bottom=sea(x,z)-2;box(walls,'front-harbor-pile',x,dockY-.25,z,.55,dockY-.25-bottom,.55,stone);if(x>34.5)box(walls,'front-harbor-bollard',x,dockY+.48,z,.34,.48,.34,wood);}
 const gate=buildHarborWatergate(dockY,sea(32,92)-2);gate.name='citadel-front-harbor-watergate';gate.position.set(32,dockY,92);root.add(gate);mergeStaticGroup(gate,{mergedTag:'front-harbor-watergate',onSurface:m=>{m.name='front-harbor-watergate-solid';m.userData.citadelSolidExterior=true;}});
 if(gateBaked){gate.children.forEach((m,i)=>{const part=gateBaked.parts[i];if(!part)throw new Error('Missing Blender watergate part');const input=m.geometry.index?m.geometry.toNonIndexed():m.geometry;let digest=2166136261;for(const v of input.attributes.position.array)digest=Math.imul(digest^Math.round(v*1e4),16777619)>>>0;if(digest!==part.sourceDigest)throw new Error('Watergate changed: regenerate Blender asset');if(input!==m.geometry)input.dispose();const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(part.positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(part.normals,3));m.geometry.dispose();m.geometry=g;});gate.userData.sourceBlender=gateBaked.source;}
 mergeStaticGroup(walking,{mergedTag:'front-harbor-walk',onSurface:m=>{m.name='front-harbor-walkable';m.userData.westCityWalkable=true;m.userData.isCitadelTerrain=true;}});
 mergeStaticGroup(walls,{mergedTag:'front-harbor-guards',onSurface:m=>{m.name='front-harbor-guard';m.userData.citadelSolidExterior=true;}});
 // Excavate only the new switchback corridor, after the authored Blender pass.
 const floorAt=(x,z)=>x>=27.5&&x<=47.5&&z>=80&&z<=95.5?dockY-1.8:null;
 castle.updateWorldMatrix(true,true);const cuts=[];
 for(const name of ['citadel-oskar-grid-mountain-surface','backlit-highlight-citadel-oskar-grid-mountain-surface']){
  const m=castle.getObjectByName(name),g=m.geometry,a=g.attributes.position,toCity=city.matrixWorld.clone().invert().multiply(m.matrixWorld),inv=toCity.clone().invert();let changed=0;
  for(let i=0;i<a.count;i++){if(g.attributes.shoreBoundaryBottom?.getX(i)>.5)continue;const p=new THREE.Vector3().fromBufferAttribute(a,i).applyMatrix4(toCity),floor=floorAt(p.x,p.z);if(floor!==null&&p.y>floor){p.y=floor;p.applyMatrix4(inv);a.setXYZ(i,p.x,p.y,p.z);changed++;}}
  a.needsUpdate=true;g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();cuts.push({name,changed});
 }
 const toCastle=p=>castle.worldToLocal(city.localToWorld(new THREE.Vector3(p[0],p[1],p[2]+2))).toArray();
 city.userData.frontHarborRoute=route.map(toCastle);city.userData.frontHarborAnchor=toCastle([32,dockY,95]);
 city.userData.frontHarborApproach={dockY,flights:2,flightLayout:flights,stepsPerFlight:n,riser:rise/n,stairWidth,turnWidth,turnCourt:{center:[35,midY,83.8],width:8,depth:7,entry:[[41.5,midY,86.2],[38,midY,86.2],[35,midY,86.2]],entryWidth:2},cuts,status:'walking approach; fleet still uses rear harbor'};
 root.userData.sourceId='citadel-front-harbor-v3';root.userData.frontHarborApproach=city.userData.frontHarborApproach;
 return root;
}

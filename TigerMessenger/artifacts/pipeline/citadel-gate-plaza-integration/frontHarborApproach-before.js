import * as THREE from 'three';
import {P} from '../../core/params.js';
import {buildHarborArchitecture} from './harborArchitecture.js';
import {createOceanHeightSampler} from './oceanSurface.js';
import {buildHarborWatergate} from './harborWatergate.js';
import {mergeStaticGroup} from '../geometryMerge.js';
// The original rear port remains the active fleet berth until boarding migrates.
export function buildFrontHarborApproach(castle,radius){
 const city=castle.getObjectByName('highland-west-city');if(!city||city.getObjectByName('citadel-front-harbor'))return;
 const rawSea=createOceanHeightSampler(city,radius),sea=(x,z)=>rawSea(x,z+2),dockY=Math.max(...[30,45].flatMap(x=>[92,96].map(z=>sea(x,z))))+.9;
 const rise=(4-dockY)/3,n=Math.ceil(rise/.18),run=11;
 const root=new THREE.Group();root.name='citadel-front-harbor';root.position.z=2;city.add(root);
 const walking=new THREE.Group(),walls=new THREE.Group();root.add(walking,walls);
 const stone=new THREE.MeshStandardMaterial({color:0xc5bfae,roughness:.97});
 const paving=new THREE.MeshStandardMaterial({color:0xd5cdb8,roughness:.94});
 const wood=new THREE.MeshStandardMaterial({color:0x756049,roughness:.97});
 function box(parent,name,x,top,z,w,h,d,mat){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.name=name;m.position.set(x,top-h/2,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 box(walking,'front-harbor-quay',37.5,dockY,94,15,.5,4,paving);
 box(walking,'front-harbor-gate-landing',32,dockY,91.5,4,.3,5,paving);
 const route=[[32,dockY,95],[32,dockY,92.4],[30.5,dockY,92.4],[30.5,dockY,90],[32,dockY,90]];
 const flights=[];
 for(let f=0;f<3;f++){
  const z=90-f*5,from=f%2?43:32,to=f%2?32:43,low=dockY+f*rise,high=low+rise;
  flights.push({from,to,z,low,high});
  for(let i=0;i<n;i++){
   const x=from+(to-from)*(i+.5)/n,top=low+rise*(i+1)/n,bottom=Math.min(sea(x,z)-1.5,low-.6);
   box(walking,'front-harbor-step',x,top,z,run/n+.015,top-bottom,2.8,paving);
   if(i>=4&&i<n-4)for(const side of [-1,1])box(walls,'front-harbor-step-guard',x,top+1,z+side*1.64,run/n+.015,1.0,.28,stone);
   route.push([x,top,z]);
  }
  route.push([to,high,z]);
  if(f<2){const turnX=to+(f===0?1.5:-1.5),bottom=Math.min(dockY-1.5,sea(turnX,z-2.5)-1.5);box(walking,'front-harbor-turn',turnX,high,z-2.5,3,high-bottom,7.8,paving);route.push([turnX,high,z],[turnX,high,z-5],[to,high,z-5]);if(f===0)box(walls,'front-harbor-turn-guard',turnX+1.65,high+1,z-2.5,.3,1,7.8,stone);else {box(walls,'front-harbor-turn-guard',turnX-1.65,high+1,80.95,.3,1,4.7,stone);box(walls,'front-harbor-turn-guard',turnX-1.65,high+1,86.05,.3,1,.7,stone);}}
 }
 box(walking,'front-harbor-plaza-link',45.5,4,80,5.2,.35,2.8,paving);route.push([48,4,80],[51,4,80]);
 // Shops belong below the ceremonial square, beside the switchback and watergate.
 const terraces=[{id:'quayside-arcade',x:24,z:91.5,y:dockY,w:5.7,d:3.7,h:3.35,bays:3},{id:'east-harbor-provisioner',x:24,z:84.5,y:dockY+2*rise,w:3.7,d:3,h:3.7,bays:1}];
 const shops=[];
 for(const t of terraces){
  const platformX=25,platformW=8,platformD=t.id==='quayside-arcade'?6.2:6;
  const bottom=Math.min(sea(platformX,t.z)-1.5,t.y-.6);
  box(walking,'front-harbor-shop-terrace',platformX,t.y,t.z,platformW,t.y-bottom,platformD,paving);
  const kit=buildHarborArchitecture(()=>0,{shops:[{...t,x:0,z:0}],perimeter:false,mooring:false});
  kit.name='front-harbor-landing-shop-'+t.id;kit.position.set(t.x,t.y-4,t.z);kit.rotation.y=Math.PI/2;root.add(kit);shops.push(kit);
 }
 box(walking,'front-harbor-lower-shop-link',29.75,dockY,92.4,1.5,.35,2.4,paving);
 root.userData.landingShops=terraces;
 const lights=castle.getObjectByName('highland-light-volumes');
 if(lights){const previous=lights.update;lights.update=lights.userData.update=(time,phase=P.timeOfDay)=>{previous(time,phase);for(const kit of shops)kit.userData.update(phase);};lights.update(0);}
 for(const x of [30.7,37.5,44.3])for(const z of [92.6,95.4]){const bottom=sea(x,z)-2;box(walls,'front-harbor-pile',x,dockY-.25,z,.55,dockY-.25-bottom,.55,stone);if(x>34.5)box(walls,'front-harbor-bollard',x,dockY+.48,z,.34,.48,.34,wood);}
 const gate=buildHarborWatergate(dockY,sea(32,92)-2);gate.name='citadel-front-harbor-watergate';gate.position.set(32,dockY,92);root.add(gate);mergeStaticGroup(gate,{mergedTag:'front-harbor-watergate',onSurface:m=>{m.name='front-harbor-watergate-solid';m.userData.citadelSolidExterior=true;}});
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
 city.userData.frontHarborApproach={dockY,flights:3,stepsPerFlight:n,riser:rise/n,tread:run/n,cuts,status:'walking approach; fleet still uses rear harbor'};
 root.userData.sourceId='citadel-front-harbor-v1';root.userData.frontHarborApproach=city.userData.frontHarborApproach;
 return root;
}

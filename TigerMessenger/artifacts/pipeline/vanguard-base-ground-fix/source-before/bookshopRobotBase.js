import {animateArticulatedRobot} from '../assets/robotArticulation.js';
import {buildFactoryLoadingYards,installFactorySteam} from './bookshopLoadingYards.js';
import {buildBookshopBasePlaza} from './bookshopBasePlaza.js';
import {warpFactoryToSphere} from './bookshopSurfaceWarp.js';
import {buildBookshopBaseServices} from './bookshopBaseServices.js';
import {buildBookshopAirshipDock} from './bookshopAirshipDock.js';
import {buildBookshopFreightSpurs} from './bookshopFreightSpurs.js';
import {createBookshopFactoryCompound} from '../assets/bookshopFactoryCompounds.js';
import {buildBookshopFactoryBase} from './bookshopFactoryBase.js';
import {bookshopTownPose,buildBookshopTownGround,townSurfacePoint,townSurfaceMesh,seatTownObject} from './bookshopTownSite.js';
import * as THREE from 'three';
import {BOOKSHOP_ROBOT_FACTORIES} from '../assets/bookshopRobots.js';
import {mergeStaticGroup} from './geometryMerge.js';


// Three shops face a shared open plaza. Existing bookstore remains in place.
export function installBookshopRobots({scene,bookshop,colliders,platforms,R=160}) {
 if(bookshop.userData.steampunkRobots)return bookshop.userData.steampunkRobots;
 const root=new THREE.Group();root.name='bookshop-steampunk-robots';
 const sitePose=bookshopTownPose(R);root.position.copy(sitePose.position);root.quaternion.copy(sitePose.quaternion);scene.add(root);
 buildBookshopTownGround({root,R,platforms});
 const stone=new THREE.MeshStandardMaterial({color:0xc6bba0,roughness:.94}),brass=new THREE.MeshStandardMaterial({color:0xbc995b,roughness:.65,metalness:.25});
 function floor(parent,w,d,x,z,name){const m=townSurfaceMesh(parent,x-w/2,x+w/2,z-d/2,z+d/2,stone,R,.915,12);m.name=name;return m;}
 const plaza=buildBookshopBasePlaza({root,R});root.userData.plaza=plaza;
 const specs=[-2.15,Math.PI,2.15].map((a,i)=>{
  const x=Math.sin(a)*48,z=32+Math.cos(a)*48;
  return {x,z,yaw:Math.atan2(-x,32-z),robotX:6.875,robotZ:1.25};
 });
 const models=[],audit=[],districts=[];
 for(const [i,make]of BOOKSHOP_ROBOT_FACTORIES.entries()){
  const s=specs[i],district=new THREE.Group();district.name=['locust','ant','beetle'][i]+'-bookshop-court';root.add(district);districts.push(district);seatTownObject(root,district,s.x,s.z,s.yaw,R);
  const shop=createBookshopFactoryCompound(['locust','ant','beetle'][i]);shop.scale.setScalar(1.25);district.add(shop);floor(district,36,45,2.5,-13.75,'factory-spherical-yard');floor(district,5,8,-3,7,'shop-plaza-path');district.updateWorldMatrix(true,true);
  // Spherical deformation preserves each factory's height while seating its long halls.
  warpFactoryToSphere(shop,district,R);
  // Scaled wall footprints leave both public doors and industrial portals open.
  const wall=(x1,z1,x2,z2)=>{const length=Math.hypot(x2-x1,z2-z1),steps=Math.ceil(length/.65);for(let j=0;j<=steps;j++){const f=j/steps,x=(x1+(x2-x1)*f)*1.25,z=(z1+(z2-z1)*f)*1.25;colliders.push({position:district.localToWorld(townSurfacePoint(district,x,z,R)),radius:.40,kind:'bookshop-factory-wall',factory:['locust','ant','beetle'][i],minRadius:R+.9,maxRadius:R+10});}};
  const walls=[[-6.9,2.4,-6.9,-3.5],[.7,2.4,.7,-3.5],[-6.9,-3.5,.7,-3.5],[-6.9,2.4,-4.3,2.4],[-2,2.4,.7,2.4],[-8,-4,-8,-12],[-8,-12,0,-12],[-1.3,-2.5,-1.3,-13],[8.1,-2.5,8.1,-13],[-9,-14,-9,-28],[14.9,-14,14.9,-28],[-9,-28,14.9,-28]];
  const cameraWalls=new THREE.Group();cameraWalls.name='factory-camera-walls';cameraWalls.visible=false;district.add(cameraWalls);
  const cameraMaterial=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
  for(const line of walls){wall(...line);const[x1,z1,x2,z2]=line,h=z1<-4?9:5.5,o=new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(x2-x1,z2-z1)*1.25,h,.30),cameraMaterial);o.position.set((x1+x2)*.625,h/2,(z1+z2)*.625);o.rotation.y=-Math.atan2(z2-z1,x2-x1);cameraWalls.add(o);}
  mergeStaticGroup(cameraWalls);warpFactoryToSphere(cameraWalls,district,R);district.userData.cameraWalls=cameraWalls.children.filter(c=>c.isMesh);
  for(let x=-7.8;x<.5;x+=1.5)for(let z=-3.5;z<3.5;z+=1.5){const center=district.localToWorld(townSurfacePoint(district,x,z,R,1.17)),q=district.getWorldQuaternion(new THREE.Quaternion());platforms.push({mesh:shop,center,normal:center.clone().normalize(),right:new THREE.Vector3(1,0,0).applyQuaternion(q),forward:new THREE.Vector3(0,0,1).applyQuaternion(q),half:new THREE.Vector3(.78,.15,.78),topHeight:R+1.17,kind:'bookshop-reading-room'});}

  floor(district,4.3,4.2,s.robotX,s.robotZ,'robot-service-pad');
  const robot=make({rigged:true});robot.userData.displaySeated=i===1;animateArticulatedRobot(robot,{state:'idle'});robot.scale.setScalar(1.25);district.add(robot);seatTownObject(district,robot,s.robotX,s.robotZ,i===0?.15:0,R);models.push(robot);robot.updateWorldMatrix(true,true);
  const world=robot.getWorldPosition(new THREE.Vector3());colliders.push({position:world.clone(),radius:i===0?1.45:1.3});audit.push({name:robot.userData.robotName,pairedShop:['蝗虫书店','蚂蚁书店','甲壳虫书店'][i],world:world.toArray(),stats:robot.userData.stats});
 }
 buildBookshopFactoryBase({root,districts,R,colliders});
 buildBookshopFreightSpurs({root,districts,R});
 buildFactoryLoadingYards({districts,R,platforms});
 const steamUpdate=installFactorySteam(districts,R),previousUpdate=root.userData.update;root.userData.update=(dt,t)=>{previousUpdate?.(dt,t);steamUpdate(t);for(const m of models)animateArticulatedRobot(m,{time:t,state:'idle'});};
 buildBookshopBaseServices({root,R,colliders});
 const updateAirship=buildBookshopAirshipDock({root,R,colliders}),updateBase=root.userData.update;
 root.userData.update=(dt,t)=>{updateBase(dt,t);updateAirship(t);};
 root.userData.cameraOccludersNear=(position,reach)=>districts.flatMap(d=>position.distanceTo(d.getWorldPosition(new THREE.Vector3()))<45+reach?d.userData.cameraWalls:[]);
 root.userData.audit=audit;root.userData.models=models;root.userData.layout='Three shops spaced along the rear arc around one circular plaza; all doors face its center';root.userData.ringLayout={center:[0,32],radius:48,angles:[-123,180,123],shops:specs};bookshop.userData.steampunkRobots=root;return root;
}

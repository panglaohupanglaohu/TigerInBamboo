import {citadelRevision} from "./layoutRelease.js";
import {clipExteriorBox} from './clipExteriorBox.js';
import * as THREE from 'three';
import {createOceanHeightSampler} from './oceanSurface.js';
import {buildHarborWatergate} from './harborWatergate.js';
import {buildHarborArchitecture} from './harborArchitecture.js';
import {CITADEL_HARBOR_WATER_PLAN as waterPlan} from './harborWaterPlan.js';
import {finishFrontHarbor} from './frontHarborFinish.js';
import {buildFrontHarborCargo} from './frontHarborCargo.js';
// Staged reconstruction: sea-level quay, gate and inhabited terrace in one frame.
export function buildIntegratedFrontGate(castle,radius=160){
 if(typeof location==='undefined'||citadelRevision('citadelFrontGate')!=='1')return;
 const city=castle.getObjectByName('highland-west-city'),old=city?.getObjectByName('citadel-front-harbor');if(!old)return;
 old.visible=false;old.name='archived-front-harbor-layout';
 const root=new THREE.Group();root.name='citadel-front-harbor';root.userData.integratedCandidate=true;city.add(root);
 const sea=createOceanHeightSampler(city,radius),[gateX,gateZ]=waterPlan.gate,dockY=sea(gateX,gateZ+.8)+waterPlan.quay.freeboard,midY=2.2,route=[];
 root.userData.waterPlanVersion=waterPlan.version;
 const stone=new THREE.MeshStandardMaterial({color:0xc6c5bb,roughness:.96}),paving=new THREE.MeshStandardMaterial({color:0xd5cdb8,roughness:.94});
 const box=(name,x,y,z,w,h,d,walk=false)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),walk?paving:stone);m.name=name;m.position.set(x,y-h/2,z);m.castShadow=true;m.receiveShadow=true;m.userData.westCityWalkable=walk;m.userData.isCitadelTerrain=walk;m.userData.citadelSolidExterior=!walk;root.add(m);return m;};
 // Narrow strips follow the actual spherical water instead of floating a flat slab.
 const quays=[];for(let i=0;i<waterPlan.quay.xMax-waterPlan.quay.xMin;i++){const x=waterPlan.quay.xMin+.5+i,y=sea(x,waterPlan.quay.z)+waterPlan.quay.freeboard;box('integrated-quay-strip',x,y,waterPlan.quay.z+.4,1.01,.55,3.6,true);quays.push({x,y,water:sea(x,waterPlan.quay.z)});}
 box('integrated-gate-apron',gateX,dockY,106.4,5,.5,3.3,true);
 const gate=buildHarborWatergate(dockY,Math.min(sea(48,107),sea(60,107))-2,{top:midY+.9-dockY});gate.name='citadel-front-harbor-watergate';gate.position.set(gateX,dockY,gateZ);root.add(gate);
 route.push([gateX,dockY,108],[gateX,dockY,105]);
 const landingX=citadelRevision('citadelPort')==='4'?64.2:63;
 const flights=[{start:[54,105],end:[54,91],low:dockY,high:midY},{start:[56.5,91],end:[63,91],low:midY,high:4}];
 for(const [index,f]of flights.entries()){const dx=f.end[0]-f.start[0],dz=f.end[1]-f.start[1],run=Math.hypot(dx,dz),n=Math.ceil((f.high-f.low)/.18);f.steps=n;f.tread=run/n;f.width=4.8;
 for(let i=0;i<n;i++){const x=f.start[0]+dx*(i+.5)/n,z=f.start[1]+dz*(i+.5)/n,y=f.low+(f.high-f.low)*(i+1)/n;const m=box('integrated-stair-'+index,x,y,z,run/n+.012,Math.max(.3,y-sea(x,z)+1),4.8,true);m.rotation.y=-Math.atan2(dz,dx);route.push([x,y,z]);}
 route.push([f.end[0],f.high,f.end[1]]);if(index===0){box('integrated-turning-court',53.8,midY,90.1,7,.7,1.8,true);route.push([56.5,midY,91]);}}
 if(landingX>63){box('integrated-stair-top-extension',63.625,4,91,1.35,.35,4.8,true);route.push([landingX,4,91]);}
 box('integrated-upper-landing',65.5,4,88.5,5,.35,5.2,true);route.push([landingX,4,88.5],[63,4,85]);
 // The side shop stays below and in front of the plaza, clear of the ascent.
 box('integrated-side-court',46.5,midY,92,7.5,midY-sea(46.5,92)+1,9,true);
 box('integrated-side-court-link',50.6,midY,91,3,.4,3.4,true);
 // Occupied terrace over the defensive frontage, with a real stairwell slot.
 box('integrated-west-terrace',47.2,midY,98.5,8.4,.5,17,true);
 box('integrated-east-terrace',61.4,midY,98.5,9.8,.5,17,true);
 box('integrated-overgate-walk',54,midY,105.9,5.1,.5,2.2,true);
 const releasedPort=citadelRevision('citadelPort')==='4';
 const shop=buildHarborArchitecture(()=>0,{shops:[{id:'front-gate-side-shop',x:0,z:0,y:midY,w:5.2,d:3,h:3.7,bays:2,canopyReach:releasedPort?2:1.4,counter:releasedPort}],perimeter:false,mooring:false});shop.position.set(46,midY-4,92.5);root.add(shop);shop.userData.update(.85);
 if(releasedPort){
  const ground=(x)=>quays.reduce((a,b)=>Math.abs(b.x-x)<Math.abs(a.x-x)?b:a).y;
  const market=buildHarborArchitecture(()=>0,{shops:[],stalls:[{id:'front-quay-canvas-stall',x:46.5,y:ground(46.5),z:107.82,w:4.8,reach:.98}],ground,perimeter:false,mooring:false});
  market.name='citadel-front-quay-market';root.add(market);
  market.userData.sourceId='citadel-reference-harbor-architecture-v1:original-blue-canvas';
 }
 // Continuous side walls tie the gate frontage to the terrace behind it.
 for(const [a,b]of [[42.5,48],[60,67]])box('integrated-front-wall',(a+b)/2,midY+.9,107,b-a,midY+.9-Math.min(sea(a,107),sea(b,107))+1,1.5);
 for(const x of [43,66.5])box('integrated-return-wall',x,midY+.9,98.5,.8,midY+.9-sea(x,98.5)+1,17);
 if(citadelRevision('citadelPort')==='4')finishFrontHarbor(root,flights);
 if(citadelRevision('citadelPort')==='4')buildFrontHarborCargo(root,quays);
 city.updateWorldMatrix(true,true);const edge=city.getObjectByName('citadel-plaza-edge-garden');
 const opened=edge?clipExteriorBox(edge,city,[60.4,3.85,85.2],[65.6,12,89.2]):0;root.userData.entryCutTriangles=opened;
 city.updateWorldMatrix(true,true);const toCastle=p=>castle.worldToLocal(city.localToWorld(new THREE.Vector3(...p))).toArray();
 root.userData.layout={gate:[gateX,dockY,gateZ],midY,quays,flights,plazaExit:[63,4,85],status:'candidate; wall opening, terrain clearance and ship berth verification pending'};
 const approach={dockY,flights:2,flightLayout:flights,stepsPerFlight:flights.map(f=>f.steps),stairWidth:4.8,turnWidth:7,turnCourt:{center:[46.5,midY,92],width:7.5,depth:9,entry:[[54,midY,91],[50.6,midY,91],[46.5,midY,91]],entryWidth:3},status:'integrated candidate; original actor and ship verification pending'};
 city.userData.frontHarborApproach=approach;root.userData.frontHarborApproach=approach;
 city.userData.frontHarborRoute=route.map(toCastle);city.userData.frontHarborAnchor=toCastle(route[0]);
 // One authored route for native export and future battle deployment, including
 // the previously untested crossing of the open plaza between the two legs.
 city.userData.harborToKeepRoute=[...city.userData.frontHarborRoute,...city.userData.plazaToKeepRoute];
 return root;
}

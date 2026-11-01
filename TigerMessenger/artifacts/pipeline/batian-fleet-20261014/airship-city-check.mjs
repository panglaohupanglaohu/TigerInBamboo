import assert from 'node:assert/strict';
import * as T from 'three';
import {createAirshipRide} from '../../../src/player/airshipRide.js';
import {latLonToDir,quatYToDir} from '../../../src/world/sphereMath.js';
const listeners=[];globalThis.window={addEventListener:(type,fn)=>{if(type==='keydown')listeners.push(fn)}};
const scene=new T.Scene(),a=new T.Group(),gondola=new T.Group(),rope=new T.Mesh(new T.CylinderGeometry(.03,.03,8).translate(0,4,0),new T.MeshBasicMaterial());
a.add(gondola,rope);a.userData.parts={gondolaMesh:gondola};a.userData.rope=rope;a.userData.hover=20;scene.add(a);
const start=latLonToDir(-35,115),city=latLonToDir(-50,-112);a.position.copy(start).multiplyScalar(180);a.quaternion.copy(quatYToDir(start));scene.updateMatrixWorld(true);
const player={position:a.position.clone(),velocity:new T.Vector3(),forward:new T.Vector3(),facing:new T.Vector3(),onGround:false,riding:false},keys={};
const ride=createAirshipRide({player,getAirship:()=>a,keys,planetRadius:160,scene,cameraRig:{},elHint:null});
const event={code:'KeyF',repeat:false,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};for(const fn of listeners)fn(event);for(let i=0;i<120;i++)ride.update(1/60);assert(ride.isFlying());
ride.setPose(start,20,city.clone().multiplyScalar(180));keys.KeyW=true;let min=Infinity,minStep=Infinity,prev=a.position.clone(),before=start.angleTo(city)*160;
for(let i=0;i<Math.ceil(before/8*60);i++){ride.update(1/60);scene.updateMatrixWorld(true);min=Math.min(min,a.position.clone().normalize().angleTo(city)*160);minStep=Math.min(minStep,a.position.distanceTo(prev));prev.copy(a.position);}
console.log(JSON.stringify({startDistance:before,closestToCity:min,minStep,state:ride.getState()}));
if(!process.argv.includes('--baseline')){assert(min<1,'holding W along the initial city bearing must reach the city, without steering drift');assert(minStep>.13,'no stopped forward frames');}

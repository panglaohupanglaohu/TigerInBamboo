import fs from 'node:fs';import * as T from 'three';import {createHash} from 'node:crypto';
const context=new Proxy({canvas:{width:2,height:2},createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),getImageData:(_,__,w=2,h=2)=>({data:new Uint8ClampedArray(w*h*4)}),createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
function element(){const listeners={};return{width:2,height:2,style:{},dataset:{},classList:{add(){},remove(){},toggle(){}},appendChild(){},cloneNode(){return element();},setAttribute(){},addEventListener(k,f){listeners[k]=f;},removeEventListener(){},set src(v){queueMicrotask(()=>listeners.load?.call(this));},getContext:()=>context};}
globalThis.ImageData=class{constructor(data,width,height){this.data=data;this.width=width;this.height=height;}};
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element,addEventListener(){},body:element()};globalThis.location={search:'?tour=crystal-v7&autostart=1',href:'http://localhost:8931/TigerMessenger/index.html?tour=crystal-v7&autostart=1'};
// In-memory storage never reads, clears or writes the user's browser saves.
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};globalThis.window={addEventListener(){},removeEventListener(){},localStorage,location,innerWidth:1280,innerHeight:800};globalThis.HTMLImageElement=class{};globalThis.Image=class extends HTMLImageElement{constructor(){super();Object.assign(this,element(),{complete:true});}};
const {messengerIslandScene}=await import('../../../src/scenes/messengerIsland.js');


const started=performance.now();const scene=new T.Scene(),gen=messengerIslandScene.loadSteps({scene,planetRadius:160});let reached=false;
try{for(let i=0;i<140;i++){const next=gen.next();if(next.done)break;if(String(next.value).includes('信使主岛已构建')){reached=true;break;}}}finally{gen.return();}
const inner=scene.getObjectByName('moebius-swamp-zone');if(!inner||!reached)throw Error('formal load did not reach lake');
await inner.userData.tiger.userData.swampTigerV2Ready;

const {createSwampCameraOccluders}=await import('../../../src/world/swampCameraOcclusion.js');
const {createCameraRig}=await import('../../../src/core/camera.js');

const provider=createSwampCameraOccluders(inner.parent),records=[];
const points=inner.userData.gregSpatialPlan.route.filter((p,i)=>i%4===0);
points.push([16.815,30.8,-17.487]);
for(const [index,xyz] of points.entries()){
 const position=inner.localToWorld(new T.Vector3(...xyz)),up=position.clone().normalize();
 const base=inner.localToWorld(new T.Vector3(-8,xyz[1],-7)).sub(position);base.addScaledVector(up,-base.dot(up)).normalize();
 for(const yaw of [0,Math.PI/2,-Math.PI/2,Math.PI]){
  const forward=base.clone().applyAxisAngle(up,yaw),look=position.clone().addScaledVector(up,1.1),camera=new T.PerspectiveCamera(),rig=createCameraRig(camera,{position,forward,velocity:new T.Vector3()},{colliders:()=>[],occluderMeshes:provider});
  rig.setDist(7.5);rig.snapToPlayer();let intersections=0,minGap=Infinity;
  for(let frame=0;frame<3;frame++){
   const dir=camera.position.clone().sub(look).normalize(),len=camera.position.distanceTo(look),ray=new T.Raycaster(look,dir,0,len+.55),hits=ray.intersectObjects(provider(look,len+2),false),hit=hits[0];
   if(hit){minGap=Math.min(minGap,hit.distance-len);if(hit.distance<len-1e-6)intersections++;}rig.update(1/60);
  }
  records.push({index,xyz,yaw,pull:rig.getOcclusionDist(),minGap:Number.isFinite(minGap)?minGap:null,intersections});
 }
}
const report={timestamp:new Date().toISOString(),kind:'production-loadSteps-camera-authored-ray-probe',points:points.length,poses:records.length,simulatedFrames:records.length*3,remainingCentrelineIntersections:records.reduce((s,r)=>s+r.intersections,0),minimumGap:Math.min(...records.filter(r=>r.minGap!==null).map(r=>r.minGap)),records};
fs.writeFileSync(new URL('./camera-formal-clearance-report.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,records:undefined}));

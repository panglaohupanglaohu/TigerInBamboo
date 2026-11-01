import fs from 'node:fs';import * as T from 'three';import {createHash} from 'node:crypto';
const context=new Proxy({canvas:{width:2,height:2},createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),getImageData:(_,__,w=2,h=2)=>({data:new Uint8ClampedArray(w*h*4)}),createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
function element(){const listeners={};return{width:2,height:2,style:{},dataset:{},classList:{add(){},remove(){},toggle(){}},appendChild(){},cloneNode(){return element();},setAttribute(){},addEventListener(k,f){listeners[k]=f;},removeEventListener(){},set src(v){queueMicrotask(()=>listeners.load?.call(this));},getContext:()=>context};}
globalThis.ImageData=class{constructor(data,width,height){this.data=data;this.width=width;this.height=height;}};
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element,addEventListener(){},body:element()};globalThis.location={search:'?tour=crystal-v7&autostart=1',href:'http://localhost:8931/TigerMessenger/index.html?tour=crystal-v7&autostart=1'};
// In-memory storage never reads, clears or writes the user's browser saves.
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};globalThis.window={addEventListener(){},removeEventListener(){},localStorage,location,innerWidth:1280,innerHeight:800};globalThis.HTMLImageElement=class{};globalThis.Image=class extends HTMLImageElement{constructor(){super();Object.assign(this,element(),{complete:true});}};
const {messengerIslandScene}=await import('../../../src/scenes/messengerIsland.js');



const {createSwampLivingPathConstraints}=await import('../../../src/world/swampGregLivingPaths.js');
const started=performance.now(),scene=new T.Scene(),gen=messengerIslandScene.loadSteps({scene,planetRadius:160});let built;
for(let i=0;i<150;i++){const n=gen.next();if(n.done){built=n.value;break;}}if(!built)throw Error('formal scene incomplete');
const root=built.landmarks.moebiusSwamp,inner=root.userData.inner;await inner.userData.tiger.userData.swampTigerV2Ready;scene.updateMatrixWorld(true);


const canopy=inner.userData.gregCoralCanopy,inverse=inner.matrixWorld.clone().invert(),tram=built.landmarks.tramSystem;
const curves=[tram.curve,...Object.values(tram.curves||{})],railPoints=[];let maxRailStep=0;
for(const curve of curves){const points=curve.getSpacedPoints(4096);for(let i=1;i<points.length;i++)maxRailStep=Math.max(maxRailStep,points[i].distanceTo(points[i-1]));railPoints.push(...points);}
const records=[],p=new T.Vector3();let minInnerY=Infinity,maxInnerY=-Infinity,maxRadius=0,minRailBoxDistance=Infinity,vertexCount=0;
for(const r of canopy.records){if(!r.expandedCentral)continue;const m=canopy.meshes.find(o=>o.parent===r.parent),im=new T.Matrix4();m.getMatrixAt(r.instance,im);const worldMatrix=m.matrixWorld.clone().multiply(im),matrix=inverse.clone().multiply(worldMatrix),box=new T.Box3();const attr=m.geometry.attributes.position;
 for(let i=0;i<attr.count;i++){p.fromBufferAttribute(attr,i).applyMatrix4(matrix);minInnerY=Math.min(minInnerY,p.y);maxInnerY=Math.max(maxInnerY,p.y);maxRadius=Math.max(maxRadius,Math.hypot(p.x,p.z));box.expandByPoint(p.fromBufferAttribute(attr,i).applyMatrix4(worldMatrix));vertexCount++;}
 let distance=Infinity;for(const v of railPoints)distance=Math.min(distance,box.distanceToPoint(v));minRailBoxDistance=Math.min(minRailBoxDistance,distance);
 records.push({group:r.group,instance:r.instance,box:[box.min.toArray(),box.max.toArray()],trackDistanceLowerBound:distance-maxRailStep/2-4.3});}
const report={at:new Date().toISOString(),formal:true,version:canopy.version,leaves:records.length,vertexCount,minInnerY,maxInnerY,maxRadiusInner:maxRadius,walkHeadClearanceWorld:(minInnerY-43.32)*.5,railBoundingBoxDistance:minRailBoxDistance,maxRailStep,railHalfWidth:4.3,railClearanceConservative:minRailBoxDistance-maxRailStep/2-4.3,records,elapsedMs:performance.now()-started};
fs.writeFileSync(new URL('./environment-round5-canopy-formal.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));

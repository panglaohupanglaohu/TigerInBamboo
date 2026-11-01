import fs from 'node:fs';import * as T from 'three';import {createHash} from 'node:crypto';
const context=new Proxy({canvas:{width:2,height:2},createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),getImageData:(_,__,w=2,h=2)=>({data:new Uint8ClampedArray(w*h*4)}),createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
function element(){const listeners={};return{width:2,height:2,style:{},dataset:{},classList:{add(){},remove(){},toggle(){}},appendChild(){},cloneNode(){return element();},setAttribute(){},addEventListener(k,f){listeners[k]=f;},removeEventListener(){},set src(v){queueMicrotask(()=>listeners.load?.call(this));},getContext:()=>context};}
globalThis.ImageData=class{constructor(data,width,height){this.data=data;this.width=width;this.height=height;}};
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element,addEventListener(){},body:element()};globalThis.location={search:'?tour=crystal-v7&autostart=1',href:'http://localhost:8931/TigerMessenger/index.html?tour=crystal-v7&autostart=1'};
// In-memory storage never reads, clears or writes the user's browser saves.
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};globalThis.window={addEventListener(){},removeEventListener(){},localStorage,location,innerWidth:1280,innerHeight:800};globalThis.HTMLImageElement=class{};globalThis.Image=class extends HTMLImageElement{constructor(){super();Object.assign(this,element(),{complete:true});}};
const {messengerIslandScene}=await import('../../../src/scenes/messengerIsland.js');



const {cityLocalToDir,dirToCityLocal,getCityFrame}=await import('../../../src/world/crystalCityLayout.js');
const {V7_SWAMP_LOCAL}=await import('../../../src/world/crystalV7Layout.js');
if(process.argv[2]){const [lx,lz]=process.argv[2].split(',').map(Number);Object.assign(V7_SWAMP_LOCAL,{lx,lz});}
const started=performance.now(),scene=new T.Scene(),gen=messengerIslandScene.loadSteps({scene,planetRadius:160});let built;
for(let i=0;i<150;i++){const n=gen.next();if(n.done){built=n.value;break;}}
if(!built)throw Error('no formal scene');
const {moebiusSwamp:swamp,tramSystem:tram,moebius:city}=built.landmarks,inner=swamp.userData.inner;
await inner.userData.tiger.userData.swampTigerV2Ready;
const bridgeReport=inner.userData.gregBridgeClearance;bridgeReport?.dispose();scene.updateMatrixWorld(true);
const q=new T.Quaternion().setFromAxisAngle(getCityFrame().center,-Math.PI/6),radius=swamp.position.length(),points=[];
for(const [name,curve]of Object.entries({center:tram.curve,...tram.curves}))for(let i=0;i<4096;i++)points.push({name,t:i/4096,p:curve.getPointAt(i/4096).normalize()});
const metric=(lx,lz)=>{const dir=cityLocalToDir(lx,lz).applyQuaternion(q);let min=Infinity,near;
 for(const p of points){const d=dir.angleTo(p.p)*radius;if(d<min){min=d;near=p;}}
 const towers=city.crystals.map(o=>({id:o.id||o.group.name,distance:dir.angleTo(o.dir)*radius})).sort((a,b)=>a.distance-b.distance);
 return{lx,lz,afterRotation:dirToCityLocal(dir),distanceFromOld:dir.angleTo(swamp.position.clone().normalize())*radius,trackCenterDistance:min,rim20Clearance:min-20-4.3,canopy30Clearance:min-30-4.3,nearestTrack:{name:near.name,t:near.t},nearestTowers:towers.slice(0,3)};
};
const candidates=[];for(let lx=-.15;lx<=.9;lx+=.025)for(let lz=-.55;lz<=.55;lz+=.025){const r=metric(+lx.toFixed(3),+lz.toFixed(3));if(r.distanceFromOld<75&&r.canopy30Clearance>3&&r.nearestTowers[0].distance>30)candidates.push(r);}
candidates.sort((a,b)=>a.distanceFromOld-b.distanceFromOld);
const inv=inner.matrixWorld.clone().invert();let canopyRadius=0;inner.traverse(o=>{if(o.isInstancedMesh&&o.name==='greg-coral-fan-crown'){o.geometry.computeBoundingBox();for(let i=0;i<o.count;i++){const im=new T.Matrix4();o.getMatrixAt(i,im);const b=o.geometry.boundingBox.clone().applyMatrix4(inv.clone().multiply(o.matrixWorld).multiply(im));for(const x of[b.min.x,b.max.x])for(const z of[b.min.z,b.max.z])canopyRadius=Math.max(canopyRadius,Math.hypot(x,z)*.5);}}});
const pierStats={components:0,minHorizontalWorld:Infinity,nearName:null};scene.traverse(o=>{
 if(!o.isMesh||!(o.name==='gate-site-GateSite_stone-solid'||(o.parent?.name==='tram-static-sector'&&o.userData.materialSourceNames?.length===1&&o.userData.materialSourceNames[0]==='tram-static-pier')))return;
 const p=o.geometry?.attributes?.position;if(!p||o.geometry.index||p.count%36)return;const m=inv.clone().multiply(o.matrixWorld);
 for(let first=0;first<p.count;first+=36){let min=Infinity,near=false;for(let j=0;j<36;j++){const wp=new T.Vector3().fromBufferAttribute(p,first+j).applyMatrix4(o.matrixWorld);if(wp.clone().normalize().dot(swamp.position.clone().normalize())>.7){const v=wp.applyMatrix4(inv);min=Math.min(min,Math.hypot(v.x,v.z)*.5);near=true;}}if(near){pierStats.components++;if(min<pierStats.minHorizontalWorld){pierStats.minHorizontalWorld=min;pierStats.nearName=o.name;}}}
});
const connectors=city.v7Shores?.children.filter(o=>o.name==='v7-garden-connector')||[],connectorBox=new T.Box3();let minConnectorY=Infinity,maxConnectorLength=0;for(const o of connectors){o.geometry.computeBoundingBox();maxConnectorLength=Math.max(maxConnectorLength,o.geometry.boundingBox.getSize(new T.Vector3()).z);minConnectorY=Math.min(minConnectorY,o.position.length());}
const report={pierStats,connectorCount:connectors.length,maxConnectorLength,minConnectorY,initialTowers:city.crystals.slice(0,3).map(o=>({id:o.group.name,local:dirToCityLocal(o.dir),lakeDistance:swamp.position.clone().normalize().angleTo(o.dir)*radius})),elapsedMs:performance.now()-started,original:metric(V7_SWAMP_LOCAL.lx,V7_SWAMP_LOCAL.lz),radius,canopyRadius,swampPosition:swamp.position.toArray(),bridgeBeforeDispose:bridgeReport?{removedPiers:bridgeReport.removedPiers}:null,best:candidates.slice(0,20)};
fs.writeFileSync(new URL('./lake-relocation-probe'+(process.argv[2]?'-candidate':'')+'.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));

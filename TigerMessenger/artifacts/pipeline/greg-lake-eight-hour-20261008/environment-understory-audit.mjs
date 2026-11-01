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

const growth=inner.userData.gregUnderstory,records=growth.records.filter(r=>r.source==='rim'||r.source==='shoulder').map((r,i)=>({i,source:r.source,type:r.type,hero:r.hero??false,cluster:r.cluster,side:r.rimSide||'inner',position:r.position,height:r.envelope.height,top:r.envelope.position[1]+r.envelope.height,radial:Math.hypot(r.position[0],r.position[2])}));
fs.writeFileSync(new URL('./environment-understory-height-before.json',import.meta.url),JSON.stringify({at:new Date().toISOString(),records,counts:growth.counts,route:inner.userData.gregSpatialPlan.route},null,2));console.log(JSON.stringify({records,counts:growth.counts}));

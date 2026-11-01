import * as T from 'three';
import {writeFileSync} from 'node:fs';
// The real scene generator, URL defaults and ordered city/mountain steps run
// unchanged. Only browser drawing APIs are stubbed for this CPU startup check.
const context=new Proxy({canvas:{width:2,height:2},createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),getImageData:(_,__,w=2,h=2)=>({data:new Uint8ClampedArray(w*h*4)}),createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
function element(){const listeners={};return{width:2,height:2,style:{},dataset:{},classList:{add(){},remove(){},toggle(){}},appendChild(){},cloneNode(){return element();},setAttribute(){},addEventListener(k,f){listeners[k]=f;},removeEventListener(){},set src(v){queueMicrotask(()=>listeners.load?.call(this));},getContext:()=>context};}
globalThis.ImageData=class{constructor(data,width,height){this.data=data;this.width=width;this.height=height;}};
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element,addEventListener(){},body:element()};globalThis.location={search:'?tour=crystal-v7&autostart=1',href:'http://localhost:8931/TigerMessenger/index.html?tour=crystal-v7&autostart=1'};
// In-memory storage never reads, clears or writes the user's browser saves.
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};globalThis.window={addEventListener(){},removeEventListener(){},localStorage,location,innerWidth:1280,innerHeight:800};globalThis.HTMLImageElement=class{};globalThis.Image=class extends HTMLImageElement{constructor(){super();Object.assign(this,element(),{complete:true});}};
const {messengerIslandScene}=await import('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger/src/scenes/messengerIsland.js');



const scene=new T.Scene(),gen=messengerIslandScene.loadSteps({scene,planetRadius:160});let handle;
for(let i=0;i<160;i++){const n=gen.next();if(n.done){handle=n.value;break;}}
if(!handle?.update)throw Error('No actual returned formal scene handle');
const inner=scene.getObjectByName('moebius-swamp-zone');await inner.userData.tiger?.userData.swampTigerV2Ready;
let root;scene.traverse(o=>{if(o.userData.kind==='moebius-swamp'&&o.userData.update)root=o;});if(!root)throw Error('No actual swamp placement update');
const records=[],allocationStacks={},disposeCounts={texture:0,geometry:0,material:0},canvasCounts={count:0};
let tracking=false;
const seenG=new Set(),seenM=new Set(),addStacks={};scene.traverse(o=>{if(o.geometry)seenG.add(o.geometry.uuid);for(const m of [].concat(o.material||[]))seenM.add(m.uuid);});
const originalAdd=T.Object3D.prototype.add;
T.Object3D.prototype.add=function(...children){if(tracking){for(const child of children){let geometry=0,material=0;child.traverse?.(o=>{if(o.geometry&&!seenG.has(o.geometry.uuid)){geometry++;seenG.add(o.geometry.uuid);}for(const m of [].concat(o.material||[]))if(!seenM.has(m.uuid)){material++;seenM.add(m.uuid);}});if(geometry||material){const stack=new Error().stack.split('\n').slice(2,7).join('\n');const entry=addStacks[stack]??={geometry:0,material:0,examples:[]};entry.geometry+=geometry;entry.material+=material;if(entry.examples.length<3)entry.examples.push(child.name||child.type);}}}return originalAdd.apply(this,children);};

const originalDispatch=T.EventDispatcher.prototype.dispatchEvent;
T.EventDispatcher.prototype.dispatchEvent=function(event){if(tracking&&event.type==='dispose'){const k=this.isTexture?'texture':this.isBufferGeometry?'geometry':this.isMaterial?'material':null;if(k)disposeCounts[k]++;}return originalDispatch.call(this,event);};
const originalElement=document.createElement;document.createElement=function(tag){if(tracking&&tag==='canvas'){canvasCounts.count++;const stack=new Error().stack.split('\n').slice(2,6).join('\n');allocationStacks[stack]=(allocationStacks[stack]||0)+1;}return originalElement(tag);};
function ids(){const x=[new T.Texture(),new T.BufferGeometry(),new T.MeshBasicMaterial()];const y=x.map(o=>o.id);x.forEach(o=>o.dispose());return y;}
function inventory(){const geometry=new Set(),material=new Set(),texture=new Set();let objects=0;function tex(v){if(v?.isTexture)texture.add(v.uuid);else if(Array.isArray(v))v.forEach(tex);}
scene.traverse(o=>{objects++;if(o.geometry)geometry.add(o.geometry.uuid);for(const m of [].concat(o.material||[])){material.add(m.uuid);Object.values(m).forEach(tex);for(const u of Object.values(m.uniforms||{}))tex(u?.value);}});return{objects,geometry:geometry.size,material:material.size,texture: texture.size};}
const runtime={gameStarted:true,keys:{},player:new T.Group()};runtime.player.position.set(0,161,0);runtime.player.facing=new T.Vector3(0,0,1);runtime.player.userData.velocity=new T.Vector3();
function run(name,update,seconds,startTime){const start=ids(),before=inventory(),disposedBefore={...disposeCounts},canvasBefore=canvasCounts.count,wallStart=performance.now();let error=null,frames=0;tracking=true;try{for(let i=0;i<seconds*20;i++){update(.05,startTime+i*.05,runtime);frames++;}}catch(e){error=e.stack;}tracking=false;const end=ids();const row={name,seconds:frames*.05,frames,wallSeconds:(performance.now()-wallStart)/1000,allocations:Object.fromEntries(['texture','geometry','material'].map((k,i)=>[k,end[i]-start[i]-1])),disposals:Object.fromEntries(Object.keys(disposeCounts).map(k=>[k,disposeCounts[k]-disposedBefore[k]])),canvas:canvasCounts.count-canvasBefore,before,after:inventory(),error};records.push(row);console.log(JSON.stringify(row));}
run('formal-first-10s',handle.update,10,0);
run('formal-next-10s',handle.update,10,10);

const result={method:'Actual completed messengerIslandScene generator returned handle, actual updateMessengerIsland and actual lake placement root.update; resource constructor monotonic IDs count all Texture/BufferGeometry/Material subclasses even if immediately detached. No renderer, main player/physics/lighting/DOM/audio loop; browser APIs stubbed, no claim of GPU memory measurement. dt=.05, 20 updates/s. Wall timers not accelerated.',records,canvasAllocationStacks:allocationStacks,addStacks};
writeFileSync(new URL('./performance-allocation-trace.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
process.exit(records.some(x=>x.error)?1:0);

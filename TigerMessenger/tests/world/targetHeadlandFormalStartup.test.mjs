import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
// The real scene generator, URL defaults and ordered city/mountain steps run
// unchanged. Only browser drawing APIs are stubbed for this CPU startup check.
const context=new Proxy({canvas:{width:2,height:2},createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),getImageData:(_,__,w=2,h=2)=>({data:new Uint8ClampedArray(w*h*4)}),createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
function element(){const listeners={};return{width:2,height:2,style:{},dataset:{},classList:{add(){},remove(){},toggle(){}},appendChild(){},setAttribute(){},addEventListener(k,f){listeners[k]=f;},removeEventListener(){},set src(v){queueMicrotask(()=>listeners.load?.call(this));},getContext:()=>context};}
globalThis.ImageData=class{constructor(data,width,height){this.data=data;this.width=width;this.height=height;}};
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element,addEventListener(){},body:element()};globalThis.location={search:'?tour=crystal-v7&autostart=1',href:'http://localhost:8931/TigerMessenger/index.html?tour=crystal-v7&autostart=1'};
// In-memory storage never reads, clears or writes the user's browser saves.
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};globalThis.window={addEventListener(){},removeEventListener(){},localStorage,location,innerWidth:1280,innerHeight:800};globalThis.HTMLImageElement=class{};globalThis.Image=class extends HTMLImageElement{constructor(){super();Object.assign(this,element(),{complete:true});}};
const {messengerIslandScene}=await import('../../src/scenes/messengerIsland.js');
test('formal messengerIsland loadSteps reaches lake construction through the complete default mountain chain',()=>{
 const scene=new T.Scene(),generator=messengerIslandScene.loadSteps({scene,planetRadius:160}),stages=[];let reached=false;
 try{for(let i=0;i<100;i++){const next=generator.next();if(next.done)break;stages.push(String(next.value));if(String(next.value).includes('布置书店与湖沼')){reached=true;break;}}}finally{generator.return();}
 assert.ok(reached,'real default scene must pass mountainStudy, not a differently configured standalone fixture');assert.equal(stages.filter(s=>s.includes('整理圣城地形（')).length,33);assert.ok(stages.some(s=>s.includes('整理山体与岩面植被')));
 const source=scene.getObjectByName('citadel-oskar-grid-mountain-surface'),report=source.userData.westRailHeadlandRetreat.rearShipCliff;
 assert.ok(report.sourceTriangles>100000);assert.equal(report.closedCutContours,true);assert.equal(report.openCapEndpoints,0);assert.deepEqual(report.openContourNodes,[]);assert.ok(report.authoredSkirtPanels>=2);assert.ok(report.capTriangles>0);assert.ok(Number.isFinite(report.skirtBase));
 for(const a of Object.values(source.geometry.attributes))assert.ok([...a.array].every(Number.isFinite));
});

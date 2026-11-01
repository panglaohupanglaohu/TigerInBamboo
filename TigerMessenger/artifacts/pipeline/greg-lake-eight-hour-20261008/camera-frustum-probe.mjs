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


const provider=createSwampCameraOccluders(inner.parent),position=inner.localToWorld(new T.Vector3(16.815,30.8,-17.487)),up=position.clone().normalize(),forward=inner.localToWorld(new T.Vector3(-8,30.8,-7)).sub(position);forward.addScaledVector(up,-forward.dot(up)).normalize();
const camera=new T.PerspectiveCamera(60,1280/540,.1,1000),rig=createCameraRig(camera,{position,forward,velocity:new T.Vector3()},{colliders:()=>[],occluderMeshes:provider});rig.snapToPlayer();for(let i=0;i<60;i++)rig.update(1/60);camera.updateMatrixWorld(true);const meshes=[];scene.traverse(o=>{if(o.isMesh)meshes.push(o)});
for(const xy of [[0,0],[-.5,0],[.5,0],[0,.5],[0,-.5],[-.5,.5],[.5,.5],[-.5,-.5],[.5,-.5]]){const ray=new T.Raycaster();ray.setFromCamera(new T.Vector2(...xy),camera);console.log('pixel',xy,ray.intersectObjects(meshes,false).slice(0,3).map(h=>({name:h.object.name,parent:h.object.parent?.name,d:h.distance,point:inner.worldToLocal(h.point.clone()).toArray()})));}

console.log('cuts',JSON.stringify(scene.getObjectByName('crystal-v7-shores').userData.lakeCavityClearance));

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

const {createWeaponEffects}=await import('../../../src/gameplay/robotOps/weaponEffects.js');
const root=new T.Group(),model=new T.Group();model.userData.robotType='ant';root.add(model);
const effects=createWeaponEffects(root);let created=0,disposed=0;const maps=[],seen=new Set();
const prevAdd=T.Object3D.prototype.add;T.Object3D.prototype.add=function(...objects){for(const o of objects)if(o.name==='weapon-pressure-steam'){const tex=o.material.map;maps.push(tex);if(!seen.has(tex)){seen.add(tex);created++;tex.addEventListener('dispose',()=>disposed++);}}return prevAdd.apply(this,objects);};
for(let i=0;i<20;i++){effects.shot(model,new T.Vector3(0,0,10));for(let j=0;j<40;j++)effects.update(.05);}
const beforeDispose={created,disposed,active:effects.count,pending:effects.pendingCount,children:root.children.length};effects.dispose();
const result={method:'Actual createWeaponEffects ant shot, 20 rounds, each followed by 2 simulated seconds update, then actual effects.dispose. DOM/audio APIs stubbed; no renderer. Each steam material.map has dispose event listener.',beforeDispose,afterDispose:{created,disposed,active:effects.count,children:root.children.length},uniqueTextures:new Set(maps.map(t=>t.uuid)).size,textureType:maps[0]?.constructor.name};
writeFileSync(new URL('./weapon-steam-texture-audit-after.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(result);

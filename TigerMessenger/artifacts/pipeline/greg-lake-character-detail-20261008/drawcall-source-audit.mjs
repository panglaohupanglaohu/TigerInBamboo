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


const scene=new T.Scene(),gen=messengerIslandScene.loadSteps({scene,planetRadius:160});let reached=false;
try{for(let i=0;i<140;i++){const n=gen.next();if(n.done)break;if(String(n.value).includes('信使主岛已构建')){reached=true;break;}}}finally{gen.return();}
if(!reached)throw new Error('formal scene construction did not complete');
const inner=scene.getObjectByName('moebius-swamp-zone');await inner.userData.tiger?.userData.swampTigerV2Ready;
scene.updateMatrixWorld(true);
const path=o=>{const a=[];for(let n=o;n&&n!==scene;n=n.parent)a.unshift(n.name||`${n.type}#${n.id}`);return a.join('/');};
const blank=()=>({objects:0,draws:0,triangles:0,outlineObjects:0,outlineDraws:0,outlineTriangles:0,instancedObjects:0,instances:0,materials:new Set()});
const groups=new Map(),materialRows=new Map(),signatureRows=new Map(),geometryRows=new Map(),objects=[];
function add(s,r){for(const k of ['objects','draws','triangles','outlineObjects','outlineDraws','outlineTriangles','instancedObjects','instances'])s[k]+=r[k];for(const m of r.materials)s.materials.add(m);}
const total=blank(),lake=blank();
scene.traverseVisible(o=>{
 if(!(o.isMesh||o.isLine||o.isPoints||o.isSprite)||!o.material)return;
 const all=Array.isArray(o.material)?o.material:[o.material],mats=all.filter(m=>m?.visible);if(!mats.length)return;
 const g=o.geometry,range=g?.drawRange||{start:0,count:Infinity},raw=g?(g.index?.count??g.attributes.position?.count??0):6;
 const groupsDraw=Array.isArray(o.material)?(g.groups||[]).filter(g=>all[g.materialIndex]?.visible&&Math.min(g.start+g.count,range.start+range.count)>Math.max(g.start,range.start)):[];
 const draws=Array.isArray(o.material)?groupsDraw.length:1;
 const twoPass=m=>m.transparent&&m.side===T.DoubleSide&&!m.forceSinglePass?2:1;
 const drawEstimate=Array.isArray(o.material)?groupsDraw.reduce((n,g)=>n+twoPass(all[g.materialIndex]),0):twoPass(mats[0]);
 const inst=o.isInstancedMesh?o.count:1,count=Math.max(0,Math.min(raw-range.start,range.count));
 const tris=o.isMesh?count/3*inst:0,outline=o.userData.isOutline||o.userData.outline||/outline|(?:^|-)ink(?:-|$)/i.test(o.name)||mats.every(m=>m.side===T.BackSide);
 const row={objects:1,draws:drawEstimate,triangles:Math.round(tris),outlineObjects:outline?1:0,outlineDraws:outline?drawEstimate:0,outlineTriangles:outline?Math.round(tris):0,instancedObjects:o.isInstancedMesh?1:0,instances:o.isInstancedMesh?o.count:0,materials:new Set(mats.map(m=>m.uuid))};
 add(total,row);let inLake=false;for(let n=o;n;n=n.parent){if(n===inner)inLake=true;if(!groups.has(n))groups.set(n,blank());add(groups.get(n),row);}if(inLake)add(lake,row);
 const entry={name:o.name||o.type,path:path(o),draws:drawEstimate,triangles:Math.round(tris),outline:!!outline,geometry:g?.type,materialCount:mats.length,instanced:!!o.isInstancedMesh,instances:o.isInstancedMesh?o.count:0,inLake};objects.push(entry);
 for(const m of mats){const signature=JSON.stringify({type:m.type,color:m.color?.getHexString(),side:m.side,transparent:m.transparent,opacity:m.opacity,map:!!m.map,vertexColors:m.vertexColors,shaderKey:m.customProgramCacheKey?.()});
  for(const [map,key]of[[materialRows,m.uuid],[signatureRows,signature]]){if(!map.has(key))map.set(key,{name:m.name,type:m.type,color:m.color?.getHexString(),side:m.side,objects:0,lakeObjects:0,outlineObjects:0,materialIds:new Set(),examples:[]});const s=map.get(key);s.objects++;s.lakeObjects+=inLake?1:0;s.outlineObjects+=outline?1:0;s.materialIds.add(m.uuid);if(s.examples.length<4)s.examples.push(path(o));}
 }
 const geoKey=g?.uuid;if(geoKey){if(!geometryRows.has(geoKey))geometryRows.set(geoKey,{type:g.type,objects:0,lakeObjects:0,trianglesEach:raw/3,examples:[]});const s=geometryRows.get(geoKey);s.objects++;s.lakeObjects+=inLake?1:0;if(s.examples.length<3)s.examples.push(path(o));}
});
const clean=s=>({...s,materials:s.materials?.size,materialIds:s.materialIds?.size});
const groupRows=[...groups].filter(([o])=>!o.isMesh&&!o.isLine&&!o.isPoints).map(([o,s])=>({name:o.name||o.type,path:path(o),...clean(s)})).sort((a,b)=>b.draws-a.draws);
const report={method:'Read-only formal scene CPU inventory. Visible ancestor traversal, no camera frustum/occlusion or render pass simulation. Mesh groups and transparent DoubleSide two-pass estimated. These are available main-pass submissions, NOT measured GPU drawcalls. Shared geometry/material does not batch ordinary meshes.',total:clean(total),lake:clean(lake),largestDrawObjects:objects.slice().sort((a,b)=>b.draws-a.draws).slice(0,35),lakeChildren:inner.children.map(o=>({name:o.name||o.type,path:path(o),...clean(groups.get(o)||blank())})).sort((a,b)=>b.draws-a.draws),lakeOutlineSubtrees:groupRows.filter(g=>g.path.includes('moebius-swamp-zone')&&g.outlineDraws).sort((a,b)=>b.outlineDraws-a.outlineDraws).slice(0,30),warships:[...groups].filter(([o])=>o.userData.warshipV6).map(([o,s])=>({name:o.name,...clean(s),staticDraws:o.userData.warshipV6.staticDraws,dynamicBatches:o.userData.warshipV6.batches,crewRows:o.userData.crew?.userData.rows?.length})),sceneChildren:scene.children.map(o=>({name:o.name||o.type,path:path(o),...clean(groups.get(o)||blank())})).sort((a,b)=>b.draws-a.draws),largestSubtrees:groupRows.slice(0,100),lakeSubtrees:groupRows.filter(g=>g.path.includes('moebius-swamp-zone')).slice(0,65),shipSubtrees:groupRows.filter(g=>/ship|boat|trireme|fleet|舰|船|galley/i.test(g.name)).slice(0,100),largestMaterials:[...materialRows.values()].sort((a,b)=>b.objects-a.objects).slice(0,35).map(clean),largestCompatibleMaterialSignatures:[...signatureRows.values()].sort((a,b)=>b.objects-a.objects).slice(0,35).map(clean),largestSharedGeometries:[...geometryRows.values()].sort((a,b)=>b.objects-a.objects).slice(0,30),largestTriangleObjects:objects.sort((a,b)=>b.triangles-a.triangles).slice(0,40)};
writeFileSync(new URL(`./drawcall-source-audit${process.env.LAKE_AUDIT_SUFFIX||''}.json`,import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,lake:report.lake,sceneChildren:report.sceneChildren,largestSubtrees:report.largestSubtrees.slice(0,22),lakeSubtrees:report.lakeSubtrees.slice(0,25),shipSubtrees:report.shipSubtrees.slice(0,20)},null,2));

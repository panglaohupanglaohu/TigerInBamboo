import * as THREE from 'three';
import {P} from '../core/params.js';
import {junctionAssemblyInput,junctionRestoreLogicalOwners,junctionCellValue,junctionSetCell,JUNCTION_GROW_MARGIN} from './junctionEditableCells.js';
import {createJunctionScenePicking} from './junctionScenePicking.js';
import {auditTownPassageClearance} from './citadel/townPassageGeometry.js';
import foundation from '../../assets/models/optimized/canal-junction/junctionFoundationData.js';
import {buildCitadelTownAssembly} from './odysseyCitadel.js';
export const JUNCTION_EDIT_KEY='tiger:canal-junction:regions:v1';
const clone=x=>JSON.parse(JSON.stringify(x));
export function junctionRegionDefaults(){return foundation.regions.map(([id,x,z,baseY,w,d,h,color],index)=>{
 const cols=Math.max(1,Math.round(w/1.6)),rows=Math.max(1,Math.round(d/1.6)),floors=Math.max(2,Math.round(h/1.7));
 const char={coral:'D',teal:'C',yellow:'3',cream:'0'}[color];
 const levels=Array.from({length:floors},()=>Array(rows).fill(char.repeat(cols)));
 if(!id.includes('tower')&&id!=='rear-keep')levels[floors-1][rows-1]='.'.repeat(cols);
 if(id==='rear-keep')for(let k=0;k<2;k++)for(let row=0;row<rows;row++){let a=[...levels[k][row]];a[Math.floor(cols/2)]='.';if(cols>3)a[Math.floor(cols/2)-1]='.';levels[k][row]=a.join('');}
 return {id,x,z:-z,baseY,cols,rows,levels,seed:711+index};
});}
// Context-owned resources may not occur on any emitted mesh (e.g. the water
// material on a dry region). Pattern maps are shared factory assets: never dispose
// arbitrary material.map here. Only the per-build gradient is exclusively owned.
const ownedContextResources=new WeakMap();
function release(group){const gs=new Set(),ms=new Set(),textures=new Set();group.traverse(o=>{
 if(o.geometry)gs.add(o.geometry);
 for(const m of Array.isArray(o.material)?o.material:[o.material])if(m&&!m.userData?.shared)ms.add(m);
 const owned=ownedContextResources.get(o);if(owned){owned.materials.forEach(m=>ms.add(m));owned.textures.forEach(t=>textures.add(t));ownedContextResources.delete(o);}
});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}
export function installEditableJunction(city,{storage=globalThis.localStorage,build=buildCitadelTownAssembly,wfcPassage=Number(new URLSearchParams(globalThis.location?.search||'').get('junctionWfcPassage')||0)}={}){
 if(wfcPassage&&P.cornerModulesV1)throw Error('junctionWfcPassage does not support cornerModulesV1');
 if(![false,true,0,1,2].includes(wfcPassage))throw Error('Unsupported junction passage candidate');
 const paired=wfcPassage===2;
 const root=new THREE.Group();root.name='canal-junction-editable-v1';
 for(const p of foundation.parts){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p.positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(p.normals,3));const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:new THREE.Color(...p.color),roughness:1,flatShading:true}));mesh.name=p.name;mesh.userData.junctionWalk=true;mesh.userData.citadelSolidExterior=true;root.add(mesh);}
 const defaults=junctionRegionDefaults();
 // Real open foundation decks regain their own sparse, neighbouring-cell grid.
 for(const [name,id]of[['irregular-quay','build-quay'],['central-open-court','build-court'],['keep-bearing-foundation','build-keep']]){const mesh=root.getObjectByName(name);mesh.geometry.computeBoundingBox();defaults.push({id,x:0,z:0,baseY:mesh.geometry.boundingBox.max.y,cols:25,rows:25,levels:[Array(25).fill('.'.repeat(25))],seed:911+defaults.length,freeBuild:true});}
 let regions=clone(defaults),undo=[],redo=[],revision=0,dirty=false;const groups=new Map();
 try{const saved=JSON.parse(storage?.getItem(JUNCTION_EDIT_KEY)||'null');if(saved?.schema==='junction-regions-v1'&&Array.isArray(saved.regions)){
  for(const r of regions){const item=saved.regions.find(s=>s.id===r.id);if(!item){if(r.freeBuild)continue;throw Error('missing original region');}
   if(!Array.isArray(item.levels)||item.levels.length>24||!item.levels.length||item.levels.some(l=>!Array.isArray(l)||l.length!==r.rows||l.some(v=>typeof v!=='string'||v.length!==r.cols||!/^[.0-9A-GWLBD]+$/.test(v))))throw Error('invalid region save');
   r.levels=clone(item.levels);r.extensions={};for(const[key,value]of Object.entries(item.extensions||{})){const a=key.split(',').map(Number);if(a.length!==3||!a.every(Number.isInteger)||a[0]<-JUNCTION_GROW_MARGIN||a[0]>=r.cols+JUNCTION_GROW_MARGIN||a[1]<0||a[1]>=24||a[2]<-JUNCTION_GROW_MARGIN||a[2]>=r.rows+JUNCTION_GROW_MARGIN||! /^[0-9A-G]$/.test(value))throw Error('invalid extension save');r.extensions[key]=value;}
  }
 }}catch{regions=clone(defaults);}
 function construct(r){
 if(paired&&r.id==='left-mid-yellow')for(const x of [0,1,2]){
  const occupied=y=>(r.levels[y]?.[1]?.[x]??'.')!=='.';
  if(!occupied(0)&&occupied(1))throw Error(`双层拱门拒绝删除：left-mid-yellow ${x},1,1 上格仍占用，删除下半会失去承托；上格未被自动删除。`);
 }
 const input=junctionAssemblyInput(r),cache={};const town=build({cellSize:1.6,cellHeight:1.7,levels:input.levels},{baseY:r.baseY,wfcTownV1:true,wfcPassageV1:!!wfcPassage,wfcPassagePair:paired&&r.id==='left-mid-yellow',wfcSeed:r.seed,townCtxCache:cache,townscaperColors:true,leanDecor:true});
 const privateMaterials=new Set(Object.values(town.materials||{}).flat().filter(m=>m?.isMaterial&&!m.userData?.shared));
 // townWaterMat is a fresh clone even though clone copies userData.shared.
 if(town.ctx?.townWaterMat)privateMaterials.add(town.ctx.townWaterMat);
 ownedContextResources.set(town.group,{materials:privateMaterials,textures:new Set(town.gradientMap?[town.gradientMap]:[])});
 const occupiedCount=r.levels.reduce((sum,rows)=>sum+rows.join('').replace(/\./g,'').length,0)+Object.keys(r.extensions||{}).length;
 junctionRestoreLogicalOwners(town.group,input.padding);
 const assignment=Object.fromEntries(Object.entries(cache.wfcTownSelection?.value?.byCell||{}).map(([key,value])=>{const [x,y,z]=key.split(',').map(Number);return[[x-input.padding,y,z-input.padding].join(','),value];}));
 if(occupiedCount&&town.stats?.wfcTown?.ok!==true){release(town.group);throw Error(`WFC failed for ${r.id}; candidate not published`);}
 town.group.userData.junctionWfc={...town.stats.wfcTown,occupiedCount,assignment:clone(assignment),geometryConsumers:['roof-slope-versus-flat','enclosed-garden',...(wfcPassage?['body.passage-through-arch']:[]),...(paired&&r.id==='left-mid-yellow'?['body.passage2-cross-storey']:[])],adjacencyBuilders:['wall','corner',wfcPassage?'suspended-arch':'arch','decoration'],scope:'fixed region occupancy; local role compatibility, not global city generation'};
 for(const level of town.levels)level.position.z=0;town.group.position.set(r.x,0,r.z);town.group.name=r.id;town.group.userData.junctionRegion=r.id;town.group.traverse(o=>{if(o.isMesh){o.userData.junctionWalk=true;o.userData.citadelSolidExterior=true;}});return town.group;}
 function publish(next){const replacements=[];try{for(const r of next){const prev=regions.find(v=>v.id===r.id);if(r.freeBuild&&!groups.has(r.id)&&!r.levels.some(l=>l.some(row=>/[^.]/.test(row)))&&!Object.keys(r.extensions||{}).length)continue;if(!groups.has(r.id)||JSON.stringify([prev.levels,prev.extensions])!==JSON.stringify([r.levels,r.extensions]))replacements.push([r.id,construct(r)]);}
 if(wfcPassage){const proposed=new Map([...groups,...replacements]);const clearance=auditTownPassageClearance([...root.children.filter(o=>!o.userData.junctionRegion),...proposed.values()],{referenceRoot:root});if(!clearance.ok)throw Error(`WFC passage obstructed: ${JSON.stringify(clearance.blocked.slice(0,3))}`);root.userData.passageClearance=clearance;}
 }catch(error){for(const[,g]of replacements)release(g);return {ok:false,error:String(error)};}
 for(const[id,g]of replacements){const old=groups.get(id);if(old){old.removeFromParent();release(old);}root.add(g);groups.set(id,g);}regions=next;revision++;root.userData.revision=revision;root.updateMatrixWorld(true);return {ok:true,revision};}
 const initial=publish(regions);if(!initial.ok){release(root);throw new Error(initial.error);}
 const previous=city.children.map(o=>[o,o.visible]);previous.forEach(([o])=>o.visible=false);city.add(root);city.userData.junctionTarget=root;
 const picking=createJunctionScenePicking(city,root,()=>regions,groups);
 const api={root,get revision(){return revision;},get dirty(){return dirty;},audit:()=>({revision,regions:[...groups].map(([regionId,g])=>({regionId,...clone(g.userData.junctionWfc)}))}),snapshot:()=>({schema:'junction-regions-v1',regions:regions.map(({id,levels,extensions})=>({id,levels:clone(levels),...(Object.keys(extensions||{}).length?{extensions:clone(extensions)}:{})}))}),
 cellWorld(c){const r=regions.find(r=>r.id===c.regionId);return r?city.localToWorld(new THREE.Vector3(r.x+(c.ix-(r.cols-1)/2)*1.6,r.baseY+(c.iy+.5)*1.7,r.z+(c.iz-(r.rows-1)/2)*1.6)):null;},
 pick:picking.pick, placementTarget:picking.target,
 edit(c,mode,char='0'){const next=clone(regions),r=next.find(r=>r.id===c.regionId);if(!r||!picking.valid(c))return {ok:false,error:'outside supported build region'};const old=junctionCellValue(r,c),value=mode==='erase'?'.':char;if(old===value)return {ok:false,error:'unchanged'};if(!/^[.0-9A-G]$/.test(value))return {ok:false,error:'invalid color'};if(mode!=='erase'&&!picking.admitted(c))return {ok:false,error:'该格缺少完整台基承托，或与另一楼群重叠'};junctionSetCell(r,c,value);const before=clone(regions),result=publish(next);if(result.ok){undo.push(before);if(undo.length>100)undo.shift();redo=[];dirty=true;}return result;},
 undo(){if(!undo.length)return false;const before=clone(regions),result=publish(clone(undo.at(-1)));if(result.ok){undo.pop();redo.push(before);dirty=true;}return result.ok;},
 redo(){if(!redo.length)return false;const before=clone(regions),result=publish(clone(redo.at(-1)));if(result.ok){redo.pop();undo.push(before);dirty=true;}return result.ok;},
 save(){storage.setItem(JUNCTION_EDIT_KEY,JSON.stringify(api.snapshot()));dirty=false;return true;},
 dispose(){root.removeFromParent();release(root);previous.forEach(([o,v])=>o.visible=v);delete city.userData.junctionTarget;delete city.userData.junctionEditor;}
 };city.userData.junctionEditor=api;return root;
}

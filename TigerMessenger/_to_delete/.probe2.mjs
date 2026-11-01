import * as T from 'three';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement}=await import(process.cwd()+'/src/world/moebiusSwamp.js');
const scene=createMoebiusSwampPlacement({seed:7711,scale:.5});scene.updateMatrixWorld(true);
for(const m of process.argv.slice(2)){const mod=await import(process.cwd()+'/src/world/'+m+'.js');const fn=Object.values(mod).find(f=>f.name?.startsWith('install'));const t0=Date.now();const r=fn({swamp:scene});for(let i=0;i<5;i++){scene.userData.update?.(.1,i,{});r.update(i);}console.log(m,Date.now()-t0+'ms',JSON.stringify(r.report));}

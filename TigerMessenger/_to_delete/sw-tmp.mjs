import * as T from 'three';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement}=await import(process.cwd()+'/src/world/moebiusSwamp.js');
const scene=createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=scene.userData.inner;let sw;inner.traverse(g=>{if(g.name==='swamp-native-doll'&&g.userData.coralSwimLimbs)sw=g;});
const out=[];for(let i=0;i<56;i++){const t=i*.5;scene.userData.update(.5,t,{});scene.updateMatrixWorld(true);const b=new T.Box3().setFromObject(sw);const inv=inner.matrixWorld.clone().invert();b.applyMatrix4(inv);out.push(`${t}:${sw.userData.swimPhase[0]}:${b.max.y.toFixed(2)}`);}
console.log(sw.userData.bodyH, out.join(' '));

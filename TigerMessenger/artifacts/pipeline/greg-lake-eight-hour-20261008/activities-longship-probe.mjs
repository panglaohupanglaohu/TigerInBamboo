import * as T from 'three';
const ctx=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});const el=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>ctx});globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:el,createElementNS:el};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement}=await import('../../../src/world/moebiusSwamp.js');const root=createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=root.userData.inner;root.updateMatrixWorld(true);

import fs from 'node:fs';
const sy=inner.userData.shipyard,boat=sy.departure,nodes=boat.userData.warshipV6.nodes,v=new T.Vector3(),v2=new T.Vector3(),prev=new T.Vector3(),groups={};const trace=[],detail=[];
for(let i=0;i<=780;i++){const time=i/30;root.userData.update(1/30,time,{});root.updateMatrixWorld(true);const cycle=(time+4)%26,phase=cycle<9?'dock':cycle<20?'sail':'fade';const g=groups[phase]??={minBladeY:Infinity,maxBladeY:-Infinity,minDirection:1,maxSpeed:0,below:0,above:0,rows:26};
 const d=v2.copy(boat.position).sub(prev);d.y=0;if(i&&d.length()<1&&d.length()>.00001)g.minDirection=Math.min(g.minDirection,d.clone().normalize().dot(new T.Vector3(Math.cos(boat.rotation.y),0,-Math.sin(boat.rotation.y))));g.maxSpeed=Math.max(g.maxSpeed,d.length()*30);prev.copy(boat.position);
 for(let j=0;j<26;j++){nodes.get('n'+(66+j*5)).getWorldPosition(v);inner.worldToLocal(v);g.minBladeY=Math.min(g.minBladeY,v.y);g.maxBladeY=Math.max(g.maxBladeY,v.y);g[v.y<25?'below':'above']++;if(j===0&&phase==='sail')detail.push({t:time,y:v.y,phase:boat.userData.oarPhase,x:boat.worldToLocal(nodes.get('n66').getWorldPosition(v)).x});}
 trace.push(inner.userData.lotuses.map(b=>({p:b.position.toArray(),q:b.quaternion.toArray(),stem:b.userData.flowerStem?.matrix.elements.slice(),motion:{...b.userData.paddleMotion}})));
}
const tag=process.argv[2]||'before';fs.writeFileSync(new URL('activities-longship-'+tag+'.json',import.meta.url),JSON.stringify({groups,detail},null,2));fs.writeFileSync(new URL('activities-nav-trace-'+tag+'.json',import.meta.url),JSON.stringify(trace));console.log(JSON.stringify(groups));

import * as T from 'three';
const m=await import(process.cwd()+'/src/world/twelveApostlesTarget.js');
const curve={getLength:()=>Math.PI*2*161,getPointAt:u=>new T.Vector3(Math.sin(u*Math.PI*2)*161,Math.cos(u*Math.PI*2)*161,0),getTangentAt:u=>new T.Vector3(Math.cos(u*Math.PI*2),-Math.sin(u*Math.PI*2),0)};const rails=Array.from({length:2024},(_,i)=>curve.getPointAt(i/2024));
const g=new T.Group();const r=m.buildTwelveApostlesTarget({parent:g,railCurves:{red:curve},railPoints:rails,waterAt:p=>p.clone().normalize().multiplyScalar(160),referencePoint:new T.Vector3(0,160,8)});
for(const x of r.report.masses)if(!x.wfc?.solved)console.log(x.id,JSON.stringify(x.wfc.conflicts),JSON.stringify(x.wfc.pinsUsed),x.dropped&&JSON.stringify(x.dropped));

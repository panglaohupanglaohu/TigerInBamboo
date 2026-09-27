import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{const p=await b.newPage();await p.addInitScript(()=>{const r=requestAnimationFrame.bind(window);window.requestAnimationFrame=f=>f.name==='animate'?0:r(f);});await p.goto('http://localhost:8931/TigerMessenger/?autostart=1');await p.waitForFunction(()=>window.__tm?.messenger?.landmarks?.abandonedGate,null,{timeout:180000});
const report=await p.evaluate(async()=>{
 const t=window.__tm,T=t.THREE,g=t.messenger.landmarks.abandonedGate,c=t.messenger.landmarks.tramSystem.curve,L=c.getLength();
 const {officialOceanLevelAt}=await import('/TigerMessenger/src/world/waterV8/officialOcean.js'),{canyonOffsetDir,canyonOffsetDirSmooth}=await import('/TigerMessenger/src/world/canyon.js');
 const result=[];
 for(let delta=-60;delta<=180;delta+=4){const u=g.userData.anchor.entryU+delta/L,center=c.getPointAt(u),up=center.clone().normalize(),f=c.getTangentAt(u).normalize(),right=new T.Vector3().crossVectors(up,f).normalize();up.crossVectors(f,right).normalize();const basis=new T.Matrix4().makeBasis(right,up,f),q=new T.Quaternion().setFromRotationMatrix(basis),origin=center.clone().addScaledVector(up,-.8);let lateral=0,vertical=0;
  for(let d=-18;d<=18;d+=.5){const rel=c.getPointAt(u+d/L).sub(origin);lateral=Math.max(lateral,Math.abs(rel.dot(right)));vertical=Math.max(vertical,rel.dot(up));}
  const heights=[];for(const x of [-30,-15,15,30]){const pt=new T.Vector3(x,0,0).applyQuaternion(q).add(origin);const dir=pt.clone().normalize();heights.push(160+canyonOffsetDir(dir)-pt.length());}
  result.push({delta,u,position:center.toArray(),lateral,vertical,waterClearance:center.length()-160-officialOceanLevelAt(center),floorClearance:center.length()-160-canyonOffsetDir(center.clone().normalize()),heights,origin:origin.toArray(),quaternion:q.toArray()});
 }
 return {sourceEntry:g.userData.anchor.entryU,oldAnchor:g.userData.anchor.gateU,curveLength:L,candidates:result};
});await writeFile('TigerMessenger/artifacts/pipeline/gate-of-sighs-build/canyon-candidates.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report.candidates.filter(x=>x.lateral<3&&x.waterClearance>4)));}finally{await b.close();}

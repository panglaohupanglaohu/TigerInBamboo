import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {readFile,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const out=new URL('../../artifacts/pipeline/citadel-foundation-support/',import.meta.url);
const survey=JSON.parse(await readFile(new URL('survey.json',out),'utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{const page=await browser.newPage();await page.goto('http://localhost:8931/TigerMessenger/?autostart=1&citadelCommonFrame=1&citadelOldHarbor=1',{timeout:180000});await page.waitForFunction(()=>window.__tm?.scene?.getObjectByName('citadel-old-city-support-spur'),null,{timeout:180000});
const result=await page.evaluate(s=>{const t=window.__tm,T=t.THREE,c=t.scene.getObjectByName('castleContainer'),mesh=c.getObjectByName('citadel-old-city-support-spur');c.updateWorldMatrix(true,true);const up=new T.Vector3(0,1,0).transformDirection(c.matrixWorld),ray=new T.Raycaster();ray.far=100;const rows=[];
for(const r of s.rows.filter(r=>r.category==='unsupported-edge')){let distance=Infinity;const [x,y,z]=r.top;for(let i=1;i<s.route.length;i++){const a=s.route[i-1],b=s.route[i],dx=b[0]-a[0],dz=b[2]-a[2],den=dx*dx+dz*dz;if(den<1e-8)continue;const q=T.MathUtils.clamp(((x-a[0])*dx+(z-a[2])*dz)/den,0,1);distance=Math.min(distance,Math.hypot(x-a[0]-q*dx,z-a[2]-q*dz));}ray.set(c.localToWorld(new T.Vector3(x,6,z)),up.clone().negate());const hit=ray.intersectObject(mesh,false)[0];const height=hit?c.worldToLocal(hit.point.clone()).y:null;rows.push({top:r.top,distance,height,passage:distance<4.8,supported:height!==null&&height>=4.0});}
return {rows,unsupported:rows.filter(r=>!r.passage&&!r.supported),passageSamples:rows.filter(r=>r.passage).length};},survey);await writeFile(new URL('contact-test.json',out),JSON.stringify(result,null,2));console.log(JSON.stringify(result));assert.equal(result.unsupported.length,0);
}finally{await browser.close();}

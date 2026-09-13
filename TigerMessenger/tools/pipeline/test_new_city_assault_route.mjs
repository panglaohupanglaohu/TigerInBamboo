import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const out=new URL('../../artifacts/pipeline/new-city-assault-route/',import.meta.url);await mkdir(out,{recursive:true});
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{const p=await b.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>cb.name==='animate'?0:raf(cb);});
await p.goto('http://127.0.0.1:8931/TigerMessenger/?autostart=1',{timeout:180000});await p.waitForFunction(()=>!!window.__tm?.messenger,null,{timeout:180000});
const r=await p.evaluate(async()=>{const tm=window.__tm,T=tm.THREE,c=tm.scene.getObjectByName('castleContainer'),city=c.getObjectByName('highland-west-city');tm.scene.updateMatrixWorld(true);
const {createNewCityAssaultRoute}=await import('/TigerMessenger/src/world/citadel/newCityAssaultRoute.js');const a=createNewCityAssaultRoute(c);if(!a)throw Error('No new-city route');
const meshes=[],ground=[];city.traverseVisible(o=>{if(o.isMesh&&!o.userData.isOutline&&!o.material?.transparent){meshes.push(o);if(o.userData.westCityWalkable)ground.push(o);}});
const ray=new T.Raycaster();ray.layers.enableAll();let samples=0;const missing=[],blocked=[];
const check=route=>{for(let j=1;j<route.length;j++){const from=route[j-1],to=route[j],n=Math.max(1,Math.ceil(from.distanceTo(to)/.22));for(let k=0;k<=n;k++){const q=from.clone().lerp(to,k/n);samples++;ray.set(q.clone().addScaledVector(a.up,.19),a.up.clone().negate());ray.far=.45;if(!ray.intersectObjects(ground,false).length&&missing.length<15)missing.push(c.worldToLocal(q.clone()).toArray());
for(const height of [.4,1.4]){const dir=to.clone().sub(q);const len=Math.min(.18,dir.length());if(len<.0001)continue;ray.set(q.clone().addScaledVector(a.up,height),dir.normalize());ray.far=len;const hit=ray.intersectObjects(meshes,false)[0];if(hit&&blocked.length<15)blocked.push({position:c.worldToLocal(q.clone()).toArray(),name:hit.object.name});}}}};
check(a.points);const slots=[];for(let w=0;w<4;w++)for(let x=0;x<5;x++)for(let z=0;z<5;z++){const path=a.entryFor(w,x,z);slots.push(c.worldToLocal(path[0].clone()).toArray());check(path.slice(0,4));}
return {source:a.source,slots:slots.length,slotPositions:slots,routePoints:a.points.length,samples,missing,blocked,passed:!missing.length&&!blocked.length};});r.errors=errors;r.passed&&=!errors.length;await writeFile(new URL('route-report.json',out),JSON.stringify(r,null,2));console.log(JSON.stringify({...r,slotPositions:undefined}));if(!r.passed)process.exitCode=1;
}finally{await b.close();}

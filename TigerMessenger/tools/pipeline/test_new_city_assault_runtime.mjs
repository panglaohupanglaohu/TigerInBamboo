import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const out=new URL('../../artifacts/pipeline/new-city-assault-route/',import.meta.url);await mkdir(out,{recursive:true});
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{const p=await b.newPage({viewport:{width:1440,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>cb.name==='animate'?0:raf(cb);});
await p.goto('http://127.0.0.1:8931/TigerMessenger/?autostart=1',{timeout:180000});await p.waitForFunction(()=>!!window.__tm?.messenger,null,{timeout:180000});
const start=p.getByRole('button',{name:'开始送信',exact:true});if(await start.isVisible())await start.click();
const initial=await p.evaluate(()=>{const t=window.__tm,c=t.scene.getObjectByName('castleContainer'),city=c.getObjectByName('highland-west-city'),battle=t.messenger.landmarks.saihojiPhalanx; t.P.timeOfDay=.6;t.P.daySpeed=0;battle.root.userData.debugSiege();
const rows=[];battle.root.traverse(o=>{if(o.userData.siegeEntryRoute)rows.push({uid:o.userData.uid,position:c.worldToLocal(o.getWorldPosition(new t.THREE.Vector3())).toArray(),route:o.userData.siegeEntryRoute.length});});
window.__initialCitadelSoldiers=rows;
t.cameraRig.update=()=>{};t.camera.position.copy(city.localToWorld(new t.THREE.Vector3(12,42,141)));t.camera.up.set(0,1,0).transformDirection(city.matrixWorld);t.camera.lookAt(city.localToWorld(new t.THREE.Vector3(34,19,16)));t.camera.fov=52;t.camera.far=3000;t.camera.updateProjectionMatrix();t.renderer.render(t.scene,t.camera);
return {source:battle.root.userData.infantryAssaultSource,rows};});await p.screenshot({path:new URL('gather.png',out).pathname});
const after=await p.evaluate(()=>{const t=window.__tm,c=t.scene.getObjectByName('castleContainer'),b=t.messenger.landmarks.saihojiPhalanx;for(let i=0;i<720;i++)b.update(1/60,i/60);const rows=[];b.root.traverse(o=>{if(o.userData.siegeEntryRoute)rows.push({uid:o.userData.uid,position:c.worldToLocal(o.getWorldPosition(new t.THREE.Vector3())).toArray(),stage:o.userData.siegeStage,index:o.userData.stairPointIndex});});t.renderer.render(t.scene,t.camera);return rows;});await p.screenshot({path:new URL('march.png',out).pathname});
const moved=after.filter(r=>{const a=initial.rows.find(a=>a.uid===r.uid);return a&&Math.hypot(...r.position.map((v,i)=>v-a.position[i]))>.1;}).length;
const report={initial,after,moved,errors,passed:initial.source==='new-city-plaza-to-main-tower'&&initial.rows.length===50&&after.length===50&&moved>0&&!errors.length,scope:'Real original soldier pool relocated onto new-city forecourt; 12 simulated seconds of march. This is debug-triggered, not continuous ship disembarkation or full siege completion.'};await writeFile(new URL('runtime-report.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify({source:initial.source,soldiers:initial.rows.length,moved,errors,passed:report.passed}));if(!report.passed)process.exitCode=1;
}finally{await b.close();}

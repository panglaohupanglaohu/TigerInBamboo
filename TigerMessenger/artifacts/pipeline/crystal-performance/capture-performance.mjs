import {chromium} from '/Users/panglaohu/Downloads/TigerInBamboo/tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const label=process.argv[2]||'before',out='TigerMessenger/artifacts/pipeline/crystal-performance';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
await page.goto('http://localhost:8931/TigerMessenger/?autostart=1',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__tm?.messenger?.landmarks?.moebiusSwamp,null,{timeout:180000});await page.waitForTimeout(5000);
const result=await page.evaluate(async()=>{
 const t=window.__tm,T=t.THREE,l=t.messenger.landmarks;t.cameraRig.update=()=>{};t.P.daySpeed=0;t.P.timeOfDay=.38;
 const c=l.moebiusSwamp.position.clone(),up=c.clone().normalize(),back=l.moebius.grand.group.position.clone().sub(c);back.addScaledVector(up,-back.dot(up)).normalize();
 const towers=l.moebius.crystals.map(r=>{let meshes=0,groups=0,triangles=0,names={};r.group.userData.v9Root.traverseVisible(o=>{if(o.isMesh){meshes++;const g=o.geometry;groups+=Array.isArray(o.material)?g.groups.length:1;triangles+=(g.index?.count??g.attributes.position.count)/3;names[o.name]=(names[o.name]||0)+(Array.isArray(o.material)?g.groups.length:1)}});return {position:r.group.position.toArray(),meshes,groups,triangles,names}});
 const rail=l.tramSystem.curve.getPoints(1200);let nearest=0;for(let i=1;i<rail.length;i++)if(rail[i].distanceTo(c)<rail[nearest].distanceTo(c))nearest=i;
 const views=[{name:'overview',eye:c.clone().addScaledVector(back,-185).addScaledVector(up,155),at:c.clone().addScaledVector(up,22),up},...[-28,0,28].map(offset=>{const i=Math.max(1,Math.min(1198,nearest+offset)),eye=rail[i].clone(),u=eye.clone().normalize();return {name:'tram'+offset,eye:eye.addScaledVector(u,2.5),at:rail[i+8].clone().addScaledVector(u,2.5),up:u}})];
 window.__crystalPerfViews=views;return {towers,nearest,views:views.map(v=>({name:v.name,eye:v.eye.toArray(),at:v.at.toArray(),up:v.up.toArray()}))};
});
result.samples=[];
for(let i=0;i<result.views.length;i++){
 await page.evaluate(i=>{const t=window.__tm,v=window.__crystalPerfViews[i];t.camera.position.copy(v.eye);t.camera.up.copy(v.up);t.camera.lookAt(v.at);t.camera.fov=60;t.camera.updateProjectionMatrix();t.distanceCulling?.recollect();t.distanceCulling?.update(3)},i);await page.waitForTimeout(1500);
 const sample=await page.evaluate(async()=>{const t=window.__tm,times=[],calls=[],triangles=[];let last=performance.now();for(let i=0;i<45;i++){await new Promise(requestAnimationFrame);const now=performance.now();times.push(now-last);last=now;calls.push(t.renderer.info.render.calls);triangles.push(t.renderer.info.render.triangles)}times.sort((a,b)=>a-b);return {medianMs:times[22],p90Ms:times[40],calls:Math.round(calls.reduce((a,b)=>a+b)/calls.length),triangles:Math.round(triangles.reduce((a,b)=>a+b)/triangles.length),pixelRatio:t.renderer.getPixelRatio()}});result.samples.push({name:result.views[i].name,...sample});
 const png=await page.evaluate(()=>{const t=window.__tm;t.renderer.render(t.scene,t.camera);return t.renderer.domElement.toDataURL()});await writeFile(`${out}/${label}-${result.views[i].name}.png`,Buffer.from(png.split(',')[1],'base64'));
}
result.errors=errors;await writeFile(`${out}/${label}.json`,JSON.stringify(result,null,2));console.log(JSON.stringify({samples:result.samples,towerGroups:result.towers.map(t=>t.groups),errors}));await browser.close();

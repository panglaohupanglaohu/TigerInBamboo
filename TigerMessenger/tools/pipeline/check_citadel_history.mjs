import{chromium}from'../../../tools/shot/node_modules/playwright/index.mjs';
import{writeFileSync,mkdirSync,readFileSync}from'node:fs';
const out=new URL('../../artifacts/pipeline/citadel-history-fifty/',import.meta.url).pathname.replace(/\/$/,'');
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']}),p=await b.newPage({viewport:{width:1400,height:900}}),errors=[],consoleErrors=[];
p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text().slice(0,1600));});
await p.goto('http://localhost:8931/TigerMessenger/?autostart=1&citadelHistory=50');await p.waitForFunction(()=>window.__tm?.scene.getObjectByName('highland-gate')&&window.__tm.scene.getObjectByName('highland-west-city'),null,{timeout:120000});await p.waitForTimeout(6500);
await p.evaluate(()=>{const t=__tm;t.cameraRig.update=()=>{};t.P.daySpeed=0;t.P.timeOfDay=.5;document.querySelectorAll('body > :not(canvas)').forEach(e=>{if(e.tagName!=='SCRIPT')e.style.visibility='hidden';});t.scene.getObjectByName('citadel-ridge-flow-clouds').visible=false;});
const report=process.argv.includes('--tail')?JSON.parse(readFileSync(out+'/rounds.json')).report.filter(x=>x.round<39):[];
for(const round of(process.argv.includes('--all')?Array.from({length:51},(_,i)=>i):process.argv.includes('--tail')?Array.from({length:12},(_,i)=>i+39):[0,10,20,30,45,50])){
 const stats=await p.evaluate(async round=>{const t=__tm,h=await import('/TigerMessenger/src/world/citadel/historicStone.js');return ['castleContainer','highland-gate'].map(name=>{const root=t.scene.getObjectByName(name);h.applyHistoricStone(root,round);return{name,...h.setHistoricRound(root,round)};});},round);
 for(const view of ['old','new','gate']){
  await p.evaluate(view=>{const t=__tm,T=t.THREE,c=t.scene.getObjectByName(view==='gate'?'highland-gate':'castleContainer'),cams={old:[[-112,46,70],[-59,27,-15],49],new:[[4,40,135],[52,18,21],48],gate:[[44,27,-59],[0,14,0],48]},[eye,target,fov]=cams[view];t.camera.position.copy(c.localToWorld(new T.Vector3(...eye)));t.camera.up.set(0,1,0).transformDirection(c.matrixWorld);t.camera.lookAt(c.localToWorld(new T.Vector3(...target)));t.camera.fov=fov;t.camera.far=4000;t.camera.updateProjectionMatrix();t.camera.updateMatrixWorld(true);t.distanceCulling.recollect();t.distanceCulling.update(3);},view);
  await p.waitForTimeout(250);
  const image=await p.evaluate(()=>{__tm.renderer.render(__tm.scene,__tm.camera);return __tm.renderer.domElement.toDataURL('image/jpeg',.90);});
  writeFileSync(`${out}/r${String(round).padStart(2,'0')}-${view}.jpg`,Buffer.from(image.split(',')[1],'base64'));
 }
 report.push({round,stats});console.log(JSON.stringify({round,stats,errors:errors.length,consoleErrors:consoleErrors.length}));writeFileSync(out+'/rounds.json',JSON.stringify({report,errors,consoleErrors},null,2));
}
const details=await p.evaluate(()=>{const t=__tm,T=t.THREE;return ['castleContainer','highland-gate'].map(n=>{const root=t.scene.getObjectByName(n),list=[];root.traverse(o=>{if(o.isMesh&&/merlon|crenel|parapet|pilaster|coping|pillar|keystone|stone-plinth|ashlar/.test(o.name)&&list.length<100)list.push({name:o.name,geom:o.geometry.type,count:o.geometry.attributes.position.count});});return{n,list};});});writeFileSync(out+'/mesh-details.json',JSON.stringify(details,null,2));await b.close();

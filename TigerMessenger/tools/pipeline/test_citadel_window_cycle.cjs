const {chromium}=require('../../../tools/e2e/node_modules/playwright-core');
const fs=require('fs'),path=require('path');
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=metal']});try{
 const p=await browser.newPage();await p.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>cb.name==='animate'?0:raf(cb);});
 await p.goto('http://localhost:8931/TigerMessenger/',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>!!window.__tm?.messenger,null,{timeout:180000});
 const report=await p.evaluate(async()=>{
 const T=await import('three'),api=await import('/TigerMessenger/src/world/odysseyCitadel.js');
 let castle;window.__tm.scene.traverse(o=>{if(o.userData.highlandAssaultAnchors)castle=o;});
 const west=castle.getObjectByName('highland-west-city');
 const windows=[];west.traverse(o=>{if(o.isMesh&&o.name==='town-window')windows.push(o);});
 window.__tm.P.sunRigManual=false;
 const rows=[];
 for(const phase of [.5,.9,.5]){
  api.updateCitadelNightWindows(castle,phase,{threats:[]});
  rows.push({phase,total:windows.length,lit:windows.filter(w=>w.material===castle.userData.windowLitMat).length,registered:windows.filter(w=>castle.userData.townWindows.includes(w)).length});
 }
 const lights=castle.getObjectByName('highland-light-volumes');
 return {rows,oldLightYaw:lights.rotation.y,passed:windows.length>100&&rows[0].lit===0&&rows[1].lit>0&&rows[2].lit===0&&rows.every(r=>r.registered===windows.length)&&Math.abs(lights.rotation.y-Math.PI/6)<1e-6,scope:'Actual mounted new-city windows: day/night/day controller and old light-group yaw; not final night lighting or per-room combat.'};
 });
 const out=path.resolve(__dirname,'../../artifacts/pipeline/citadel-plaza-horse');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(out+'/web-window-cycle.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});

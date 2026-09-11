const {chromium}=require('../../../tools/e2e/node_modules/playwright-core');
const fs=require('fs');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=metal']});try{
 const page=await b.newPage({viewport:{width:960,height:640}});
 await page.goto('http://localhost:8931/TigerMessenger/?autostart=1');await page.waitForFunction(()=>window.__tm?.scene.getObjectByName('highland-west-city'),null,{timeout:180000});
 await page.evaluate(async()=>{
  const T=await import('three'),tm=window.__tm;let castle;tm.scene.traverse(o=>{if(o.userData.highlandAssaultAnchors)castle=o;});
  const start=castle.localToWorld(new T.Vector3(8,4,48.5));tm.player.position.copy(start);tm.player.velocity.set(0,0,0);tm.player.onGround=true;
  // Control only test camera; keyboard, animation loop and physics remain production.
  tm.cameraRig.update=()=>{};tm.camera.position.copy(castle.localToWorld(new T.Vector3(8,12,62)));tm.camera.up.copy(start).normalize();tm.camera.lookAt(castle.localToWorld(new T.Vector3(8,8,32)));
  const rows=[];window.__keyboardEvidence={rows};
  const record=()=>{const p=castle.worldToLocal(tm.player.position.clone());rows.push({x:p.x,y:p.y,z:p.z,onGround:tm.player.onGround});if(!window.__keyboardStop)requestAnimationFrame(record);};record();
 });
 await page.keyboard.down('w');
 let reached=true;try{await page.waitForFunction(()=>{const a=window.__keyboardEvidence.rows;return a[a.length-1].z<13.2},null,{timeout:30000});}catch{reached=false;}
 await page.keyboard.up('w');await page.waitForTimeout(200);
 const report=await page.evaluate(()=>{const rows=window.__keyboardEvidence.rows;return {frames:rows.length,start:rows[0],end:rows.at(-1),minY:Math.min(...rows.map(p=>p.y)),maxY:Math.max(...rows.map(p=>p.y)),maxSideDrift:Math.max(...rows.map(p=>Math.abs(p.x-8)))};});
 report.reached=reached;report.passed=reached&&report.end.y>15&&report.minY>3.7&&report.maxSideDrift<2;
 await page.keyboard.down('s');
 let returned=true;try{await page.waitForFunction(()=>{const a=window.__keyboardEvidence.rows;return a.at(-1).z>48.2},null,{timeout:30000});}catch{returned=false;}
 await page.keyboard.up('s');await page.waitForTimeout(300);
 report.descent=await page.evaluate(()=>({end:window.__keyboardEvidence.rows.at(-1)}));report.descent.reached=returned;
 const jumpStart=await page.evaluate(()=>window.__keyboardEvidence.rows.length);
 await page.keyboard.down('Space');await page.waitForTimeout(250);await page.keyboard.up('Space');await page.waitForFunction(index=>{const a=window.__keyboardEvidence.rows.slice(index);return a.some(p=>!p.onGround)&&a.at(-1)?.onGround;},jumpStart,{timeout:15000}).catch(()=>{});
 report.jump=await page.evaluate(index=>{window.__keyboardStop=true;const a=window.__keyboardEvidence.rows.slice(index);return {frames:a.length,airborne:a.some(p=>!p.onGround),maxY:Math.max(...a.map(p=>p.y)),minY:Math.min(...a.map(p=>p.y)),end:a.at(-1)};},jumpStart);
 report.passed=report.passed&&returned&&Math.abs(report.descent.end.y-4)<.15&&report.jump.airborne&&report.jump.maxY>4.3&&report.jump.end.onGround&&Math.abs(report.jump.end.y-4)<.15;
 report.scope='Actual browser W ascent, S descent and Space jump through production animate/player/ground/wall physics, both processional stair flights to the main gate, 12m ascent and return. Camera fixed for deterministic direction; initial position placed at lower landing.';
 fs.writeFileSync('TigerMessenger/artifacts/pipeline/citadel-plaza-horse/web-keyboard-stairs.json',JSON.stringify(report,null,2));await page.screenshot({path:'TigerMessenger/artifacts/pipeline/citadel-plaza-horse/web-keyboard-stairs.png'});console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});

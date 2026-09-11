const {chromium}=require('../../../tools/e2e/node_modules/playwright-core');const fs=require('fs');
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=metal']});try{
 const page=await browser.newPage({viewport:{width:960,height:640}});await page.goto('http://localhost:8931/TigerMessenger/?autostart=1');await page.waitForFunction(()=>window.__tm?.scene.getObjectByName('highland-west-city'),null,{timeout:180000});
 await page.evaluate(async()=>{
  const T=await import('three'),tm=window.__tm;let castle;tm.scene.traverse(o=>{if(o.userData.highlandAssaultAnchors)castle=o;});
  const waypoints=[[11,16,9.5],[11,19.15,1.8],[8,19.15,1.8],[8,22.3,9.4],[11,22.3,9.4],[11,22.3,8.3],[14,22.3,8.3],[11,22.3,8.3],[11,22.3,4],[8,22.3,4],[7,22.3,-2.8],[7,22.3,-3.4]];
  const spiral=castle.getObjectByName('citadel-main-tower-stairs');
  waypoints.push(...spiral.userData.route.map(p=>[p[0]-52,p[1],p[2]]),[8,37,-2.5],[8,37,2.4]);
  tm.player.position.copy(castle.localToWorld(new T.Vector3(8,16,9.5)));tm.player.velocity.set(0,0,0);tm.player.onGround=true;tm.cameraRig.update=()=>{};
  window.__courtKeyboard={index:0,rows:[],waypoints,done:false};
  const tick=()=>{
   const state=window.__courtKeyboard,p=castle.worldToLocal(tm.player.position.clone());
   state.rows.push({p:p.toArray(),onGround:tm.player.onGround,index:state.index});
   let target=waypoints[state.index];
   if(Math.hypot(p.x-target[0],p.z-target[2])<.3&&Math.abs(p.y-target[1])<.25){state.index++;if(state.index===waypoints.length){state.done=true;return;}target=waypoints[state.index];}
   const world=castle.localToWorld(new T.Vector3(...target)),up=tm.player.position.clone().normalize();
   const direction=world.clone().sub(tm.player.position);direction.addScaledVector(up,-direction.dot(up)).normalize();
   tm.camera.position.copy(tm.player.position).addScaledVector(direction,-8).addScaledVector(up,7);tm.camera.up.copy(up);tm.camera.lookAt(world);
   if(!state.stop)requestAnimationFrame(tick);
  };tick();
 });await page.keyboard.down('w');let finished=true;
 try{await page.waitForFunction(()=>window.__courtKeyboard.done,null,{timeout:60000});}catch{finished=false;}
 await page.keyboard.up('w');
 const report=await page.evaluate(()=>{const s=window.__courtKeyboard;s.stop=true;return {index:s.index,waypoints:s.waypoints,frames:s.rows.length,start:s.rows[0],end:s.rows.at(-1),minY:Math.min(...s.rows.map(r=>r.p[1])),tail:s.rows.slice(-5)};});
 report.passed=finished&&report.index===report.waypoints.length&&report.end.p[1]>36.75;report.scope='Actual W key and production physics; test camera steers toward court and main-tower entry waypoints, no position driving after initial placement. Includes 37m upper exit and balcony; not free-camera manual play or full battle.';
 fs.writeFileSync('TigerMessenger/artifacts/pipeline/citadel-plaza-horse/web-keyboard-court.json',JSON.stringify(report,null,2));await page.screenshot({path:'TigerMessenger/artifacts/pipeline/citadel-plaza-horse/web-keyboard-court.png'});console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});

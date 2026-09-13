import { chromium } from '../../../tools/shot/node_modules/playwright/index.mjs';
import { writeFile } from 'node:fs/promises';
const base=new URL('../../',import.meta.url);
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
const report={errors:[]};
try {
 const page=await browser.newPage({viewport:{width:1280,height:1000}});
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('http://localhost:8931/TigerMessenger/artifacts/pipeline/human-courier-v1/index.html');
 await page.waitForFunction(()=>window.courierReview,null,{timeout:15000});
 await page.click('#walk'); await page.click('#letter'); await page.waitForTimeout(350);
 report.model=await page.evaluate(async()=>{
  const THREE=await import('/TigerMessenger/vendor/three.module.js');
  const {model,player,animateHumanCourier,renderer}=courierReview;
  const u=model.userData,local=u.letter.position.clone(); let finite=true;
  for(const riding of [false,true]) for(const onGround of [false,true]) for(const holdingLetter of [false,true]) {
    Object.assign(player,{riding,onGround,holdingLetter});
    for(let i=0;i<60;i++)animateHumanCourier(player,model,1/60,true);
    model.updateMatrixWorld(true); model.traverse(o=>{finite&&=o.matrixWorld.elements.every(Number.isFinite)});
  }
  Object.assign(player,{riding:false,onGround:true,holdingLetter:true});
  const size=new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  return {finite,letterParent:u.letter.parent.name,letterLocalDrift:local.distanceTo(u.letter.position),bounds:size.toArray(),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
 });
 await page.screenshot({path:new URL('artifacts/pipeline/human-courier-v1/web-walk-letter.png',base).pathname});
 if(!report.model.finite||report.model.letterLocalDrift!==0||report.model.letterParent!=='handR')throw Error('Joint/letter validation failed');
 await page.goto('http://localhost:8931/TigerMessenger/');
 await page.waitForFunction(()=>window.__tm?.scene,null,{timeout:60000});
 report.game=await page.evaluate(()=>{
   let courier=null; __tm.scene.traverse(o=>{if(o.userData.isHumanCourier)courier=o});
   return {loaded:!!courier,isHumanCourier:courier?.userData.isHumanCourier,letterParent:courier?.userData.letter.parent.name,scale:courier?.scale.x};
 });
 if(!report.game.loaded)throw Error('Main game missing human courier');
 await page.screenshot({path:new URL('artifacts/pipeline/human-courier-v1/game-loaded.png',base).pathname});
} finally {
 await writeFile(new URL('artifacts/pipeline/human-courier-v1/check.json',base),JSON.stringify(report,null,2));
 await browser.close();
 console.log(JSON.stringify(report));
}

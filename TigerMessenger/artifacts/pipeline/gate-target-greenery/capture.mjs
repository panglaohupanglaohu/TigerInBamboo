import {chromium} from '/Users/panglaohu/Downloads/TigerInBamboo/tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const out='TigerMessenger/artifacts/pipeline/gate-target-greenery';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try {for(let n=Number(process.argv[2]||0);n<=Number(process.argv[3]||0);n++){
 const page=await browser.newPage({viewport:{width:1100,height:730}}),errors=[];

 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto(`http://localhost:8931/TigerMessenger/?autostart=1&gateThirty=30&gateGreenery=${n}`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__tm?.messenger?.landmarks?.abandonedGate?.userData.seatRoot?.userData.moebiusV10,null,{timeout:180000});
 await page.waitForTimeout(1800);
 const report=await page.evaluate(async()=>{
  const t=window.__tm,T=t.THREE,l=t.messenger.landmarks,gate=l.abandonedGate,seat=gate.userData.seatRoot,site=seat.userData.siteRoot,root=seat.userData.moebiusV10;
  t.cameraRig.update=()=>{};t.P.daySpeed=0;t.P.timeOfDay=.38;t.scene.updateMatrixWorld(true);
  const solids=[];root.traverseVisible(o=>{if(o.isMesh)solids.push(o)});
  const ray=new T.Raycaster(),cv=l.tramSystem.curve,L=cv.getLength(),failures=[];let rays=0;
  for(let s=-32;s<32;s+=.5)for(const side of[-1.8,0,1.8])for(const h of[.3,1.5,3.2]){
   const at=d=>{const u=((gate.userData.anchor.gateU+d/L)%1+1)%1,w=cv.getPointAt(u),up=w.clone().normalize(),right=new T.Vector3().crossVectors(up,cv.getTangentAt(u)).normalize();return w.addScaledVector(up,h).addScaledVector(right,side);};
   const a=at(s),d=at(s+.5).sub(a);ray.set(a,d.clone().normalize());ray.far=d.length();rays++;const hit=ray.intersectObjects(solids,false)[0];if(hit)failures.push({s,side,h,name:hit.object.name});
  }
  const {createGatePlayerGround}=await import('/TigerMessenger/src/world/gateTarget.js'),ground=createGatePlayerGround(seat),misses=[];
  for(const [i,p]of site.userData.approachRoute.entries()){const w=site.localToWorld(new T.Vector3(...p));w.addScaledVector(w.clone().normalize(),.04);const y=ground(w);if(!Number.isFinite(y)||Math.abs(y-w.length())>.2)misses.push(i);}
  window.gateRoundView=side=>{const eye=side==='detail'?[12,8,-15]:side==='reverse'?[-46,20,42]:side==='front'?[0,7,-65]:side?[52,12,-2]:[42,24,-48],at=side==='detail'?[6.6,7,-7.92]:side==='front'?[0,9,14]:side?[0,7,0]:[0,6,0];t.camera.position.copy(seat.localToWorld(new T.Vector3(...eye)));t.camera.up.set(0,1,0).transformDirection(seat.matrixWorld);t.camera.lookAt(seat.localToWorld(new T.Vector3(...at)));t.camera.fov=48;t.camera.updateProjectionMatrix();t.distanceCulling.recollect();t.distanceCulling.update(3);};
  return {round:root.userData.thirtyRound||0,features:root.userData.thirtyFeatures||[],railRays:rays,railFailures:failures,approachMisses:misses,greenery:site.getObjectByName('gate-reference-greenery')?.userData.audit,farCrystals:site.getObjectsByProperty('name','g30-far-crystal-shaft').length,meshes:solids.length};
 });
 for(const [tag,side]of[['overview',false],['side',true],...(n===1?[['detail','detail'],['reverse','reverse'],['front','front']]:[])]){await page.evaluate(side=>window.gateRoundView(side),side);await page.waitForTimeout(250);const data=await page.evaluate(()=>{const t=window.__tm;t.renderer.render(t.scene,t.camera);return t.renderer.domElement.toDataURL()});await writeFile(`${out}/r${String(n).padStart(2,'0')}-${tag}.png`,Buffer.from(data.split(',')[1],'base64'));}
 report.errors=errors;report.passed=!errors.length&&!report.railFailures.length&&!report.approachMisses.length;
 await writeFile(`${out}/r${String(n).padStart(2,'0')}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({round:n,passed:report.passed,errors:errors.slice(0,2),rail:report.railFailures.slice(0,3),approach:report.approachMisses}));await page.close();if(!report.passed)break;
}} finally {await browser.close();}

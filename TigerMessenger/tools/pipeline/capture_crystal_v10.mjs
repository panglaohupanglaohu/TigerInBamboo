import {chromium} from '/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const out='TigerMessenger/artifacts/pipeline/crystal-v10-thirty-rounds';
await mkdir(out,{recursive:true});
const round=process.argv[2]||'1';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message)});
 page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text())});
 await page.goto('http://127.0.0.1:8931/TigerMessenger/?autostart=1'+('&crystalV10='+round),{waitUntil:'domcontentloaded'});
 for(let attempt=0;attempt<3;attempt++){
  await page.waitForTimeout(2500);
  if(await page.evaluate(()=>document.body.innerText.includes('游戏脚本启动失败'))){console.log('Retrying interrupted local module transfer');await page.reload({waitUntil:'domcontentloaded'});}else break;
 }
 await page.waitForFunction(()=>window.__tm?.messenger?.landmarks?.moebiusSwamp,null,{timeout:180000}).catch(async e=>{console.log((await page.locator('body').innerText()).slice(-2500));throw e});
 await page.waitForTimeout(3500);
 const report=await page.evaluate(async(round)=>{
  const t=window.__tm,T=t.THREE,l=t.messenger.landmarks;
  t.cameraRig.update=()=>{};t.P.daySpeed=0;t.P.timeOfDay=.38;
  t.scene.updateMatrixWorld(true);
  const towers=l.moebius.crystals.map(r=>({name:r.group.name,position:r.group.position.toArray(),dir:r.dir.toArray(),root:r.root,height:r.h,radius:r.r,scale:r.group.scale.toArray(),quaternion:r.group.quaternion.toArray()}));
  const {getCityFrame}=await import('/TigerMessenger/src/world/crystalCityLayout.js');const f=getCityFrame();
  const center=l.moebiusSwamp.position.clone(),up=center.clone().normalize();
  const back=l.moebius.grand.group.position.clone().sub(center);back.addScaledVector(up,-back.dot(up)).normalize();
  const eye=center.clone().addScaledVector(back,-135).addScaledVector(up,105),target=center.clone().addScaledVector(up,22);
  const camera={position:eye.toArray(),up:up.toArray(),target:target.toArray()};
  t.camera.position.fromArray(camera.position);t.camera.up.copy(up);t.camera.lookAt(new T.Vector3(...camera.target));t.camera.fov=48;t.camera.updateProjectionMatrix();t.distanceCulling?.recollect();t.distanceCulling?.update(3);
  const shores=l.moebius.v7Shores;
  const {officialOceanLevelAt}=await import('/TigerMessenger/src/world/waterV8/officialOcean.js');
  const waterChecks=l.moebius.crystals.map(r=>({root:r.root,water:160+officialOceanLevelAt(r.dir)}));
  const groundChecks=shores.userData.walkMeshes.filter(o=>o.name==='v7-garden-connector').map(o=>{
   const pos=o.getWorldPosition(new T.Vector3());pos.setLength(pos.length()+.24);
   const ground=shores.userData.sampleGroundRadius(pos);return {name:o.name,ground,expected:pos.length(),ok:ground!==null&&Math.abs(ground-pos.length())<.3};
  });
  const ray=new T.Raycaster(),rail=l.tramSystem.curve.getPoints(1600),railHits=[];
  const towerMeshes=[];l.moebius.crystals.forEach(r=>r.group.traverse(o=>{if(o.isMesh&&o.visible&&!o.userData.isOutline&&(()=>{for(let p=o.parent;p;p=p.parent)if(!p.visible)return false;return true;})())towerMeshes.push(o)}));
  for(let i=0;i<rail.length-1;i++){
   if(rail[i].clone().normalize().angleTo(l.moebiusSwamp.position.clone().normalize())>.7)continue;
   const next=rail[i+1],dir=next.clone().sub(rail[i]),length=dir.length();
   for(const height of [1,3]){ray.set(rail[i].clone().addScaledVector(rail[i].clone().normalize(),height),dir.normalize());ray.far=length;const hit=ray.intersectObjects(towerMeshes,false)[0];if(hit)railHits.push({segment:i,name:hit.object.name});}
  }
  return {v10Round:l.moebius.grand.group.userData.v10Round,railHits,mossMeshes:l.mossSwamp.children.length,regradedVertices:l.abandonedGate.getObjectByName('gate-canyon-site-blender').userData.crystalV7RegradedVertices,waterChecks,groundChecks,round,camera,towers,swamp:{position:l.moebiusSwamp.position.toArray(),quaternion:l.moebiusSwamp.quaternion.toArray(),scale:l.moebiusSwamp.scale.toArray(),children:l.moebiusSwamp.children.length},port:!!l.crystalMotherPort,shoreMeshes:l.moebius.v7Shores?.children.length,walkMeshes:l.moebius.v7Shores?.userData.walkMeshes.length,swampUpdate:typeof l.moebiusSwamp.userData.update};
 },round);
 await page.waitForTimeout(2500);
 const png=await page.evaluate(()=>{const t=window.__tm;t.renderer.render(t.scene,t.camera);return t.renderer.domElement.toDataURL();});
 await writeFile(`${out}/r${round.padStart(2,'0')}.png`,Buffer.from(png.split(',')[1],'base64'));
 await page.evaluate(()=>{const t=window.__tm,T=t.THREE,r=t.messenger.landmarks.moebius.grand.group.userData.v9Root;t.camera.position.copy(r.localToWorld(new T.Vector3(17,30,40)));t.camera.up.set(0,1,0).transformDirection(r.matrixWorld);t.camera.lookAt(r.localToWorld(new T.Vector3(0,25,2)));t.camera.fov=48;t.camera.updateProjectionMatrix();t.distanceCulling.recollect();t.distanceCulling.update(3);});
 await page.waitForTimeout(1000);
 const detail=await page.evaluate(()=>{const t=window.__tm;t.renderer.render(t.scene,t.camera);return t.renderer.domElement.toDataURL();});
 await writeFile(`${out}/r${round.padStart(2,'0')}-detail.png`,Buffer.from(detail.split(',')[1],'base64'));
 if(Number(round)>=12){
  await page.evaluate(()=>{const t=window.__tm,T=t.THREE,l=t.messenger.landmarks,r=l.moebius.crystals[0],up=r.dir.clone().normalize(),center=up.clone().multiplyScalar(r.root),toward=l.moebiusSwamp.position.clone().sub(center);toward.addScaledVector(up,-toward.dot(up)).normalize();const eye=center.clone().addScaledVector(toward,32).addScaledVector(up,18);t.camera.position.copy(eye);t.camera.up.copy(up);t.camera.lookAt(center.clone().addScaledVector(up,-5));t.camera.fov=48;t.camera.updateProjectionMatrix();t.distanceCulling.recollect();t.distanceCulling.update(3);});
  await page.waitForTimeout(1000);
  const shore=await page.evaluate(()=>{const t=window.__tm;t.renderer.render(t.scene,t.camera);return t.renderer.domElement.toDataURL();});
  await writeFile(`${out}/r${round.padStart(2,'0')}-shore.png`,Buffer.from(shore.split(',')[1],'base64'));
 }
 report.errors=errors;report.passed=errors.length===0&&report.towers.length===3&&report.port&&report.swampUpdate==='function'&&report.groundChecks.every(c=>c.ok)&&report.shoreMeshes>300&&report.railHits.length===0&&report.mossMeshes===0; if(!report.passed)process.exitCode=1;await writeFile(`${out}/r${round.padStart(2,'0')}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({round,passed:report.passed,railHits:report.railHits.length,groundChecks:report.groundChecks.length,errors}));

} finally {await browser.close();}

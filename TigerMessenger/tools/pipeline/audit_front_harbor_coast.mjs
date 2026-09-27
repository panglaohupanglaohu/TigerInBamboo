import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {readFile,writeFile} from 'node:fs/promises';
const original=JSON.parse(await readFile(new URL('../../assets/models/optimized/citadel-front-coast/source.json',import.meta.url),'utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>cb.name==='animate'?0:raf(cb);});
 await page.goto('http://localhost:8931/TigerMessenger/?autostart=1',{timeout:180000});await page.waitForFunction(()=>window.__tm?.messenger,null,{timeout:180000});
 const report=await page.evaluate(async original=>{
  const t=window.__tm,T=t.THREE,c=t.scene.getObjectByName('castleContainer'),city=c.getObjectByName('highland-west-city');
  const {createWarshipWaterRoutes}=await import('/TigerMessenger/src/world/warshipWaterRoutes.js');const solver=createWarshipWaterRoutes(t.scene,160);
  const datum=new T.Vector3(64.67225624191263,143.94218047597377,27.88341534496225),support=solver.surface(datum);
  const hills=t.scene.getObjectByName('hills'),base=original.parts.find(p=>p.name==='hills');let outsideChanged=0,changed=0;
  const ci=city.matrixWorld.clone().invert(),p=new T.Vector3();
  for(let i=0;i<hills.geometry.attributes.position.count;i++){
   const old=new T.Vector3(...base.positions.slice(i*3,i*3+3)),next=p.fromBufferAttribute(hills.geometry.attributes.position,i);
   if(old.distanceTo(next)<.002)continue;changed++;
   const v=old.clone().normalize().multiplyScalar(160).applyMatrix4(ci),r=Math.hypot((v.x-c.userData.frontHarborCoast.basin.center[0])/c.userData.frontHarborCoast.basin.radii[0],(v.z-c.userData.frontHarborCoast.basin.center[1])/c.userData.frontHarborCoast.basin.radii[1]);if(r>1.001)outsideChanged++;
  }
  t.camera.position.copy(city.localToWorld(new T.Vector3(85,15,140)));t.camera.up.set(0,1,0).transformDirection(city.matrixWorld);t.camera.lookAt(city.localToWorld(new T.Vector3(56,0,106)));t.camera.fov=55;t.camera.aspect=1.6;t.camera.updateProjectionMatrix();t.renderer.setSize(1600,1000);t.scene.updateMatrixWorld(true);t.renderer.render(t.scene,t.camera);
  const npcClearance=['elder','foxAli'].map(key=>{const o=t.messenger.debug.camp.landmarks[key],world=o.getWorldPosition(new T.Vector3()),v=world.clone().normalize().multiplyScalar(160).applyMatrix4(ci),b=c.userData.frontHarborCoast.basin;return {key,world:world.toArray(),basinDistance:Math.hypot((v.x-b.center[0])/b.radii[0],(v.z-b.center[1])/b.radii[1]),localY:v.y};});
  const indexSame=base.indices.length===hills.geometry.index?.count&&base.indices.every((v,i)=>hills.geometry.index.array[i]===v);
  const colorsSame=base.colors.length===hills.geometry.attributes.color.count*3&&base.colors.every((v,i)=>Math.abs(v-hills.geometry.attributes.color.array[i])<1e-6);
  return {npcClearance,status:c.userData.frontHarborCoast,support,depth:support.water-Math.max(support.ground,support.seabed),hills:{indexSame,colorsSame,changed,outsideChanged},image:t.renderer.domElement.toDataURL('image/png'),scope:'Actual new-port coast and original hills grid/color preservation; boat route and NPC whole-world traversal require separate validation.'};
 },original);
 await writeFile(new URL('../../artifacts/pipeline/citadel-master-terrain/front-coast-web.png',import.meta.url),Buffer.from(report.image.split(',')[1],'base64'));delete report.image;
 report.errors=errors;report.passed=report.status?.status==='ready'&&report.depth>1.25&&report.hills.indexSame&&report.hills.colorsSame&&report.hills.changed>0&&report.hills.outsideChanged===0&&report.npcClearance.every(n=>n.basinDistance>=1||n.localY< -70)&&!errors.length;
 await writeFile(new URL('../../artifacts/pipeline/citadel-master-terrain/front-coast-audit.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
}finally{await browser.close();}

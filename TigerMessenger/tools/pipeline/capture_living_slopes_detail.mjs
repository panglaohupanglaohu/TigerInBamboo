import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFileSync,mkdirSync} from 'node:fs';
const stage=process.argv[2]||'after',round='13';
const out=new URL('../../artifacts/pipeline/citadel-living-slopes/',import.meta.url).pathname;
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[],warnings=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',e=>{if(e.type()==='error'||e.text().includes('[citadel]'))warnings.push(e.text().slice(0,1000));});
await page.goto('http://localhost:8931/TigerMessenger/?autostart=1&timeOfDay=.5&citadelMountain='+round+'&citadelLandform='+(stage==='before'?'0':'1'));
await page.waitForFunction(()=>window.__tm?.scene.getObjectByName('highland-gate'),null,{timeout:120000});
await page.waitForTimeout(7000);
await page.evaluate(()=>{const t=__tm;t.cameraRig.update=()=>{};t.P.daySpeed=0;t.P.timeOfDay=.5;t.dayNight.update(.0001);document.querySelectorAll('body > :not(canvas)').forEach(e=>{if(e.tagName!=='SCRIPT')e.style.visibility='hidden';});});
await page.evaluate(()=>{const t=__tm,T=t.THREE,c=t.scene.getObjectByName('castleContainer'),points=c.userData.mountainStudy.planting.groundcover.grass.roots;let best=null,dist=Infinity;for(const p of points){const q=c.worldToLocal(new T.Vector3(...p)),d=q.distanceToSquared(new T.Vector3(0,15,-18));if(d<dist){best=q;dist=d;}}if(best){t.camera.position.copy(c.localToWorld(best.clone().add(new T.Vector3(0,20,6))));t.camera.up.set(0,1,0).transformDirection(c.matrixWorld);t.camera.lookAt(c.localToWorld(best));t.camera.fov=50;t.camera.updateProjectionMatrix();t.distanceCulling.update(3);}});
const meadow=await page.evaluate(()=>{__tm.renderer.render(__tm.scene,__tm.camera);return __tm.renderer.domElement.toDataURL('image/png');});writeFileSync(out+stage+'-meadow.png',Buffer.from(meadow.split(',')[1],'base64'));

const cloud=await page.evaluate(()=>{const t=__tm,T=t.THREE,c=t.scene.getObjectByName('castleContainer'),m=c.userData.ridgeFlowClouds;if(!m)return null;const pos=m.geometry.attributes.iPos,alpha=m.geometry.attributes.iAlpha;let i=0;for(let j=1;j<alpha.count;j++)if(alpha.getX(j)>alpha.getX(i))i=j;const p=c.worldToLocal(m.localToWorld(new T.Vector3().fromBufferAttribute(pos,i)));t.camera.position.copy(c.localToWorld(p.clone().add(new T.Vector3(0,40,3))));t.camera.lookAt(c.localToWorld(p));t.camera.fov=52;t.camera.updateProjectionMatrix();t.distanceCulling.update(3);m.visible=true;return m.userData.stats;});
const png=await page.evaluate(()=>{__tm.renderer.render(__tm.scene,__tm.camera);return __tm.renderer.domElement.toDataURL('image/png');});writeFileSync(out+'after-cloud.png',Buffer.from(png.split(',')[1],'base64'));writeFileSync(out+'cloud-detail.json',JSON.stringify(cloud,null,2));await browser.close();process.exit(0);

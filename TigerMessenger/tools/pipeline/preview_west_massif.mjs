import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const out=new URL('../../artifacts/pipeline/citadel-west-massif/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.route('**/src/world/highlandCitadelDesign.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('side < 0 ? buildWestMassifGeometry() : makeRavineWallGeometry(side)','makeRavineWallGeometry(side)')});});
await page.goto('http://localhost:8931/TigerMessenger/?autostart=1&citadelCommonFrame=1',{timeout:180000});await page.waitForFunction(()=>window.__tm?.messenger,null,{timeout:180000});
const report=[];
for(const stage of [0,1,2]){
const row=await page.evaluate(async stage=>{const t=window.__tm,T=t.THREE,c=t.scene.getObjectByName('castleContainer'),wall=c.getObjectByName('highland-ravine-wall-west');t.cameraRig.update=()=>{};t.P.daySpeed=0;t.P.timeOfDay=.85;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));t.scene.updateMatrixWorld(true);
if(stage){const data=(await import('/TigerMessenger/assets/models/optimized/citadel-west-massif/westMassifR0'+stage+'.js')).default;const g=new T.BufferGeometry();for(const [name,key]of [['position','positions'],['normal','normals'],['color','colors']])g.setAttribute(name,new T.Float32BufferAttribute(data[key],3));g.computeBoundingSphere();wall.geometry=g;wall.userData.blenderSource=data.source;}
t.camera.position.copy(c.localToWorld(new T.Vector3(0,34,170)));t.camera.up.set(0,1,0).transformDirection(c.matrixWorld);t.camera.lookAt(c.localToWorld(new T.Vector3(-6,14,42)));t.camera.fov=52;t.camera.updateProjectionMatrix();t.renderer.render(t.scene,t.camera);
return {stage,vertices:wall.geometry.attributes.position.count,matrix:wall.matrixWorld.toArray(),source:wall.userData.blenderSource,image:t.renderer.domElement.toDataURL('image/png')};},stage);
if(stage===0 && row.vertices!==108)throw Error('Legacy baseline interception failed');
await writeFile(new URL('web-r0'+stage+'.png',out),Buffer.from(row.image.split(',')[1],'base64'));delete row.image;report.push(row);}
await writeFile(new URL('preview.json',out),JSON.stringify({report,errors},null,2));console.log(JSON.stringify({report,errors}));}finally{await browser.close();}

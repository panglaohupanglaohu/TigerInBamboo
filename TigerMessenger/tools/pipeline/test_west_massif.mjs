import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const out=new URL('../../artifacts/pipeline/citadel-west-massif/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{const reports={};for(const common of [false,true]){
const p=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];p.on('pageerror',e=>errors.push(String(e)));
await p.goto('http://localhost:8931/TigerMessenger/?autostart=1'+(common?'&citadelCommonFrame=1':''),{timeout:180000});await p.waitForFunction(()=>window.__tm?.messenger,null,{timeout:180000});
const row=await p.evaluate(async()=>{const t=window.__tm,T=t.THREE,c=t.scene.getObjectByName('castleContainer'),wall=c.getObjectByName('highland-ravine-wall-west'),city=c.getObjectByName('highland-west-city');
t.cameraRig.update=()=>{};t.P.daySpeed=0;t.P.timeOfDay=.85;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));t.scene.updateMatrixWorld(true);
const up=new T.Vector3(0,1,0).transformDirection(c.matrixWorld),ray=new T.Raycaster();ray.layers.enableAll();const meshes=[];city.traverseVisible(o=>{if(o.isMesh&&o.userData.westCityWalkable)meshes.push(o);});let samples=0,missing=0,wallBlocks=0;
for(const key of ['walkRoute','harborRoute','frontHarborRoute']){const route=city.userData[key];for(let i=1;i<route.length;i++){const a=new T.Vector3(...route[i-1]),b=new T.Vector3(...route[i]),n=Math.ceil(a.distanceTo(b)/.12);for(let j=0;j<=n;j++){const v=c.localToWorld(a.clone().lerp(b,n?j/n:0));ray.set(v.clone().addScaledVector(up,.18),up.clone().negate());ray.far=.4;if(!ray.intersectObjects(meshes,false).length)missing++;ray.set(v.clone().addScaledVector(up,2),up.clone().negate());ray.far=2;if(ray.intersectObject(wall,false).length)wallBlocks++;samples++;}}}
t.camera.position.copy(c.localToWorld(new T.Vector3(0,34,170)));t.camera.up.copy(up);t.camera.lookAt(c.localToWorld(new T.Vector3(-6,14,42)));t.camera.fov=52;t.camera.updateProjectionMatrix();t.renderer.render(t.scene,t.camera);
const g=wall.geometry;return {source:wall.userData.westMassifBlender.source,conformance:wall.userData.westMassifBlender,samples,missing,wallBlocks,positions:Array.from(g.attributes.position.array),normals:Array.from(g.attributes.normal.array),colors:Array.from(g.attributes.color.array),matrix:wall.matrixWorld.toArray(),image:t.renderer.domElement.toDataURL('image/png')};});
assert.equal(row.missing,0);assert.equal(row.wallBlocks,0);assert.ok(row.conformance.maxFootClearance<=-1.49);assert.equal(errors.length,0);
const label=common?'common-frame':'default';await writeFile(new URL(label+'-current.png',out),Buffer.from(row.image.split(',')[1],'base64'));delete row.image;
await writeFile(new URL('../../godot/data/'+(common?'common-frame-':'')+'west-massif.json',import.meta.url),JSON.stringify(row));
const {positions,normals,colors,...small}=row;reports[label]={...small,errors};await p.close();}
await writeFile(new URL('runtime.json',out),JSON.stringify(reports,null,2));console.log(JSON.stringify(reports));}finally{await browser.close();}

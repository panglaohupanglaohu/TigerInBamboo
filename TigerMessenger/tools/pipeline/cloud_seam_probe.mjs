// Reproduce the cut-cloud seam (noon, plaza looking south) and isolate the source.
import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const out='TigerMessenger/artifacts/pipeline/sky-glow/seam/';await mkdir(out,{recursive:true});
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{const p=await b.newPage({viewport:{width:1280,height:800}});await p.goto('http://localhost:8931/TigerMessenger/?autostart=1',{waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>window.__tm?.scene.getObjectByName('highland-west-city'),null,{timeout:240000});await p.waitForTimeout(2000);
const names=await p.evaluate(()=>{const t=window.__tm,T=t.THREE;let c;t.scene.traverse(o=>{if(o.userData.highlandAssaultAnchors)c=o;});window.__c=c;
 t.cameraRig.update=()=>{};t.P.daySpeed=0;t.P.timeOfDay=.5;t.dayNight?.update?.(1e-4);
 const L=v=>c.localToWorld(new T.Vector3(...v));const pos=L([15,12.5,92]),u=pos.clone().normalize();const d=new T.Vector3(0,0,1).transformDirection(c.matrixWorld);d.addScaledVector(u,-d.dot(u)).normalize();
 const look=pos.clone().addScaledVector(d,Math.cos(.21)*50).addScaledVector(u,Math.sin(.21)*50);t.camera.position.copy(pos);t.camera.up.copy(u);t.camera.lookAt(look);t.camera.fov=55;t.camera.updateProjectionMatrix();t.camera.updateMatrixWorld(true);t.distanceCulling?.update(3);
 const hits=[];t.scene.traverse(o=>{if(/cloud|impostor|sky|weather|mist|fog/i.test(o.name)&&o.visible)hits.push(o.name);});return {near:t.camera.near,far:t.camera.far,hits:[...new Set(hits)].slice(0,40)};});
console.log(JSON.stringify(names));
const shot=async(label,hide)=>{const png=await p.evaluate((hide)=>{const t=window.__tm;const hidden=[];if(hide)t.scene.traverse(o=>{if(o.name===hide&&o.visible){o.visible=false;hidden.push(o);}});t.renderer.render(t.scene,t.camera);const u=t.renderer.domElement.toDataURL('image/jpeg',.85);hidden.forEach(o=>o.visible=true);return u;},hide);await writeFile(out+label+'.jpg',Buffer.from(png.split(',')[1],'base64'));};
await shot('all',null);
for(const n of names.hits)await shot('hide-'+n.replace(/[^a-z0-9-]/gi,'_'),n);
}finally{await b.close();}

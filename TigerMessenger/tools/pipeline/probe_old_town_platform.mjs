// Old-town plateau vs mountain: view, object names along the plateau rim, and the gap below it.
import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile,mkdir} from 'node:fs/promises';
const label=process.argv[2]||'before';const out='TigerMessenger/artifacts/pipeline/old-town-platform/';await mkdir(out,{recursive:true});
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{const p=await b.newPage({viewport:{width:1400,height:900}});await p.goto('http://localhost:8931/TigerMessenger/?autostart=1',{waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>window.__tm?.scene.getObjectByName('highland-west-city'),null,{timeout:240000});await p.waitForTimeout(6500);
const r=await p.evaluate(()=>{const t=window.__tm,T=t.THREE;let c;t.scene.traverse(o=>{if(o.userData.highlandAssaultAnchors)c=o;});t.cameraRig.update=()=>{};t.P.daySpeed=0;t.P.timeOfDay=.45;t.scene.updateMatrixWorld(true);
 const L=v=>c.localToWorld(new T.Vector3(...v));const up=new T.Vector3(0,1,0).transformDirection(c.matrixWorld);
 window.__shots={near:[[-36,22,70],[-52,10,6]],side:[[-5,24,40],[-50,8,4]],roofs:[[-38,14,26],[-52,9,2]],fall:[[-20,12,62],[-40,8,24]]};
 window.__set=k=>{const [a,l]=window.__shots[k];t.camera.position.copy(L(a));t.camera.up.copy(up);t.camera.lookAt(L(l));t.camera.fov=50;t.camera.far=4000;t.camera.updateProjectionMatrix();t.camera.updateMatrixWorld(true);t.distanceCulling?.update(3);};
 // radial probe grid over the old-town plateau: top surface object and gap to the next surface below
 const solids=[];t.scene.traverse(o=>{if(!o.isMesh||o.userData.isOutline)return;let a=o;while(a){if(/cloud|^sky|bird|ocean|water|tram/i.test(a.name))return;a=a.parent;}const ms=Array.isArray(o.material)?o.material:[o.material];if(ms.every(m=>m.visible===false))return;solids.push(o);});
 const ray=new T.Raycaster();const rows=[];
 for(let z=-24;z<=24;z+=6){const row=[];for(let x=-84;x<=-20;x+=8){const w=L([x,0,z]),u=w.clone().normalize();ray.set(u.clone().multiplyScalar(320),u.clone().negate());ray.far=240;const hs=ray.intersectObjects(solids,false);
  if(!hs.length){row.push('-');continue;}const top=hs[0];const below=hs.find(h=>h.object!==top.object&&top.point.length()-h.point.length()>0.3);
  row.push(`${Math.round(top.point.length()-160)}:${top.object.name.slice(0,14)}${below?'>'+Math.round(below.point.length()-160)+':'+below.object.name.slice(0,12):''}`);}rows.push(z+' | '+row.join(' | '));}
 const named={};t.scene.traverse(o=>{if(/town|old-?city|highland-town|foundation|platform|plateau/i.test(o.name)&&o.isMesh){const box=new T.Box3().setFromObject(o);if(box.isEmpty())return;const ce=c.worldToLocal(box.getCenter(new T.Vector3()));if(ce.x<-10&&ce.x>-110&&Math.abs(ce.z)<45)named[o.name]=[Math.round(ce.x),Math.round(ce.y),Math.round(ce.z),Math.round(box.getSize(new T.Vector3()).length())];}});
 return {rows,named:Object.entries(named).slice(0,30)};});
if(process.argv.includes('--red'))await p.evaluate(()=>{const m=window.__tm.scene.getObjectByName('highland-town-foundation-plinth');if(m){m.material=new window.__tm.THREE.MeshBasicMaterial({color:0xff0000,side:2});}});
if(process.argv.includes('--noOutline'))await p.evaluate(()=>{window.__tm.scene.traverse(o=>{if(o.userData?.isOutline)o.visible=false;});});
for(const k of ['near','side','roofs','fall']){await p.evaluate(k=>window.__set(k),k);await p.waitForTimeout(600);const png=await p.evaluate(()=>{const t=window.__tm;t.renderer.render(t.scene,t.camera);return t.renderer.domElement.toDataURL('image/jpeg',.85);});await writeFile(`${out}${label}-${k}.jpg`,Buffer.from(png.split(',')[1],'base64'));}
console.log(r.rows.join('\n'));console.log(JSON.stringify(r.named));}finally{await b.close();}

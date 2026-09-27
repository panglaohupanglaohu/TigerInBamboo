import {chromium} from '/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const out='TigerMessenger/artifacts/pipeline/gate-moebius-terrain';await mkdir(out,{recursive:true});
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{const p=await b.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await p.goto('http://localhost:8931/TigerMessenger/?autostart=1');await p.waitForFunction(()=>window.__tm?.messenger?.landmarks?.abandonedGate?.userData?.seatRoot?.userData.moebiusV10,null,{timeout:180000});
const report=await p.evaluate(()=>{
 const t=window.__tm,T=t.THREE,gate=t.messenger.landmarks.abandonedGate,seat=gate.userData.seatRoot,root=seat.userData.moebiusV10;
 t.cameraRig.update=()=>{};t.P.daySpeed=0;t.P.timeOfDay=.38;t.scene.updateMatrixWorld(true);
 const solids=[];root.traverse(o=>{if(o.isMesh)solids.push(o)});
 gate.getObjectByName('gate-canyon-site-blender').traverse(o=>{if(o.isMesh)solids.push(o)});
 const ray=new T.Raycaster(),cv=t.messenger.landmarks.tramSystem.curve,L=cv.getLength(),failures=[];let rays=0;
 for(let s=-40;s<40;s+=.25)for(const side of [-1.8,0,1.8])for(const h of [.25,1.5,3.2]){
  const at=d=>{const u=((gate.userData.anchor.gateU+d/L)%1+1)%1,w=cv.getPointAt(u),up=w.clone().normalize(),right=new T.Vector3().crossVectors(up,cv.getTangentAt(u)).normalize();return w.addScaledVector(up,h).addScaledVector(right,side);};
  const a=at(s),d=at(s+.25).sub(a);ray.set(a,d.clone().normalize());ray.far=d.length();rays++;const hit=ray.intersectObjects(solids,false)[0];if(hit)failures.push({s,side,h,name:hit.object.name});
 }
 window.gateV10View=k=>{const c=k==='detail'?[[10,10,-8],[4.8,7,0]]:[[29,23,-48],[0,7,0]];t.camera.position.copy(seat.localToWorld(new T.Vector3(...c[0])));t.camera.up.set(0,1,0).transformDirection(seat.matrixWorld);t.camera.lookAt(seat.localToWorld(new T.Vector3(...c[1])));t.camera.fov=48;t.camera.updateProjectionMatrix();t.distanceCulling.recollect();t.distanceCulling.update(3);};
 return {seatSiteOffset:seat.position.distanceTo(seat.userData.siteRoot.position),arches:root.children.filter(o=>o.name==='v10-gate-open-arch').length,botanicalPods:root.children.filter(o=>o.name==='v10-botanical-glass').length,railRays:rays,railFailures:failures,scope:'Gate assembly and full canyon site, 80m two-track envelope; not entire global railway.'};
});
for(const k of ['overview','detail']){await p.evaluate(k=>window.gateV10View(k),k);await p.waitForTimeout(1200);const png=await p.evaluate(()=>{const t=window.__tm;t.renderer.render(t.scene,t.camera);return t.renderer.domElement.toDataURL()});await writeFile(`${out}/${k}.png`,Buffer.from(png.split(',')[1],'base64'));}
report.errors=errors;report.passed=report.seatSiteOffset<.01&&report.arches===3&&report.botanicalPods===6&&!report.railFailures.length&&!errors.length;await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
}finally{await b.close()}

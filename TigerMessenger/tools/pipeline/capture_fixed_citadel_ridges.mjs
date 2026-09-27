import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});const errors=[];const out=new URL('../../artifacts/pipeline/citadel-master-terrain/',import.meta.url);
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:8931/TigerMessenger/?autostart=1',{timeout:180000});
 await page.waitForFunction(()=>window.__tm?.scene.getObjectByName('castleContainer')?.userData.masterTerrainCandidate?.status==='ready',null,{timeout:180000});
 const reports=[];
 for(const [label,phase,move] of [['day',.45,false],['moved',.45,true],['night',.9,false]]){
  const row=await page.evaluate(async({phase,move})=>{
   const t=window.__tm,T=t.THREE,c=t.scene.getObjectByName('castleContainer'),city=c.getObjectByName('highland-west-city');
   t.P.timeOfDay=phase;t.P.daySpeed=0;t.cameraRig.update=()=>{};
   t.camera.position.copy(city.localToWorld(new T.Vector3(move?112:108,42,140)));t.camera.up.set(0,1,0).transformDirection(city.matrixWorld);t.camera.lookAt(city.localToWorld(new T.Vector3(59,14,65)));t.camera.fov=55;t.camera.updateProjectionMatrix();
   if(move)t.player.position.add(new T.Vector3(2,0,1));
   for(let i=0;i<70;i++)await new Promise(r=>requestAnimationFrame(r));
   c.userData.highlandRidges.update(phase);t.scene.updateMatrixWorld(true);t.renderer.render(t.scene,t.camera);
   const line=c.userData.highlandRidges.layer,a=line.geometry.attributes.position,transform=new T.Matrix4().multiplyMatrices(c.matrixWorld.clone().invert(),line.matrixWorld),points=[];
   for(let i=0;i<a.count;i++)points.push(...new T.Vector3().fromBufferAttribute(a,i).applyMatrix4(transform).toArray());
   return {image:t.renderer.domElement.toDataURL('image/png'),points,color:'#'+line.material.color.getHexString(),segments:a.count/2,matrix:line.matrixWorld.toArray(),scale:line.scale.toArray(),nightWeight:line.userData.nightWeight,hasOldShell:!!c.getObjectByName('backlit-highlight-citadel-oskar-grid-mountain-surface')};
  },{phase,move});
  await writeFile(new URL('fixed-ridges-'+label+'.png',out),Buffer.from(row.image.split(',')[1],'base64'));delete row.image;
  if(label==='day')await writeFile(new URL('../../godot/data/citadel-fixed-ridges.json',import.meta.url),JSON.stringify({frame:'castleContainer',positions:row.points,day:'#d6aa58',night:'#cad6e7',source:'actual released mountain convex creases, fixed geometry'}));
  reports.push({label,...row});
 }
 const same=(a,b)=>a.length===b.length&&a.every((v,i)=>Math.abs(v-b[i])<1e-8);
 const passed=reports[0].segments>0&&same(reports[0].points,reports[1].points)&&same(reports[0].matrix,reports[1].matrix)&&reports[0].color===reports[1].color&&reports[0].color!==reports[2].color&&reports.every(r=>!r.hasOldShell)&&!errors.length;
 for(const row of reports)delete row.points;
 await writeFile(new URL('fixed-ridges-audit.json',out),JSON.stringify({passed,reports,errors,scope:'Actual Web fixed crease geometry and matrix checked after camera/player movement; real day/night colours. Source mountain geometry is not expanded.'},null,2));console.log(JSON.stringify({passed,reports,errors}));if(!passed)process.exitCode=1;
}finally{await browser.close();}

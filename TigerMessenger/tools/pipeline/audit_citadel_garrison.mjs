import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const out=new URL('../../artifacts/pipeline/citadel-master-terrain/',import.meta.url);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try {
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);let held;window.requestAnimationFrame=cb=>cb.name==='animate'?(held=cb,0):raf(cb);window.__resumeAuditFrame=()=>{window.requestAnimationFrame=raf;if(held)raf(held);};});
  await page.goto('http://127.0.0.1:8931/TigerMessenger/?autostart=1',{timeout:180000});
  await page.waitForFunction(()=>!!window.__tm?.messenger,null,{timeout:180000});
  const start=page.getByRole('button',{name:'开始送信',exact:true});
  if(await start.isVisible())await start.click();
  const report=await page.evaluate(()=>{
    const t=window.__tm,T=t.THREE,castle=t.scene.getObjectByName('castleContainer');
    const battle=t.messenger.landmarks.saihojiPhalanx;
    battle.root.userData.debugSiege();t.scene.updateMatrixWorld(true);
    const root=battle.root.getObjectByName('citadel-red-garrison');
    const city=castle.getObjectByName('highland-west-city');
    // Ignore the region visibility switch (the player remains at spawn), but
    // honour replaced/hidden geometry inside the castle.
    const meshes=[];castle.traverse(o=>{let visible=true;for(let a=o;a&&a!==castle;a=a.parent)visible&&=a.visible;if(o.isMesh&&visible)meshes.push(o);});
    const up=new T.Vector3(0,1,0).transformDirection(castle.matrixWorld),ray=new T.Raycaster();ray.layers.enableAll();
    const rows=root.children.map((s,index)=>{
      const pos=s.getWorldPosition(new T.Vector3());
      // Nearby downward support only: do not snap a roof guard to a floor below.
      ray.set(pos.clone().addScaledVector(up,.15),up.clone().negate());ray.far=2;
      const hit=ray.intersectObjects(meshes,false)[0];
      const obstructions=[];
      const east=new T.Vector3(1,0,0).transformDirection(castle.matrixWorld),north=new T.Vector3().crossVectors(up,east).normalize();
      for(const height of [.3,.7,1.1])for(let j=0;j<8;j++){
        const direction=east.clone().multiplyScalar(Math.cos(j*Math.PI/4)).addScaledVector(north,Math.sin(j*Math.PI/4));
        ray.set(pos.clone().addScaledVector(up,height),direction);ray.far=.35;
        const block=ray.intersectObjects(meshes,false)[0];
        if(block)obstructions.push({height,name:block.object.name,distance:block.distance});
      }
      const upright=new T.Vector3(0,1,0).applyQuaternion(s.getWorldQuaternion(new T.Quaternion())).dot(up);
      return {index,upright,rotationLength:s.quaternion.length(),post:s.userData.guardPostId??'balcony-archer',role:s.userData.phalanxRole??s.name,position:castle.worldToLocal(pos.clone()).toArray(),obstructions,support:hit?{name:hit.object.name,gap:hit.distance-.15}:null};
    });
    const closePairs=[];
    for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
      const distance=Math.hypot(...rows[i].position.map((n,k)=>n-rows[j].position[k]));
      if(distance<.4)closePairs.push({a:i,b:j,distance});
    }
    const platforms=[];
    city.traverse(o=>{if(o.isMesh&&/promenade|landing|balcony|crossing/.test(o.name)){
      const box=new T.Box3().setFromObject(o),center=box.getCenter(new T.Vector3());
      platforms.push({name:o.name,center:castle.worldToLocal(center).toArray(),included:meshes.includes(o),visibility:o.visible,parents:(()=>{const a=[];for(let p=o.parent;p;p=p.parent)a.push({name:p.name,visible:p.visible});return a;})()});
    }});
    t.P.timeOfDay=.6;t.P.daySpeed=0;
    t.camera.position.copy(city.localToWorld(new T.Vector3(32,40,102)));
    t.camera.up.copy(up);t.camera.lookAt(city.localToWorld(new T.Vector3(60,16,36)));
    t.camera.far=3000;t.camera.updateProjectionMatrix();t.renderer.render(t.scene,t.camera);
    const face=new T.Vector3(0,0,1).transformDirection(city.matrixWorld).transformDirection(castle.matrixWorld.clone().invert()).toArray();
    return {scope:'Debug-spawned actual red garrison; near-foot locally visible mesh support, ignoring regional visibility, and center proximity. Not body collision, combat or natural trigger validation.',face,count:rows.length,rows,closePairs,platforms,walkRoute:city.userData.walkRoute};
  });
  report.dimensions=await page.evaluate(()=>{
    const t=window.__tm,T=t.THREE,city=t.scene.getObjectByName('highland-west-city');
    const root=t.messenger.landmarks.saihojiPhalanx.root.getObjectByName('citadel-red-garrison');
    const result={actors:[],openings:[]};
    for(const role of ['gladius','spear','longbow']){
      const actor=root.children.find(s=>s.userData.phalanxRole===role);if(!actor)continue;
      const bounds=new T.Box3(),inverse=actor.matrixWorld.clone().invert();
      actor.traverseVisible(mesh=>{
        if(!mesh.isMesh||!mesh.geometry?.attributes.position)return;
        const transform=new T.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld),a=mesh.geometry.attributes.position;
        for(let i=0;i<a.count;i++)bounds.expandByPoint(new T.Vector3().fromBufferAttribute(a,i).applyMatrix4(transform));
      });
      result.actors.push({role,min:bounds.min.toArray(),max:bounds.max.toArray(),size:bounds.getSize(new T.Vector3()).toArray(),scope:'Visible full asset envelope in actor axes, including equipment; not anatomical body height.'});
    }
    city.traverse(o=>{if(o.userData.opening)result.openings.push({name:o.name,opening:o.userData.opening,scale:o.getWorldScale(new T.Vector3()).toArray()});});
    return result;
  });
  report.errors=errors;
  report.supportCheckPassed=report.count===28&&report.rows.every(r=>r.support&&Math.abs(r.support.gap)<.2)&&!errors.length;
  report.spacingCheckPassed=report.closePairs.length===0;
  report.bodyProbePassed=report.rows.every(r=>!r.obstructions.length);
  report.orientationPassed=report.rows.every(r=>r.upright>.999&&Math.abs(r.rotationLength-1)<.0001);
  await writeFile(new URL('garrison-audit.json',out),JSON.stringify(report,null,2));
  const image=await page.evaluate(async()=>{
    const t=window.__tm;t.cameraRig.update=()=>{};t.P.timeOfDay=.85;
    window.__resumeAuditFrame();
    // The real light pool updates at a lower cadence than animation. Two
    // frames can still show daytime proxy energies after changing the clock.
    for(let i=0;i<180;i++){
      await new Promise(resolve=>requestAnimationFrame(resolve));
      let ready=!t.lightPool;
      t.scene.traverse(o=>{if(o.userData.isLightPool&&o.userData.sourceLightName==='new-city-light-main-gate'&&o.intensity>0)ready=true;});
      if(ready)break;
      if(i===179)throw new Error('Night main-gate light never reached its real pool slot');
    }
    await new Promise(resolve=>requestAnimationFrame(resolve));
    t.renderer.render(t.scene,t.camera);return t.renderer.domElement.toDataURL('image/png');
  });
  await writeFile(new URL('garrison-layout.png',out),Buffer.from(image.split(',')[1],'base64'));
  if(report.supportCheckPassed&&report.spacingCheckPassed&&report.bodyProbePassed&&report.orientationPassed){
    await writeFile(new URL('../../godot/data/new-city-garrison.json',import.meta.url),JSON.stringify({source:'new-city-layered-garrison-v1',frame:'castleContainer',scope:'Shared static posts; native battle state machine pending.',face:report.face,rows:report.rows.map(({index,post,role,position})=>({index,post,role,position}))},null,2));
  }
  console.log(JSON.stringify({count:report.count,nearPairs:report.closePairs.length,unsupported:report.rows.filter(r=>!r.support).length,errors}));
  // These are separate checks. Correct feet do not make an overcrowded layout pass.
  if(!report.supportCheckPassed||!report.spacingCheckPassed||!report.bodyProbePassed||!report.orientationPassed)process.exitCode=1;
} finally {await browser.close();}

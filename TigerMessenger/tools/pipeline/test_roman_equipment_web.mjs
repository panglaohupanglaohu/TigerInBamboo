// Actual browser/runtime factories and battle state machine; no foreground UI or full world.
import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir, writeFile, readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = path.join(root, 'artifacts/pipeline/roman-equipment-web');
const base = process.env.ROMAN_TEST_BASE_URL || 'http://127.0.0.1:8877/TigerMessenger';
await mkdir(output, {recursive:true});
const browser = await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors = [];
let report;
try {
  const page = await browser.newPage({viewport:{width:1200,height:720},deviceScaleFactor:1});
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/roman-test.html', route => route.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#cdd9d3;font:16px system-ui}header{padding:14px;text-align:center}main{display:flex}</style><script type="importmap">{"imports":{"three":"${base}/vendor/three.module.js","three/addons/":"${base}/vendor/jsm/"}}</script><header id="label">Roman equipment — original actor and approved armor</header><main></main>`}));
  await page.goto(base+'/roman-test.html');
  report = await page.evaluate(async ({base}) => {
    const T = await import('three');
    const {createGladiusSoldier,paintSoldierHelm,createHarborPatrolSoldier} = await import(base+'/src/assets/harbor.js');
    const {bindRomanSoldierEquipment:bind} = await import(base+'/src/assets/romanSoldierEquipment.js');
    const {ROMAN_EQUIPMENT_DATA:data} = await import(base+'/src/assets/romanEquipmentData.js');
    const {createSaihojiPhalanxBattle} = await import(base+'/src/world/saihojiPhalanx.js');
    const {PLANET_RADIUS:R} = await import(base+'/src/world/planet.js');
    const {saihoujiHubDir} = await import(base+'/src/world/saihojiPhalanx.js');
    const checks=[], check=(name,passed,detail)=>checks.push({name,passed:!!passed,...(detail===undefined?{}:{detail})});
    const nodes=o=>{const n=[];o.traverse(x=>n.push(x));return n;};
    const close=(a,b,e=1e-7)=>a.length===b.length&&a.every((x,i)=>Math.abs(x-b[i])<e);
    const matrix=o=>{o.updateMatrix();return [...o.matrix.elements];};
    const geometry=g=>JSON.stringify({p:[...g.attributes.position.array],n:[...g.attributes.normal.array],i:g.index?[...g.index.array]:null});
    const gripError=(actor,side)=>{
      actor.updateWorldMatrix(true,true);
      const arm=actor.userData.parts[side==='sword'?'armR':'armL'];
      const weapon=actor.userData.equipment[side==='sword'?'gladius':'shield'];
      return arm.localToWorld(new T.Vector3(0,-.138,0)).distanceTo(weapon.localToWorld(side==='sword'?new T.Vector3(0,.04,0):new T.Vector3(-.055,0,0)));
    };
    const vertices=(node,actor,skipHandle=false)=>{
      actor.updateWorldMatrix(true,true);
      const inverse=actor.matrixWorld.clone().invert(),points=[];
      const visit=o=>{
        if(!o.visible||(skipHandle&&o.name==='roman-handle-approved'))return;
        if(o.isMesh){const m=inverse.clone().multiply(o.matrixWorld),p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)points.push(new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(m));}
        o.children.forEach(visit);
      };visit(node);return points;
    };
    const gap=(a,b,shield,actor)=>{
      const basis=actor.matrixWorld.clone().invert().multiply(shield.matrixWorld);
      const axes=[new T.Vector3(1,0,0),new T.Vector3(0,1,0),new T.Vector3(0,0,1)];
      for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)if(x||y||z)axes.push(new T.Vector3(x,y,z).transformDirection(basis));
      let best=-Infinity;
      for(const axis of axes){let amin=Infinity,amax=-Infinity,bmin=Infinity,bmax=-Infinity;for(const p of a){const v=p.dot(axis);amin=Math.min(amin,v);amax=Math.max(amax,v);}for(const p of b){const v=p.dot(axis);bmin=Math.min(bmin,v);bmax=Math.max(bmax,v);}best=Math.max(best,amin-bmax,bmin-amax);}
      return best;
    };
    const legacy=createGladiusSoldier(), original=nodes(legacy);
    const source=await (await fetch(base+'/assets/models/originals/supplemental/romanSoldier_gladius_red.source.json')).json();
    check('unadapted factory remains original archived node tree',original.length===source.nodes.length&&original.every((n,i)=>n.name===source.nodes[i].name&&close(matrix(n),source.nodes[i].matrix)),{nodes:original.length});
    check('unadapted factory has no candidate metadata',!legacy.userData.romanEquipment);
    const spearController=bind(createHarborPatrolSoldier());
    check('shared armor accepts original spear actor',!!spearController);
    spearController?.dispose();
    const specimen=createGladiusSoldier(), refs=nodes(specimen), parents=refs.map(n=>n.parent), transforms=refs.map(matrix);
    const geometries=refs.map(n=>n.geometry?geometry(n.geometry):null), mats=refs.map(n=>n.material);
    const controller=bind(specimen);
    check('same actor and original dynamic references retained',controller.actor===specimen&&controller.originalNodes.every((n,i)=>n===refs[i])&&specimen.userData.equipment.gladius===refs.find(n=>n.name==='right-hand-gladius'));
    check('original parents and geometry/material references retained',refs.every((n,i)=>n.parent===parents[i]&&(!n.geometry||geometry(n.geometry)===geometries[i])&&n.material===mats[i]));
    check('six candidate meshes exactly match approved GLB extraction', ['armor','handle'].every(kind=>controller[kind].children.every((m,i)=>close([...m.geometry.attributes.position.array],data[kind].meshes[i].positions,0.000000001)&&close([...m.geometry.attributes.normal.array],data[kind].meshes[i].normals,0.000000001)&&close([...m.geometry.index.array],data[kind].meshes[i].indices,0.000000001))));
    check('old helmet and skirt hidden without removing them',!specimen.userData.parts.body.getObjectByName('soldier-helm').visible&&!specimen.userData.parts.body.children[1].visible);
    check('crest is rotated once and seated lower',close(specimen.getObjectByName('soldier-crest').quaternion.toArray(),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI/2).toArray())&&Math.abs(specimen.getObjectByName('soldier-crest').position.y+.018)<1e-9);
    for(const side of ['red','blue']){
      paintSoldierHelm(specimen,side);
      check(`${side} original crest colors retained`,specimen.userData.helmSide===side&&specimen.getObjectByName('soldier-crest').material.color.getHex()===(side==='red'?0xc62828:0x2563eb));
    }
    let maxGrip=0;
    const worldParent=new T.Group();worldParent.position.set(7,-12,5);worldParent.rotation.set(.5,-.8,1.1);worldParent.scale.set(1.2,.8,1.5);worldParent.add(specimen);
    for(let i=0;i<252;i++){
      specimen.rotation.set(.2*Math.sin(i),i*.071,-.1);
      specimen.userData.parts.armR.rotation.set(.12*Math.sin(i),0,.2+(i%21)*.06);
      specimen.userData.equipment.gladius.rotation.set(.15,.2*Math.sin(i),-1.2+(i%21)*.02);
      controller.update({swing:.15*Math.sin(i)});
      maxGrip=Math.max(maxGrip,gripError(specimen,'sword'),gripError(specimen,'shield'));
    }
    check('252 rotated nonuniform-scale poses keep both hands on grips',maxGrip<1e-6,{maxGripError:maxGrip});
    worldParent.remove(specimen);specimen.rotation.set(0,0,0);
    for(let i=0;i<4;i++){controller.setEnabled(false);controller.setEnabled(true);}
    specimen.visible=false;specimen.userData.equipment.shield.visible=false;
    controller.setEnabled(false);controller.setEnabled(true);
    check('pooling and broken shield visibility survive toggles',!specimen.visible&&!specimen.userData.equipment.shield.visible);
    controller.setEnabled(false);
    check('repeated optout restores every original local transform',refs.every((n,i)=>n===specimen||close(matrix(n),transforms[i])));
    check('original helmet and skirt visible on optout',specimen.userData.parts.body.getObjectByName('soldier-helm').visible&&specimen.userData.parts.body.children[1].visible);
    controller.dispose();controller.dispose();
    check('dispose removes only owned additions',nodes(specimen).length===refs.length&&!specimen.userData.romanEquipment&&refs.every((n,i)=>n.parent===parents[i]));
    const rebound=bind(specimen);check('rebind after dispose creates exactly six meshes',nodes(specimen).length===refs.length+8&&rebound!==controller);rebound.dispose();
    const sharedA=bind(createGladiusSoldier()),sharedB=bind(createGladiusSoldier());
    const sharedGeometry=sharedA.armor.children[0].geometry;let disposedGeometry=0;
    sharedGeometry.addEventListener('dispose',()=>disposedGeometry++);
    check('candidate immutable geometry is shared across actors',sharedGeometry===sharedB.armor.children[0].geometry);
    sharedA.dispose();check('disposing one actor preserves another actor resources',disposedGeometry===0&&sharedB.active);
    sharedB.dispose();check('last adapter releases shared candidate resources once',disposedGeometry===1);

    // Actual production battle module in a bounded scene (castle marker, simple sphere).
    const scene=new T.Scene();scene.background=new T.Color('#d5dfd5');
    const hub=saihoujiHubDir(), east=new T.Vector3().crossVectors(new T.Vector3(0,1,0),hub).normalize();
    const castle=new T.Group();castle.name='castleContainer';castle.position.copy(hub).multiplyScalar(R).addScaledVector(east,-80);castle.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),castle.position.clone().normalize());scene.add(castle);
    const planet=new T.Mesh(new T.SphereGeometry(R,32,24),new T.MeshToonMaterial({color:0x899e85}));planet.name='planet-surface';scene.add(planet);
    const battle=createSaihojiPhalanxBattle({scene,isWhaleRisen:()=>false,getSquad:()=>null,getTimeOfDay:()=>.45,seed:43});
    battle.root.userData.debugSiege();battle.update(0,0);
    const soldiers=()=>nodes(battle.root).filter(n=>n.userData.equipment?.gladius);
    const actual=soldiers(),blue=actual.find(a=>a.userData.helmSide==='blue'),red=actual.find(a=>a.userData.helmSide==='red');
    check('real battle spawn enables both original color variants',!!blue&&!!red&&actual.every(a=>a.userData.romanEquipment?.active),{gladiusCount:actual.length});
    check('real actor uid, original short sword and hidden spear retained',actual.every(a=>Number.isFinite(a.userData.uid)&&a.name==='gladius-soldier'&&a.userData.equipment.gladius.visible&&!a.userData.equipment.spear.visible));
    const stable=actual.map(a=>({a,uuid:a.uuid,uid:a.userData.uid,parents:nodes(a).map(n=>[n,n.parent]),
      crests:['soldier-crest','soldier-crest-feathers','soldier-crest-stems'].map(name=>{const n=a.getObjectByName(name);return {n,transform:matrix(n),parent:n.parent};}),
      skirt:(()=>{const n=a.getObjectByName('Skirt_Ten_Separated_Lames.002');return {n,geometry:geometry(n.geometry),parent:n.parent};})()}));
    const captures={},captureInfo={};
    const battleRenderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});battleRenderer.setSize(900,700);
    const battleCamera=new T.PerspectiveCamera(32,900/700,.01,1000);battleCamera.layers.set(1);
    const ambient=new T.HemisphereLight(0xffffff,0x536950,2.2);ambient.layers.enable(1);scene.add(ambient);
    const key=new T.DirectionalLight(0xffffff,2.5);key.layers.enable(1);scene.add(key);planet.layers.enable(1);
    const captureActor=(a,action,frame)=>{
      const meshes=nodes(a).filter(n=>n.isMesh);meshes.forEach(m=>m.layers.enable(1));
      const focus=a.localToWorld(new T.Vector3(0,.55,0));
      battleCamera.position.copy(a.localToWorld(new T.Vector3(1.9,1.5,2.4)));
      battleCamera.up.set(0,1,0).transformDirection(a.matrixWorld);battleCamera.lookAt(focus);
      key.position.copy(focus).addScaledVector(battleCamera.up,4).add(new T.Vector3(2,2,2));key.target.position.copy(focus);scene.add(key.target);
      battleRenderer.render(scene,battleCamera);captures[action]=battleRenderer.domElement.toDataURL('image/png');
      captureInfo[action]={uid:a.userData.uid,side:a.userData.helmSide,stage:a.userData.siegeStage,frame,position:a.position.toArray()};
      meshes.forEach(m=>m.layers.disable(1));
    };
    const actions={},stages={},metrics={frames:0,maxSwordGrip:0,maxShieldGrip:0,finite:true,animationMoved:false,crestLocalStable:true,skirtGeometryStable:true,separationSamples:0,minBodySeparation:Infinity,minSwordSeparation:Infinity};
    const previousLeg=blue.userData.parts.legL.rotation.z;
    for(let frame=0;frame<720;frame++){
      battle.update(.05,frame*.05);scene.updateMatrixWorld(true);
      for(const a of soldiers()){
        const meta=a.userData.romanEquipment;if(!meta)continue;
        actions[meta.action]=(actions[meta.action]||0)+1;
        const stage=a.userData.siegeStage||'other';stages[stage]=(stages[stage]||0)+1;
        if(['walk','strike','climb','downed'].includes(meta.action)&&!captures[meta.action]&&a.visible)captureActor(a,meta.action,frame);
        metrics.maxSwordGrip=Math.max(metrics.maxSwordGrip,gripError(a,'sword'));
        if(stage!=='climb')metrics.maxShieldGrip=Math.max(metrics.maxShieldGrip,gripError(a,'shield'));
        metrics.finite&&=nodes(a).every(n=>n.matrixWorld.elements.every(Number.isFinite));
        if(frame%24===0&&a.visible&&!a.userData.dead&&!a.userData.downed&&stage!=='climb'&&a.userData.equipment.shield.visible){
          const shield=a.userData.equipment.shield,p=a.userData.parts;
          const sv=vertices(shield,a,true),bv=[...vertices(p.body,a),...vertices(p.legL,a),...vertices(p.legR,a)],wv=vertices(a.userData.equipment.gladius,a);
          metrics.minBodySeparation=Math.min(metrics.minBodySeparation,gap(sv,bv,shield,a));
          metrics.minSwordSeparation=Math.min(metrics.minSwordSeparation,gap(sv,wv,shield,a));
          metrics.separationSamples++;
        }
      }
      metrics.animationMoved ||= Math.abs(blue.userData.parts.legL.rotation.z-previousLeg)>.001;
      metrics.crestLocalStable &&= stable.every(s=>s.crests.every(({n,transform,parent})=>n.parent===parent&&close(matrix(n),transform)));
      metrics.skirtGeometryStable &&= stable.every(s=>s.skirt.n.parent===s.skirt.parent&&geometry(s.skirt.n.geometry)===s.skirt.geometry);
      metrics.frames++;
    }
    check('720 real battle frames keep poses finite and both grips attached',metrics.finite&&metrics.maxSwordGrip<1e-6&&metrics.maxShieldGrip<1e-6,metrics);
    check('real movement and combat produce animated walk and strike',metrics.animationMoved&&actions.walk>0&&actions.strike>0,{actions,stages});
    check('actual battle instances captured in walk strike climb and downed',Object.keys(captures).length===4,captureInfo);
    check('sampled real guard/walk/strike poses separate shield from body and sword',metrics.separationSamples>0&&metrics.minBodySeparation>0&&metrics.minSwordSeparation>0,{samples:metrics.separationSamples,body:metrics.minBodySeparation,sword:metrics.minSwordSeparation});
    check('battle actions retain stable actor IDs and original hierarchy',stable.every(({a,uuid,uid,parents})=>a.uuid===uuid&&a.userData.uid===uid&&parents.every(([n,p])=>n.parent===p)));
    check('all three crests retain body parent and stable local transforms every battle frame',metrics.crestLocalStable);
    check('approved static skirt geometry and body attachment remain stable during motion',metrics.skirtGeometryStable);
    battle.root.userData.setRomanEquipment(false);
    check('battle-wide rollback deactivates existing actors',soldiers().every(a=>!a.userData.romanEquipment.active));
    battle.root.userData.setRomanEquipment(true);
    check('battle-wide re-enable reuses owned additions',soldiers().every(a=>a.userData.romanEquipment.active&&nodes(a).filter(n=>n.userData.romanEquipmentOwned).length===2));
    const doomed=soldiers()[0];doomed.visible=false;doomed.userData.dead=true;doomed.userData.equipment.shield.visible=false;battle.update(.05,36.05);
    check('battle cannot resurrect hidden dead actors or broken shields',!doomed.visible&&!doomed.userData.equipment.shield.visible);
    const detached=soldiers()[1];detached.removeFromParent();battle.update(.05,36.1);
    check('detached battle actor releases adapter resources',!detached.userData.romanEquipment&&!nodes(detached).some(n=>n.userData.romanEquipmentOwned));
    const beforeReset=soldiers();battle.reset();
    check('battle reset disposes adapters on retained external references',beforeReset.every(a=>!a.userData.romanEquipment&&!nodes(a).some(n=>n.userData.romanEquipmentOwned)));
    battle.root.userData.debugSiege();battle.update(.05,36.15);
    check('next battle cycle creates fresh adapted actors',soldiers().length>0&&soldiers().every(a=>a.userData.romanEquipment.active));

    // Identical cameras/light: original factory versus the approved equipment on that factory.
    const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1200,650);renderer.setPixelRatio(1);document.querySelector('main').append(renderer.domElement);
    renderer.setScissorTest(true);
    const comparison=[];
    for(const active of [false,true]){
      const s=new T.Scene();s.background=new T.Color('#d5dfd5');
      s.add(new T.HemisphereLight(0xffffff,0x536950,2.2));const light=new T.DirectionalLight(0xffffff,2.5);light.position.set(3,4,2);s.add(light);
      const actors=[];
      for(const [side,z] of [['red',-.32],['blue',.32]]){
        const a=createGladiusSoldier();paintSoldierHelm(a,side);a.position.z=z;s.add(a);actors.push(a);if(active)bind(a);
      }
      const floor=new T.Mesh(new T.PlaneGeometry(5,5),new T.MeshToonMaterial({color:0xa8b5a0}));floor.rotation.x=-Math.PI/2;floor.position.y=-.035;s.add(floor);
      const camera=new T.PerspectiveCamera(34,600/650,.01,30);camera.position.set(1.95,1.25,2.34);camera.lookAt(0,.48,0);
      comparison.push({s,camera,actors});
    }
    function draw(pose){
      document.getElementById('label').textContent=`Original factory (left) / approved v3 equipment (right) — ${pose}`;
      comparison.forEach(({s,camera,actors},i)=>{
        if(pose==='rear')camera.position.set(2.5,1.5,-3);
        else camera.position.set(1.95,1.25,2.34);
        camera.lookAt(0,.48,0);
        for(const actor of actors){
          const p=actor.userData.parts;
          p.legL.rotation.z=pose==='walk'?.45:.08;p.legR.rotation.z=pose==='walk'?-.45:-.08;p.armR.rotation.z=pose==='strike'?1.22:.85;
          actor.userData.equipment.gladius.rotation.z=pose==='strike'?-1.4:-.9;
          if(i)bind(actor).update({swing:pose==='walk'?.1:0});
        }
        renderer.setViewport(i*600,0,600,650);renderer.setScissor(i*600,0,600,650);renderer.render(s,camera);
      });
    }
    window.romanDraw=draw;draw('guard');
    window.romanBattle={battle,scene,soldiers};
    battleRenderer.dispose();
    return {checks,metrics,actions,stages,captures,captureInfo,sourceHashes:{armor:data.armor.sha256,handle:data.handle.sha256},scope:'Production Web factories and real phalanx battle module in a bounded scene; not the full game world'};
  },{base});
  for(const pose of ['guard','walk','strike','rear']){await page.evaluate(p=>window.romanDraw(p),pose);await page.screenshot({path:path.join(output,`comparison-${pose}.png`)});}
} finally {await browser.close();}
report.errors=errors;report.passed=report.checks.every(c=>c.passed)&&errors.length===0;
for(const [action,url] of Object.entries(report.captures||{}))await writeFile(path.join(output,`battle-${action}.png`),Buffer.from(url.split(',')[1],'base64'));
delete report.captures;
report.runtimeHashes=Object.fromEntries(await Promise.all(['src/assets/romanSoldierEquipment.js','src/assets/romanEquipmentData.js','src/world/romanSoldierCombatPose.js','src/world/saihojiPhalanx.js'].map(async f=>[f,createHash('sha256').update(await readFile(path.join(root,f))).digest('hex')])));
await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,failures:report.checks.filter(c=>!c.passed),metrics:report.metrics,actions:report.actions,errors},null,2));
if(!report.passed)process.exitCode=1;

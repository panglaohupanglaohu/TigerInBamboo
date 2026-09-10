import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const base=process.env.BATTLE_TEST_BASE_URL||'http://127.0.0.1:8931/TigerMessenger';
const output=path.join(root,'artifacts/pipeline/battle-optimization-web');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
let report;const errors=[];
try {
 const page=await browser.newPage({viewport:{width:1000,height:850}});
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/battle-fixture.html',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><style>body{margin:0}</style><script type="importmap">{"imports":{"three":"${base}/vendor/three.module.js"}}</script>`}));
 await page.goto(base+'/battle-fixture.html');
 report=await page.evaluate(async ({base})=>{
  const T=await import('three'),V=await import(base+'/src/world/vanguardTrooper.js'),S=await import(base+'/src/world/gateHaulerCraft.js');
  const B=await import(base+'/src/assets/battleOptimization.js');
  const heavyData=(await import(base+'/src/assets/battleVanguardData.js')).default,soccoData=(await import(base+'/src/assets/battleSoccoData.js')).default;
  const checks=[],check=(name,passed,detail)=>checks.push({name,passed:!!passed,detail:detail===undefined?undefined:JSON.parse(JSON.stringify(detail))});
  const all=root=>{const ns=[];root.traverse(n=>ns.push(n));return ns;};
  const old=V.createVanguardTrooper({optimized:false}),original=all(old).map(n=>({n,parent:n.parent,geometry:n.geometry,material:n.material}));
  const partRefs={...old.userData.parts},c=B.bindVanguardOptimization(old);
  check('heavy binds synchronously',c?.active&&c.meta.geometryApplied,c?.meta);
  check('84 original IDs and parents retained',original.length===84&&original.every(s=>s.n.parent===s.parent));
  check('117 candidate nodes',all(old).length===117,all(old).length);
  check('parts identities retained',Object.keys(partRefs).every(k=>partRefs[k]===old.userData.parts[k]));
  function colorsAndAttributes(controller,data) {
   let maxColorError=0,attributeValid=true,colorEnabled=true;
   for(const spec of data.nodes) {
    if(spec.hidden||spec.mesh===null)continue;const node=controller.nodes.get(spec.id);
    if(!node.isMesh||node.userData.transientFx||node.material?.map)continue;
    const materialIds=[];for(const p of data.meshes[spec.mesh].primitives)if(!materialIds.includes(p.material))materialIds.push(p.material);
    const mats=Array.isArray(node.material)?node.material:[node.material];
    for(let i=0;i<mats.length;i++) {
     const factor=data.materials[materialIds[i]].pbrMetallicRoughness?.baseColorFactor||[1,1,1,1];
     maxColorError=Math.max(maxColorError,...mats[i].color.toArray().map((v,j)=>Math.abs(v-factor[j])));
    }
    for(const attr of Object.values(node.geometry.attributes))attributeValid&&=attr.count===node.geometry.attributes.position.count&&[...attr.array].every(Number.isFinite);
    if(node.geometry.attributes.color)colorEnabled&&=mats.every(m=>m.vertexColors);
   }
   return {maxColorError,attributeValid,colorEnabled};
  }
  const heavyMaterialCheck=colorsAndAttributes(c,heavyData);check('heavy exact GLB linear factors and complete vertex attributes',heavyMaterialCheck.maxColorError<1e-8&&heavyMaterialCheck.attributeValid&&heavyMaterialCheck.colorEnabled,heavyMaterialCheck);
  const world=new T.Group();world.position.set(4,-2,8);world.rotation.set(.2,.5,-.3);world.scale.set(1.3,.8,1.1);world.add(old);
  const point=(id,p=[0,0,0])=>c.nodes.get(id).localToWorld(new T.Vector3(...p));
  let maxGrip=0,finite=true,commands=true;const poses={};
  for(const action of ['idle','aim','windup','slash','walk','stagger','rope']) {
   old.userData.parts.armL.rotation.x=-1.1;old.userData.parts.armR.rotation.x=-1.05;
   old.userData.parts.legL.rotation.x=.23;old.userData.parts.legR.rotation.x=-.23;
   c.update({action,walk:action==='walk'?1:0});world.updateMatrixWorld(true);
   const right=point('n54').distanceTo(point('n59'));
   const left=point('n34').distanceTo(action==='rope'?point('add:rope-grip'):point('n39',[0,-.11,-.12]));
   maxGrip=Math.max(maxGrip,right,left);finite&&=all(old).every(n=>n.matrixWorld.elements.every(Number.isFinite));
   commands&&=old.userData.parts.armL.rotation.x===-1.1&&old.userData.parts.armR.rotation.x===-1.05;
   poses[action]={left,right};
   if(action==='aim') {
    const local=c.nodes.get('n39').quaternion.clone();check('aim cannon points actor +Z',new T.Vector3(0,0,1).applyQuaternion(local).distanceTo(new T.Vector3(0,0,1))<1e-8);
    const muzzle=V.vanguardMuzzleWorld(old);check('original muzzle interface follows candidate',muzzle.distanceTo(point('n39',[0,0,.47]))<1e-8);
   }
  }
  check('seven poses maintain actual hand/weapon anchors under transformed parent',maxGrip<1e-6,{maxGrip,poses});
  check('poses finite and gameplay Euler commands retained',finite&&commands,{finite,commands});
  c.update({});old.userData.parts.armL.rotation.x=-1.3;old.userData.parts.armR.rotation.x=-1.05;world.updateMatrixWorld(true);
  check('original aim commands select live rig',c.meta.action==='aim',c.meta.action);
  old.userData.climbing=true;world.updateMatrixWorld(true);check('original climbing lifecycle selects rope',c.meta.action==='rope');old.userData.climbing=false;
  const squad=new T.Group(),enemy=new T.Group();world.add(squad,enemy);world.remove(old);squad.add(old);old.position.set(0,150,0);enemy.position.set(0,150,9);squad.userData.state='deployed';squad.userData.troopers=[old];
  let combatGrip=0,chargeScale=1;const actionCounts={};
  for(let frame=0;frame<240;frame++) {
   enemy.position.z=frame<120?9:1.5;
   V.updateVanguardCombat(squad,1/60,frame/60,{soldiers:[enemy],onWound:()=>{}});world.updateMatrixWorld(true);
   combatGrip=Math.max(combatGrip,point('n34').distanceTo(point('n39',[0,-.11,-.12])),point('n54').distanceTo(point('n59')));
   chargeScale=Math.max(chargeScale,partRefs.gun.scale.x);actionCounts[c.meta.action]=(actionCounts[c.meta.action]||0)+1;
  }
  check('real combat updater preserves hands through charging and melee',combatGrip<1e-6&&chargeScale>1&&actionCounts.windup>0&&actionCounts.slash>0,{combatGrip,chargeScale,actionCounts});
  const another=V.createVanguardTrooper(),mat=c.nodes.get('n30').material,othermat=another.userData.battleOptimizationController.nodes.get('n30').material;
  check('actors share geometry and own mutable materials',c.nodes.get('n30').geometry===another.userData.battleOptimizationController.nodes.get('n30').geometry&&mat!==othermat);
  old.visible=false;partRefs.blade.visible=false;c.setEnabled(false);
  check('optout restores original geometry/materials',original.every(s=>s.n.geometry===s.geometry&&s.n.material===s.material));
  c.setEnabled(true);check('toggle preserves external root and blade visibility',!old.visible&&!partRefs.blade.visible);
  check('toggle creates no duplicate nodes',all(old).length===117);c.dispose();
  check('dispose restores original nodes and parts',all(old).length===84&&original.every(s=>s.n.geometry===s.geometry&&s.n.material===s.material)&&Object.keys(partRefs).every(k=>partRefs[k]===old.userData.parts[k]));
  another.userData.battleOptimizationController.dispose();
  const boats=[];
  for(const serial of [4,8]) {
   const boat=S.createSoccoCraft({optimized:false,serial}),source=all(boat).map(n=>({n,parent:n.parent,geometry:n.geometry,material:n.material}));
   const hinge=boat.userData.soccoRamp,seatRefs=boat.userData.soccoSeats,spray=all(boat).find(n=>n.userData.transientFx),sprayMat=spray?.material;
   const map=new Map(all(boat).filter(n=>n.userData.blenderSourceNode).map(n=>[n.userData.blenderSourceNode,n]));
   const bc=B.bindSoccoOptimization(boat,map);boats.push(boat);
   check(`socco serial ${serial} bind and parent contract`,bc?.active&&source.every(s=>s.n.parent===s.parent),bc?.meta);
   check(`socco serial ${serial} dynamic refs and VFX material retained`,boat.userData.soccoRamp===hinge&&boat.userData.soccoSeats===seatRefs&&spray?.material===sprayMat);
   const soccoMaterialCheck=colorsAndAttributes(bc,soccoData);check(`socco serial ${serial} GLB colors and vertex attributes`,soccoMaterialCheck.maxColorError<1e-8&&soccoMaterialCheck.attributeValid&&soccoMaterialCheck.colorEnabled,soccoMaterialCheck);
   S.updateSoccoSeaSkim(boat,{t:.7,speed:.8});check(`socco serial ${serial} original sea skim and fourteen seats work`,spray.material===sprayMat&&spray.material.opacity>0&&S.soccoSeatWorldPositions(boat).length===14);
   S.setSoccoRamp(boat,0);check(`socco serial ${serial} closes upward`,Math.abs(hinge.rotation.x-Math.PI/2)<1e-8);
   S.setSoccoRamp(boat,1,-1.99);const a=hinge.rotation.x,footY=-1.4+2.9*Math.sin(a)-.01*Math.cos(a);
   check(`socco serial ${serial} ramp tip solves explicit ground`,Math.abs(footY+1.99)<1e-8&&S.soccoRampReady(boat),{footY,a,status:boat.userData.soccoRampGroundStatus});
   S.setSoccoRamp(boat,1,10);check(`socco serial ${serial} impossible ground not ready`,!S.soccoRampReady(boat));
   S.setSoccoRamp(boat,1);check(`socco serial ${serial} missing ground explicit`,boat.userData.soccoRampGroundStatus==='review-angle-ground-unresolved');
   bc.setEnabled(false);check(`socco serial ${serial} optout restores original meshes`,source.every(s=>s.n.geometry===s.geometry&&s.n.material===s.material));bc.setEnabled(true);
  }
  const scene=new T.Scene();scene.background=new T.Color('#bec9cb');scene.add(new T.HemisphereLight(0xffffff,0x576975,2));const light=new T.DirectionalLight(0xffffff,2.4);light.position.set(5,8,4);scene.add(light);
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1000,850);document.body.appendChild(renderer.domElement);
  const camera=new T.PerspectiveCamera(34,1000/850,.01,200);
  window.captureBattle=(kind,optimized=true)=>{
   for(const o of [...scene.children])if(o.userData.fixture)scene.remove(o);
   const actor=kind==='heavy'?V.createVanguardTrooper({optimized}):S.createSoccoCraft({optimized});actor.userData.fixture=true;scene.add(actor);
   if(kind==='heavy') {actor.userData.battleOptimizationController?.update({action:'aim'});camera.position.set(3.2,2.15,4.2);camera.lookAt(0,.95,0);}
   else {S.setSoccoRamp(actor,1,-1.99);camera.position.set(8,6,-11);camera.lookAt(0,-.3,0);}
   renderer.render(scene,camera);return true;
  };
  return {passed:checks.every(c=>c.passed),checks,limits:['Factory and seven authored action samples; not a full natural battle or collision sweep.','Explicit local ground ramp fixture; production terrain does not yet provide this sample.']};
 },{base});
 for(const kind of ['heavy','socco'])for(const optimized of [false,true]) {
  await page.evaluate(({kind,optimized})=>window.captureBattle(kind,optimized),{kind,optimized});
  await page.screenshot({path:path.join(output,`${kind}-${optimized?'after':'before'}.png`)});
 }
} finally {await browser.close();}
report.pageErrors=errors;report.passed&&=errors.length===0;
await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,failed:report.checks.filter(c=>!c.passed),errors,output}));
if(!report.passed)process.exitCode=1;

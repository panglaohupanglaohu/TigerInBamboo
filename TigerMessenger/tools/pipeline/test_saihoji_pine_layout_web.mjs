import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const base=process.env.PINE_TEST_BASE_URL||'http://127.0.0.1:8765/TigerMessenger';
const output=path.join(root,'artifacts/pipeline/saihoji-pine-layout');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/pine-layout-fixture.html',r=>r.fulfill({contentType:'text/html',body:`<style>body{margin:0}</style><script type="importmap">{"imports":{"three":"${base}/vendor/three.module.js"}}</script>`}));
 await page.goto(base+'/pine-layout-fixture.html');
 const report=await page.evaluate(async(base)=>{
  const T=await import('three'),M=await import(base+'/src/scenes/saihojiGarden.js');
  const scene=new T.Scene();scene.background=new T.Color('#aabfc3');
  const loaded=M.saihojiGardenScene.load({scene,planetRadius:161,options:{}});
  scene.updateMatrixWorld(true);
  const whale=loaded.group,island=whale.getObjectByName('leviathan-island');
  const pines=[];whale.traverse(n=>{if(n.name==='giantTreeGroup')pines.push(n);});
  const terrain=[];island.traverse(n=>{if(n.isMesh&&(n.name==='leviathan-crust-plate'||n.name==='leviathan-terrain-topography'||n.name.startsWith('leviathan-moss-bed-')))terrain.push(n);});
  const up=new T.Vector3(0,1,0).transformDirection(island.matrixWorld);
  const ray=new T.Raycaster();
  const sample=p=>{ray.set(p.clone().addScaledVector(up,15),up.clone().negate());ray.far=30;const h=ray.intersectObjects(terrain,false)[0];return h?{point:h.point.toArray(),delta:p.clone().sub(h.point).dot(up),terrain:h.object.name}:null;};
  const trees=pines.map(p=>{const position=p.getWorldPosition(new T.Vector3());return {seed:p.userData.sourceSeed,position:position.toArray(),islandLocal:island.worldToLocal(position.clone()).toArray(),upTiltDegrees:THREEAngle(p),support:sample(position),optimization:p.userData.pineOptimization};});
  function THREEAngle(p){return new T.Vector3(0,1,0).transformDirection(p.matrixWorld).angleTo(up)*180/Math.PI;}
  let minimumDistance=Infinity;for(let i=0;i<trees.length;i++)for(let j=i+1;j<trees.length;j++)minimumDistance=Math.min(minimumDistance,new T.Vector3(...trees[i].position).distanceTo(new T.Vector3(...trees[j].position)));
  const checks=[],check=(name,passed,detail)=>checks.push({name,passed:!!passed,detail});
  check('25 distinct Blender source seeds in actual scene',trees.length===25&&new Set(trees.map(t=>t.seed)).size===25&&trees.every(t=>t.optimization?.geometryApplied),trees.map(t=>t.seed));
  check('all pine roots have real island terrain beneath',trees.every(t=>t.support&&Math.abs(t.support.delta)<.15),trees.map(t=>({seed:t.seed,delta:t.support?.delta})));
  check('relocated roots align with island up',trees.every(t=>t.upTiltDegrees<.1),trees.map(t=>({seed:t.seed,tilt:t.upTiltDegrees})));
  const layout=whale.userData.pineLayoutReport||null;
  check('actual scene exposes layout report',!!layout,layout);
  let previousMinimumDistance=Infinity;
  for(let i=0;i<(layout?.entries.length||0);i++)for(let j=i+1;j<layout.entries.length;j++)previousMinimumDistance=Math.min(previousMinimumDistance,island.localToWorld(new T.Vector3(...layout.entries[i].before)).distanceTo(island.localToWorld(new T.Vector3(...layout.entries[j].before))));
  check('root spacing improves on original placement',minimumDistance>previousMinimumDistance,{before:previousMinimumDistance,after:minimumDistance});
  const rawCovers=whale.userData.saihojiCoverPoints||[];
  const stepping=[];island.traverse(o=>{if(o.userData.kind==='stoneStep'){const w=o.getWorldPosition(new T.Vector3());stepping.push({zone:o.userData.gardenZone,visible:o.visible,style:o.userData.placementStyle,support:sample(w)});}});
  check('scattered stepping stones remain grounded and leave empty courtyard sparse',stepping.length>=20&&stepping.length<=42&&stepping.every(s=>s.visible&&s.style==='scattered-zen'&&s.support&&Math.abs(s.support.delta)<.15)&&stepping.filter(s=>s.zone==='empty-court').length===2,stepping);
  const covers=rawCovers.map((c,i)=>{const world=c.anchor.localToWorld(c.localPoint.clone()),support=sample(world),crowns=[];c.pine.traverse(n=>{if(n.isMesh&&['n10','n11','n12'].includes(n.userData.sourceNodeId))crowns.push(n);});ray.set(world.clone().addScaledVector(up,15),up.clone().negate());ray.far=15;const hits=ray.intersectObjects(crowns,false),canopy=hits[0],minimumCrownHeight=hits.length?Math.min(...hits.map(h=>h.point.clone().sub(world).dot(up))):0;return {minimumCrownHeight,index:i,id:c.id,seed:c.pine?.userData.sourceSeed,localPoint:c.localPoint.toArray(),world:world.toArray(),support,canopy:canopy?{mesh:canopy.object.name,height:canopy.point.clone().sub(world).dot(up)}:null};});
  check('50 distinct cover slots on real island terrain',covers.length===50&&new Set(covers.map(c=>c.id)).size===50&&covers.every(c=>c.support&&Math.abs(c.support.delta)<.15),covers.map(c=>({id:c.id,delta:c.support?.delta})));
  check('all slots provide actual helmet clearance above crouched troops',covers.length===50&&covers.every(c=>c.minimumCrownHeight>=1.095),covers.map(c=>({id:c.id,height:c.minimumCrownHeight})));
  check('every cover slot lies below its assigned actual Blender crown',covers.length>0&&covers.every(c=>c.canopy?.height>0),covers.map(c=>({id:c.id,canopy:c.canopy})));
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1200,900);renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;document.body.appendChild(renderer.domElement);
  scene.add(new T.HemisphereLight(0xf4f6ee,0x535e49,2));const sun=new T.DirectionalLight(0xffedcf,1.8);sun.position.copy(island.localToWorld(new T.Vector3(-10,22,18)));scene.add(sun);sun.target.position.copy(island.getWorldPosition(new T.Vector3()));scene.add(sun.target);
  const camera=new T.PerspectiveCamera(38,1200/900,.1,500);camera.up.copy(up);
  const currentPositions=new Map(pines.map(p=>[p,p.position.clone()]));
  window.capturePineLayout=(view,oldLayout=false)=>{
    for(const pine of pines){
      const old=layout?.entries.find(e=>e.seed===pine.userData.sourceSeed);
      pine.position.copy(oldLayout&&old?pine.parent.worldToLocal(island.localToWorld(new T.Vector3(...old.before))):currentPositions.get(pine));
    }
    scene.updateMatrixWorld(true);
    const position=view==='near'?[7,9,13]:[24,28,38];
    camera.position.copy(island.localToWorld(new T.Vector3(...position)));camera.lookAt(island.localToWorld(new T.Vector3(0,1,0)));renderer.render(scene,camera);
    return {view,oldLayout,scope:oldLayout?'Same new models/scales restored to old root positions only; not a full old game screenshot':'Actual current SceneModule layout',camera:camera.position.toArray(),islandCamera:position,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
  };
  return {scope:'Actual saihojiGarden SceneModule isolated render; default idle state. No generic substitute terrain or trees. Not full game/battle acceptance.',checks,trees,minimumDistance,previousMinimumDistance,layout,covers};
 },base);
 report.captures=[];
 for(const view of ['far','near']){report.captures.push(await page.evaluate(v=>window.capturePineLayout(v),view));await page.screenshot({path:path.join(output,view+'.png')});}
 report.captures.push(await page.evaluate(()=>window.capturePineLayout('far',true)));await page.screenshot({path:path.join(output,'same-models-old-placement.png')});
 report.checks.push({name:'browser page errors absent',passed:errors.length===0,detail:errors});
 report.passed=report.checks.every(c=>c.passed);
 await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,minimumDistance:report.minimumDistance,covers:report.covers.length,failed:report.checks.filter(c=>!c.passed).map(c=>c.name)}));
 if(!report.passed)process.exitCode=1;
}finally{await browser.close();}

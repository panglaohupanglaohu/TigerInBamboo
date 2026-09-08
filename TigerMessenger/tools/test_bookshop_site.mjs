import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '../../tools/shot/node_modules/playwright/index.mjs';

const base = process.env.TM_TEST_URL || 'http://127.0.0.1:8767/TigerMessenger/';
const out = new URL('../artifacts/bookshop-refinement/', import.meta.url);
await mkdir(out,{recursive:true});
const browser = await chromium.launch({channel:'chrome',headless:true,
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];
try {
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`${base}tools/originals/capture.html`);
  await page.waitForFunction(()=>window.ready);
  const fixture=await page.evaluate(async()=>{
    const THREE=await import('three');
    const {decorateCorridorForests}=await import('../../src/world/nature.js');
    const {createBookshopPlantingClearance}=await import('../../src/scenes/messenger/bookshopLayout.js');
    const {placeObjectOnSphere}=await import('../../src/world/sphereMath.js');
    const {groundLiftAt}=await import('../../src/world/hills.js');
    const {WORLD_SCALE:S}=await import('../../src/world/worldScale.js');
    const shop=new THREE.Group();
    placeObjectOnSphere(shop,11.5*S,5.5*S,groundLiftAt(11.5*S,5.5*S),160);shop.rotateY(-.5);
    const clearance=createBookshopPlantingClearance(shop);
    function generate(acceptTree){
      const old=Math.random;let state=34891;
      Math.random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
      try {return decorateCorridorForests(new THREE.Scene(),160,{acceptTree});} finally {Math.random=old;}
    }
    // Warm shared toon materials before seeding the two comparisons: Three's
    // first-time material UUID allocation also consumes Math.random().
    const warm=generate(null);
    const warmGeometries=new Set();
    for(const tree of warm.meshes)tree.traverse(n=>{if(n.geometry)warmGeometries.add(n.geometry);});
    for(const geometry of warmGeometries)geometry.dispose();
    const before=generate(null),after=generate(clearance.accepts);
    const snapshot=forest=>forest.meshes.map(tree=>{
      let hash=2166136261;
      tree.traverse(n=>{if(n.geometry?.attributes.position)for(const v of n.geometry.attributes.position.array)hash=Math.imul(hash^Math.round(v*1e6),16777619)>>>0;});
      return {position:tree.position.toArray(),quaternion:tree.quaternion.toArray(),scale:tree.scale.toArray(),hash};
    });
    const a=snapshot(before),b=snapshot(after);
    const unchanged=b.every(next=>a.some(old=>JSON.stringify(old)===JSON.stringify(next)));
    const collisionsMatch=after.meshes.every((tree,i)=>tree.position.equals(after.colliders[i].position))&&after.meshes.length===after.colliders.length;
    return {beforeCount:a.length,afterCount:b.length,unchanged,collisionsMatch,clearance:clearance.report};
  });
  assert(fixture.afterCount<fixture.beforeCount && fixture.afterCount>fixture.beforeCount*.65);
  assert(fixture.unchanged && fixture.collisionsMatch,'Remaining forest geometry, transforms and colliders must be unchanged');
  console.log('BOOKSHOP_SITE_LAYOUT_OK',JSON.stringify(fixture));

  await page.goto(`${base}?autostart=1&timeOfDay=0.38`,{timeout:120000});
  await page.waitForFunction(()=>window.__tm?.messenger?.landmarks?.bookshop && document.getElementById('intro').classList.contains('hidden'),null,{timeout:120000});
  const site=await page.evaluate(()=>{
    const t=__tm, THREE=t.THREE,shop=t.messenger.landmarks.bookshop;
    shop.updateWorldMatrix(true,true);
    const trees=[];t.scene.traverse(n=>{if(n.userData.corridorId)trees.push(n);});
    const sign=shop.userData.signNamePlane;
    const eye=shop.localToWorld(new THREE.Vector3(0,1.7,7));
    const samples=[];
    const cameraSamples=[];
    for(const x of [-.6,0,.6])for(const y of [-.22,0,.22]){
      const target=sign.localToWorld(new THREE.Vector3(x,y,0));
      const delta=target.clone().sub(eye);
      const ray=new THREE.Raycaster(eye,delta.clone().normalize(),0,delta.length());
      samples.push({x,y,treeHits:ray.intersectObjects(trees,true).length});
      const cameraDelta=target.clone().sub(t.camera.position);
      const cameraRay=new THREE.Raycaster(t.camera.position,cameraDelta.clone().normalize(),0,cameraDelta.length());
      cameraSamples.push({x,y,treeHits:cameraRay.intersectObjects(trees,true).length});
    }
    const route=[];
    for(const x of [-.8,0,.8]){
      const from=shop.localToWorld(new THREE.Vector3(x,1,9));
      const to=shop.localToWorld(new THREE.Vector3(x,1,3));
      const d=to.clone().sub(from);
      const ray=new THREE.Raycaster(from,d.clone().normalize(),0,d.length());
      route.push({x,treeHits:ray.intersectObjects(trees,true).length});
    }
    return {samples,cameraSamples,route,clearance:shop.userData.plantingClearance,chapter:t.rescueCampaign.snapshot().chapter,
      start:t.player.position.toArray(),treeCount:trees.length};
  });
  assert(site.clearance.rejected.length>0);
  assert(site.samples.every(s=>s.treeHits===0),'Trees must not cover the sign from the arrival viewpoint');
  assert(site.cameraSamples.every(s=>s.treeHits===0),'Trees must not cover the sign from the initial gameplay camera');
  assert(site.route.every(s=>s.treeHits===0),'Trees must not cover the entrance approach');
  await page.keyboard.down('w');
  await page.evaluate(()=>new Promise(resolve=>{let n=0;const tick=()=>++n>=40?resolve():requestAnimationFrame(tick);requestAnimationFrame(tick);}));
  await page.keyboard.up('w');await page.keyboard.press('r');
  const played=await page.evaluate(()=>({position:__tm.player.position.toArray(),onGround:__tm.player.onGround,chapter:__tm.rescueCampaign.snapshot().chapter}));
  assert.equal(played.chapter,1);assert(played.onGround);
  assert(played.position.some((v,i)=>Math.abs(v-site.start[i])>.1));
  await page.screenshot({path:new URL('web-gameplay.png',out).pathname,timeout:120000});
  const capture=await page.evaluate(()=>{
    const t=__tm,THREE=t.THREE,shop=t.messenger.landmarks.bookshop;
    const camera=new THREE.PerspectiveCamera(38,1280/900,.1,1200);
    camera.position.copy(shop.localToWorld(new THREE.Vector3(9,7,16)));
    camera.up.set(0,1,0).applyQuaternion(shop.quaternion);camera.lookAt(shop.localToWorld(new THREE.Vector3(0,3,0)));camera.updateMatrixWorld();
    const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
    renderer.setSize(1280,900);renderer.toneMapping=t.renderer.toneMapping;renderer.toneMappingExposure=t.renderer.toneMappingExposure;
    renderer.render(t.scene,camera);const png=renderer.domElement.toDataURL('image/png');const stats={...renderer.info.render};renderer.dispose();return {png,stats};
  });
  await writeFile(new URL('web-site-close.png',out),Buffer.from(capture.png.split(',')[1],'base64'));
  const report={fixture,site,played,render: capture.stats,errors,captures:['web-gameplay.png','web-site-close.png']};
  await writeFile(new URL('web-site.json',out),JSON.stringify(report,null,2));
  assert.deepEqual(errors,[]);
  console.log('BOOKSHOP_SITE_WORLD_OK',JSON.stringify({rejected:site.clearance.rejected.length,trees:site.treeCount,signSamples:site.samples,route:site.route,played,errors}));
}finally{await browser.close();}

import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '../../tools/shot/node_modules/playwright/index.mjs';

const out = new URL('../artifacts/bookshop-integration/', import.meta.url);
const base = process.env.TM_TEST_URL || 'http://127.0.0.1:8767/TigerMessenger/';
await mkdir(out, { recursive: true });
// Fixed capture set: the old/new building under the same light and camera, plus
// the actual default world/player camera and a close view in that SAME world.
const browser = await chromium.launch({ channel: 'chrome', headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}tools/originals/capture.html`);
  await page.waitForFunction(() => window.ready);
  const fixture = await page.evaluate(async () => {
    const THREE = await import('three');
    const { createHardToFindBookshop } = await import('../../src/assets/bookshop.js');
    const { applyBookshopArt } = await import('../../src/assets/bookshopArt.js');
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(900, 900);
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0xc9d9e3);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x676454, 2));
    const light = new THREE.DirectionalLight(0xfff1dc, 3); light.position.set(-8,15,10); scene.add(light);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(100,100), new THREE.MeshToonMaterial({color:0x819477}));
    floor.rotation.x = -Math.PI/2; scene.add(floor);
    const camera = new THREE.PerspectiveCamera(35,1,.1,100); camera.position.set(12,9,19); camera.lookAt(0,3.3,0);
    const shop = createHardToFindBookshop({artGeometry:false}); scene.add(shop);
    const sign = shop.userData.signNamePlane, material = sign.material;
    const render = () => { renderer.render(scene,camera); return renderer.domElement.toDataURL('image/png'); };
    const before = render();
    const applied = applyBookshopArt(shop); const after = render();
    const nodes = []; shop.traverse(n => nodes.push(n));
    const windows = ['n15','n17','n19','n21','n23','n27','n29','n31','n33','n35'].map(id => {
      const n = nodes.find(n => n.userData.blenderSourceNode === id);
      const target = n.getWorldPosition(new THREE.Vector3());
      const facing = new THREE.Vector3(0,0,1).applyQuaternion(n.quaternion);
      const ray = new THREE.Raycaster(target.clone().addScaledVector(facing, 2), facing.clone().negate());
      const hit = ray.intersectObject(shop,true)[0];
      return {id,position:target.toArray(),visible:hit?.object === n};
    });
    const frameCount = shop.children.length;
    applyBookshopArt(shop);
    const idempotent = shop.children.length === frameCount;
    shop.userData.setSignText('TIGER MESSENGER','原作书店');
    const editableSign = sign === shop.userData.signNamePlane && material === sign.material && render() !== after;
    const variant = createHardToFindBookshop({bermEdgeY:-.4});
    const ramp = variant.getObjectByName('bookshop-soil-berm').children[0];
    const terrainVariantPreserved = Math.abs(ramp.geometry.attributes.position.getY(4) + .4) < 1e-6 && variant.userData.blenderArt.version === 3;
    const reference = createHardToFindBookshop({artGeometry:false}); reference.children.at(-1).name='future-factory-change';
    const beforeGeo = reference.children[3].geometry;
    const atomicFallback = !applyBookshopArt(reference) && reference.children[3].geometry === beforeGeo;
    const metadata = shop.userData.blenderArt;
    const stats = {...renderer.info.render};
    return {applied,windows,idempotent,editableSign,terrainVariantPreserved,atomicFallback,metadata,stats,before,after};
  });
  for (const key of ['before','after']) {
    await writeFile(new URL(`web-building-${key}.png`,out),Buffer.from(fixture[key].split(',')[1],'base64'));
    delete fixture[key];
  }
  await writeFile(new URL('web-fixture.json',out),JSON.stringify(fixture,null,2));
  assert(fixture.applied && fixture.idempotent && fixture.editableSign && fixture.terrainVariantPreserved && fixture.atomicFallback);
  assert(fixture.windows.every(window => window.visible), 'All 10 windows must be exposed on the actual Blender facade');
  console.log('BOOKSHOP_ART_FIXTURE_OK');

  await page.goto(`${base}?autostart=1&timeOfDay=0.38`, {timeout:120000});
  await page.waitForFunction(() => window.__tm?.messenger?.landmarks?.bookshop && document.getElementById('intro').classList.contains('hidden'), null, {timeout:120000});
  await page.screenshot({path:new URL('web-world-player.png',out).pathname,timeout:120000});
  const start = await page.evaluate(() => {
    const t = window.__tm, shop=t.messenger.landmarks.bookshop;
    return {position:t.player.position.toArray(),chapter:t.rescueCampaign.snapshot().chapter,
      source:shop.userData.blenderArt, visible:shop.visible,
      hydrangeas:shop.getObjectByName('bookshop-hydrangeas')?.userData.layout,
      collider:t.assetColliders.some(c => c.position.distanceTo(shop.position)<.1),
      distance:t.player.position.distanceTo(shop.position)};
  });
  assert.equal(start.source?.version,3,'Default live world must contain the new Blender mesh');
  assert(start.visible && start.hydrangeas === 'blender-v3' && start.collider);
  await page.keyboard.down('w');
  await page.evaluate(() => new Promise(resolve => {let frames=0;const tick=()=>++frames>=45?resolve():requestAnimationFrame(tick);requestAnimationFrame(tick);}));
  await page.keyboard.up('w');
  await page.keyboard.press('r');
  const played = await page.evaluate(() => {
    const t=window.__tm, shop=t.messenger.landmarks.bookshop;
    return {position:t.player.position.toArray(),chapter:t.rescueCampaign.snapshot().chapter,
      distance:t.player.position.distanceTo(shop.position),onGround:t.player.onGround,
      terrainRadius:t.hills.sampleRadius(t.player.position),playerRadius:t.player.position.length()};
  });
  assert(played.position.some((v,i)=>Math.abs(v-start.position[i])>.05),'Real movement input must move the player');
  assert.equal(played.chapter,1,'Real R input must collect the letter at the integrated shop');
  assert(played.distance>3,'Building collider must keep the player outside the walls');
  await page.screenshot({path:new URL('web-world-interaction.png',out).pathname,timeout:120000});
  // Render a dedicated camera into a separate canvas without changing player or
  // simulation state. All world objects and actual runtime lighting remain.
  const close = await page.evaluate(() => {
    const t=window.__tm, shop=t.messenger.landmarks.bookshop, THREE=t.THREE;
    const renderer = new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
    renderer.setSize(1280,900); renderer.outputColorSpace=t.renderer.outputColorSpace;
    renderer.toneMapping=t.renderer.toneMapping; renderer.toneMappingExposure=t.renderer.toneMappingExposure;
    const camera=new THREE.PerspectiveCamera(38,1280/900,.1,1200);
    camera.position.copy(shop.localToWorld(new THREE.Vector3(9,7,16)));
    camera.up.set(0,1,0).applyQuaternion(shop.quaternion);
    camera.lookAt(shop.localToWorld(new THREE.Vector3(0,3,0))); camera.updateMatrixWorld();
    renderer.render(t.scene,camera);
    const png=renderer.domElement.toDataURL('image/png');
    const stats={...renderer.info.render};renderer.dispose();
    return {png,stats};
  });
  await writeFile(new URL('web-world-close.png',out),Buffer.from(close.png.split(',')[1],'base64'));
  await writeFile(new URL('web-integration.json',out),JSON.stringify({start,played,fixture,worldRender:close.stats,errors,
    environment:'Chrome software WebGL; draw counts are diagnostic, not a hardware FPS benchmark',
    captures:['web-building-before.png','web-building-after.png','web-world-player.png','web-world-interaction.png','web-world-close.png']},null,2));
  assert.deepEqual(errors,[]);
  console.log('BOOKSHOP_ART_WORLD_OK',JSON.stringify({start,played,errors}));
} finally { await browser.close(); }

import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '../../tools/shot/node_modules/playwright/index.mjs';
const base = process.env.TM_TEST_URL || 'http://127.0.0.1:8765/TigerMessenger/';
const out = new URL('../test-results/', import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}?autostart=1`, { timeout: 120000 });
  await page.waitForFunction(() => window.__tm?.rescueCampaign && !document.getElementById('intro').classList.contains('hidden') === false, null, { timeout: 120000 });
  const physics = await page.evaluate(async () => {
    const { THREE, hills } = __tm;
    const { resolveAssetColliders } = await import('./src/world/collision.js');
    const { flatToWorld } = await import('./src/world/sphereMath.js');
    const { updatePlayerControl } = await import('./src/player/controller.js');
    const { createEscortMotion } = await import('./src/story/escortMotion.js');
    const pos = new THREE.Vector3(0,160,0);
    resolveAssetColliders(pos,[{position:pos.clone(),radius:2}]);
    const radiusError = Math.abs(pos.length()-160);
    const previous = pos.clone();
    resolveAssetColliders(pos,[{position:pos.clone().negate(),radius:2}]);
    const antipodalError = pos.distanceTo(previous);
    const ray = new THREE.Raycaster(); let maxError=0, count=0;
    for(let x=-40; x<62; x+=6.3) for(let z=-55; z<43; z+=6.7) {
      const d = flatToWorld(x,0,z,160).normalize();
      ray.set(d.clone().multiplyScalar(220),d.clone().negate());
      const hit=ray.intersectObject(hills.mesh,false)[0];
      const r=hills.sampleRadius(d);
      if(hit && r!=null){maxError=Math.max(maxError,Math.abs(hit.point.length()-r));count++;}
    }
    const p={position:new THREE.Vector3(0,160,0),velocity:new THREE.Vector3(),onGround:true};
    let jumps=0;
    const args={player:p,keys:{Space:true},camera:__tm.camera,dt:1/120,gameStarted:true,onJump:()=>jumps++};
    updatePlayerControl(args); p.onGround=true; updatePlayerControl(args);
    const obstacle = {position:new THREE.Vector3(0,160,0),radius:2};
    const walker = createEscortMotion({position:new THREE.Vector3(-5,160,0).setLength(160),advance(pos,velocity,dt){
      pos.addScaledVector(velocity,dt).setLength(160);
      for(let pass=0;pass<3;pass++)resolveAssetColliders(pos,[obstacle],.65);
    }});
    let minimumClearance=Infinity;
    const destination=new THREE.Vector3(8,160,0).setLength(160);
    for(let i=0;i<240;i++){
      walker.update(destination,1/30);
      minimumClearance=Math.min(minimumClearance,walker.position.distanceTo(obstacle.position));
    }
    return {radiusError,antipodalError,maxTerrainError:maxError,surfaceSamples:count,jumps,escort:{minimumClearance,stoppedBeforeWall:walker.position.x<0}};
  });
  assert(physics.radiusError < 1e-8);
  assert(physics.antipodalError < 1e-8);
  assert(physics.surfaceSamples > 100 && physics.maxTerrainError < 1e-4);
  assert.equal(physics.jumps,1);
  assert(physics.escort.minimumClearance > 2.649 && physics.escort.stoppedBeforeWall);
  await page.screenshot({ path: new URL('web-rescue.png',out).pathname, timeout:120000 });
  const chapters=[];
  for(let i=0;i<6;i++) {
    const after=await page.evaluate(() => {
      const target=__tm.rescueCampaign.getTargetPosition();
      if(!target) throw new Error('Missing live target');
      __tm.player.position.copy(target); __tm.player.velocity.set(0,0,0);
      window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyR',bubbles:true}));
      return __tm.rescueCampaign.snapshot();
    });
    assert.equal(after.chapter,i+1); chapters.push(after);
  }
  const suppressed=await page.evaluate(()=>__tm.messenger.landmarks.aircraftSquad.userData.rescueSuppressed);
  assert.equal(suppressed,true);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('tm.rescue.campaign.v1')).chapter),6);
  const asset=await page.evaluate(()=>{
    let optimizedBookshops=0,optimizedTigers=0;
    __tm.scene.traverse(n=>{if(n.userData.blenderGeometry){if(n.name==='hard-to-find-bookshop')optimizedBookshops++;if(n.userData.kind==='moebius-swamp-tiger')optimizedTigers++;}});
    return {replacementPostboxPresent:!!__tm.scene.getObjectByName('rescue-postbox'),optimizedBookshops,optimizedTigers};
  });
  assert.equal(asset.replacementPostboxPresent,false);
  assert(asset.optimizedBookshops>0,'Live world must use the Blender bookshop topology');
  assert(asset.optimizedTigers>0,'Live world must use the Blender tiger topology');
  const perf=await page.evaluate(()=>__tm.perfProbe.snapshot());
  const report={physics,chapters,asset,perf,errors,renderer:'Chrome headless SwiftShader; not a hardware FPS benchmark'};
  await writeFile(new URL('browser-report.json',out),JSON.stringify(report,null,2));
  assert.deepEqual(errors,[]);
  console.log('BROWSER_OK',JSON.stringify({physics,asset,chapters:chapters.length,errors}));
} finally { await browser.close(); }

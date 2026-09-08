import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '../../tools/shot/node_modules/playwright/index.mjs';

const out = new URL('../artifacts/bookshop-path/', import.meta.url);
await mkdir(out, {recursive: true});
// Capture contract: actual desktop player camera, same-scene path off/on,
// followed by real keyboard movement over the entrance and R interaction.
const browser = await chromium.launch({channel:'chrome',headless:true,
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];
try {
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  page.on('pageerror',e=>errors.push(e.message));
  const base=process.env.TM_TEST_URL||'http://127.0.0.1:8767/TigerMessenger/';
  await page.goto(`${base}?autostart=1&timeOfDay=0.38`,{timeout:120000});
  await page.waitForFunction(()=>window.__tm?.messenger?.landmarks?.bookshop && document.getElementById('intro').classList.contains('hidden'),null,{timeout:120000});
  const capture=await page.evaluate(()=>{
    const t=__tm,shop=t.messenger.landmarks.bookshop,path=shop.getObjectByName('bookshop-blender-entrance-path');
    if(!path)throw new Error('Original Blender entrance stones missing');
    shop.updateWorldMatrix(true,true);
    const renderer=new t.THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
    renderer.setSize(1280,800);renderer.toneMapping=t.renderer.toneMapping;renderer.toneMappingExposure=t.renderer.toneMappingExposure;
    path.visible=false;renderer.render(t.scene,t.camera);
    const before=renderer.domElement.toDataURL('image/png'),beforeStats={...renderer.info.render};
    path.visible=true;renderer.render(t.scene,t.camera);
    const after=renderer.domElement.toDataURL('image/png'),afterStats={...renderer.info.render};
    const samples=[];
    for(let i=0;i<4;i++){
      const center=shop.localToWorld(new t.THREE.Vector3((i%2-.5)*.13,2,3.1+i*.68));
      const ray=new t.THREE.Raycaster(center,new t.THREE.Vector3(0,-1,0).transformDirection(shop.matrixWorld),0,8);
      const hit=ray.intersectObject(path)[0];
      if(!hit)throw new Error(`Stone ${i} missing at original footprint`);
      const floor=t.hills.sampleRadius(hit.point);
      samples.push({stone:i,radialClearance:hit.point.length()-floor});
    }
    const report={source:path.userData.blenderPath,groundAdapted:path.userData.groundAdapted,
      triangles:path.geometry.attributes.position.count/3,beforeStats,afterStats,samples,
      start:t.player.position.toArray(),chapter:t.rescueCampaign.snapshot().chapter};
    renderer.dispose();return {before,after,report};
  });
  assert.equal(capture.report.source.stones,4);assert(capture.report.groundAdapted);
  await writeFile(new URL('web-report.json',out),JSON.stringify({...capture.report,errors},null,2));
  assert.equal(capture.report.afterStats.calls-capture.report.beforeStats.calls,1);
  assert(capture.report.samples.every(s=>s.radialClearance>.005&&s.radialClearance<.6),JSON.stringify(capture.report.samples));
  for(const name of ['before','after'])await writeFile(new URL(`web-path-${name}.png`,out),Buffer.from(capture[name].split(',')[1],'base64'));
  await page.keyboard.down('w');
  await page.evaluate(()=>new Promise(resolve=>{let n=0;const tick=()=>++n>=40?resolve():requestAnimationFrame(tick);requestAnimationFrame(tick);}));
  await page.keyboard.up('w');await page.keyboard.press('r');
  const played=await page.evaluate(()=>({position:__tm.player.position.toArray(),grounded:__tm.player.onGround,chapter:__tm.rescueCampaign.snapshot().chapter}));
  assert(played.grounded);assert.equal(played.chapter,1);
  assert(played.position.some((v,i)=>Math.abs(v-capture.report.start[i])>.1));
  await page.screenshot({path:new URL('web-path-gameplay.png',out).pathname,timeout:120000});
  assert.deepEqual(errors,[]);
  await writeFile(new URL('web-report.json',out),JSON.stringify({...capture.report,played,errors},null,2));
  console.log('BOOKSHOP_PATH_WORLD_OK',JSON.stringify({...capture.report,played,errors}));
}finally{await browser.close();}

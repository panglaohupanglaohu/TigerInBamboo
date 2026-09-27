import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const phase='hero-story',dir='TigerMessenger/artifacts/pipeline/gate-of-sighs-build';
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:960}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>cb.name==='animate'?0:raf(cb);});
 await page.goto('http://localhost:8931/TigerMessenger/?autostart=1'+(phase==='release'?'&gateReview=1':''));
 await page.waitForFunction(()=>window.__tm?.messenger?.landmarks?.abandonedGate?.userData?.seatRoot,null,{timeout:180000});
 const result=await page.evaluate(()=>{
  document.getElementById('start-btn').click();
  const t=window.__tm,c=t.rescueCampaign,g=t.messenger.landmarks.abandonedGate.userData.meetingAnchor,h=g.getObjectByName('gate-heroes');
  t.player.position.copy(c.getTargetPosition());c.update(.2);document.querySelector('.rescue-action').click();
  const chapterAfterLetter=c.snapshot().chapter;
  t.player.position.copy(g.getWorldPosition(new t.THREE.Vector3()));c.update(.2);document.querySelector('.rescue-action').click();
  const chapterAfterPact=c.snapshot().chapter,stages=[];
  for(const dt of [.1,1.2,2.3,1.1]){c.update(dt);stages.push(h.userData.heroes.odysseus.userData.stage);}
  return {chapterAfterLetter,chapterAfterPact,stages,passed:chapterAfterLetter===1&&chapterAfterPact===2&&stages.join(',')==='receiving,reading,acknowledging,waiting',scope:'Actual mainline interaction in fresh browser context; synthetic positioning, not manual playthrough'};
 });
 await writeFile('TigerMessenger/artifacts/pipeline/gate-of-sighs-build/hero-story-check.json',JSON.stringify({...result,errors},null,2));console.log(JSON.stringify(result));if(!result.passed||errors.length)process.exitCode=1;
}finally{await browser.close();}

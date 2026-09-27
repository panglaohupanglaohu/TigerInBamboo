import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const out='artifacts/pipeline/courier-production';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
const page=await browser.newPage({viewport:{width:1100,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://localhost:8931/TigerMessenger/artifacts/pipeline/courier-production/');
await page.waitForFunction(()=>window.courierProduction?.state.rig);
for(const round of [1,2])for(const clip of ['walk','run','jump','vault']){
  await page.evaluate(({round,clip})=>{const c=window.courierProduction;c.state.playing=false;c.state.round=round;c.state.clothRound=round;c.state.clip=clip;c.state.time=0;c.camera.position.set(3.2,1.8,3.3);c.controls.target.set(0,1,clip==='vault'?0:.7);c.controls.update();c.renderPose()},{round,clip});
  for(const [label,u] of [['anticipation',.14],['key',.40],['release',.69],['landing',.90]]){
    await page.evaluate(u=>{const c=window.courierProduction;c.state.time=u*c.clips[c.state.clip].duration;c.renderPose()},u);
    await page.locator('#view').screenshot({path:`${out}/${clip}-round-${round}-${label}.png`});
  }
  const encoded=await page.evaluate(async()=>{
    const c=window.courierProduction,stream=c.renderer.domElement.captureStream(24),chunks=[];
    const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:2200000});
    const done=new Promise(resolve=>{recorder.onstop=async()=>{const blob=new Blob(chunks,{type:'video/webm'}),buffer=await blob.arrayBuffer();let s='';for(const b of new Uint8Array(buffer))s+=String.fromCharCode(b);resolve(btoa(s))}});
    recorder.ondataavailable=e=>chunks.push(e.data);c.state.time=0;c.state.playing=true;recorder.start();
    await new Promise(resolve=>setTimeout(resolve,3200));c.state.playing=false;recorder.stop();const result=await done;stream.getTracks().forEach(t=>t.stop());return result;
  });
  fs.writeFileSync(`${out}/${clip}-round-${round}.webm`,Buffer.from(encoded,'base64'));
  console.log('CAPTURED',round,clip);
}
fs.writeFileSync(`${out}/browser-check.json`,JSON.stringify({errors,clips:8,stills:32},null,2));
await browser.close();if(errors.length)throw Error(errors.join('\n'));

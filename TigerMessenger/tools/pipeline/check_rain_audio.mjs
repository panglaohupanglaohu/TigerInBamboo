import { chromium } from '../../../tools/shot/node_modules/playwright/index.mjs';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({channel:'chrome', headless:true, args:['--autoplay-policy=no-user-gesture-required']});
const results=[];
try {
  for (const mode of ['original-reproduction','stereo','no-stereo']) {
    const page=await browser.newPage();
    await page.route('**/rain-audio-harness', route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Rain audio regression</title>'}));
    if(mode==='original-reproduction') await page.route('**/src/audio/worldSfx.js',async route=>{
      const response=await route.fetch();
      const source=await response.text();
      const marker='function rainDrop(ctx, level)';
      const index=source.indexOf(marker);
      const old=source.slice(0,index)+source.slice(index).replace('const p = ctx.createStereoPanner();','const p = ctx.createStereoPanner();panNode=p;');
      await route.fulfill({response,body:old});
    });
    await page.goto('http://localhost:8931/TigerMessenger/rain-audio-harness');
    const result=await page.evaluate(async mode=>{
      const sfx=await import('/TigerMessenger/src/audio/sfx.js');
      const world=await import('/TigerMessenger/src/audio/worldSfx.js');
      const ctx=sfx.ensureAudio(); await ctx.resume();
      let drops=0; const create=ctx.createBufferSource.bind(ctx);
      ctx.createBufferSource=()=>{ const node=create();const stop=node.stop.bind(node);node.stop=(...args)=>{drops++;return stop(...args);};return node;};
      if(mode==='no-stereo') ctx.createStereoPanner=undefined;
      world.setWeatherAmbience({rain:1,snow:0,wind:.8});
      try {
        for(let i=0;i<600;i++)world.updateWorldSfx(1/60);
        world.setWeatherAmbience({rain:0,snow:1,wind:1});
        for(let i=0;i<60;i++)world.updateWorldSfx(1/60);
        await new Promise(resolve=>setTimeout(resolve,200));
        return {mode,drops,context:ctx.state,error:null};
      }catch(e){return {mode,drops,error:String(e)};}
      finally{await ctx.close();}
    },mode);
    results.push(result);await page.close();
  }
  if(!results[0].error?.includes('panNode is not defined')) throw Error('Original fault not reproduced');
  for(const result of results.slice(1))if(result.error||result.drops<20||result.context!=='running')throw Error(JSON.stringify(result));
  await writeFile(new URL('../../artifacts/pipeline/rain-audio-fix/verification.json',import.meta.url),JSON.stringify({results},null,2)+'\n');
  console.log(JSON.stringify(results,null,2));
}finally{await browser.close();}

import{chromium}from'../../../../tools/shot/node_modules/playwright/index.mjs';
import{readFile,writeFile}from'node:fs/promises';
const root=new URL('./',import.meta.url),rows=JSON.parse(await readFile(new URL('clip-coverage.json',root)));
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});const results=[];
for(const row of rows.filter(r=>r.error)){
 const page=await browser.newPage({viewport:{width:1120,height:1300}});const result={index:row.index,title:row.title,src:row.src,samples:[],method:'real-time playback, chronological screenshots; visual inspection remains sampled'};
 try{
 await page.setContent('<body style="margin:0;background:#203036;color:white;font:15px sans-serif"><h3></h3><video muted playsinline preload="auto" style="width:280px;height:280px"></video><div id="grid" style="display:grid;grid-template-columns:repeat(4,280px)"></div></body>');
 await page.evaluate(row=>{document.querySelector('h3').textContent=row.title;document.querySelector('video').src=row.src;},row);
 await page.waitForFunction(()=>document.querySelector('video').readyState>=2,null,{timeout:15000});
 await page.evaluate(async()=>{
 const v=document.querySelector('video');await v.play();
 window.recorded=[];window.capture=()=>{const c=document.createElement('canvas');c.width=c.height=280;c.getContext('2d').drawImage(v,0,0,280,280);const box=document.createElement('div');box.append(c);const label=document.createElement('div');label.textContent=v.currentTime.toFixed(2)+'s';box.append(label);document.querySelector('#grid').append(box);window.recorded.push(v.currentTime);};
 window.capture();window.timer=setInterval(()=>{if(!v.paused&&!v.ended)window.capture();},Math.max(350,v.duration*1000/15));
 v.onended=()=>{clearInterval(window.timer);window.capture();};
 });
 await page.waitForFunction(()=>document.querySelector('video').ended,null,{timeout:Math.ceil(row.duration*1000)+30000});
 result.samples=await page.evaluate(()=>window.recorded);result.ended=true;
 result.sheet='play-'+row.index+'.png';await page.locator('video').evaluate(v=>v.style.display='none');await page.screenshot({path:new URL(result.sheet,root).pathname,fullPage:true});
 }catch(e){result.error=String(e).slice(0,350);result.samples=await page.evaluate(()=>window.recorded||[]).catch(()=>[]);}
 results.push(result);await writeFile(new URL('playback-coverage.json',root),JSON.stringify(results,null,2));console.log(JSON.stringify(result));await page.close();
}
await browser.close();

import{chromium}from'../../../../tools/shot/node_modules/playwright/index.mjs';
import{readFile,writeFile}from'node:fs/promises';
const root=new URL('./',import.meta.url);
const items=JSON.parse(await readFile(new URL('../oskar-engine/public-media.json',root)));
items.push({title:'Tree octagonal impostors 2024',src:'https://video.twimg.com/tweet_video/Gap76B5XIAAVvHG.mp4',sourcePage:'https://x.com/OskSta/status/1849427564034498642'});
items.push({title:'Contrast texture 2022',src:'https://video.twimg.com/tweet_video/FJJYfP-WUAYsoWb.mp4',sourcePage:'https://x.com/OskSta/status/1482346496460828674'});
items.push({title:'Cloud impostors 2024',src:'https://video.twimg.com/tweet_video/GbTQVr6WsAAV6sA.mp4',sourcePage:'https://x.com/OskSta/status/1852334860137849222'});
const browser=await chromium.launch({channel:'chrome',headless:true});const results=[];
for(let i=0;i<items.length;i++){
 const item=items[i], page=await browser.newPage({viewport:{width:1120,height:1220}});
 const row={index:i,title:item.title,src:item.src,sourcePage:item.sourcePage,inspection:'pending',samples:[]};
 try{
 await page.setContent('<body style="margin:0;background:#203036;color:white;font:16px sans-serif"><h3></h3><video muted playsinline preload="auto" style="position:absolute;left:-1000px;width:640px;height:640px"></video><div id="grid" style="display:grid;grid-template-columns:repeat(4,280px)"></div></body>');
 await page.evaluate(item=>{document.querySelector('h3').textContent=item.title;document.querySelector('video').src=item.src;},item);
 await page.waitForFunction(()=>document.querySelector('video').readyState>=2,null,{timeout:12000});
 row.duration=await page.evaluate(()=>document.querySelector('video').duration);
 for(let j=0;j<16;j++){
 const t=Math.min(row.duration-.04,.03+j*(row.duration-.07)/15);
 await page.evaluate(t=>new Promise((resolve,reject)=>{const v=document.querySelector('video');const timer=setTimeout(()=>reject(Error('seek timeout')),6000);v.pause();v.addEventListener('seeked',()=>{clearTimeout(timer);resolve();},{once:true});v.currentTime=t;}),t);
 await page.evaluate(t=>{const v=document.querySelector('video'),box=document.createElement('div'),c=document.createElement('canvas');c.width=c.height=280;c.getContext('2d').drawImage(v,0,0,280,280);box.append(c);const label=document.createElement('div');label.textContent=t.toFixed(2)+'s';box.append(label);document.querySelector('#grid').append(box);},t);
 row.samples.push(t);
 }
 row.sheet='clip-'+i+'.png';await page.screenshot({path:new URL(row.sheet,root).pathname,fullPage:true});row.inspection='16 chronological samples captured; requires model visual inspection; not continuous viewing';
 }catch(e){row.error=String(e).slice(0,350);}
 results.push(row);await writeFile(new URL('clip-coverage.json',root),JSON.stringify(results,null,2));console.log(JSON.stringify({index:i,title:row.title,duration:row.duration,samples:row.samples.length,error:row.error}));await page.close();
}
await browser.close();

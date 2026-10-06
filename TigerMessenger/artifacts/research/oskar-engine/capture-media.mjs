import{chromium}from'../../../../tools/shot/node_modules/playwright/index.mjs';import{readFileSync,writeFileSync}from'node:fs';
const root=new URL('./',import.meta.url).pathname,items=JSON.parse(readFileSync(root+'public-media.json'));
const b=await chromium.launch({channel:'chrome',headless:true});const p=await b.newPage({viewport:{width:720,height:720}});
for(let i=0;i<items.length;i++){
 const row=items[i];row.frames=[];
 try{await p.setContent('<body style="margin:0;background:#243536"><video muted playsinline style="width:700px;height:700px;object-fit:contain" preload="auto"></video>');await p.evaluate(src=>{document.querySelector('video').src=src;},row.src);
 await p.waitForFunction(()=>document.querySelector('video').readyState>=2,null,{timeout:15000});row.duration=await p.evaluate(()=>document.querySelector('video').duration);
 for(let j=0;j<4;j++){const t=row.duration*(.05+.23*j);await p.evaluate(t=>new Promise((resolve,reject)=>{const v=document.querySelector('video'),timer=setTimeout(()=>reject(Error('seek timeout')),5000);v.addEventListener('seeked',()=>{clearTimeout(timer);resolve()},{once:true});v.currentTime=t;}),t);await p.waitForTimeout(200);const file=`video-${i}-frame-${j}.png`;await p.locator('video').screenshot({path:root+file});row.frames.push({t,file});}delete row.error;
 }catch(e){row.error=e.message.slice(0,200)}writeFileSync(root+'public-media.json',JSON.stringify(items,null,2));console.log(JSON.stringify({i,frames:row.frames.length,error:row.error}));
}await b.close();

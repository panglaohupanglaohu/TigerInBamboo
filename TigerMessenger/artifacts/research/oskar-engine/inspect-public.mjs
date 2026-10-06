import{chromium}from'../../../../tools/shot/node_modules/playwright/index.mjs';
import{writeFileSync}from'node:fs';
const root=new URL('./',import.meta.url).pathname;
const b=await chromium.launch({channel:'chrome',headless:true});const p=await b.newPage({viewport:{width:1100,height:900}});
const manifest=[];
for(const id of ['1590669875869286400','1670790425232175108']){
 await p.goto('https://threadreaderapp.com/thread/'+id+'.html',{waitUntil:'domcontentloaded',timeout:30000});
 const videos=p.locator('video');const count=await videos.count();
 for(let i=0;i<count;i++){
  const v=videos.nth(i);const info=await v.evaluate(v=>({src:v.currentSrc,poster:v.poster,context:v.parentElement.parentElement.innerText.slice(0,1400)}));
  if(manifest.some(m=>m.src===info.src))continue;
  const row={id,index:i,...info,frames:[]};
  try{await v.evaluate(v=>{v.style.width='700px';v.style.height='700px';v.style.maxWidth='none';v.controls=false;});await v.scrollIntoViewIfNeeded();await p.waitForTimeout(1000);await v.evaluate(async v=>{v.muted=true;v.preload='auto';try{await v.play()}catch{};});await p.waitForTimeout(1500);row.duration=await v.evaluate(v=>v.duration);
   if(!Number.isFinite(row.duration))throw Error('duration unavailable');
   for(let j=0;j<4;j++){const t=row.duration*(.05+.23*j);await v.evaluate((v,t)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('seek timeout')),5000);v.pause();v.addEventListener('seeked',()=>{clearTimeout(timer);resolve();},{once:true});v.currentTime=t;}),t);await p.waitForTimeout(250);const name='video-'+manifest.length+'-frame-'+j+'.png';await v.screenshot({path:root+name,timeout:10000});row.frames.push({t,file:name});}
  }catch(e){row.error=e.message;}
  manifest.push(row);writeFileSync(root+'public-media.json',JSON.stringify(manifest,null,2));console.log(JSON.stringify({index:manifest.length-1,frames:row.frames.length,error:row.error,context:row.context.slice(0,160)}));
 }
}
await b.close();

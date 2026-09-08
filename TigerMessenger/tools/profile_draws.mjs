import { chromium } from '../../tools/shot/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.TM_TEST_URL || 'http://127.0.0.1:8765/TigerMessenger/';
await mkdir(new URL('../test-results/', import.meta.url), { recursive: true });
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1000,height:700}});
 await page.goto(`${base}?autostart=1`,{timeout:120000});
 await page.waitForFunction(()=>window.__tm,null,{timeout:120000});
 const rows=await page.evaluate(async()=>{
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  const counts=new Map(), saved=[];
  __tm.scene.traverse(o=>{
   if(!o.isMesh)return;
   let p=o;const path=[];while(p&&p!==__tm.scene){path.unshift(p.name||p.type);p=p.parent;}
   const key=path.slice(0,2).join('/');
   const before=o.onBeforeRender,shadow=o.onBeforeShadow;
   saved.push([o,before,shadow]);
   const row=counts.get(key)||{path:key,draws:0,shadows:0};counts.set(key,row);
   o.onBeforeRender=function(...a){row.draws++;before?.apply(this,a)};
   o.onBeforeShadow=function(...a){row.shadows++;shadow?.apply(this,a)};
  });
  await new Promise(r=>requestAnimationFrame(r));
  saved.forEach(([o,b,s])=>{o.onBeforeRender=b;o.onBeforeShadow=s});
  return {perf:__tm.perfProbe.snapshot(),rows:[...counts.values()].filter(r=>r.draws||r.shadows).sort((a,b)=>(b.draws+b.shadows)-(a.draws+a.shadows)).slice(0,35)};
 });
 await writeFile(new URL('../test-results/draw-profile.json',import.meta.url),JSON.stringify(rows,null,2));
 console.log(JSON.stringify(rows));
}finally{await browser.close()}

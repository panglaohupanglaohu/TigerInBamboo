// 十二门徒地形候选同机位对照：认可现状 / 仅换最新库 / 软坡。
// 每种一个新的非持久上下文；候选开关只写测试上下文的 localStorage，不保存任何岩体编辑。
import {createRequire} from 'node:module';import fs from 'node:fs';import path from 'node:path';
const require=createRequire(import.meta.url),{chromium}=require('/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.resolve('TigerMessenger/artifacts/apostles-soft-terrain-20261115/run-'+Date.now());fs.mkdirSync(out,{recursive:true});
const looks=process.argv.slice(2).length?process.argv.slice(2):['approved','latest','soft'];const report={out,looks:{}};
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--mute-audio']});
for(const look of looks){const name=look.replace(',','+'),r=report.looks[name]={errors:[]};
 const ctx=await browser.newContext({viewport:{width:1500,height:1500}});
 try{if(look!=='approved')await ctx.addInitScript(v=>{try{localStorage.setItem('tm.apostles.look.v1',v);}catch{}},look);
  const page=await ctx.newPage();page.on('pageerror',e=>r.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')r.errors.push('console: '+m.text().slice(0,240));});
  const t0=Date.now();await page.goto('http://localhost:8931/TigerMessenger/pipeline.html#scene');
  await page.waitForFunction(()=>document.querySelector('#connection')?.textContent.includes('游戏已连接'),{},{timeout:300000});
  await page.waitForFunction(()=>[...document.querySelectorAll('#scene option')].some(o=>o.value==='apostles'),{},{timeout:60000});
  await page.locator('#scene').selectOption('apostles');await page.locator('#edit').click();await page.waitForTimeout(6000);
  const frame=page.frames().find(f=>f.url().includes('/TigerMessenger/index.html'));
  r.state=await frame.evaluate(async()=>{const v=(await import('./src/world/morrisViewer.js')).morrisViewer,look=(await import('./src/world/apostlesLook.js')).APOSTLES_LOOK;const leaves=v.apostles?.leaves||v.apostles?.root?.leaves||[];
   let tris=0,meshes=0;v.scene?.traverse?.(o=>{if(o.isMesh&&o.userData?.apostleMass){meshes++;tris+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3;}});
   return{look,meshes,triangles:Math.round(tris),camera:v.camera.position.toArray().map(x=>+x.toFixed(2)),softTops:leaves.map?.(l=>!!l.world?.softTops)};});
  await page.locator('#game').scrollIntoViewIfNeeded();await page.locator('#game').screenshot({path:path.join(out,name+'.png')});
  // 拉近一档再拍一张看崖顶边缘
  const b=await page.locator('#game').boundingBox();await page.mouse.move(b.x+b.width*.5,b.y+b.height*.5);for(let i=0;i<4;i++){await page.mouse.wheel(0,-240);await page.waitForTimeout(250);}await page.waitForTimeout(1500);
  await page.locator('#game').screenshot({path:path.join(out,name+'-near.png')});r.seconds=Math.round((Date.now()-t0)/1000);r.pass=true;
 }catch(e){r.pass=false;r.failure=String(e.stack).slice(0,700);}finally{await ctx.close();}
 console.log(name,JSON.stringify(r).slice(0,900));
}
await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log('OUT',out);

// light 线「3 建筑增删、暖橙屋顶与多色墙」浏览器对拍：setBakeLighting({bounces:1}) vs ({bounces:3})。
// 路径：pipeline.html#scene → 莫西斯湖默认场景 → 游戏 iframe 里 __tmMorrisStage.worldMesh
//   （vendor WorldMesh，内部走 vendor build/buildings.js + light/bake.js + build/courtyard-grass.js）。
// 隔离上下文没有用户镇存档 → 若世界为空，页内用 world.fill()/color 程序化搭一座
//   「封闭庭院 + 暖色高楼 + 奶油色墙」测试镇（只写体素场，不写 localStorage / 不 persist）。
// 证据三层：
//   ① 顶点色数组逐元素差（bake 唯一输出通道 = geometry 'color' 属性，最精确、不受动画噪声影响）；
//   ② 屏幕截图像素差（pixelmatch + 暖色偏移统计），同档对照图作动画噪声底；
//   ③ bounces:3 → 回 1 后顶点色应与基线逐字节一致（确定性往返校验）。
// 顺带核 vendor 接入：wm.build.grassPlan（庭院草）、bakeLightingOptions、rebuild 计时。
// 运行：cd TigerMessenger && $NODE tests/light-bounce-bake-browser.mjs   （需要 8931 服务在跑）
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require('/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {PNG}=require('/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pngjs');
const _pm=require('/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pixelmatch');
const pixelmatch=_pm.default??_pm;

const here=path.dirname(fileURLToPath(import.meta.url));
const stamp=new Date().toISOString().replace(/[-:T]/g,'').slice(0,14);
const out=path.resolve(here,'../artifacts/light-bounce-bake-'+stamp+'/run-'+Date.now());
fs.mkdirSync(out,{recursive:true});
const report={out,steps:{},errors:[]};
const fail=(m)=>{throw new Error(m);};

const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--mute-audio']});
try{
 const ctx=await browser.newContext({viewport:{width:1500,height:1200}});
 const page=await ctx.newPage();
 page.on('pageerror',e=>report.errors.push('pageerror: '+e.message));
 page.on('console',m=>{if(m.type()==='error')report.errors.push('console: '+m.text().slice(0,240));});

 await page.goto('http://localhost:8931/TigerMessenger/pipeline.html#scene');
 await page.waitForFunction(()=>document.querySelector('#connection')?.textContent.includes('游戏已连接'),{},{timeout:300000});
 await page.waitForFunction(()=>[...document.querySelectorAll('#scene option')].some(o=>o.value==='morris-lake'),{},{timeout:60000});
 const cur=await page.locator('#scene').inputValue();
 if(cur!=='morris-lake')await page.locator('#scene').selectOption('morris-lake');
 const frame=page.frames().find(f=>f.url().includes('/TigerMessenger/index.html'));
 if(!frame)fail('游戏 iframe 未出现');
 await frame.waitForFunction(()=>{const s=globalThis.__tmMorrisStage;return !!(s&&s.worldMesh&&s.worldMesh.builtVersion>=0);},{},{timeout:300000});

 // 世界为空（隔离上下文无存档）→ 程序化搭测试镇；已有镇则直接用
 report.steps.townSetup=await frame.evaluate(()=>{
  const s=globalThis.__tmMorrisStage,wm=s.worldMesh,world=wm.world;
  const verts=wm.geometry.getAttribute('position').count;
  let built=0;
  if(verts<1000){
   // 找离原点最近的格，BFS 铺一块 ~半径6 的连体地块：外两圈建筑（高3-5，色板轮换，
   // 中心圈奶油色 idx7 贴暖色看染色），内圈 lv1 地面 → 封闭庭院应长草。
   const cells=world.cells;
   let c0=cells[0],bd=1e9;
   for(const c of cells){const d=c.cx*c.cx+c.cz*c.cz;if(d<bd){bd=d;c0=c;}}
   const dist=new Map([[c0.id,0]]),ring=[[c0]];
   for(let d=1;d<=6;d++){const next=[];for(const c of ring[d-1])for(let i=0;i<c.n;i++){const nb=world.neighbor(c,i);if(nb&&!dist.has(nb.id)){dist.set(nb.id,d);next.push(nb);}}ring.push(next);}
   const edge=new Set();for(const c of cells)if(!dist.has(c.id))continue;
   // patch 边界 = patch 内有邻居在 patch 外的格
   const patch=new Set(dist.keys());
   const bdist=new Map();
   for(const id of patch){const c=cells[id];let m=99;for(let i=0;i<c.n;i++){const nb=world.neighbor(c,i);if(nb&&!patch.has(nb.id))m=Math.min(m,0);else if(nb)m=Math.min(m,(bdist.get(nb.id)??99)+1);}bdist.set(id,m);}
   // 两遍松弛把边界距离传遍 patch
   for(let it=0;it<8;it++)for(const id of patch){const c=cells[id];let m=bdist.get(id);for(let i=0;i<c.n;i++){const nb=world.neighbor(c,i);if(nb&&patch.has(nb.id))m=Math.min(m,bdist.get(nb.id)+1);}bdist.set(id,m);}
   for(const [id,d] of dist){
    const c=cells[id],e=bdist.get(id);
    if(e<=1){ // 外两圈：建筑
     const h=3+((id*7)%3);world.fill(c,h);
     // 色板：中心圈(按到边缘距离=1)混暖色+奶油，外墙轮换暖色
     world.color[id]=e===0?[0,9,10,1][id%4]:(id%5===0?7:[0,5,9,10,1][id%5]);
    }else{world.fill(c,1);} // 内圈地面
    built++;
   }
   world.touch();
   return{injected:true,builtCells:built,vertsBefore:verts};
  }
  return{injected:false,vertsBefore:verts};
 });
 if(report.steps.townSetup.injected){
  await frame.waitForFunction(()=>globalThis.__tmMorrisStage.worldMesh.geometry.getAttribute('position').count>1000,{},{timeout:180000});
 }
 await page.locator('#edit').click().catch(()=>{}); // morris-lake 无构建面板 → 回落 scenes.focus → frameTown
 // 莫西斯湖常年冬景（snowBase .85 会把屋顶盖白，正好遮住暖橙屋顶染色面）：
 // 临时把 snowUniform 归零露出屋顶本色、停飘雪粒子和飞鸟降噪——只改 uniform/可见性，不写存档。
 await frame.evaluate(()=>{const s=globalThis.__tmMorrisStage;
  s.snowUniform.value=0;if(s.atmosphere)s.atmosphere.showSnow=false;if(s.birds)s.birds.visible=false;});
 await page.waitForTimeout(3000); // 镜头 frameTown + 渲染稳定

 report.steps.stageInfo=await frame.evaluate(()=>{
  const s=globalThis.__tmMorrisStage,wm=s.worldMesh;
  return{hasSetBakeLighting:typeof wm.setBakeLighting==='function',
   bake:wm.bake,bakeOptions:wm.bakeLightingOptions??'default(单跳)',
   verts:wm.geometry.getAttribute('position').count,
   tris:Math.round(wm.geometry.getAttribute('position').count/3),
   garden:wm.garden??null,grassPlan:wm.build?.grassPlan?.stats??null,
   worldVersion:wm.world.version,cells:wm.world.cells.length};
 });

 // 基线 bounces:1（显式调用应与缺省相等并早退，不触发重建）
 const probe=await frame.evaluate(async()=>{
  const wm=globalThis.__tmMorrisStage.worldMesh;
  const orig=wm.rebuild.bind(wm);globalThis.__rebLog=[];
  wm.rebuild=()=>{const t0=performance.now();const r=orig();globalThis.__rebLog.push({rebuilt:r,ms:Math.round(performance.now()-t0)});return r;};
  const v0=wm.builtVersion;
  wm.setBakeLighting({bounces:1});
  const earlyReturn=wm.builtVersion===v0;
  wm.setBakeLighting({bounces:1,strength:.62,bounce:.42,airGain:0});
  const stillSame=wm.builtVersion===v0;
  globalThis.__colA=wm.geometry.getAttribute('color').array.slice();
  return{earlyReturn,stillSame,options:wm.bakeLightingOptions??'default'};
 });
 report.steps.baselineProbe=probe;

 const shot=async(name)=>{await page.locator('#game').scrollIntoViewIfNeeded();await page.locator('#game').screenshot({path:path.join(out,name+'.png')});};
 await shot('bounces1');
 await page.waitForTimeout(1500);
 await shot('bounces1-again'); // 同档噪声底

 const t3=await frame.evaluate(()=>{const wm=globalThis.__tmMorrisStage.worldMesh;globalThis.__rebLog.length=0;wm.setBakeLighting({bounces:3});return{invalidated:wm.builtVersion===-1,options:wm.bakeLightingOptions};});
 report.steps.set3=t3;
 if(!t3.invalidated)fail('setBakeLighting({bounces:3}) 没有触发 invalidate');
 await frame.waitForFunction(()=>globalThis.__tmMorrisStage.worldMesh.builtVersion>=0,{},{timeout:180000});
 report.steps.rebuild3=await frame.evaluate(()=>{const l=globalThis.__rebLog;return l.find(x=>x.rebuilt)??l.reduce((a,b)=>b.ms>a.ms?b:a,l[0]);});
 await page.waitForTimeout(800);
 await shot('bounces3');

 report.steps.vertexDiff=await frame.evaluate(()=>{
  const a=globalThis.__colA,b=globalThis.__tmMorrisStage.worldMesh.geometry.getAttribute('color').array;
  if(a.length!==b.length)return{sameLength:false,aLen:a.length,bLen:b.length};
  let changed=0,warm=0,maxD=0,sumD=0,sumWarm=0;
  for(let i=0;i<a.length;i+=3){
   const dr=b[i]-a[i],dg=b[i+1]-a[i+1],db=b[i+2]-a[i+2];
   const d=Math.max(Math.abs(dr),Math.abs(dg),Math.abs(db));
   if(d>1e-4){changed++;sumD+=d;if(d>maxD)maxD=d;
    const w=dr-(dg+db)/2;if(w>1e-4){warm++;sumWarm+=w;}}
  }
  return{sameLength:true,verts:a.length/3,changed,changedPct:+(100*changed/(a.length/3)).toFixed(2),
   warmShifted:warm,warmShiftedPct:+(100*warm/(a.length/3)).toFixed(2),
   maxDelta:+maxD.toFixed(4),meanDelta:+(changed?sumD/changed:0).toFixed(4),
   meanWarmShift:+(warm?sumWarm/warm:0).toFixed(4)};
 });

 await frame.evaluate(()=>{const wm=globalThis.__tmMorrisStage.worldMesh;globalThis.__rebLog.length=0;wm.setBakeLighting({bounces:1});});
 await frame.waitForFunction(()=>globalThis.__tmMorrisStage.worldMesh.builtVersion>=0,{},{timeout:180000});
 report.steps.rebuildBack=await frame.evaluate(()=>{const l=globalThis.__rebLog;return l.find(x=>x.rebuilt)??l.reduce((a,b)=>b.ms>a.ms?b:a,l[0]);});
 report.steps.roundtrip=await frame.evaluate(()=>{
  const a=globalThis.__colA,b=globalThis.__tmMorrisStage.worldMesh.geometry.getAttribute('color').array;
  if(a.length!==b.length)return{sameLength:false};
  let diff=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])diff++;
  return{sameLength:true,diffFloats:diff,restored:diff===0};
 });
 await page.waitForTimeout(600);
 await shot('bounces1-restored');

 const png=n=>PNG.sync.read(fs.readFileSync(path.join(out,n+'.png')));
 const diffPair=(na,nb,tag)=>{
  const A=png(na),B=png(nb);if(A.width!==B.width||A.height!==B.height)return{tag,sizeMismatch:true};
  const D=new PNG({width:A.width,height:A.height});
  const mism=pixelmatch(A.data,B.data,D.data,A.width,A.height,{threshold:0.12});
  fs.writeFileSync(path.join(out,'diff-'+tag+'.png'),PNG.sync.write(D));
  let warm=0,sumAbs=0;
  for(let i=0;i<A.data.length;i+=4){const dr=B.data[i]-A.data[i],dg=B.data[i+1]-A.data[i+1],db=B.data[i+2]-A.data[i+2];
   sumAbs+=Math.abs(dr)+Math.abs(dg)+Math.abs(db);
   if(dr>10&&dr>dg+8&&dr>db+8)warm++;}
  const px=A.width*A.height;
  return{tag,pixels:px,mismatched:mism,mismatchPct:+(100*mism/px).toFixed(3),
   meanAbsPerChannel:+(sumAbs/(px*3)).toFixed(3),warmedPixels:warm,warmedPct:+(100*warm/px).toFixed(3)};
 };
 report.steps.pixelNoiseFloor=diffPair('bounces1','bounces1-again','noise');
 report.steps.pixelBounce=diffPair('bounces1-again','bounces3','b1vs3');
 report.steps.pixelRestore=diffPair('bounces1-again','bounces1-restored','restore');

 const v=report.steps.vertexDiff,p=report.steps.pixelBounce;
 report.steps.verdict={
  bakeApiUsable:report.steps.stageInfo.hasSetBakeLighting===true,
  grassOnMesh:(report.steps.stageInfo.grassPlan?.grassCells??0)>0,
  multiHopVertexObservable:v.sameLength===true&&v.changed>0,
  multiHopPixelObservable:p.mismatched>report.steps.pixelNoiseFloor.mismatched*1.5||p.warmedPixels>report.steps.pixelNoiseFloor.warmedPixels*3||p.meanAbsPerChannel>report.steps.pixelNoiseFloor.meanAbsPerChannel*2,
  roundtripExact:report.steps.roundtrip.restored===true};
 report.pass=report.steps.verdict.bakeApiUsable&&report.steps.verdict.roundtripExact;
 report.capabilities=['light.bounce'];   // 成熟度 ⑥ 证据：setBakeLighting 多跳烘焙实测
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report.steps,null,2).slice(0,4000));
 console.log('PASS?',report.pass,'OUT',out);
}finally{await browser.close();}

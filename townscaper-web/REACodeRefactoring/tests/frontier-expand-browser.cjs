/* 1582293326815862786 ·「只在坍缩边缘评估候选 → 增量放置 → 简化导航图扩展并互连」
   真页面（wfc.html?expand=1）/ 真像素；对照 = 关掉双锋面（单锋面最小候选优先）。
   判据全部来自页面读数与 canvas 像素，不读日志。 */
const {chromium}=require('playwright'),fs=require('fs'),assert=require('node:assert/strict');
const S=(a,b)=>a+'/'+b;
(async()=>{
const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,
  args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const p=await b.newPage({viewport:{width:1200,height:1000}}),errors=[];
p.on('pageerror',e=>errors.push('pageerror:'+e.message));
p.on('console',m=>{if(m.type()==='error')errors.push('console:'+m.text())});
const count=`(()=>{const d=document.querySelector('canvas').getContext('2d').getImageData(0,0,1000,650).data;let y=0,g=0;
  for(let i=0;i<d.length;i+=4){const r=d[i],gg=d[i+1],bb=d[i+2];
   if(Math.hypot(r-188,gg-188,bb-108)<50)y++;else if(Math.hypot(r-74,gg-203,bb-121)<50)g++;}
  return{y,g};})()`;
try{
 await p.goto('http://127.0.0.1:8769/wfc.html?expand=1&mixed=1&nav=1',{waitUntil:'load'});
 await p.waitForFunction(()=>window.frontierExpand,{timeout:30000});
 // ---- 1) 增量放置与计数守恒（混合网格）
 const m=await p.evaluate(()=>{const E=window.frontierExpand;return{cells:E.cells,placed:E.result.stats.placed,dead:E.result.dead.length,
  total:E.result.order.length,comp:E.result.components,nav:E.result.nav.length,drawn:E.drawn,navEdgesSum:E.drawn.navEdges,
  width:E.width,meanCand:+E.result.stats.meanCandidates.toFixed(2),tests:E.result.stats.tests,naive:E.result.stats.naiveTests,
  mergeAt:E.mergeAt,seedIds:E.seedIds,seedHops:E.seedHops,catalog:E.result.stats.placed?24:24,complete:E.result.complete}});
 assert.equal(m.cells,147);assert(m.complete);
 assert.equal(m.placed+2+m.dead,m.cells,'每个格不是被放置就是死格');
 assert.deepEqual(m.comp,[147],'最终只剩一个连通块');
 assert.equal(m.navEdgesSum,m.nav,'页面重算的导航边数 == 模块导航边数');
 // 只在坍缩边缘：每步要看的格数（未放格中与已放格相邻者）远小于剩余未放格
 assert(m.width.mean<m.width.openMean*0.3,`每步只看 ${m.width.mean} 格 vs 剩余 ${m.width.openMean}`);
 assert(m.width.max<m.width.openMean);
 assert(m.meanCand<m.catalog*0.25,`每格可行候选 ${m.meanCand} 远小于目录 ${m.catalog}`);
 // ---- 2) 逐步回放：候选数用 frontierCandidates 在同一状态重算，必须与增量台账逐位一致
 const rep=await p.evaluate(()=>{const E=window.frontierExpand,out=[];
  for(const k of [1,5,20,40,60,80,100,120]){const r=E.replay(k);const nxt=E.result.order[k];
   out.push({k,rows:r.rows.length,frontier:r.frontier.length,
     cands:nxt&&nxt.candidates!==null?nxt.candidates:null,
     recomputed:nxt?r.rows.find(x=>x.cell===nxt.cell)?.candidates.length??null:null});}
  return out;});
 for(const r of rep){assert.equal(r.rows,r.frontier,'待评估格数 == 坍缩边缘格数');
  if(r.cands!==null){assert.equal(r.recomputed,r.cands,`第${r.k}步候选数可被只读探针复现`);}}
 // ---- 3) 两条锋面：中段两组人数接近，末段并成一组（原片「绿→黄」）
 const g=await p.evaluate(()=>{const E=window.frontierExpand,o={};
  for(const f of [0.25,0.5,0.75])o[f]=E.groups(Math.round(E.steps*f));
  o.merge=E.groups(E.mergeAt-1);o.after=E.groups(E.mergeAt);return o;});
 for(const f of ['0.25','0.5','0.75']){const v=g[f];assert(v[0]>0&&v[1]>0,`${f} 步两组都在长`);assert(Math.abs(v[0]-v[1])<=Math.max(2,v[0]*0.12),`${f} 步两组人数接近`);}
 assert(g.merge[1]>0&&!g.after[1],'合并前第二组还存在，合并后归零');
 // ---- 4) 像素：黄（第一组）单调增，绿（第二组）先增后归零，总墨量单调增
 const px=await p.evaluate(cnt=>{const E=window.frontierExpand,out=[];
  for(const f of [0.1,0.25,0.4,0.6,0.8,0.9,1]){E.draw(Math.round(E.steps*f));out.push([f,eval(cnt)]);}
  return out;},count);
 for(let i=1;i<px.length;i++){assert(px[i][1].y>=px[i-1][1].y,`黄色墨量单调不减（第${i}档）`);assert(px[i][1].y+px[i][1].g>px[i-1][1].y+px[i-1][1].g);}
 assert(px[3][1].g>500,'60% 处第二组有真实绿色线');assert.equal(px.at(-1)[1].g,0,'收尾时第二组颜色已并入第一组');
 await p.evaluate(()=>window.frontierExpand.draw(Math.round(window.frontierExpand.steps*0.6)));
 await p.locator('canvas').screenshot({path:'artifacts/coverage/frontier-expand-r141-twofronts-60.png'});
 await p.evaluate(()=>window.frontierExpand.draw(Math.round(window.frontierExpand.steps*0.9)));
 await p.locator('canvas').screenshot({path:'artifacts/coverage/frontier-expand-r141-twofronts-merge-before.png'});
 await p.evaluate(()=>window.frontierExpand.draw(window.frontierExpand.steps));
 await p.locator('canvas').screenshot({path:'artifacts/coverage/frontier-expand-r141-full.png'});
 // ---- 5) 反向对照：关掉双锋面 → 第二组在 50% 处仍只有 1 格、绿色线为 0（证明交替驱动才是「两条锋面」）
 const one=await p.evaluate(()=>{const E=window.frontierExpand,keep=E.groups(Math.round(E.steps*0.5));
  return{keep,mergeAt:E.mergeAt};});
 await p.evaluate(()=>{document.querySelector('#twofronts').checked=false;document.querySelector('#expand').click();});
 await p.waitForFunction(()=>window.frontierExpand&&!window.frontierExpand.twoFronts,{timeout:30000});
 const single=await p.evaluate(()=>{const E=window.frontierExpand;E.draw(Math.round(E.steps*0.5));
  const d=document.querySelector('canvas').getContext('2d').getImageData(0,0,1000,650).data;let g=0;
  for(let i=0;i<d.length;i+=4)if(Math.hypot(d[i]-74,d[i+1]-203,d[i+2]-121)<50)g++;
  return{groups:E.groups(Math.round(E.steps*0.5)),green:g,mergeAt:E.mergeAt,placed:E.result.stats.placed,nav:E.result.nav.length};});
 assert(one.keep[1]>=one.keep[0]*0.6,'双锋面时两组人数相当');
 assert.equal(single.groups[1],1,'单锋面时第二粒种子在 50% 处仍孤立');
 assert.equal(single.green,0,'单锋面时 50% 处没有绿色线');
 assert.notEqual(single.mergeAt,one.mergeAt,'两种推进顺序给出不同的互连点（单锋面 116 / 双锋面 133）');
 await p.locator('canvas').screenshot({path:'artifacts/coverage/frontier-expand-r141-singlefront-50.png'});
 // ---- 6) 四边网格同口径
 await p.evaluate(()=>{document.querySelector('#twofronts').checked=true;document.querySelector('#mixed').checked=false;document.querySelector('#expand').click();});
 await p.waitForFunction(()=>window.frontierExpand&&window.frontierExpand.grid==='quad',{timeout:30000});
 const q=await p.evaluate(()=>{const E=window.frontierExpand;return{cells:E.cells,placed:E.result.stats.placed,dead:E.result.dead.length,
  comp:E.result.components,nav:E.result.nav.length,edges:E.drawn.navEdges,mergeAt:E.mergeAt,width:E.width,groups:E.groups(Math.round(E.steps*0.5))}});
 assert.equal(q.cells,206);assert.equal(q.placed+2+q.dead,q.cells);assert.deepEqual(q.comp,[206]);
 assert.equal(q.edges,q.nav);assert(q.groups[0]>0&&q.groups[1]>0);assert(q.width.mean<q.width.openMean*0.35);
 await p.locator('canvas').screenshot({path:'artifacts/coverage/frontier-expand-r141-quad.png'});
 if(errors.length)throw new Error(errors.join('\n'));
 const reports={mixed:m,replay:rep,groups:g,pixels:px,control:{twoFrontsAt50:one.keep,mergeAt:one.mergeAt,singleFront:single},quad:q,errors};
 fs.writeFileSync('artifacts/coverage/frontier-expand-r141-browser.json',JSON.stringify(reports,null,2));
 console.log('PASS 158229 增量扩边 + 两锋面 + 导航互连：',JSON.stringify({mixed:{cells:m.cells,placed:m.placed,dead:m.dead,nav:m.nav,mergeAt:m.mergeAt,width:m.width,meanCand:m.meanCand,groups:g},control:{two:one.keep,one:single.groups,green:single.green,mergeAt:single.mergeAt},quad:{cells:q.cells,placed:q.placed,nav:q.nav,mergeAt:q.mergeAt,groups:q.groups},pixels:px.map(x=>[x[0],x[1].y,x[1].g])}));
}finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1)});

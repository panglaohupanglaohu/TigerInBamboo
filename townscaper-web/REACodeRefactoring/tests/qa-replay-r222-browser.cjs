// r222 浏览器验收：qa-replay.html 真实共享 World 页面，双网格 16 步回放逐步带
// 外露墙带采样覆盖 + 悬空体块支撑核查；页内再手工搭拱/平底钢柱配置核 kind 与支撑，
// 注入异常仍全量还原；控制台零 error。结果 artifacts/coverage/qa-replay-r222-browser.json。
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('fs');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});const reports=[],errors=[];try{for(const grid of ['mixed','quad']){const p=await b.newPage({viewport:{width:1440,height:1000}});p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!m.location().url.endsWith('/favicon.ico'))errors.push(m.text());});await p.goto('http://localhost:8769/qa-replay.html');if(grid==='quad')await p.selectOption('#grid',grid);await p.waitForFunction(()=>window.qaReplay?.api.gridKind===document.querySelector('#grid').value);const r=await p.evaluate(async()=>{
const {api}=qaReplay,{world,view}=api,base=world.snapshot(),palette=world.palette;
const same=()=>['solid','rock','color','river'].every(k=>base[k].every((v,i)=>v===world[k][i]))&&world.palette===palette;
const Q=await import('./src/core/qa-replay.js');
const result=await qaReplay.run();if(!same())throw Error('Successful replay changed snapshot');
const uncovered=result.steps.reduce((n,s)=>n+s.walls.uncovered.length,0),unsupported=result.steps.reduce((n,s)=>n+s.support.unsupported.length,0);
if(uncovered||unsupported)throw Error(`replay 漏面/失支撑 ${uncovered}/${unsupported}`);
const maxFaces=Math.max(...result.steps.map(s=>s.walls.faces)),maxFloating=Math.max(...result.steps.map(s=>s.support.floating));
// 手工拱/平底钢柱配置（quad 才有拱；mixed 全平底）
const cellById=id=>world.cells[id];let archSeen=0,flatSeen=0,supported=true;
const center=[...world.cells].sort((a,b)=>Math.hypot(a.cx,a.cz)-Math.hypot(b.cx,b.cz));
const c=center.find(x=>x.n===4&&x.edgeNeighbors.every(id=>id>=0&&world.top(world.cells[id])===0));
if(c){const i=[0,1].find(k=>c.edgeNeighbors[k]>=0&&c.edgeNeighbors[k+2]>=0);
  for(const k of[i,i+2])world.fill(world.cells[c.edgeNeighbors[k]],2);
  world.fill(c,1);world.setSolid(c,3,true);}
const d=center.find(x=>x!==c&&Math.hypot(x.cx-(c?.cx??0),x.cz-(c?.cz??0))>2&&x.edgeNeighbors.every(id=>id<0||world.top(world.cells[id])===0));
if(d)world.setSolid(d,4,true);
view.changed();view.render(0);
const L=view.worldMesh?.L??0.5,index=Q.triangleIndex(view.worldMesh.geometry);
const vox=Q.floatingVoxels(world,L),sup=Q.auditUndersideSupport(world,view.worldMesh.geometry,{L,index});
for(const v of vox){if(v.kind==='arch')archSeen++;else flatSeen++;}
if(!sup.valid)supported=false;
const wallsNow=Q.auditSurfaceCoverage(world,view.worldMesh.geometry,{L,index});
if(!wallsNow.valid)throw Error('手工配置墙带未覆盖 '+JSON.stringify(wallsNow.uncovered.slice(0,3)));
// 注入异常恢复（先还原手工配置，再验异常路径的 finally 还原）
world.restore(base);world.palette=palette;view.changed();view.render(0);
const {runWorldQA}=Q;let failureRestored=false;
try{await runWorldQA(api,{afterStep:()=>{throw Error('injected failure')}})}catch(e){if(e.message!=='injected failure')throw e;failureRestored=same();}
return{grid:api.gridKind,steps:result.steps.length,maxFaces,maxFloating,uncovered,unsupported,archSeen,flatSeen,supported,failureRestored,successRestored:same(),maxDegenerate:Math.max(...result.steps.map(x=>x.degenerateTriangles))};});assert.equal(r.steps,16);assert.ok(r.successRestored&&r.failureRestored);assert.ok(r.supported);assert.ok(r.flatSeen>=1);if(grid==='quad')assert.ok(r.archSeen>=1,'quad 应有拱例');await p.waitForTimeout(700);await p.screenshot({path:`artifacts/coverage/qa-replay-r222-${grid}.png`});reports.push(r);await p.close();}assert.deepEqual(errors,[]);fs.writeFileSync('artifacts/coverage/qa-replay-r222-browser.json',JSON.stringify({reports,errors},null,2));console.log('PASS',reports)}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
